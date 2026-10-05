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
import { dispatchPaidSideEffects } from '../_shared/paid-side-effects.ts';
import { invoiceLookup } from '../_shared/invoiceRef.ts';
import { isPermanentDbError } from '../_shared/dbErrors.ts';
import { claimWebhookEvent, redeemCredits, restoreCredits, releaseWebhookEvent } from '../_shared/credit-redemption.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return retryLater('Server misconfigured');
    }

    const mollieRes = await fetch(`https://api.mollie.com/v2/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mollieApiKey}`,
      },
    });

    if (!mollieRes.ok) {
      const errorText = await mollieRes.text();
      console.error(`Mollie API error ${mollieRes.status}:`, errorText);
      return retryLater('Failed to fetch payment');
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
    const trackerAccessCode = payment.metadata?.trackerAccessCode;

    console.log(
      `Payment ${paymentId}: status=${payment.status}, invoiceId=${invoiceId}, trackerAccessCode=${trackerAccessCode}`,
    );

    // -------------------------------------------------------------------------
    // 3. If paid, update the invoice in Supabase
    // -------------------------------------------------------------------------
    // R311: tracker deposits also carry invoiceId ('deposit-<code>') so the
    // payment link mints, but they have NO matching documents row. Skip the
    // invoice branch when trackerAccessCode is present so we don't fire bogus
    // receipt-email side-effects against a non-existent invoice — the tracker
    // branch below handles them.
    if (payment.status === 'paid' && invoiceId && !trackerAccessCode) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Supabase env vars not configured');
        return retryLater('DB not configured');
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const paidAt = payment.paidAt || new Date().toISOString();

      // R305: was writing to non-existent `invoices` table — every payment
      // silently failed to mark the doc paid. Now writes to `documents`
      // filtered on doc_type='invoice' (the actual schema since v1.0).
      // `invoiceId` is the app's document NUMBER, not the row uuid (see
      // _shared/invoiceRef.ts) — matched with the contractor's user id.
      const lookup = invoiceLookup(invoiceId, payment.metadata?.userId);
      if (!lookup) {
        // A bare number with no contractor: ambiguous, and no retry fixes it.
        console.error(`mollie ${paymentId}: unresolvable invoice reference "${invoiceId}" (no userId in metadata)`);
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
          payment_method: payment.method || null,
          payment_provider: 'mollie',
          updated_at: new Date().toISOString(),
        })
        .eq(lookup.column, lookup.value)
        .eq('doc_type', 'invoice');
      if (lookup.column === 'document_number') update = update.eq('user_id', lookup.userId);
      const { data: updatedRows, error: updateError } = await update.select('id');

      if (updateError) {
        // Nothing sent yet (the side effects come after): retry, or this
        // payment is never recorded.
        console.error('Failed to update invoice:', updateError.message);
        return failRecording('DB update failed', updateError);
      }

      const invoiceRowId: string | undefined = (updatedRows as Array<{ id: string }> | null)?.[0]?.id;
      if (!invoiceRowId) {
        // No row matched: an invoice created offline may not have reached the
        // server yet — retry (bounded by Mollie's schedule). It used to log
        // "marked as paid" for a write that matched nothing.
        console.error(`mollie ${paymentId}: no invoice matched ${lookup.column}=${lookup.value}`);
        return retryLater('Invoice not found');
      }
      console.log(`Invoice ${invoiceId} (${invoiceRowId}) marked as paid (${paymentId})`);

      // R66 round 41: idempotency gate. Pre-R41 a replayed POST (Mollie's own
      // retry on non-2xx, network duplication, or a malicious replay since the
      // webhook itself isn't HMAC-signed by Mollie's design) fired the side
      // effects every time → N receipt emails to the customer, N pushes to
      // the contractor, N business_events rows. The DB UPDATE itself was
      // idempotent (same row stays paid) but the side effects weren't gated.
      // Pattern matches the subscription-renewal branch at line 192.
      const isFirstSeeingPaid = await claimWebhookEvent(
        supabaseUrl, supabaseServiceKey, 'mollie', paymentId,
      );
      // A notification, not a money step: on `'unknown'` (the claim itself
      // failed) deliver anyway. A duplicate receipt is a nuisance; a missing
      // one is a payment the customer was never told about (#353).
      if (isFirstSeeingPaid !== 'duplicate') {
        if (isFirstSeeingPaid === 'unknown') {
          console.error(`mollie ${paymentId}: idempotency claim failed — sending paid side effects anyway`);
        }
        // Fire-and-forget: receipt email + contractor push + invoice_outcomes seed
        await dispatchPaidSideEffects(supabaseUrl, supabaseServiceKey, invoiceRowId, paidAt).catch((err) =>
          console.warn('paid side-effects failed:', String(err)),
        );
      } else {
        console.log(`Mollie payment ${paymentId} replay — side effects skipped`);
      }
    }

    // -------------------------------------------------------------------------
    // 3-tracker. Decision-tracker deposit paid? Flip the tracker's
    // payment_status so the customer portal stops showing the Pay button.
    // Tracker deposits carry metadata.trackerAccessCode and no invoiceId
    // (requestTrackerDeposit in AppState). The UPDATE is idempotent, so no
    // separate replay gate is needed (unlike invoice side-effects above).
    // -------------------------------------------------------------------------
    if (payment.status === 'paid' && trackerAccessCode) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !supabaseServiceKey) return retryLater('DB not configured');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { error: trackerErr } = await supabase
        .from('decision_trackers')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('access_code', trackerAccessCode);
      if (trackerErr) {
        // Idempotent UPDATE, nothing sent: retry until the deposit is recorded.
        console.error('Failed to mark tracker paid:', trackerErr.message);
        return failRecording('Tracker update failed', trackerErr);
      }
      console.log(`Tracker ${trackerAccessCode} marked as paid (${paymentId})`);
    }

    // -------------------------------------------------------------------------
    // 3b. Subscription renewal? Redeem credits + extend period (Option B).
    // Mollie recurring payments carry payment.subscriptionId. metadata.user_id
    // is set when create-subscription-checkout creates the subscription.
    // Feature-flagged via CREDIT_REDEMPTION_ENABLED.
    // -------------------------------------------------------------------------
    if (
      payment.status === 'paid' &&
      payment.subscriptionId &&
      Deno.env.get('CREDIT_REDEMPTION_ENABLED') === 'true'
    ) {
      const userId = payment.metadata?.userId ?? payment.metadata?.user_id ?? null;
      const supabaseUrl2 = Deno.env.get('SUPABASE_URL');
      const supabaseServiceKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (userId && supabaseUrl2 && supabaseServiceKey2) {
        const isFirstSeeing = await claimWebhookEvent(supabaseUrl2, supabaseServiceKey2, 'mollie', paymentId);
        // Consuming credits is NOT idempotent, so `'unknown'` must behave
        // like `'duplicate'`: skip. Redeeming twice takes months the customer
        // paid for.
        if (isFirstSeeing === 'first') {
          const { monthsApplied, consumed } = await redeemCredits(
            supabaseUrl2, supabaseServiceKey2, userId, 12,
          );
          if (monthsApplied > 0) {
            try {
              const admin = createClient(supabaseUrl2, supabaseServiceKey2);
              // Every step here is checked, because the catch below is a
              // COMPENSATION: it hands the credits back. supabase-js resolves
              // with `{ error }` instead of throwing, so an unread error meant
              // the catch could never run — the credits were consumed, the
              // period was never extended, and nothing anywhere said so.
              const { data: sub, error: readErr } = await admin
                .from('subscriptions')
                .select('current_period_ends_at')
                .eq('user_id', userId)
                .maybeSingle();
              // A failed READ is not "no current period": treating it as one
              // restarts the term from today and silently shortens what the
              // customer already paid for.
              if (readErr) throw new Error(`subscription read failed: ${readErr.message}`);
              const base = sub?.current_period_ends_at ? new Date(sub.current_period_ends_at) : new Date();
              const day = base.getDate();
              base.setMonth(base.getMonth() + monthsApplied);
              if (base.getDate() < day) base.setDate(0);
              const { error: extendErr } = await admin
                .from('subscriptions')
                .update({ current_period_ends_at: base.toISOString(), updated_at: new Date().toISOString() })
                .eq('user_id', userId);
              if (extendErr) throw new Error(`period extension refused: ${extendErr.message}`);
              console.log(`Mollie: extended period for user=${userId} by ${monthsApplied}mo`);
            } catch (err) {
              const restored = await restoreCredits(supabaseUrl2, supabaseServiceKey2, consumed.map((c) => c.consumedId));
              console.error(`Mollie period extension failed, credits restored=${restored}:`, String(err));
              // Compensated, so the retry may redeem afresh — give the claim
              // back. Not when this payment also carried an invoice: that
              // branch shares the claim and its receipt already went out.
              if (!invoiceId && restored) {
                await releaseWebhookEvent(supabaseUrl2, supabaseServiceKey2, 'mollie', paymentId);
                return retryLater('Period extension failed');
              }
            }
          }
        }
      }
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
