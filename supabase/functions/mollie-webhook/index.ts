// =============================================================================
// MOLLIE WEBHOOK — Supabase Edge Function
// =============================================================================
// Receives payment status updates from Mollie. When a customer pays an invoice
// via iDEAL/Bancontact/card/etc., Mollie POSTs the payment ID here.
// We fetch the full payment, check if it's paid, and update the invoice in DB.
// =============================================================================
// Mollie docs: https://docs.mollie.com/overview/webhooks
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Rate limiting — in-memory sliding window (100 calls per 60 seconds)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;
const requestTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  // Remove timestamps outside the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    return true;
  }
  requestTimestamps.push(now);
  return false;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // -------------------------------------------------------------------------
  // 0. Rate limiting — reject if more than 100 calls per minute
  // -------------------------------------------------------------------------
  if (isRateLimited()) {
    console.error('Rate limit exceeded for mollie-webhook');
    return new Response(JSON.stringify({ received: false, error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  try {
    // -------------------------------------------------------------------------
    // 1. Parse the webhook body — Mollie sends `id=tr_xxxx` as form-encoded
    // -------------------------------------------------------------------------
    const contentType = req.headers.get('content-type') || '';
    let paymentId: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      paymentId = formData.get('id') as string | null;
    } else {
      // Also accept JSON (useful for testing)
      const body = await req.json();
      paymentId = body.id ?? null;
    }

    if (!paymentId || typeof paymentId !== 'string' || !paymentId.startsWith('tr_')) {
      console.error('Invalid or missing payment ID:', paymentId);
      // Return 200 — no point in Mollie retrying with bad data
      return new Response(JSON.stringify({ received: true, error: 'Invalid payment ID' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------------------
    // 2. Fetch full payment details from Mollie API
    // -------------------------------------------------------------------------
    const mollieApiKey = Deno.env.get('MOLLIE_API_KEY');
    if (!mollieApiKey) {
      console.error('MOLLIE_API_KEY not configured');
      return new Response(JSON.stringify({ received: true, error: 'Server misconfigured' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mollieRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mollieApiKey}`,
      },
    });

    if (!mollieRes.ok) {
      const errorText = await mollieRes.text();
      console.error(`Mollie API error ${mollieRes.status}:`, errorText);
      return new Response(JSON.stringify({ received: true, error: 'Failed to fetch payment' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payment = await mollieRes.json();

    // -------------------------------------------------------------------------
    // 2b. Verify fetched payment ID matches posted ID (prevents forged webhooks)
    // -------------------------------------------------------------------------
    if (payment.id !== paymentId) {
      console.error(`Payment ID mismatch: posted=${paymentId}, fetched=${payment.id}`);
      return new Response(JSON.stringify({ received: true, error: 'Payment ID mismatch' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const invoiceId = payment.metadata?.invoiceId;

    console.log(`Payment ${paymentId}: status=${payment.status}, invoiceId=${invoiceId}`);

    // -------------------------------------------------------------------------
    // 3. If paid, update the invoice in Supabase
    // -------------------------------------------------------------------------
    if (payment.status === 'paid' && invoiceId) {
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

      const paidAt = payment.paidAt || new Date().toISOString();

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: paidAt,
          payment_id: paymentId,
          payment_method: payment.method || null,
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

      console.log(`Invoice ${invoiceId} marked as paid (${paymentId})`);
    }

    // -------------------------------------------------------------------------
    // 4. Always return 200 — Mollie retries on non-200 responses
    // -------------------------------------------------------------------------
    return new Response(JSON.stringify({ received: true, status: payment.status }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    // Even on unexpected errors, return 200 to prevent infinite Mollie retries.
    // The error is logged server-side for debugging.
    console.error('Webhook handler error:', String(err));
    return new Response(JSON.stringify({ received: true, error: 'Internal error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
