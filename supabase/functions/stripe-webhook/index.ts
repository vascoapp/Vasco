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
        const { error: subErr } = await adminClient
          .from('subscriptions')
          .upsert({
            user_id: userId,
            tier,
            status,
            external_id: externalId,
            external_provider: 'stripe',
            current_period_ends_at: currentPeriodEnd,
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
