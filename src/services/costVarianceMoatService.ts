// =============================================================================
// COST VARIANCE MOAT SERVICE (R203)
// =============================================================================
// Cohort baseline for actual_cost / quoted_total on completed jobs.
// Ratio > 1 means average cohort contractors overrun; ratio < 1 means
// quoted buffers comfortably cover actuals. Per (trade, country, job_type?).
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_cohort_cost_variance';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CohortCostVariance {
  medianRatio: number | null;
  avgRatio: number | null;
  p25Ratio: number | null;
  p75Ratio: number | null;
  overrunRate: number | null;  // 0.0–1.0
  sampleSize: number;
  contractorCount: number;
  fetchedAt: string;
}

function cacheKey(trade: string, country: string, jobType?: string | null) {
  return `${CACHE_KEY}:${trade}:${country}:${jobType ?? 'any'}`;
}

export async function getCohortCostVariance(
  trade: string,
  country: string,
  jobType?: string | null,
): Promise<CohortCostVariance | null> {
  const key = cacheKey(trade, country, jobType);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CohortCostVariance;
      if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_cohort_cost_variance', {
      p_trade: trade,
      p_country: country,
      p_job_type: jobType ?? null,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const bundle: CohortCostVariance = {
      medianRatio: row.median_ratio ?? null,
      avgRatio: row.avg_ratio ?? null,
      p25Ratio: row.p25_ratio ?? null,
      p75Ratio: row.p75_ratio ?? null,
      overrunRate: row.overrun_rate ?? null,
      sampleSize: Number(row.sample_size ?? 0),
      contractorCount: Number(row.contractor_count ?? 0),
      fetchedAt: new Date().toISOString(),
    };
    void AsyncStorage.setItem(key, JSON.stringify(bundle)).catch(() => {});
    return bundle;
  } catch {
    return null;
  }
}

// Lightweight React hook for surfacing the cohort baseline inside the
// sync intelligence generators (R210 wire-in).
export function useCohortCostVariance(
  trade: string,
  country: string,
  jobType?: string | null,
) {
  const [bundle, setBundle] = useState<CohortCostVariance | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCohortCostVariance(trade, country, jobType ?? null)
      .then(b => { if (!cancelled) setBundle(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [trade, country, jobType]);
  return bundle;
}

export const __internal = { CACHE_KEY, CACHE_TTL_MS, cacheKey };
