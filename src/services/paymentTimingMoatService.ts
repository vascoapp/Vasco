// =============================================================================
// PAYMENT TIMING MOAT SERVICE (R195) — cohort DSO fallback
// =============================================================================
// Provides a cohort-median DSO when the contractor has no personal invoice
// history to learn from. Keeps new contractors' payment-timing predictions
// grounded in real EU6 market data instead of a hardcoded 21-day default.
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_cohort_dso';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — DSO doesn't change hour-to-hour

export interface CohortDso {
  medianDso: number | null;
  avgDso: number | null;
  onTimeRate: number | null;
  sampleSize: number;
  contractorCount: number;
  fetchedAt: string;
}

function cacheKey(country: string, customerType?: string | null) {
  return `${CACHE_KEY}:${country}:${customerType ?? 'any'}`;
}

export async function getCohortDso(
  country: string,
  customerType?: string | null,
): Promise<CohortDso | null> {
  const key = cacheKey(country, customerType);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CohortDso;
      if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_cohort_dso', {
      p_country: country,
      p_customer_type: customerType ?? null,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const bundle: CohortDso = {
      medianDso: row.median_dso ?? null,
      avgDso: row.avg_dso ?? null,
      onTimeRate: row.on_time_rate ?? null,
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

// R211: React hook for intelligence generators / UI surfaces.
export function useCohortDso(country: string, customerType?: string | null) {
  const [bundle, setBundle] = useState<CohortDso | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCohortDso(country, customerType ?? null)
      .then(b => { if (!cancelled) setBundle(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [country, customerType]);
  return bundle;
}

export const __internal = { CACHE_KEY, CACHE_TTL_MS, cacheKey };
