/**
 * How much free time a Stripe checkout may still give this account.
 *
 * "One month free" is ONE month per account. The checkout set
 * `trial_period_days=30` on every session, so a contractor who had used the
 * 30-day in-app trial got 30 more at checkout, and a customer who cancelled
 * during the Stripe trial could check out again for another 30 — as often as
 * they liked (review 2026-10-14).
 *
 * Pure TypeScript: the edge function and the app's jest suite both import it.
 */

export const TRIAL_DAYS = 30;
/** Stripe Checkout refuses a `trial_end` less than 48 hours away. */
export const STRIPE_MIN_TRIAL_MS = 48 * 60 * 60 * 1000;

export interface TrialRow {
  tier?: string | null;
  status?: string | null;
  trial_ends_at?: string | null;
  external_id?: string | null;
}

/**
 * The trial this checkout carries:
 *  - `{ days: 30 }`        — the account has never had a trial (no row);
 *  - `{ endsAt: <unix s> }` — the in-app trial is still running: Stripe
 *    continues it to the SAME end (raised to Stripe's 48-hour minimum);
 *  - `null`                — the trial was used, or the account has had a
 *    paid subscription before: billing starts now.
 */
export function checkoutTrial(row: TrialRow | null, now: Date = new Date()): { days: number } | { endsAt: number } | null {
  if (!row) return { days: TRIAL_DAYS };
  if (row.external_id) return null;
  const end = row.trial_ends_at ? new Date(row.trial_ends_at).getTime() : NaN;
  if (row.tier === 'free' || Number.isNaN(end) || end <= now.getTime()) return null;
  const endsAt = Math.max(end, now.getTime() + STRIPE_MIN_TRIAL_MS + 60_000);
  return { endsAt: Math.ceil(endsAt / 1000) };
}
