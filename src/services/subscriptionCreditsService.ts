// =============================================================================
// SUBSCRIPTION CREDITS SERVICE (R233)
// =============================================================================
// Thin wrappers around the two credit RPCs:
//   - get_credits_summary        (read — safe for authenticated users)
//   - consume_subscription_credits (write — service-role only)
//
// The consume call is exposed here because TypeScript shares code between
// the app (authenticated anon) and future admin tooling or scheduled
// functions. The RPC is grant'd only to service_role so an app-side call
// will hard-fail, which is intentional — contractors should never redeem
// their own credits.
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CreditsSummary {
  totalMonths: number;
  redeemedMonths: number;
  availableMonths: number;
}

export async function getCreditsSummary(userId: string): Promise<CreditsSummary | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_credits_summary', {
      p_user_id: userId,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      totalMonths: Number(row.total_months ?? 0),
      redeemedMonths: Number(row.redeemed_months ?? 0),
      availableMonths: Number(row.available_months ?? 0),
    };
  } catch {
    return null;
  }
}

export interface ConsumedCredit {
  consumedId: string;
  monthsFree: number;
  sourceType: string;
  sourceId: string | null;
}

/**
 * Service-role only. Exposed for admin / Edge Function callers — an app
 * client invoking this via the anon key hits a permission-denied error
 * and returns null, which is the desired behaviour (contractors can't
 * redeem their own credits).
 */
export async function consumeSubscriptionCredits(
  userId: string,
  maxMonths = 12,
): Promise<ConsumedCredit[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('consume_subscription_credits', {
      p_user_id: userId,
      p_max_months: maxMonths,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      consumedId: String(r.consumed_id ?? ''),
      monthsFree: Number(r.months_free ?? 0),
      sourceType: String(r.source_type ?? ''),
      sourceId: r.source_id ?? null,
    }));
  } catch {
    return [];
  }
}

export function useCreditsSummary(userId: string | null | undefined) {
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setSummary(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCreditsSummary(userId)
      .then((s) => { if (!cancelled) setSummary(s); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return { summary, loading };
}
