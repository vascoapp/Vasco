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
