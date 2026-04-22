// =============================================================================
// MARGIN DRIFT SERVICE (R200)
// =============================================================================
// Cohort-level margin compression/expansion signal. Mirror of
// materialDriftService but on pricing_intelligence.margin_percent.
//
// If `recent_median_margin` drops vs baseline, the trade is compressing —
// a leading indicator to raise prices or tighten material sourcing. If
// expanding, the trade is pricing stronger and the contractor has room
// to hold or raise.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_margin_drift';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — margin shifts slowly

export type MarginDriftSeverity = 'medium' | 'high';

export interface MarginDrift {
  recentMedianMargin: number;
  baselineMedianMargin: number;
  driftPp: number; // signed, percentage points
  recentSampleSize: number;
  baselineSampleSize: number;
  recentContractorCount: number;
  baselineContractorCount: number;
  fetchedAt: string;
}

export function severityFor(driftPp: number): MarginDriftSeverity {
  return Math.abs(driftPp) >= 5 ? 'high' : 'medium';
}

export function directionFor(driftPp: number): 'up' | 'down' {
  return driftPp >= 0 ? 'up' : 'down';
}

function cacheKey(trade: string, country: string) {
  return `${CACHE_KEY}:${trade}:${country}`;
}

export async function getMarginDrift(
  trade: string,
  country: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<MarginDrift | null> {
  const key = cacheKey(trade, country);

  if (!opts.forceRefresh) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as MarginDrift;
        if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
          return parsed;
        }
      }
    } catch {}
  }

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_margin_drift', {
      p_trade: trade,
      p_country: country,
    });
    if (error || !Array.isArray(data) || data.length === 0) return null;
    const row = data[0];
    const bundle: MarginDrift = {
      recentMedianMargin: Number(row.recent_median_margin ?? 0),
      baselineMedianMargin: Number(row.baseline_median_margin ?? 0),
      driftPp: Number(row.drift_pp ?? 0),
      recentSampleSize: Number(row.recent_sample_size ?? 0),
      baselineSampleSize: Number(row.baseline_sample_size ?? 0),
      recentContractorCount: Number(row.recent_contractor_count ?? 0),
      baselineContractorCount: Number(row.baseline_contractor_count ?? 0),
      fetchedAt: new Date().toISOString(),
    };
    void AsyncStorage.setItem(key, JSON.stringify(bundle)).catch(() => {});
    return bundle;
  } catch {
    return null;
  }
}

export const __internal = { CACHE_KEY, CACHE_TTL_MS, cacheKey };
