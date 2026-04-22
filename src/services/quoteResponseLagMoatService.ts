// =============================================================================
// QUOTE RESPONSE LAG MOAT SERVICE (R202)
// =============================================================================
// Exposes the cohort-median hours-to-accept per (trade, country, customer_type).
// Lets the UI answer "is this quote late to be chased?" by comparing the
// current quote's outstanding age against the cohort's p75 — beyond p75 is
// a strong signal to send a friendly nudge.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_cohort_accept_lag';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CohortAcceptLag {
  p25Hours: number | null;
  medianHours: number | null;
  p75Hours: number | null;
  avgHours: number | null;
  sampleSize: number;
  contractorCount: number;
  fetchedAt: string;
}

/**
 * Classify a specific quote's outstanding age against cohort percentiles.
 * Returns null when the bundle lacks data.
 */
export function classifyLag(
  outstandingHours: number,
  bundle: CohortAcceptLag | null,
): 'fast' | 'typical' | 'slow' | 'overdue' | null {
  if (!bundle || bundle.p75Hours == null || bundle.medianHours == null || bundle.p25Hours == null) return null;
  if (outstandingHours <= bundle.p25Hours) return 'fast';
  if (outstandingHours <= bundle.medianHours) return 'typical';
  if (outstandingHours <= bundle.p75Hours) return 'slow';
  return 'overdue';
}

function cacheKey(trade: string, country: string, customerType?: string | null) {
  return `${CACHE_KEY}:${trade}:${country}:${customerType ?? 'any'}`;
}

export async function getCohortAcceptLag(
  trade: string,
  country: string,
  customerType?: string | null,
): Promise<CohortAcceptLag | null> {
  const key = cacheKey(trade, country, customerType);

  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CohortAcceptLag;
      if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_cohort_accept_lag', {
      p_trade: trade,
      p_country: country,
      p_customer_type: customerType ?? null,
    });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    const bundle: CohortAcceptLag = {
      p25Hours: row.p25_hours ?? null,
      medianHours: row.median_hours ?? null,
      p75Hours: row.p75_hours ?? null,
      avgHours: row.avg_hours ?? null,
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

export const __internal = { CACHE_KEY, CACHE_TTL_MS, cacheKey };
