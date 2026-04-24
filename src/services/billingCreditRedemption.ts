// =============================================================================
// BILLING CREDIT REDEMPTION (R234)
// =============================================================================
// Consumes unredeemed subscription credits at renewal time and returns the
// deferred renewal date. Call this from the Mollie / Stripe / in-app
// subscription renewal flow RIGHT BEFORE scheduling the next charge.
//
// Contract:
//   applyCreditsToRenewal(userId, currentRenewalAt, opts?)
//     → { newRenewalAt, monthsApplied, consumed }
//
// The function is a thin composition of R233's `consume_subscription_credits`
// RPC + a pure `addMonths` date calculator. Isolated here so every billing
// gateway integration uses identical logic.
//
// The RPC requires service role; expected callers are Edge Functions
// (mollie-webhook, stripe-webhook, any future renewal worker) that run
// under the service-role key. The app client can call it in dev but will
// hit permission-denied in prod — desired behaviour.
// =============================================================================

import {
  consumeSubscriptionCredits,
  type ConsumedCredit,
} from './subscriptionCreditsService';

export interface CreditRedemptionResult {
  /** Renewal date after applying credits — push forward by monthsApplied. */
  newRenewalAt: Date;
  /** Total months the subscription was deferred by. */
  monthsApplied: number;
  /** Raw credits the RPC marked redeemed. Empty when nothing was applied. */
  consumed: ConsumedCredit[];
}

export interface RedemptionOptions {
  /** Cap on months to consume in a single renewal. Defaults to 12 to
   *  prevent absurd jumps. */
  maxMonths?: number;
}

/**
 * Pure date-math: add N full months to a date, clamping the day-of-month
 * so Jan 31 + 1 month → Feb 28 (or 29) rather than rolling into March.
 */
export function addMonths(from: Date, months: number): Date {
  if (months <= 0) return new Date(from.getTime());
  const d = new Date(from.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // If the resulting month's day-of-month got clamped by overflow, back up
  // to the last day of the target month.
  if (d.getDate() < day) d.setDate(0);
  return d;
}

export async function applyCreditsToRenewal(
  userId: string,
  currentRenewalAt: Date,
  opts: RedemptionOptions = {},
): Promise<CreditRedemptionResult> {
  const max = Math.max(1, Math.min(opts.maxMonths ?? 12, 12));
  const consumed = await consumeSubscriptionCredits(userId, max);
  const monthsApplied = consumed.reduce((sum, c) => sum + (c.monthsFree || 0), 0);
  return {
    newRenewalAt: addMonths(currentRenewalAt, monthsApplied),
    monthsApplied,
    consumed,
  };
}

// Exposed for test fixtures only.
export const __internal = { addMonths };
