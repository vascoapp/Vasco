// =============================================================================
// CREDIT REDEMPTION — shared Edge-Function primitive (R234)
// =============================================================================
// Deno-side twin of src/services/billingCreditRedemption.ts.
// Stripe and Mollie webhooks call this on subscription-renewal events to
// consume whatever referral/promo credits the user has accrued, then reduce
// the charge by that many whole months.
//
// The actual price-adjustment step (creating a Stripe Coupon, cancelling a
// Mollie charge, etc.) is provider-specific and lives in the calling
// webhook — this module only talks to the `consume_subscription_credits`
// RPC and returns what was consumed.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ConsumedCredit {
  consumedId: string;
  monthsFree: number;
  sourceType: string;
  sourceId: string | null;
}

export interface CreditRedemptionResult {
  monthsApplied: number;
  consumed: ConsumedCredit[];
}

/**
 * Consume up to `maxMonths` of available subscription credits for `userId`.
 * Caps at 12 (sanity bound) and clamps to at least 1. Safe to call with zero
 * credits — returns `{monthsApplied: 0, consumed: []}`.
 *
 * Requires the service-role key — the RPC is GRANT'd only to service_role.
 */
export async function redeemCredits(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  maxMonths = 12,
): Promise<CreditRedemptionResult> {
  const capped = Math.max(1, Math.min(maxMonths, 12));
  const admin = createClient(supabaseUrl, serviceKey);

  const { data, error } = await admin.rpc('consume_subscription_credits', {
    p_user_id: userId,
    p_max_months: capped,
  });

  if (error || !Array.isArray(data)) {
    if (error) console.warn('consume_subscription_credits failed:', error.message);
    return { monthsApplied: 0, consumed: [] };
  }

  const consumed: ConsumedCredit[] = (data as any[]).map((r) => ({
    consumedId: String(r.consumed_id ?? ''),
    monthsFree: Number(r.months_free ?? 0),
    sourceType: String(r.source_type ?? ''),
    sourceId: r.source_id ?? null,
  }));

  const monthsApplied = consumed.reduce((sum, c) => sum + (c.monthsFree || 0), 0);
  return { monthsApplied, consumed };
}

/**
 * Three outcomes, not two:
 *
 *  - `'first'`     — we inserted the row; this event has not been handled.
 *  - `'duplicate'` — unique violation (23505); the provider is retrying.
 *  - `'unknown'`   — the claim itself failed (timeout, connection cap, RLS).
 *
 * It used to return a plain boolean, and a transient DB error returned the
 * same `false` as a genuine duplicate. Every caller read that as "already
 * processed", so one failed INSERT permanently skipped the customer's paid
 * receipt and the contractor's push — for a payment that really happened,
 * with nothing anywhere recording the decision (#353).
 *
 * The caller has to choose, because the right answer differs: for a
 * NON-idempotent money step (consuming credits) `'unknown'` must behave like
 * `'duplicate'` and skip; for a notification, delivering a possible duplicate
 * beats silently delivering nothing.
 */
export type WebhookClaim = 'first' | 'duplicate' | 'unknown';

export async function claimWebhookEvent(
  supabaseUrl: string,
  serviceKey: string,
  provider: 'stripe' | 'mollie',
  eventId: string,
): Promise<WebhookClaim> {
  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin
    .from('webhook_idempotency')
    .insert({ provider, event_id: eventId })
    .select('event_id');
  if (error) {
    // Postgres unique-violation = 23505 → already processed
    if ((error as any).code === '23505') return 'duplicate';
    console.error(`claimWebhookEvent could not claim ${provider}/${eventId}:`, error.message);
    return 'unknown';
  }
  return Array.isArray(data) && data.length > 0 ? 'first' : 'unknown';
}

/**
 * Give a claim back after the work it guards FAILED, so the provider's retry
 * is treated as the first delivery rather than a replay (sweep A7). Only call
 * it when nothing irreversible happened under the claim (no email, no push)
 * or after compensating (credits restored). Best-effort: if the delete fails,
 * the retry is a replay — no worse than before.
 */
export async function releaseWebhookEvent(
  supabaseUrl: string,
  serviceKey: string,
  provider: 'stripe' | 'mollie',
  eventId: string,
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceKey);
  const { error } = await admin
    .from('webhook_idempotency')
    .delete()
    .eq('provider', provider)
    .eq('event_id', eventId);
  if (error) console.error(`releaseWebhookEvent ${provider}/${eventId} failed:`, error.message);
}

/**
 * Un-consume credits previously redeemed. Call when a downstream step fails
 * after redeemCredits succeeded (e.g. Stripe coupon apply 500s). Best-effort —
 * logs and swallows on failure.
 */
export async function restoreCredits(
  supabaseUrl: string,
  serviceKey: string,
  consumedIds: string[],
): Promise<boolean> {
  // true = the credits are back (or there were none). A caller that releases
  // its claim for a retry must only do so on true: a retry after a FAILED
  // restore redeems a second batch while the first stays consumed (review).
  if (consumedIds.length === 0) return true;
  const admin = createClient(supabaseUrl, serviceKey);
  const { error } = await admin.rpc('restore_subscription_credits', {
    p_consumed_ids: consumedIds,
  });
  if (error) {
    console.warn('restore_subscription_credits failed:', error.message);
    return false;
  }
  return true;
}
