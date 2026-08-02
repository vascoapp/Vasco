// =============================================================================
// COHORT BENCHMARK SERVICE — Cross-contractor pricing intelligence
// =============================================================================
// Aggregates anonymized pricing data across all Vasco users to create
// trade × region × material benchmarks. This is the core data moat.
// =============================================================================
// Data sources:
// 1. Quote line items (recordPricingData in dataCollector)
// 2. Invoice scans (feedPricingMoat in invoiceScanService)
// 3. Job outcomes (emitJobCompleted with actual costs)
// 4. Supplier catalog prices (supplier integrations)
// 5. Public price indexes (priceIndexService)
// =============================================================================

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getScanHistory } from './invoiceScanService';
import { canonicalMaterialKey } from './materialNormalization';

const CACHE_KEY = '@vasco_cohort_benchmarks';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MaterialBenchmark {
  materialName: string;
  category: string;
  trade: string;
  country: string;
  // Price statistics
  avgPrice: number;
  medianPrice: number;
  p25: number;
  p75: number;
  minPrice: number;
  maxPrice: number;
  // Trend
  priceChange30d: number; // percentage
  priceChange90d: number;
  trend: 'rising' | 'stable' | 'falling';
  volatility: number; // 0-1 (stddev / mean)
  // Data quality
  sampleSize: number;
  lastUpdated: string;
  /**
   * Where this benchmark came from. 'cohort' is aggregated across other
   * contractors (k-anonymity >=5, enforced server-side). 'own' is computed
   * locally from THIS contractor's own scan history.
   *
   * Callers must not present 'own' as a market comparison: comparing someone's
   * price against their own past prices and calling it "the market" is circular
   * and will always conclude they are at market. The two are only
   * distinguishable here, so anything drawing a market conclusion has to check.
   */
  source: 'cohort' | 'own';
}

export interface TradeBenchmark {
  trade: string;
  country: string;
  avgHourlyRate: number;
  medianHourlyRate: number;
  avgJobMargin: number;
  avgQuoteAcceptanceRate: number;
  avgDSO: number; // days sales outstanding
  sampleSize: number;
}

export interface CohortStats {
  materialBenchmarks: MaterialBenchmark[];
  tradeBenchmarks: TradeBenchmark[];
  lastSync: string;
  contractorsInCohort: number;
}

// ---------------------------------------------------------------------------
// Fetch from Supabase (when deployed)
// ---------------------------------------------------------------------------

async function fetchCohortFromCloud(trade: string, country: string): Promise<CohortStats | null> {
  if (!isSupabaseConfigured) return null;

  try {
    // Trade-level aggregates (k-anonymity >=5 enforced server-side)
    const { data: tradeRows, error: tradeErr } = await (supabase.rpc as any)(
      'get_trade_pricing_stats',
      { p_trade: trade, p_country: country },
    );
    if (tradeErr) return null;
    const tradeStat = Array.isArray(tradeRows) ? tradeRows[0] : tradeRows;
    const contractorCount: number = Number(tradeStat?.contractor_count ?? 0);

    // Material-level aggregates from the aggregation-only view
    const { data: materialRows, error: matErr } = await (supabase.rpc as any)(
      'get_material_cohort_stats',
      { p_trade: trade, p_country: country },
    );
    if (matErr) return null;

    // Below k-anonymity threshold → let caller fall back to local baselines.
    if (contractorCount < 5 && (!materialRows || materialRows.length === 0)) {
      return null;
    }

    const materialBenchmarks: MaterialBenchmark[] = Array.isArray(materialRows)
      ? materialRows.map((r: any) => ({
          materialName: String(r.material_name ?? ''),
          category: String(r.material_category ?? 'general'),
          trade,
          country,
          avgPrice: Number(r.avg_price ?? 0),
          medianPrice: Number(r.median_price ?? 0),
          p25: Number(r.p25_price ?? 0),
          p75: Number(r.p75_price ?? 0),
          minPrice: Number(r.min_price ?? 0),
          maxPrice: Number(r.max_price ?? 0),
          priceChange30d: 0,
          priceChange90d: 0,
          trend: 'stable' as const,
          volatility: 0,
          sampleSize: Number(r.sample_size ?? 0),
          lastUpdated: String(r.last_observed ?? new Date().toISOString()),
          source: 'cohort' as const,
        }))
      : [];

    // Build a single TradeBenchmark row for (trade, country) from the RPC stat.
    // quoted_unit_price averages are per-line, not strictly hourly rate — but
    // this is the signal the cohort exposes until we tag hourly-line items.
    const tradeBenchmarks: TradeBenchmark[] = tradeStat && contractorCount >= 5
      ? [{
          trade,
          country,
          avgHourlyRate: Number(tradeStat.avg_hourly_rate ?? 0),
          medianHourlyRate: Number(tradeStat.median_hourly_rate ?? 0),
          avgJobMargin: Number(tradeStat.avg_margin ?? 0),
          avgQuoteAcceptanceRate: Number(tradeStat.acceptance_rate ?? 0),
          avgDSO: 0, // sourced from compute_weekly_cohort_stats, not this RPC
          sampleSize: Number(tradeStat.sample_size ?? 0),
        }]
      : [];

    return {
      materialBenchmarks,
      tradeBenchmarks,
      lastSync: new Date().toISOString(),
      contractorsInCohort: contractorCount,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local benchmark computation (from scan history + AppState data)
// ---------------------------------------------------------------------------

async function computeLocalBenchmarks(trade: string, country: string): Promise<CohortStats> {
  const scanHistory = await getScanHistory();

  // Build material benchmarks from scan history
  const priceMap = new Map<string, number[]>();
  for (const scan of scanHistory) {
    for (const item of scan.lineItems) {
      const key = `${item.description.toLowerCase().trim()}|${item.category}`;
      const prices = priceMap.get(key) ?? [];
      prices.push(item.unitPrice);
      priceMap.set(key, prices);
    }
  }

  const materialBenchmarks: MaterialBenchmark[] = [];
  for (const [key, prices] of priceMap) {
    if (prices.length < 1) continue;
    const [name, category] = key.split('|');
    const sorted = [...prices].sort((a, b) => a - b);
    const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const stddev = Math.sqrt(prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length);

    materialBenchmarks.push({
      materialName: name,
      category: category || 'general',
      trade,
      country,
      avgPrice: Math.round(mean * 100) / 100,
      medianPrice: Math.round(median * 100) / 100,
      p25: sorted[Math.floor(sorted.length * 0.25)] ?? sorted[0],
      p75: sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1],
      minPrice: sorted[0],
      maxPrice: sorted[sorted.length - 1],
      priceChange30d: 0,
      priceChange90d: 0,
      trend: 'stable',
      volatility: mean > 0 ? Math.round((stddev / mean) * 100) / 100 : 0,
      sampleSize: prices.length,
      lastUpdated: new Date().toISOString(),
      // Computed from this contractor's own scans, NOT from other contractors.
      source: 'own',
    });
  }

  // Use pre-populated trade baselines for all trades (not just the current one)
  const tradeBenchmarks = getTradeBaselines(undefined, country);

  return {
    materialBenchmarks: materialBenchmarks.sort((a, b) => b.sampleSize - a.sampleSize),
    tradeBenchmarks,
    lastSync: new Date().toISOString(),
    // Static baselines report sampleSize 0 (R34), so this is 0 -- there is no
    // cohort in the local path. The old `?? 150` never fired (0 is not nullish)
    // but read as though a fallback crowd of 150 contractors existed.
    contractorsInCohort: 0,
  };
}

// ---------------------------------------------------------------------------
// Main fetch with cache
// ---------------------------------------------------------------------------

/**
 * @internal R24: direct export retained for the in-service cache flow and
 * for the `useCohortBenchmarks` hook below. UI code should call the hook;
 * non-React contexts (workers, schedulers) call this function directly.
 */
export async function getCohortBenchmarks(trade: string, country: string): Promise<CohortStats> {
  // Check cache
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) return data;
    }
  } catch {}

  // Try cloud first
  const cloud = await fetchCohortFromCloud(trade, country);
  if (cloud) {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: cloud, timestamp: Date.now() })).catch(() => {});
    return cloud;
  }

  // Fall back to local computation
  const local = await computeLocalBenchmarks(trade, country);
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ data: local, timestamp: Date.now() })).catch(() => {});
  return local;
}

// ---------------------------------------------------------------------------
// Benchmark lookup
// ---------------------------------------------------------------------------
// Exact match first — cheapest, and correct when both sides were written the
// same way. Then fall back to canonical comparison, because the benchmark was
// stored under whatever spelling the OBSERVING contractor used: a quote line
// reading "YMvK 3x2,5mm²" would otherwise never find a cohort stored as
// "kabel ymvk 3 x 2.5 mm2". See materialNormalization.ts.
//
// Extracted from compareToMarket so callers that need the benchmark itself
// (price levels, sample size, trend) share one matching rule instead of
// reimplementing it and drifting.
export function findBenchmark(
  materialName: string,
  benchmarks: MaterialBenchmark[],
): MaterialBenchmark | null {
  const wanted = materialName.toLowerCase().trim();
  const exact = benchmarks.find(b => b.materialName === wanted);
  if (exact) return exact;
  const wantedKey = canonicalMaterialKey({ description: materialName }).key;
  if (!wantedKey) return null;
  return benchmarks.find(
    b => canonicalMaterialKey({ description: b.materialName }).key === wantedKey,
  ) ?? null;
}

// ---------------------------------------------------------------------------
// Compare contractor's price to cohort benchmark
// ---------------------------------------------------------------------------

export function compareToMarket(
  materialName: string,
  yourPrice: number,
  benchmarks: MaterialBenchmark[],
): { position: 'below' | 'average' | 'above' | 'unknown'; percentile: number; savings: number } {
  // Exact match first — cheapest, and correct when both sides were written the
  // same way. Then fall back to canonical comparison, because the benchmark was
  // stored under whatever spelling the OBSERVING contractor used: a quote line
  // reading "YMvK 3x2,5mm²" would otherwise never find a cohort stored as
  // "kabel ymvk 3 x 2.5 mm2", and the contractor sees "unknown" while a perfectly
  // good benchmark sits one spelling away. See materialNormalization.ts.
  const match = findBenchmark(materialName, benchmarks);
  if (!match || match.sampleSize < 2) return { position: 'unknown', percentile: 50, savings: 0 };

  if (yourPrice <= match.p25) return { position: 'below', percentile: 25, savings: 0 };
  if (yourPrice >= match.p75) return { position: 'above', percentile: 75, savings: Math.round((yourPrice - match.medianPrice) * 100) / 100 };
  return { position: 'average', percentile: 50, savings: 0 };
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useCohortBenchmarks(trade: string = 'general', country: string = 'NL') {
  const [data, setData] = useState<CohortStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCohortBenchmarks(trade, country)
      .then(setData)
      .finally(() => setLoading(false));
  }, [trade, country]);

  return { benchmarks: data, loading };
}

// ---------------------------------------------------------------------------
// Contractor calibration — personalized pricing signal (R188)
// ---------------------------------------------------------------------------
// Answers "how do you price vs the cohort median, and how does that affect
// your acceptance rate?" Returned null when the user hasn't accumulated
// enough of their own history (>=5 quotes) or cohort is below k-anonymity.

export interface ContractorCalibration {
  medianPriceVsCohortPct: number | null;      // e.g. +8 means 8% above cohort median
  acceptanceRateVsCohortPct: number | null;   // percentage points
  marginVsCohortPct: number | null;           // percentage points
  sampleSize: number;
  cohortSampleSize: number;
  confidence: number;                         // 0.0-1.0
  computedAt: string;
}

export async function getContractorCalibration(
  userId: string,
  trade: string,
  country: string,
): Promise<ContractorCalibration | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_contractor_calibration', {
      p_user_id: userId,
      p_trade: trade,
      p_country: country,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      medianPriceVsCohortPct: row.median_price_vs_cohort_pct ?? null,
      acceptanceRateVsCohortPct: row.acceptance_rate_vs_cohort_pct ?? null,
      marginVsCohortPct: row.margin_vs_cohort_pct ?? null,
      sampleSize: Number(row.sample_size ?? 0),
      cohortSampleSize: Number(row.cohort_sample_size ?? 0),
      confidence: Number(row.confidence ?? 0),
      computedAt: String(row.computed_at ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

// R265: postcode-level cohort surface lives in postcodeCohortService.ts —
// kept separate to avoid pulling cohortBenchmarkService's heavy transitive
// imports (AsyncStorage, invoiceScanService) into job-detail-screen test paths.
export { getPostcodeCohort, usePostcodeCohort, type PostcodeCohort } from './postcodeCohortService';

export function useContractorCalibration(
  userId: string | null | undefined,
  trade: string = 'general',
  country: string = 'NL',
) {
  const [data, setData] = useState<ContractorCalibration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getContractorCalibration(userId, trade, country)
      .then(res => { if (!cancelled) setData(res); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, trade, country]);

  return { calibration: data, loading };
}

// ---------------------------------------------------------------------------
// Line-item edit distribution (R188)
// ---------------------------------------------------------------------------
// "Contractors like you typically adjust this line by +X%". Surfaced next to
// AI-baseline quote lines. Server enforces k-anonymity >=5.

export interface LineEditDistribution {
  sampleSize: number;
  contractorCount: number;
  medianQtyDeltaPct: number | null;
  medianUnitPriceDeltaPct: number | null;
  topReasonCode: string | null;
  topReasonShare: number | null; // 0.0-1.0
}

export async function getLineEditDistribution(
  trade: string,
  country: string,
  descriptionLike: string,
): Promise<LineEditDistribution | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_line_item_edit_distribution', {
      p_trade: trade,
      p_country: country,
      p_description_like: descriptionLike,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      sampleSize: Number(row.sample_size ?? 0),
      contractorCount: Number(row.contractor_count ?? 0),
      medianQtyDeltaPct: row.median_qty_delta_pct ?? null,
      medianUnitPriceDeltaPct: row.median_unit_price_delta_pct ?? null,
      topReasonCode: row.top_reason_code ?? null,
      topReasonShare: row.top_reason_share ?? null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Crew utilization cohort stats (intelligence retrofit Stage 5)
// ---------------------------------------------------------------------------
// "Contractors in your trade run avg N active jobs per worker — you're at M
// on Bas, X.Xσ above cohort". RPC enforces k-anonymity ≥5 contractors.
// Returns null when gate fails so consumers can render their fallback path.

export interface CrewUtilizationCohort {
  avgJobsPerWorker: number | null;
  p25JobsPerWorker: number | null;
  medianJobsPerWorker: number | null;
  p75JobsPerWorker: number | null;
  sampleSize: number;
  contractorCount: number;
  kAnonymityPassed: boolean;
}

export async function getCrewUtilizationCohort(params: {
  trade?: string;
  country?: string;
  months?: number;
}): Promise<CrewUtilizationCohort | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await (supabase.rpc as any)('get_crew_utilization_stats', {
      p_trade: params.trade ?? null,
      p_country: params.country ?? null,
      p_months: params.months ?? 3,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const contractorCount = Number(row.contractor_count ?? 0);
    const passed = contractorCount >= 5 && row.median_jobs_per_worker != null;
    return {
      avgJobsPerWorker: passed ? Number(row.avg_jobs_per_worker ?? 0) : null,
      p25JobsPerWorker: passed ? Number(row.p25_jobs_per_worker ?? 0) : null,
      medianJobsPerWorker: passed ? Number(row.median_jobs_per_worker ?? 0) : null,
      p75JobsPerWorker: passed ? Number(row.p75_jobs_per_worker ?? 0) : null,
      sampleSize: Number(row.sample_size ?? 0),
      contractorCount,
      kAnonymityPassed: passed,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Trade baselines — pre-populated benchmarks for immediate value on signup
// ---------------------------------------------------------------------------
// Covers ALL 6 trades × 6 countries so new users see market data from day one.
// Rates are based on 2025/2026 EU construction market averages.

const TRADE_BASELINES: Record<string, Record<string, Omit<TradeBenchmark, 'trade' | 'country' | 'sampleSize'>>> = {
  plumbing: {
    NL: { avgHourlyRate: 52, medianHourlyRate: 49, avgJobMargin: 23, avgQuoteAcceptanceRate: 0.62, avgDSO: 22 },
    DE: { avgHourlyRate: 58, medianHourlyRate: 55, avgJobMargin: 21, avgQuoteAcceptanceRate: 0.60, avgDSO: 25 },
    FR: { avgHourlyRate: 48, medianHourlyRate: 45, avgJobMargin: 24, avgQuoteAcceptanceRate: 0.58, avgDSO: 28 },
    ES: { avgHourlyRate: 38, medianHourlyRate: 35, avgJobMargin: 26, avgQuoteAcceptanceRate: 0.64, avgDSO: 32 },
    IT: { avgHourlyRate: 42, medianHourlyRate: 40, avgJobMargin: 22, avgQuoteAcceptanceRate: 0.61, avgDSO: 35 },
    UK: { avgHourlyRate: 48, medianHourlyRate: 45, avgJobMargin: 25, avgQuoteAcceptanceRate: 0.66, avgDSO: 20 },
  },
  electrical: {
    NL: { avgHourlyRate: 55, medianHourlyRate: 52, avgJobMargin: 24, avgQuoteAcceptanceRate: 0.60, avgDSO: 21 },
    DE: { avgHourlyRate: 60, medianHourlyRate: 57, avgJobMargin: 22, avgQuoteAcceptanceRate: 0.58, avgDSO: 24 },
    FR: { avgHourlyRate: 50, medianHourlyRate: 47, avgJobMargin: 23, avgQuoteAcceptanceRate: 0.56, avgDSO: 27 },
    ES: { avgHourlyRate: 40, medianHourlyRate: 37, avgJobMargin: 25, avgQuoteAcceptanceRate: 0.62, avgDSO: 30 },
    IT: { avgHourlyRate: 44, medianHourlyRate: 42, avgJobMargin: 21, avgQuoteAcceptanceRate: 0.59, avgDSO: 33 },
    UK: { avgHourlyRate: 50, medianHourlyRate: 47, avgJobMargin: 26, avgQuoteAcceptanceRate: 0.64, avgDSO: 19 },
  },
  gas: {
    NL: { avgHourlyRate: 58, medianHourlyRate: 55, avgJobMargin: 25, avgQuoteAcceptanceRate: 0.68, avgDSO: 20 },
    DE: { avgHourlyRate: 62, medianHourlyRate: 59, avgJobMargin: 23, avgQuoteAcceptanceRate: 0.65, avgDSO: 23 },
    FR: { avgHourlyRate: 52, medianHourlyRate: 49, avgJobMargin: 24, avgQuoteAcceptanceRate: 0.60, avgDSO: 26 },
    ES: { avgHourlyRate: 42, medianHourlyRate: 39, avgJobMargin: 27, avgQuoteAcceptanceRate: 0.66, avgDSO: 29 },
    IT: { avgHourlyRate: 46, medianHourlyRate: 43, avgJobMargin: 23, avgQuoteAcceptanceRate: 0.63, avgDSO: 31 },
    UK: { avgHourlyRate: 55, medianHourlyRate: 52, avgJobMargin: 28, avgQuoteAcceptanceRate: 0.70, avgDSO: 18 },
  },
  carpentry: {
    NL: { avgHourlyRate: 48, medianHourlyRate: 45, avgJobMargin: 22, avgQuoteAcceptanceRate: 0.64, avgDSO: 23 },
    DE: { avgHourlyRate: 52, medianHourlyRate: 49, avgJobMargin: 20, avgQuoteAcceptanceRate: 0.62, avgDSO: 26 },
    FR: { avgHourlyRate: 44, medianHourlyRate: 41, avgJobMargin: 23, avgQuoteAcceptanceRate: 0.60, avgDSO: 29 },
    ES: { avgHourlyRate: 34, medianHourlyRate: 32, avgJobMargin: 25, avgQuoteAcceptanceRate: 0.66, avgDSO: 31 },
    IT: { avgHourlyRate: 38, medianHourlyRate: 36, avgJobMargin: 21, avgQuoteAcceptanceRate: 0.63, avgDSO: 34 },
    UK: { avgHourlyRate: 44, medianHourlyRate: 42, avgJobMargin: 24, avgQuoteAcceptanceRate: 0.68, avgDSO: 21 },
  },
  painting: {
    NL: { avgHourlyRate: 42, medianHourlyRate: 40, avgJobMargin: 20, avgQuoteAcceptanceRate: 0.70, avgDSO: 20 },
    DE: { avgHourlyRate: 46, medianHourlyRate: 44, avgJobMargin: 18, avgQuoteAcceptanceRate: 0.68, avgDSO: 22 },
    FR: { avgHourlyRate: 40, medianHourlyRate: 38, avgJobMargin: 21, avgQuoteAcceptanceRate: 0.65, avgDSO: 25 },
    ES: { avgHourlyRate: 30, medianHourlyRate: 28, avgJobMargin: 24, avgQuoteAcceptanceRate: 0.72, avgDSO: 28 },
    IT: { avgHourlyRate: 34, medianHourlyRate: 32, avgJobMargin: 19, avgQuoteAcceptanceRate: 0.67, avgDSO: 30 },
    UK: { avgHourlyRate: 38, medianHourlyRate: 36, avgJobMargin: 22, avgQuoteAcceptanceRate: 0.74, avgDSO: 18 },
  },
  general: {
    NL: { avgHourlyRate: 50, medianHourlyRate: 48, avgJobMargin: 22, avgQuoteAcceptanceRate: 0.65, avgDSO: 21 },
    DE: { avgHourlyRate: 55, medianHourlyRate: 52, avgJobMargin: 20, avgQuoteAcceptanceRate: 0.62, avgDSO: 24 },
    FR: { avgHourlyRate: 46, medianHourlyRate: 43, avgJobMargin: 22, avgQuoteAcceptanceRate: 0.60, avgDSO: 27 },
    ES: { avgHourlyRate: 36, medianHourlyRate: 34, avgJobMargin: 25, avgQuoteAcceptanceRate: 0.66, avgDSO: 30 },
    IT: { avgHourlyRate: 40, medianHourlyRate: 38, avgJobMargin: 21, avgQuoteAcceptanceRate: 0.63, avgDSO: 33 },
    UK: { avgHourlyRate: 45, medianHourlyRate: 42, avgJobMargin: 24, avgQuoteAcceptanceRate: 0.68, avgDSO: 19 },
  },
};

// ---------------------------------------------------------------------------
// Per-country price multipliers and cheapest suppliers
// ---------------------------------------------------------------------------
// DE is typically 10-15% cheaper than NL for materials. UK prices in GBP
// (but stored as EUR equivalent at ~1.16 GBP/EUR for baseline comparison).

type CountryCode = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';

const COUNTRY_PRICE_FACTORS: Record<CountryCode, number> = {
  NL: 1.00,
  DE: 0.88,  // 12% cheaper than NL
  FR: 0.95,
  ES: 0.82,
  IT: 0.90,
  UK: 1.05,  // GBP equivalent, slightly higher
};

const COUNTRY_SUPPLIERS: Record<CountryCode, Record<string, string>> = {
  NL: {
    plumbing: 'Wildkamp', electrical: 'Rexel', gas: 'Breman',
    carpentry: 'Pontmeyer', painting: 'Verfgroothandel', general: 'Bouwmaat',
  },
  DE: {
    plumbing: 'Richter+Frenzel', electrical: 'Sonepar', gas: 'Buderus',
    carpentry: 'Holz-Richter', painting: 'Brillux', general: 'Bauhaus',
  },
  FR: {
    plumbing: 'Cedeo', electrical: 'Rexel FR', gas: 'Chappée',
    carpentry: 'Gedimat', painting: 'Zolpan', general: 'Point.P',
  },
  ES: {
    plumbing: 'Saltoki', electrical: 'Sonepar ES', gas: 'Roca',
    carpentry: 'Maderas Medina', painting: 'Pinturas Blatem', general: 'BigMat ES',
  },
  IT: {
    plumbing: 'Comet', electrical: 'Sonepar IT', gas: 'Riello',
    carpentry: 'Legnami Trento', painting: 'Boero', general: 'Leroy Merlin IT',
  },
  UK: {
    plumbing: 'Wolseley', electrical: 'Edmundson', gas: 'Plumb Center',
    carpentry: 'Jewson', painting: 'Dulux Trade', general: 'Travis Perkins',
  },
};

interface MaterialBaseline {
  name: string;
  avgPrice: number; // NL base price in EUR
  unit: string;
  cheaperSupplier: string; // default (NL) supplier
  trade: string;
}

// Master material list with NL base prices. Per-country prices derived via COUNTRY_PRICE_FACTORS.
const MATERIAL_MASTER: MaterialBaseline[] = [
  // ---- PLUMBING (20 items) ----
  { name: 'copper pipe 15mm', avgPrice: 3.80, unit: 'meter', cheaperSupplier: 'Wildkamp', trade: 'plumbing' },
  { name: 'copper pipe 22mm', avgPrice: 5.40, unit: 'meter', cheaperSupplier: 'Wildkamp', trade: 'plumbing' },
  { name: 'pvc pipe 40mm', avgPrice: 2.30, unit: 'meter', cheaperSupplier: 'Wildkamp', trade: 'plumbing' },
  { name: 'pvc pipe 110mm', avgPrice: 4.80, unit: 'meter', cheaperSupplier: 'Dyka', trade: 'plumbing' },
  { name: 'solder fittings 15mm', avgPrice: 1.90, unit: 'stuk', cheaperSupplier: 'Breman', trade: 'plumbing' },
  { name: 'push-fit fittings 15mm', avgPrice: 4.10, unit: 'stuk', cheaperSupplier: 'Breman', trade: 'plumbing' },
  { name: 'ball valve 15mm', avgPrice: 8.50, unit: 'stuk', cheaperSupplier: 'Wildkamp', trade: 'plumbing' },
  { name: 'ball valve 22mm', avgPrice: 12.80, unit: 'stuk', cheaperSupplier: 'Wildkamp', trade: 'plumbing' },
  { name: 'thermostatic radiator valve', avgPrice: 22.00, unit: 'stuk', cheaperSupplier: 'Sanitairwinkel', trade: 'plumbing' },
  { name: 'radiator type 22 600x1200', avgPrice: 145.00, unit: 'stuk', cheaperSupplier: 'Radson Direct', trade: 'plumbing' },
  { name: 'combi boiler', avgPrice: 1250.00, unit: 'stuk', cheaperSupplier: 'CV Totaal', trade: 'plumbing' },
  { name: 'expansion vessel 8l', avgPrice: 32.00, unit: 'stuk', cheaperSupplier: 'CV Totaal', trade: 'plumbing' },
  { name: 'circulation pump', avgPrice: 165.00, unit: 'stuk', cheaperSupplier: 'CV Totaal', trade: 'plumbing' },
  { name: 'water heater 80l', avgPrice: 320.00, unit: 'stuk', cheaperSupplier: 'Sanitairwinkel', trade: 'plumbing' },
  { name: 'drain trap', avgPrice: 6.50, unit: 'stuk', cheaperSupplier: 'Wildkamp', trade: 'plumbing' },
  { name: 'toilet fill valve', avgPrice: 14.00, unit: 'stuk', cheaperSupplier: 'Sanitairwinkel', trade: 'plumbing' },
  { name: 'shower mixer', avgPrice: 85.00, unit: 'stuk', cheaperSupplier: 'Sanitairwinkel', trade: 'plumbing' },
  { name: 'water meter', avgPrice: 42.00, unit: 'stuk', cheaperSupplier: 'Wildkamp', trade: 'plumbing' },
  { name: 'pipe insulation 22mm', avgPrice: 2.80, unit: 'meter', cheaperSupplier: 'Isover Direct', trade: 'plumbing' },
  { name: 'flux paste 100g', avgPrice: 4.50, unit: 'stuk', cheaperSupplier: 'Breman', trade: 'plumbing' },

  // ---- ELECTRICAL (15 items) ----
  { name: 'nym cable 3x1.5', avgPrice: 0.85, unit: 'meter', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'nym cable 3x2.5', avgPrice: 1.20, unit: 'meter', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'junction box', avgPrice: 2.40, unit: 'stuk', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'consumer unit 12-way', avgPrice: 185.00, unit: 'stuk', cheaperSupplier: 'Solar', trade: 'electrical' },
  { name: 'mcb 16a', avgPrice: 6.80, unit: 'stuk', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'mcb 32a', avgPrice: 8.50, unit: 'stuk', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'rcd 30ma', avgPrice: 28.00, unit: 'stuk', cheaperSupplier: 'Solar', trade: 'electrical' },
  { name: 'socket outlet', avgPrice: 6.20, unit: 'stuk', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'light switch', avgPrice: 8.50, unit: 'stuk', cheaperSupplier: 'Elektro Breijer', trade: 'electrical' },
  { name: 'led downlight', avgPrice: 14.50, unit: 'stuk', cheaperSupplier: 'Ledvion', trade: 'electrical' },
  { name: 'led panel 60x60', avgPrice: 32.00, unit: 'stuk', cheaperSupplier: 'Ledvion', trade: 'electrical' },
  { name: 'cable tray 2m', avgPrice: 18.00, unit: 'stuk', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'conduit 20mm', avgPrice: 1.20, unit: 'meter', cheaperSupplier: 'Rexel', trade: 'electrical' },
  { name: 'earth rod', avgPrice: 22.00, unit: 'stuk', cheaperSupplier: 'Solar', trade: 'electrical' },
  { name: 'smoke detector', avgPrice: 18.00, unit: 'stuk', cheaperSupplier: 'Rexel', trade: 'electrical' },

  // ---- GAS / HVAC (12 items) ----
  { name: 'gas pipe 22mm', avgPrice: 9.80, unit: 'meter', cheaperSupplier: 'Breman', trade: 'gas' },
  { name: 'gas valve', avgPrice: 18.50, unit: 'stuk', cheaperSupplier: 'Wildkamp', trade: 'gas' },
  { name: 'flue pipe 80/125', avgPrice: 32.00, unit: 'stuk', cheaperSupplier: 'CV Totaal', trade: 'gas' },
  { name: 'condensing boiler', avgPrice: 1450.00, unit: 'stuk', cheaperSupplier: 'CV Totaal', trade: 'gas' },
  { name: 'heat pump air-water', avgPrice: 4200.00, unit: 'stuk', cheaperSupplier: 'Daikin Direct', trade: 'gas' },
  { name: 'smart thermostat', avgPrice: 185.00, unit: 'stuk', cheaperSupplier: 'CV Totaal', trade: 'gas' },
  { name: 'zone valve', avgPrice: 45.00, unit: 'stuk', cheaperSupplier: 'Breman', trade: 'gas' },
  { name: 'gas meter', avgPrice: 85.00, unit: 'stuk', cheaperSupplier: 'Wildkamp', trade: 'gas' },
  { name: 'co detector', avgPrice: 24.00, unit: 'stuk', cheaperSupplier: 'Dyka', trade: 'gas' },
  { name: 'expansion vessel 18l', avgPrice: 48.00, unit: 'stuk', cheaperSupplier: 'CV Totaal', trade: 'gas' },
  { name: 'air vent valve', avgPrice: 8.50, unit: 'stuk', cheaperSupplier: 'Breman', trade: 'gas' },
  { name: 'pressure gauge', avgPrice: 12.00, unit: 'stuk', cheaperSupplier: 'Breman', trade: 'gas' },

  // ---- PAINTING (10 items) ----
  { name: 'wall paint 10l', avgPrice: 42.00, unit: 'emmer', cheaperSupplier: 'Verfgroothandel', trade: 'painting' },
  { name: 'ceiling paint 10l', avgPrice: 38.00, unit: 'emmer', cheaperSupplier: 'Verfgroothandel', trade: 'painting' },
  { name: 'exterior paint 10l', avgPrice: 65.00, unit: 'emmer', cheaperSupplier: 'Sigma', trade: 'painting' },
  { name: 'wood lacquer 2.5l', avgPrice: 28.00, unit: 'blik', cheaperSupplier: 'Verfgroothandel', trade: 'painting' },
  { name: 'primer 10l', avgPrice: 35.00, unit: 'emmer', cheaperSupplier: 'Sigma', trade: 'painting' },
  { name: 'sandpaper p120 pack', avgPrice: 8.50, unit: 'pak', cheaperSupplier: 'Screwfix', trade: 'painting' },
  { name: 'masking tape 50mm', avgPrice: 4.20, unit: 'rol', cheaperSupplier: 'Verfgroothandel', trade: 'painting' },
  { name: 'filler paste 5kg', avgPrice: 14.00, unit: 'emmer', cheaperSupplier: 'Verfgroothandel', trade: 'painting' },
  { name: 'roller set 25cm', avgPrice: 12.00, unit: 'set', cheaperSupplier: 'Verfgroothandel', trade: 'painting' },
  { name: 'brush set 3pc', avgPrice: 15.00, unit: 'set', cheaperSupplier: 'Verfgroothandel', trade: 'painting' },

  // ---- CARPENTRY (12 items) ----
  { name: 'softwood timber 47x100mm', avgPrice: 4.80, unit: 'meter', cheaperSupplier: 'Pontmeyer', trade: 'carpentry' },
  { name: 'plywood 18mm sheet', avgPrice: 42.00, unit: 'plaat', cheaperSupplier: 'Houthandel', trade: 'carpentry' },
  { name: 'mdf 18mm sheet', avgPrice: 28.00, unit: 'plaat', cheaperSupplier: 'Pontmeyer', trade: 'carpentry' },
  { name: 'osb 18mm sheet', avgPrice: 22.00, unit: 'plaat', cheaperSupplier: 'Houthandel', trade: 'carpentry' },
  { name: 'wood screws 50mm box', avgPrice: 12.50, unit: 'doos', cheaperSupplier: 'Screwfix', trade: 'carpentry' },
  { name: 'wood glue 750ml', avgPrice: 8.90, unit: 'stuk', cheaperSupplier: 'Pontmeyer', trade: 'carpentry' },
  { name: 'door blank 826x2040', avgPrice: 68.00, unit: 'stuk', cheaperSupplier: 'Skantrae', trade: 'carpentry' },
  { name: 'skirting board 100mm', avgPrice: 3.20, unit: 'meter', cheaperSupplier: 'Pontmeyer', trade: 'carpentry' },
  { name: 'architrave 69mm', avgPrice: 2.40, unit: 'meter', cheaperSupplier: 'Pontmeyer', trade: 'carpentry' },
  { name: 'hinges pair', avgPrice: 6.50, unit: 'paar', cheaperSupplier: 'Screwfix', trade: 'carpentry' },
  { name: 'door handle set', avgPrice: 18.00, unit: 'set', cheaperSupplier: 'Screwfix', trade: 'carpentry' },
  { name: 'insulation 100mm', avgPrice: 12.00, unit: 'm2', cheaperSupplier: 'Isover Direct', trade: 'carpentry' },

  // ---- GENERAL (10 items) ----
  { name: 'cement 25kg', avgPrice: 5.80, unit: 'zak', cheaperSupplier: 'BigMat', trade: 'general' },
  { name: 'sand m3', avgPrice: 32.00, unit: 'm3', cheaperSupplier: 'BigMat', trade: 'general' },
  { name: 'plasterboard 2400x1200', avgPrice: 8.50, unit: 'plaat', cheaperSupplier: 'Bouwmaat', trade: 'general' },
  { name: 'joint compound 25kg', avgPrice: 18.00, unit: 'zak', cheaperSupplier: 'Bouwmaat', trade: 'general' },
  { name: 'silicone sealant 300ml', avgPrice: 5.50, unit: 'stuk', cheaperSupplier: 'Bouwmaat', trade: 'general' },
  { name: 'expanding foam 750ml', avgPrice: 7.80, unit: 'stuk', cheaperSupplier: 'Bouwmaat', trade: 'general' },
  { name: 'damp proof membrane', avgPrice: 3.20, unit: 'm2', cheaperSupplier: 'BigMat', trade: 'general' },
  { name: 'breeze block', avgPrice: 1.80, unit: 'stuk', cheaperSupplier: 'BigMat', trade: 'general' },
  { name: 'steel lintel 1200mm', avgPrice: 28.00, unit: 'stuk', cheaperSupplier: 'Bouwmaat', trade: 'general' },
  { name: 'aggregate m3', avgPrice: 38.00, unit: 'm3', cheaperSupplier: 'BigMat', trade: 'general' },
];

// Build the legacy MATERIAL_BASELINES lookup from MATERIAL_MASTER (backwards compatible)
const MATERIAL_BASELINES: Record<string, { name: string; avgPrice: number; unit: string; cheaperSupplier: string }[]> = {};
for (const item of MATERIAL_MASTER) {
  if (!MATERIAL_BASELINES[item.trade]) MATERIAL_BASELINES[item.trade] = [];
  MATERIAL_BASELINES[item.trade].push({
    name: item.name,
    avgPrice: item.avgPrice,
    unit: item.unit,
    cheaperSupplier: item.cheaperSupplier,
  });
}

/**
 * Get pre-populated trade baselines for all 6 trades × 6 countries.
 * Returns meaningful benchmarks immediately, even for brand new users.
 */
export function getTradeBaselines(trade?: string, country?: string): TradeBenchmark[] {
  const trades = trade ? [trade] : Object.keys(TRADE_BASELINES);
  const countries = country ? [country] : ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'];
  const baselines: TradeBenchmark[] = [];

  for (const t of trades) {
    const tradeData = TRADE_BASELINES[t] ?? TRADE_BASELINES['general'];
    for (const c of countries) {
      const data = tradeData[c] ?? tradeData['NL'];
      baselines.push({
        trade: t,
        country: c,
        ...data,
        // R34: was `150 + Math.floor(Math.random() * 100)` — every call
        // returned a different fake "sample size" (150-249) so the UI
        // chart claimed "based on 187 contractors" then "based on 213"
        // on next render. Real sample sizes flow from the cohort BE
        // tables (R195+); for static baselines (no cohort data yet)
        // return 0 to indicate honest "static baseline" provenance.
        sampleSize: 0,
      });
    }
  }
  return baselines;
}

/**
 * Get material baselines for a specific trade (NL base prices).
 * Used by invoiceScanService for first-scan price comparisons.
 */
export function getMaterialBaselines(trade: string = 'general'): typeof MATERIAL_BASELINES[string] {
  return MATERIAL_BASELINES[trade] ?? MATERIAL_BASELINES['general'];
}

/**
 * Get material baselines adjusted for a specific country.
 * DE prices are ~12% lower than NL, ES ~18% lower, UK ~5% higher, etc.
 * Returns the cheapest local supplier per country.
 */
export function getMaterialBaselinesForCountry(
  trade: string = 'general',
  country: CountryCode = 'NL',
): { name: string; avgPrice: number; unit: string; cheaperSupplier: string }[] {
  const baseTrade = MATERIAL_BASELINES[trade] ?? MATERIAL_BASELINES['general'];
  const factor = COUNTRY_PRICE_FACTORS[country] ?? 1.0;
  const suppliers = COUNTRY_SUPPLIERS[country] ?? COUNTRY_SUPPLIERS['NL'];
  const tradeSupplier = suppliers[trade] ?? suppliers['general'];

  return baseTrade.map(item => ({
    name: item.name,
    avgPrice: Math.round(item.avgPrice * factor * 100) / 100,
    unit: item.unit,
    cheaperSupplier: country === 'NL' ? item.cheaperSupplier : tradeSupplier,
  }));
}

/**
 * Get ALL material baselines across all trades for a country.
 * Useful for comprehensive price comparison and AI recommendations.
 */
export function getAllMaterialBaselines(country: CountryCode = 'NL'): { name: string; avgPrice: number; unit: string; cheaperSupplier: string; trade: string }[] {
  const factor = COUNTRY_PRICE_FACTORS[country] ?? 1.0;
  const suppliers = COUNTRY_SUPPLIERS[country] ?? COUNTRY_SUPPLIERS['NL'];

  return MATERIAL_MASTER.map(item => ({
    name: item.name,
    avgPrice: Math.round(item.avgPrice * factor * 100) / 100,
    unit: item.unit,
    cheaperSupplier: country === 'NL' ? item.cheaperSupplier : (suppliers[item.trade] ?? suppliers['general']),
    trade: item.trade,
  }));
}

