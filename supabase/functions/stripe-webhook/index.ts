// =============================================================================
// STRIPE WEBHOOK — Supabase Edge Function
// =============================================================================
// Receives payment event notifications from Stripe. When a customer pays an
// invoice via card/SEPA/Bacs/iDEAL/etc., Stripe POSTs the event JSON here.
// We check if it's a payment_intent.succeeded event, extract the invoiceId
// from metadata, and update the invoice in the database.
// =============================================================================
// Stripe docs: https://docs.stripe.com/webhooks
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { dispatchPaidSideEffects } from '../_shared/paid-side-effects.ts';
import { claimWebhookEvent, redeemCredits, restoreCredits } from '../_shared/credit-redemption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// ---------------------------------------------------------------------------
// Stripe signature verification helpers
// ---------------------------------------------------------------------------

const SIGNATURE_TOLERANCE_SECONDS = 300; // 5 minutes

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    // Parse the signature header: t=timestamp,v1=signature[,v1=signature...]
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signatureParts = parts.filter((p) => p.startsWith('v1='));

    if (!timestampPart || signatureParts.length === 0) {
      console.error('Stripe signature header missing t= or v1= components');
      return false;
    }

    const timestamp = parseInt(timestampPart.slice(2), 10);
    if (isNaN(timestamp)) {
      console.error('Stripe signature has invalid timestamp');
      return false;
    }

    // Check timestamp tolerance to prevent replay attacks
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
      console.error(`Stripe signature timestamp too old: diff=${now - timestamp}s`);
      return false;
    }

    // Compute expected signature: HMAC-SHA256(timestamp + "." + payload)
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare against all provided v1 signatures (Stripe may send multiple during key rotation)
    return signatureParts.some((part) => {
      const sig = part.slice(3); // strip "v1="
      return sig === expectedSig;
    });
  } catch (err) {
    console.error('Stripe signature verification error:', String(err));
    return false;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Verify webhook signature and parse the body
    // -------------------------------------------------------------------------
    const rawBody = await req.text();

    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeWebhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response(JSON.stringify({ received: false, error: 'Server misconfigured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signatureHeader = req.headers.get('stripe-signature');
    if (!signatureHeader) {
      console.error('Missing stripe-signature header');
      return new Response(JSON.stringify({ received: false, error: 'Missing signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyStripeSignature(rawBody, signatureHeader, stripeWebhookSecret);
    if (!isValid) {
      console.error('Invalid Stripe webhook signature');
      return new Response(JSON.stringify({ received: false, error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(rawBody);

    if (!event || !event.type || !event.data?.object) {
      console.error('Invalid Stripe event payload');
      return new Response(JSON.stringify({ received: true, error: 'Invalid event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Stripe event: type=${event.type}, id=${event.id}`);

    const supabaseUrl0 = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey0 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // -------------------------------------------------------------------------
    // 2.0 invoice.upcoming → Option A: apply referral credits as a Stripe Coupon
    //     so the next charge is reduced by N whole months. Feature-flagged via
    //     STRIPE_COUPON_REDEMPTION; mutually exclusive with Option B.
    //     Stripe fires this ~1h before the actual invoice finalizes.
    // -------------------------------------------------------------------------
    if (event.type === 'invoice.upcoming') {
      const couponFlag = Deno.env.get('STRIPE_COUPON_REDEMPTION') === 'true';
      const stripeApiKey = Deno.env.get('STRIPE_API_KEY');
      if (!couponFlag || !stripeApiKey || !supabaseUrl0 || !supabaseServiceKey0) {
        return new Response(JSON.stringify({ received: true, status: 'invoice.upcoming ignored' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const upcoming = event.data.object;
      const userId =
        upcoming?.subscription_details?.metadata?.user_id ??
        upcoming?.metadata?.user_id ??
        null;
      const customerId = upcoming?.customer ?? null;
      const currency = (upcoming?.currency ?? 'eur').toLowerCase();
      // Per-month price = first recurring line's unit_amount (cents)
      const firstLine = Array.isArray(upcoming?.lines?.data) ? upcoming.lines.data[0] : null;
      const monthlyAmountCents = Number(
        firstLine?.price?.unit_amount ?? firstLine?.amount ?? upcoming?.amount_due ?? 0,
      );

      if (!userId || !customerId || monthlyAmountCents <= 0) {
        return new Response(JSON.stringify({ received: true, status: 'invoice.upcoming missing fields' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const isFirstSeeingUpcoming = await claimWebhookEvent(
        supabaseUrl0, supabaseServiceKey0, 'stripe', event.id,
      );
      if (!isFirstSeeingUpcoming) {
        return new Response(JSON.stringify({ received: true, status: 'invoice.upcoming retry' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { monthsApplied, consumed } = await redeemCredits(
        supabaseUrl0, supabaseServiceKey0, userId, 12,
      );
      if (monthsApplied === 0) {
        return new Response(JSON.stringify({ received: true, status: 'no credits' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Cap discount at the upcoming invoice's amount_due so a 12-month credit
      // can't go negative against a 1-month bill.
      const amountDue = Number(upcoming?.amount_due ?? 0);
      let amountOffCents = monthsApplied * monthlyAmountCents;
      if (amountDue > 0 && amountOffCents > amountDue) amountOffCents = amountDue;

      try {
        // Stripe REST: form-encoded coupon create
        const couponBody = new URLSearchParams({
          amount_off: String(amountOffCents),
          currency,
          duration: 'once',
          'metadata[source]': 'vasco_credits',
          'metadata[consumed_ids]': consumed.map((c) => c.consumedId).join(','),
        });
        const couponResp = await fetch('https://api.stripe.com/v1/coupons', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeApiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': `vasco-coupon-${event.id}`,
          },
          body: couponBody.toString(),
        });
        if (!couponResp.ok) throw new Error(`coupon create ${couponResp.status}`);
        const coupon = await couponResp.json();

        // Apply as default subscription coupon → next finalized invoice picks it up.
        // (We can't update an `upcoming` invoice's id directly — it's a simulation.)
        const subId = upcoming?.subscription ?? null;
        if (!subId) throw new Error('no subscription on upcoming invoice');
        const subBody = new URLSearchParams({ coupon: coupon.id });
        const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeApiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': `vasco-sub-coupon-${event.id}`,
          },
          body: subBody.toString(),
        });
        if (!subResp.ok) throw new Error(`subscription coupon apply ${subResp.status}`);

        console.log(
          `Applied ${monthsApplied}mo coupon (${amountOffCents}¢ ${currency}) to sub=${subId} for user=${userId}`,
        );
        return new Response(JSON.stringify({
          received: true, status: 'credits_applied',
          months: monthsApplied, amount_off: amountOffCents,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) {
        await restoreCredits(supabaseUrl0, supabaseServiceKey0, consumed.map((c) => c.consumedId));
        console.error('Option A coupon flow failed, credits restored:', String(err));
        return new Response(JSON.stringify({ received: true, status: 'coupon_failed_restored' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // -------------------------------------------------------------------------
    // 2a. Subscription lifecycle events → sync public.subscriptions
    // -------------------------------------------------------------------------
    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      if (!supabaseUrl0 || !supabaseServiceKey0) {
        return new Response(JSON.stringify({ received: true, error: 'DB not configured' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const sub = event.data.object;
      // Metadata carries user_id + tier from create-subscription-checkout
      const userId = sub?.metadata?.user_id ?? sub?.subscription_data?.metadata?.user_id ?? null;
      const tier = sub?.metadata?.tier ?? null;
      const statusMap: Record<string, string> = {
        trialing: 'trialing',
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'past_due',
        incomplete_expired: 'expired',
        unpaid: 'past_due',
      };
      const externalId = typeof sub?.id === 'string' ? sub.id : null;
      const currentPeriodEnd = sub?.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      const status = event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : statusMap[sub?.status ?? 'active'] ?? 'active';

      if (userId && tier) {
        const adminClient = createClient(supabaseUrl0, supabaseServiceKey0);

        // Option B: redeem available credits and extend the period accordingly.
        // Feature-flagged via CREDIT_REDEMPTION_ENABLED. Skipped when Option A
        // (STRIPE_COUPON_REDEMPTION) is on so we don't double-redeem.
        let extendedPeriodEnd = currentPeriodEnd;
        const creditFlag = Deno.env.get('CREDIT_REDEMPTION_ENABLED') === 'true';
        const couponMode = Deno.env.get('STRIPE_COUPON_REDEMPTION') === 'true';
        const isFirstSeeing = await claimWebhookEvent(supabaseUrl0, supabaseServiceKey0, 'stripe', event.id);
        if (creditFlag && !couponMode && isFirstSeeing && status === 'active' && currentPeriodEnd) {
          const { monthsApplied, consumed } = await redeemCredits(
            supabaseUrl0, supabaseServiceKey0, userId, 12,
          );
          if (monthsApplied > 0) {
            try {
              const d = new Date(currentPeriodEnd);
              const day = d.getDate();
              d.setMonth(d.getMonth() + monthsApplied);
              if (d.getDate() < day) d.setDate(0);
              extendedPeriodEnd = d.toISOString();
              console.log(`Extended period for user=${userId} by ${monthsApplied}mo → ${extendedPeriodEnd}`);
            } catch (err) {
              await restoreCredits(supabaseUrl0, supabaseServiceKey0, consumed.map((c) => c.consumedId));
              console.error('period extension failed, credits restored:', String(err));
            }
          }
        }

        const { error: subErr } = await adminClient
          .from('subscriptions')
          .upsert({
            user_id: userId,
            tier,
            status,
            external_id: externalId,
            external_provider: 'stripe',
            current_period_ends_at: extendedPeriodEnd,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        if (subErr) console.error('subscriptions upsert failed:', subErr.message);
        else console.log(`Subscription synced: user=${userId} tier=${tier} status=${status}`);
      } else {
        console.warn(`Subscription event missing metadata — user_id=${userId} tier=${tier}`);
      }
      return new Response(JSON.stringify({ received: true, status: 'subscription_synced' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // 2b. Only remaining handled event: payment_intent.succeeded (invoice paid)
    // -------------------------------------------------------------------------
    if (event.type !== 'payment_intent.succeeded') {
      // Acknowledge but ignore other event types
      return new Response(JSON.stringify({ received: true, status: 'ignored', type: event.type }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentIntent = event.data.object;
    const paymentId = paymentIntent.id;
    const invoiceId = paymentIntent.metadata?.invoiceId;

    console.log(`PaymentIntent ${paymentId}: status=${paymentIntent.status}, invoiceId=${invoiceId}`);

    if (!invoiceId) {
      console.error('No invoiceId in payment metadata');
      return new Response(JSON.stringify({ received: true, error: 'No invoiceId in metadata' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // 3. Update the invoice in Supabase
    // -------------------------------------------------------------------------
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Supabase env vars not configured');
      return new Response(JSON.stringify({ received: true, error: 'DB not configured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const paidAt = new Date(paymentIntent.created * 1000).toISOString();

    // Determine payment method type from the PaymentIntent
    const paymentMethodType = paymentIntent.payment_method_types?.[0] || null;

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: paidAt,
        payment_id: paymentId,
        payment_method: paymentMethodType,
        payment_provider: 'stripe',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateError) {
      console.error('Failed to update invoice:', updateError.message);
      return new Response(JSON.stringify({ received: true, error: 'DB update failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Invoice ${invoiceId} marked as paid via Stripe (${paymentId})`);

    await dispatchPaidSideEffects(supabaseUrl, supabaseServiceKey, invoiceId).catch((err) =>
      console.warn('paid side-effects failed:', String(err)),
    );

    // -------------------------------------------------------------------------
    // 4. Always return 200 — Stripe retries on non-2xx responses
    // -------------------------------------------------------------------------
    return new Response(JSON.stringify({ received: true, status: 'paid', invoiceId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Even on unexpected errors, return 200 to prevent infinite Stripe retries.
    // The error is logged server-side for debugging.
    console.error('Webhook handler error:', String(err));
    return new Response(JSON.stringify({ received: true, error: 'Internal error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
