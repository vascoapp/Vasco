// =============================================================================
// JOB DURATION MOAT SERVICE (R196) — cohort duration-ratio fallback
// =============================================================================
// Provides a cohort-median duration ratio (actual/estimated) when the
// contractor has no personal job history to learn from. Keeps new
// contractors' duration predictions grounded in real EU6 trade data
// instead of the hardcoded 1.15 fallback.
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_cohort_duration';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — ratios drift slowly

export interface CohortDuration {
  medianRatio: number | null;
  avgRatio: number | null;
  scopeChangeRate: number | null;
  sampleSize: number;
  contractorCount: number;
  fetchedAt: string;
}

function cacheKey(trade: string, jobType?: string | null) {
  return `${CACHE_KEY}:${trade}:${jobType ?? 'any'}`;
}

export async function getCohortDurationRatio(
  trade: string,
  jobType?: string | null,
): Promise<CohortDuration | null> {
  const key = cacheKey(trade, jobType);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CohortDuration;
      if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_cohort_job_duration', {
      p_trade: trade,
      p_job_type: jobType ?? null,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const bundle: CohortDuration = {
      medianRatio: row.median_ratio ?? null,
      avgRatio: row.avg_ratio ?? null,
      scopeChangeRate: row.scope_change_rate ?? null,
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

// R212: React hook for intelligence generators that consume duration cohort.
export function useCohortDuration(trade: string, jobType?: string | null) {
  const [bundle, setBundle] = useState<CohortDuration | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCohortDurationRatio(trade, jobType ?? null)
      .then(b => { if (!cancelled) setBundle(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [trade, jobType]);
  return bundle;
}

export const __internal = { CACHE_KEY, CACHE_TTL_MS, cacheKey };
