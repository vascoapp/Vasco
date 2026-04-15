// =============================================================================
// REVENUE DASHBOARD DATA
// =============================================================================
// Pulls real signup + subscription + paid-invoice numbers from Supabase when
// configured. Falls back to zero-value skeleton so the UI renders during
// development without Supabase.
// =============================================================================

import { getSupabase, isSupabaseConfigured } from "./supabase";

const TIER_PRICES_MONTHLY: Record<string, number> = {
  free: 0,
  advanced: 19,
  pro: 39,
  contractor: 69,
};

export interface RevenueSnapshot {
  totalUsers: number;
  paidUsers: number;
  mrr: number;
  paidInvoicesLast30d: number;
  paidInvoiceRevenueLast30d: number;
  tierBreakdown: Record<string, number>;
  countryBreakdown: Record<string, number>;
  fetchedAt: string;
  live: boolean;
}

function empty(live: boolean): RevenueSnapshot {
  return {
    totalUsers: 0,
    paidUsers: 0,
    mrr: 0,
    paidInvoicesLast30d: 0,
    paidInvoiceRevenueLast30d: 0,
    tierBreakdown: { free: 0, advanced: 0, pro: 0, contractor: 0 },
    countryBreakdown: {},
    fetchedAt: new Date().toISOString(),
    live,
  };
}

export async function fetchRevenueSnapshot(): Promise<RevenueSnapshot> {
  if (!isSupabaseConfigured()) return empty(false);
  const supabase = getSupabase();
  if (!supabase) return empty(false);

  try {
    const [{ data: subs }, { data: invoices }, { data: profiles }] = await Promise.all([
      supabase.from("subscriptions").select("tier, status, billing_cycle"),
      supabase
        .from("invoices")
        .select("total, currency, paid_at, status")
        .eq("status", "paid")
        .gte("paid_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from("business_profiles").select("country"),
    ]);

    const snap = empty(true);
    snap.totalUsers = (subs?.length ?? 0) || (profiles?.length ?? 0);

    let mrr = 0;
    let paidUsers = 0;
    for (const s of (subs ?? []) as Array<{ tier?: string; status?: string; billing_cycle?: string }>) {
      const tier = s.tier ?? "free";
      snap.tierBreakdown[tier] = (snap.tierBreakdown[tier] ?? 0) + 1;
      if (s.status === "active" || s.status === "trialing") {
        const monthly = TIER_PRICES_MONTHLY[tier] ?? 0;
        if (monthly > 0) {
          mrr += monthly;
          paidUsers += 1;
        }
      }
    }
    snap.mrr = mrr;
    snap.paidUsers = paidUsers;

    let invRev = 0;
    for (const inv of (invoices ?? []) as Array<{ total?: number }>) {
      invRev += inv.total ?? 0;
    }
    snap.paidInvoicesLast30d = invoices?.length ?? 0;
    snap.paidInvoiceRevenueLast30d = invRev;

    for (const p of (profiles ?? []) as Array<{ country?: string }>) {
      const c = p.country ?? "??";
      snap.countryBreakdown[c] = (snap.countryBreakdown[c] ?? 0) + 1;
    }

    return snap;
  } catch {
    return empty(true);
  }
}
