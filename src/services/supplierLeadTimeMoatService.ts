// =============================================================================
// SUPPLIER LEAD-TIME MOAT SERVICE (R204)
// =============================================================================
// Detects supply-chain stress by comparing recent vs baseline median
// lead_time_days per supplier. Complements R192 material drift (prices
// moving) with a time-dimension view (availability moving).
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_leadtime_drift';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — lead times shift faster than prices

export interface LeadTimeDriftRow {
  supplierId: string;
  supplierName: string;
  baselineDays: number;
  recentDays: number;
  driftDays: number;               // signed — positive = slower
  recentSampleSize: number;
  baselineSampleSize: number;
  recentObserverCount: number;
}

export interface LeadTimeDriftBundle {
  rows: LeadTimeDriftRow[];
  fetchedAt: string;
}

export type LeadTimeSeverity = 'medium' | 'high';

/**
 * Coarse severity bucket: >=5 days = high, otherwise medium.
 * Positive driftDays means supply-chain stress — high severity signals
 * the contractor should re-schedule or source elsewhere.
 */
export function severityFor(driftDays: number): LeadTimeSeverity {
  return Math.abs(driftDays) >= 5 ? 'high' : 'medium';
}

function cacheKey(trade: string, country: string) {
  return `${CACHE_KEY}:${trade}:${country}`;
}

export async function getSupplierLeadTimeDrift(
  trade: string,
  country: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<LeadTimeDriftBundle> {
  const key = cacheKey(trade, country);

  if (!opts.forceRefresh) {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as LeadTimeDriftBundle;
        if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
          return parsed;
        }
      }
    } catch {}
  }

  if (!isSupabaseConfigured) return { rows: [], fetchedAt: new Date().toISOString() };

  try {
    const { data, error } = await (supabase.rpc as any)('get_supplier_leadtime_drift', {
      p_trade: trade,
      p_country: country,
    });
    if (error || !Array.isArray(data)) return { rows: [], fetchedAt: new Date().toISOString() };
    const rows: LeadTimeDriftRow[] = (data as any[]).map(r => ({
      supplierId: String(r.supplier_id ?? ''),
      supplierName: String(r.supplier_name ?? ''),
      baselineDays: Number(r.baseline_days ?? 0),
      recentDays: Number(r.recent_days ?? 0),
      driftDays: Number(r.drift_days ?? 0),
      recentSampleSize: Number(r.recent_sample_size ?? 0),
      baselineSampleSize: Number(r.baseline_sample_size ?? 0),
      recentObserverCount: Number(r.recent_observer_count ?? 0),
    }));
    const bundle: LeadTimeDriftBundle = { rows, fetchedAt: new Date().toISOString() };
    void AsyncStorage.setItem(key, JSON.stringify(bundle)).catch(() => {});
    return bundle;
  } catch {
    return { rows: [], fetchedAt: new Date().toISOString() };
  }
}

// R218: React hook for intelligence generators consuming lead-time drift.
export function useSupplierLeadTimeDrift(trade: string, country: string) {
  const [bundle, setBundle] = useState<LeadTimeDriftBundle | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSupplierLeadTimeDrift(trade, country)
      .then(b => { if (!cancelled) setBundle(b); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [trade, country]);
  return bundle;
}

export const __internal = { CACHE_KEY, CACHE_TTL_MS, cacheKey };
