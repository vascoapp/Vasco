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
import { stripeSecretKey } from '../_shared/stripeKey.ts';
import { dispatchPaidSideEffects } from '../_shared/paid-side-effects.ts';
import { claimWebhookEvent, redeemCredits, restoreCredits, releaseWebhookEvent } from '../_shared/credit-redemption.ts';
import { invoiceLookup } from '../_shared/invoiceRef.ts';
import { isPermanentDbError } from '../_shared/dbErrors.ts';
import { invoiceSubscriptionId, invoiceSubscriptionMetadata, subscriptionPeriodEnd } from '../_shared/stripeShapes.ts';

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

/**
 * 503 = "deliver this again later". Used ONLY where nothing irreversible has
 * happened yet (or it was compensated): the provider retries (Mollie ~10× over
 * 26 h, Stripe up to 3 days) and the idempotent writes simply land then. Every
 * such failure used to answer 200, so a payment the database could not record
 * was never recorded at all (sweep A7). After an email/push went out a failure
 * is REPORTED instead (#352).
 */
function retryLater(why: string): Response {
  return new Response(JSON.stringify({ received: false, retry: true, error: why }), {
    status: 503,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '300' },
  });
}

/** Transient → 503 (retry); permanent → 200 + a loud log (see dbErrors.ts). */
function failRecording(why: string, error: { code?: unknown; message?: string } | null): Response {
  if (isPermanentDbError(error)) {
    console.error(`PERMANENT, not retried — ${why}: ${error?.message ?? ''} (${String(error?.code ?? '')})`);
    return new Response(JSON.stringify({ received: true, recorded: false, error: why }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return retryLater(why);
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

    // Connected-account events (Stripe Connect, decision 2a) arrive on a
    // separate Connect endpoint with its OWN signing secret.
    const connectWebhookSecret = Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET');
    const isValid = await verifyStripeSignature(rawBody, signatureHeader, stripeWebhookSecret)
      || (!!connectWebhookSecret && await verifyStripeSignature(rawBody, signatureHeader, connectWebhookSecret));
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

    console.log(`Stripe event: type=${event.type}, id=${event.id}${event.account ? `, account=${event.account}` : ''}`);

    // A CONNECTED account's event (Stripe Connect): only invoice payments count,
    // and only for the contractor who owns that account. The metadata is
    // written by our server, but a contractor can also make a link in their own
    // Stripe dashboard with any metadata — `userId` of another contractor would
    // then mark THEIR invoice paid. The owner comes from stripe_connections.
    let connectedOwner: string | null = null;
    if (typeof event.account === 'string' && event.account) {
      // The contractor revoked Vasco in their Stripe dashboard: forget the link,
      // or the app keeps saying "Connected" while every payment link fails.
      if (event.type === 'account.application.deauthorized') {
        const u = Deno.env.get('SUPABASE_URL');
        const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        if (!u || !k) return retryLater('DB not configured');
        const { error: delErr } = await createClient(u, k).from('stripe_connections').delete().eq('stripe_account_id', event.account);
        if (delErr) return retryLater('Could not forget the connection');
        return new Response(JSON.stringify({ received: true, status: 'deauthorized' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (event.type !== 'payment_intent.succeeded') {
        return new Response(JSON.stringify({ received: true, status: 'ignored', type: event.type }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const u = Deno.env.get('SUPABASE_URL');
      const k = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!u || !k) return retryLater('DB not configured');
      const { data: owner, error: ownerErr } = await createClient(u, k)
        .from('stripe_connections').select('user_id').eq('stripe_account_id', event.account).maybeSingle();
      if (ownerErr) return retryLater('Owner lookup failed');
      if (!owner?.user_id) {
        console.error(`stripe ${event.id}: account ${event.account} is not connected to any contractor`);
        return new Response(JSON.stringify({ received: true, status: 'unknown account' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      connectedOwner = owner.user_id as string;
    }

    const supabaseUrl0 = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey0 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    // Hoisted to function scope: the invoice.upcoming (coupon) branch AND the
    // invoice.payment_failed (dunning) branch both need it. Previously declared
    // only inside the invoice.upcoming block, so payment_failed threw
    // ReferenceError → subscriptions never marked past_due (dunning banner dead).
    const stripeApiKey = stripeSecretKey();

    // -------------------------------------------------------------------------
    // 2.0 invoice.upcoming → Option A: apply referral credits as a Stripe Coupon
    //     so the next charge is reduced by N whole months. Feature-flagged via
    //     STRIPE_COUPON_REDEMPTION; mutually exclusive with Option B.
    //     Stripe fires this ~1h before the actual invoice finalizes.
    // -------------------------------------------------------------------------
    if (event.type === 'invoice.upcoming') {
      const couponFlag = Deno.env.get('STRIPE_COUPON_REDEMPTION') === 'true';
      if (!couponFlag || !stripeApiKey || !supabaseUrl0 || !supabaseServiceKey0) {
        return new Response(JSON.stringify({ received: true, status: 'invoice.upcoming ignored' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const upcoming = event.data.object;
      const userId =
        invoiceSubscriptionMetadata(upcoming)?.user_id ??
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
      // Only a confirmed duplicate short-circuits; an unclaimable event is
      // still handled, with a log, rather than dropped.
      if (isFirstSeeingUpcoming === 'duplicate') {
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
        const subId = invoiceSubscriptionId(upcoming);
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
      if (!supabaseUrl0 || !supabaseServiceKey0) return retryLater('DB not configured');
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
      const periodEnd = subscriptionPeriodEnd(sub);
      const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
      const status = event.type === 'customer.subscription.deleted'
        ? 'canceled'
        : statusMap[sub?.status ?? 'active'] ?? 'active';

      if (userId && tier) {
        const adminClient = createClient(supabaseUrl0, supabaseServiceKey0);

        // Option B: redeem available credits and extend the period accordingly.
        // Feature-flagged via CREDIT_REDEMPTION_ENABLED. Skipped when Option A
        // (STRIPE_COUPON_REDEMPTION) is on so we don't double-redeem.
        let extendedPeriodEnd = currentPeriodEnd;
        // Credits consumed for THIS event, so the write below can hand them
        // back if it fails. They were redeemed inside the `if` and the
        // compensation lived there too — inside a try that wrapped only Date
        // arithmetic, which cannot throw. `restoreCredits` was unreachable by
        // construction, and the write that actually decides whether the
        // extension exists is fifteen lines lower, outside it. Same defect as
        // mollie-webhook, still live here (#352).
        let consumedCreditIds: string[] = [];
        const creditFlag = Deno.env.get('CREDIT_REDEMPTION_ENABLED') === 'true';
        const couponMode = Deno.env.get('STRIPE_COUPON_REDEMPTION') === 'true';
        const isFirstSeeing = await claimWebhookEvent(supabaseUrl0, supabaseServiceKey0, 'stripe', event.id);
        // Money: `'first'` only — see the note in credit-redemption.ts.
        if (creditFlag && !couponMode && isFirstSeeing === 'first' && status === 'active' && currentPeriodEnd) {
          const { monthsApplied, consumed } = await redeemCredits(
            supabaseUrl0, supabaseServiceKey0, userId, 12,
          );
          if (monthsApplied > 0) {
            consumedCreditIds = consumed.map((c) => c.consumedId);
            const d = new Date(currentPeriodEnd);
            const day = d.getDate();
            d.setMonth(d.getMonth() + monthsApplied);
            if (d.getDate() < day) d.setDate(0);
            extendedPeriodEnd = d.toISOString();
            console.log(`Extended period for user=${userId} by ${monthsApplied}mo → ${extendedPeriodEnd}`);
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
        if (subErr) {
          // THIS is the failure the compensation exists for: the credits are
          // already spent and the extension never landed. `event.id` was
          // claimed above, so Stripe's retry is treated as a replay and will
          // never redeem again — without this, the customer pays, loses the
          // credits and gets nothing.
          console.error('subscriptions upsert failed:', subErr.message);
          let restored = true;
          if (consumedCreditIds.length > 0) {
            restored = await restoreCredits(supabaseUrl0, supabaseServiceKey0, consumedCreditIds);
            console.error(`restore ${consumedCreditIds.length} credit(s) for user=${userId}: ${restored}`);
          }
          // The PURCHASE itself did not land: a paying customer would stay on
          // Free, and the claim made Stripe's retry a replay (sweep A7). Give
          // the claim back and ask Stripe to deliver again — the upsert is
          // idempotent and the credits were handed back above.
          // Release only a claim THIS delivery owns, and only after the
          // credits are back: releasing a claim an earlier delivery made, or
          // after a failed restore, would redeem a second batch (review).
          if (isFirstSeeing === 'first' && restored) {
            await releaseWebhookEvent(supabaseUrl0, supabaseServiceKey0, 'stripe', event.id);
          }
          return failRecording('subscription sync failed', subErr);
        } else {
          console.log(`Subscription synced: user=${userId} tier=${tier} status=${status}`);
        }
      } else {
        console.warn(`Subscription event missing metadata — user_id=${userId} tier=${tier}`);
      }
      return new Response(JSON.stringify({ received: true, status: 'subscription_synced' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // 2a-bis. Dunning: invoice.payment_failed → mark past_due. Stripe's Smart
    // Retries (Dashboard → Settings → Subscriptions) handles the actual retry
    // schedule + customer emails. When retries exhaust, Stripe fires
    // customer.subscription.deleted which the 2a block above downgrades to
    // canceled. We just sync the past_due state so the in-app UI can show a
    // "card declined" banner during the retry window.
    // -------------------------------------------------------------------------
    if (event.type === 'invoice.payment_failed') {
      if (!supabaseUrl0 || !supabaseServiceKey0) return retryLater('DB not configured');
      const invoice = event.data.object;
      const subId: string | null = invoiceSubscriptionId(invoice);
      if (!subId) {
        return new Response(JSON.stringify({ received: true, status: 'no_subscription' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Look up the subscription to recover user_id from metadata. We don't
      // trust invoice.metadata for that — checkout writes user_id on the
      // subscription, not on individual invoices.
      const subResp = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
        headers: { Authorization: `Bearer ${stripeApiKey}` },
      });
      if (!subResp.ok) {
        console.error(`payment_failed: subscription fetch ${subResp.status}`);
        return retryLater('sub_fetch_failed');
      }
      const sub = await subResp.json();
      const userId: string | null = sub?.metadata?.user_id ?? null;
      if (!userId) {
        console.warn('payment_failed: subscription missing user_id metadata');
        return new Response(JSON.stringify({ received: true, status: 'no_user_id' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const adminClient = createClient(supabaseUrl0, supabaseServiceKey0);
      // UPDATE, not upsert: `subscriptions.tier` is NOT NULL without a default
      // and this event has no tier, so the upsert failed (23502) on EVERY
      // dunning event — logged and ignored before, a 3-day retry storm once
      // failures asked for redelivery (review 2026-10-05).
      const { error: upErr } = await adminClient
        .from('subscriptions')
        .update({
          status: 'past_due',
          external_id: subId,
          external_provider: 'stripe',
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      if (upErr) {
        console.error('past_due update failed:', upErr.message);
        return failRecording('past_due sync failed', upErr);
      }
      console.log(`Subscription past_due: user=${userId} sub=${subId} attempt=${invoice?.attempt_count ?? 0}`);

      return new Response(JSON.stringify({ received: true, status: 'past_due_synced' }), {
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
    const trackerAccessCode = paymentIntent.metadata?.trackerAccessCode;

    console.log(
      `PaymentIntent ${paymentId}: status=${paymentIntent.status}, invoiceId=${invoiceId}, trackerAccessCode=${trackerAccessCode}`,
    );

    // Decision-tracker deposit? Flip the tracker payment_status so the customer
    // portal stops showing the Pay button. R311: these ALSO carry invoiceId
    // ('deposit-<code>') because requestTrackerDeposit mints via the payment
    // link, so trackerAccessCode (not the absence of invoiceId) is the
    // discriminator — check it first so we don't fall through to the invoice
    // branch (which would 0-match documents + fire bogus side-effects).
    // Idempotent UPDATE.
    if (trackerAccessCode) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseServiceKey) return retryLater('DB not configured');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      let trackerUpdate = supabase
        .from('decision_trackers')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('access_code', trackerAccessCode);
      // Connected account: only the account owner's own tracker.
      if (connectedOwner) trackerUpdate = trackerUpdate.eq('user_id', connectedOwner);
      const { error: trackerErr } = await trackerUpdate;
      if (trackerErr) {
        console.error('Failed to mark tracker paid:', trackerErr.message);
        return failRecording('Tracker update failed', trackerErr);
      }
      console.log(`Tracker ${trackerAccessCode} marked as paid via Stripe (${paymentId})`);
      return new Response(
        JSON.stringify({ received: true, status: 'tracker_paid', trackerAccessCode }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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
      return retryLater('DB not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const paidAt = new Date(paymentIntent.created * 1000).toISOString();

    // Determine payment method type from the PaymentIntent
    const paymentMethodType = paymentIntent.payment_method_types?.[0] || null;

    // R305: same fix as mollie-webhook — was writing to non-existent
    // `invoices` table; switched to `documents` filtered on doc_type='invoice'.
    // `invoiceId` is the app's document NUMBER, not the row uuid (see
    // _shared/invoiceRef.ts) — matched with the contractor's user id.
    // A connected account's payment: the OWNER of the account, never the
    // metadata, decides whose invoice it is — and only by document number.
    const lookup = connectedOwner
      ? invoiceLookup(invoiceId, connectedOwner)
      : invoiceLookup(invoiceId, paymentIntent.metadata?.userId);
    if (connectedOwner && lookup && lookup.column === 'id') {
      // A uuid reference is not scoped to a contractor: refuse it here.
      console.error(`stripe ${event.id}: connected-account payment with a uuid invoice reference`);
      return new Response(JSON.stringify({ received: true, error: 'Unscoped invoice reference' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!lookup) {
      // A bare number with no contractor: ambiguous, and no retry fixes it.
      console.error(`stripe ${event.id}: unresolvable invoice reference "${invoiceId}" (no userId in metadata)`);
      return new Response(JSON.stringify({ received: true, error: 'Unresolvable invoice reference' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let update = supabase
      .from('documents')
      .update({
        status: 'paid',
        paid_at: paidAt,
        payment_id: paymentId,
        payment_method: paymentMethodType,
        payment_provider: 'stripe',
        updated_at: new Date().toISOString(),
      })
      .eq(lookup.column, lookup.value)
      .eq('doc_type', 'invoice');
    if (lookup.column === 'document_number') update = update.eq('user_id', lookup.userId);
    const { data: updatedRows, error: updateError } = await update.select('id');

    if (updateError) {
      // Nothing sent yet (side effects come after): retry, or this payment
      // is never recorded.
      console.error('Failed to update invoice:', updateError.message);
      return failRecording('DB update failed', updateError);
    }

    const invoiceRowId: string | undefined = (updatedRows as Array<{ id: string }> | null)?.[0]?.id;
    if (!invoiceRowId) {
      // No row matched: an invoice created offline may not be on the server
      // yet — retry (bounded by Stripe's schedule).
      console.error(`stripe ${event.id}: no invoice matched ${lookup.column}=${lookup.value}`);
      return retryLater('Invoice not found');
    }
    console.log(`Invoice ${invoiceId} (${invoiceRowId}) marked as paid via Stripe (${paymentId})`);

    // R66 round 41: idempotency gate. Stripe's signature check at line 103
    // already prevents arbitrary replay from outside, but Stripe itself
    // retries on non-2xx — without this gate we'd fire side effects every
    // retry. event.id is the natural idempotency key (already used at
    // lines 169 + 288 for upcoming-invoice + subscription-redemption
    // branches).
    const isFirstSeeingPaid = await claimWebhookEvent(
      supabaseUrl, supabaseServiceKey, 'stripe', event.id,
    );
    // Notification: deliver unless this is a confirmed replay.
    if (isFirstSeeingPaid !== 'duplicate') {
      if (isFirstSeeingPaid === 'unknown') {
        console.error(`stripe ${event.id}: idempotency claim failed — sending paid side effects anyway`);
      }
      await dispatchPaidSideEffects(supabaseUrl, supabaseServiceKey, invoiceRowId, paidAt).catch((err) =>
        console.warn('paid side-effects failed:', String(err)),
      );
    } else {
      console.log(`Stripe event ${event.id} replay — side effects skipped`);
    }

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
