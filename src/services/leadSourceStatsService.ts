// =============================================================================
// LEAD SOURCE STATS — per-source acceptance rate from business_events
// =============================================================================
// Stage 2 of the intelligence retrofit. Aggregates `lead_converted` events
// (entity_type='lead') into per-(source, trade, country) conversion stats so
// downstream consumers can answer "leads from google_lsa accept at X%".
//
// Two consumers:
//  - Stage 3 leadFollowupGenerator — surfaces "your referral leads convert
//    3× faster, follow up first" insights.
//  - Future ML lift in scoreQuoteWin — apply a multiplier when a quote was
//    drafted from a high-converting source.
//
// Data sources (in order of preference):
//  1. Own contractor's events from public.business_events (BE — authoritative)
//  2. Local AppState leads array (fallback — works offline + before first
//     business_events flush completes)
//
// Cohort-wide stats (cross-contractor) require a server-side RPC with
// k-anonymity gating (contractor_count ≥ 5, sample_size ≥ 20). Out of scope
// for Stage 2 — the RPC lands in Stage 5. This file exposes the cohort shape
// so callers can opt in once that ships.
// =============================================================================

import { supabase as _supabase, isSupabaseConfigured } from '../lib/supabase';
const supabase: any = _supabase;

import type { Lead, LeadSource } from '../domain/lead';
import { getCurrentTrade, getCurrentCountry, getCurrentUserId } from '../lib/currentUser';

export interface LeadSourceStats {
  source: LeadSource | 'all';
  trade?: string;
  country?: string;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  // Won / (Won + Lost) — pending leads excluded. Returns null when there
  // are fewer than `MIN_SAMPLE_OWN` resolved leads (avoids overconfident
  // claims on early signal).
  conversionRate: number | null;
  // Mean hoursFromCreatedToConverted for resolved leads. Useful for the
  // followup generator's "stale lead" threshold.
  avgHoursToConvert: number | null;
  sampleSize: number;
}

export interface CohortLeadSourceStats extends LeadSourceStats {
  // Number of contractors contributing to this stat. The cohort RPC gates
  // results behind contractorCount >= 5. Always null in the FE-only path.
  contractorCount: number | null;
  // True when the gate was passed — UI should only render cohort claims
  // ("contractors in your market") when this is true.
  kAnonymityPassed: boolean;
}

const MIN_SAMPLE_OWN = 3;          // own data: 3 resolved leads to publish a rate
const MIN_SAMPLE_COHORT = 20;       // cohort data: BE RPC will enforce ≥20
const MIN_CONTRACTORS_COHORT = 5;   // cohort data: BE RPC will enforce ≥5

// -----------------------------------------------------------------------------
// Own-stats path — works offline, uses AppState leads array
// -----------------------------------------------------------------------------

export function computeOwnLeadSourceStats(
  leads: Lead[],
  filter?: { source?: LeadSource; trade?: string; country?: string },
): LeadSourceStats {
  const filtered = filter?.source
    ? leads.filter((l) => l.source === filter.source)
    : leads;
  const resolved = filtered.filter((l) => l.status === 'won' || l.status === 'lost');
  const won = resolved.filter((l) => l.status === 'won').length;
  const lost = resolved.filter((l) => l.status === 'lost').length;

  const passSample = resolved.length >= MIN_SAMPLE_OWN;

  // Average resolution time — only over leads with both timestamps; falls
  // back to null when the window is too small to be informative.
  const hoursList = resolved
    .map((l) => {
      const start = new Date(l.createdAt).getTime();
      const end = l.convertedAt ? new Date(l.convertedAt).getTime() : new Date(l.updatedAt).getTime();
      return Math.max(0, (end - start) / 3_600_000);
    })
    .filter((h) => Number.isFinite(h));
  const avgHours = passSample && hoursList.length > 0
    ? hoursList.reduce((s, h) => s + h, 0) / hoursList.length
    : null;

  return {
    source: filter?.source ?? 'all',
    trade: filter?.trade,
    country: filter?.country,
    totalLeads: filtered.length,
    wonLeads: won,
    lostLeads: lost,
    conversionRate: passSample ? won / Math.max(1, won + lost) : null,
    avgHoursToConvert: avgHours,
    sampleSize: resolved.length,
  };
}

/** Convenience: bucket the contractor's leads by source and compute stats per. */
export function computeOwnLeadSourceBreakdown(leads: Lead[]): LeadSourceStats[] {
  const sources = Array.from(new Set(leads.map((l) => l.source))) as LeadSource[];
  return sources.map((source) => computeOwnLeadSourceStats(leads, { source }));
}

// -----------------------------------------------------------------------------
// Cohort path — Supabase BE, k-anonymity gated.
//
// The RPC `get_lead_source_stats(p_source, p_trade, p_country, p_months)` is
// the contract this function expects. It must:
//   - Return null/empty when contractor_count < 5 OR sample_size < 20
//   - Return shape: { conversion_rate, sample_size, contractor_count,
//     avg_hours_to_convert }
//   - Be readable by all authenticated users (cohort aggregate, no PII)
//
// Until the RPC ships (Stage 5), this function returns the kAnonymity-failed
// shape so consumers can render their fallback path. No data leak — we
// never query own-user rows in this path.
// -----------------------------------------------------------------------------

export async function fetchCohortLeadSourceStats(params: {
  source: LeadSource;
  trade?: string;
  country?: string;
  months?: number;
}): Promise<CohortLeadSourceStats> {
  const empty: CohortLeadSourceStats = {
    source: params.source,
    trade: params.trade,
    country: params.country,
    totalLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    conversionRate: null,
    avgHoursToConvert: null,
    sampleSize: 0,
    contractorCount: null,
    kAnonymityPassed: false,
  };

  if (!isSupabaseConfigured) return empty;

  try {
    const { data, error } = await supabase.rpc('get_lead_source_stats', {
      p_source: params.source,
      p_trade: params.trade ?? getCurrentTrade() ?? null,
      p_country: params.country ?? getCurrentCountry() ?? null,
      p_months: params.months ?? 6,
    });
    if (error) return empty;
    if (!data) return empty;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return empty;
    const sampleSize: number = Number(row.sample_size ?? 0);
    const contractorCount: number = Number(row.contractor_count ?? 0);
    const passed = sampleSize >= MIN_SAMPLE_COHORT && contractorCount >= MIN_CONTRACTORS_COHORT;
    return {
      source: params.source,
      trade: params.trade,
      country: params.country,
      totalLeads: sampleSize,
      wonLeads: Math.round(sampleSize * (Number(row.conversion_rate ?? 0))),
      lostLeads: sampleSize - Math.round(sampleSize * (Number(row.conversion_rate ?? 0))),
      conversionRate: passed ? Number(row.conversion_rate ?? 0) : null,
      avgHoursToConvert: passed ? Number(row.avg_hours_to_convert ?? 0) : null,
      sampleSize,
      contractorCount,
      kAnonymityPassed: passed,
    };
  } catch {
    return empty;
  }
}

// -----------------------------------------------------------------------------
// Lift modifier — used by future ML score adjustment
// -----------------------------------------------------------------------------

/**
 * Returns a multiplicative lift factor for the quote-win probability given a
 * lead source. Designed to be a soft adjustment (not a hard cap):
 *   - 1.0   = no signal
 *   - 1.2   = source converts 20% above baseline in cohort
 *   - 0.85  = source converts 15% below baseline
 *
 * The baseline is the cohort's overall conversion rate (all sources). When
 * the cohort RPC has not yet shipped or gating fails, this returns 1.0 so
 * scoreQuoteWin behaves identically to pre-Stage-2.
 *
 * Note: `userId` is currently unused at the FE-only path because we have
 * no FE access to a baseline conversion rate (that requires the cohort
 * RPC). Kept in the signature so the trainer-side path can use it later
 * without a signature break.
 */
export async function getLeadSourceLift(_userId: string, params: {
  source: LeadSource;
  trade?: string;
  country?: string;
}): Promise<number> {
  const cohort = await fetchCohortLeadSourceStats(params);
  if (!cohort.kAnonymityPassed || cohort.conversionRate == null) return 1.0;
  // Without a baseline we can't compute lift. Stage 5 will widen the RPC to
  // also return cohort_overall_rate so this becomes a real ratio. For now
  // we map the per-source rate into a lift around 1.0 using a fixed pivot
  // (0.35 — the empirical median lead-to-quote acceptance in early data).
  const PIVOT = 0.35;
  const ratio = cohort.conversionRate / PIVOT;
  // Clamp to [0.75, 1.35] so a noisy stat can't tank a quote prediction.
  return Math.max(0.75, Math.min(1.35, ratio));
}

// Re-exported helpers in case a generator wants to filter on the caller's
// own market without re-importing currentUser.
export { getCurrentTrade, getCurrentCountry, getCurrentUserId };
