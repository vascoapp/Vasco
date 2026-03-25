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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Parse the webhook body — Stripe sends JSON events
    // -------------------------------------------------------------------------
    const event = await req.json();

    if (!event || !event.type || !event.data?.object) {
      console.error('Invalid Stripe event payload');
      return new Response(JSON.stringify({ received: true, error: 'Invalid event' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Stripe event: type=${event.type}, id=${event.id}`);

    // -------------------------------------------------------------------------
    // 2. Only handle payment_intent.succeeded
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
