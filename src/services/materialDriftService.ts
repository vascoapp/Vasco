// =============================================================================
// MATERIAL DRIFT SERVICE (R192)
// =============================================================================
// Fetches supplier + material price drift from the cohort. Surfaces changes
// the contractor should act on:
//   - Re-quote pending jobs when prices rose (margin preservation)
//   - Switch suppliers when ONE supplier drifted but the market didn't
//   - Wait to re-order when a single-supplier drop is observable
//
// Data flows through `get_material_drift` RPC which enforces k-anonymity
// (>=3 observers per supplier+material cell in recent window).
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY = '@vasco_material_drift';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — drift isn't time-sensitive enough to poll

// Severity bucketing. Deliberately biased toward "medium" as the default
// because a 5-10% move can be statistical noise on thin cells; the jump to
// "high" signals real action is warranted.
const SEVERITY_MEDIUM_MIN = 5;   // first surfaced at 5% (matches RPC threshold)
const SEVERITY_HIGH_MIN = 12;    // >=12% is "act now"

export type DriftSeverity = 'medium' | 'high';

export interface MaterialDriftRow {
  materialName: string;
  materialCategory: string | null;
  unit: string;
  supplierId: string;
  supplierName: string;
  baselinePrice: number;
  recentPrice: number;
  driftPct: number;              // signed: negative = price drop
  recentSampleSize: number;
  baselineSampleSize: number;
  recentObserverCount: number;
  isMarketWide: boolean;
}

export interface DriftBundle {
  rows: MaterialDriftRow[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

export function severityFor(driftPct: number): DriftSeverity {
  return Math.abs(driftPct) >= SEVERITY_HIGH_MIN ? 'high' : 'medium';
}

export function directionFor(driftPct: number): 'up' | 'down' {
  return driftPct >= 0 ? 'up' : 'down';
}

// ---------------------------------------------------------------------------
// Fetch + cache
// ---------------------------------------------------------------------------

async function fetchFromCloud(
  trade: string,
  country: string,
): Promise<MaterialDriftRow[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('get_material_drift', {
      p_trade: trade,
      p_country: country,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map(r => ({
      materialName: String(r.material_name ?? ''),
      materialCategory: r.material_category ?? null,
      unit: String(r.unit ?? ''),
      supplierId: String(r.supplier_id ?? ''),
      supplierName: String(r.supplier_name ?? ''),
      baselinePrice: Number(r.baseline_price ?? 0),
      recentPrice: Number(r.recent_price ?? 0),
      driftPct: Number(r.drift_pct ?? 0),
      recentSampleSize: Number(r.recent_sample_size ?? 0),
      baselineSampleSize: Number(r.baseline_sample_size ?? 0),
      recentObserverCount: Number(r.recent_observer_count ?? 0),
      isMarketWide: Boolean(r.is_market_wide),
    }));
  } catch {
    return [];
  }
}

async function readCache(key: string): Promise<DriftBundle | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriftBundle;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(key: string, bundle: DriftBundle): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(bundle));
  } catch {
    // silent — cache write failures never block the UI
  }
}

function cacheKey(trade: string, country: string) {
  return `${CACHE_KEY}:${trade}:${country}`;
}

export async function getMaterialDrift(
  trade: string,
  country: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<DriftBundle> {
  const key = cacheKey(trade, country);
  if (!opts.forceRefresh) {
    const cached = await readCache(key);
    if (cached) return cached;
  }
  const rows = await fetchFromCloud(trade, country);
  const bundle: DriftBundle = { rows, fetchedAt: new Date().toISOString() };
  void writeCache(key, bundle);
  return bundle;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useMaterialDrift(trade: string, country: string) {
  const [bundle, setBundle] = useState<DriftBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMaterialDrift(trade, country)
      .then(b => { if (!cancelled) setBundle(b); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trade, country]);

  const refresh = async () => {
    const b = await getMaterialDrift(trade, country, { forceRefresh: true });
    setBundle(b);
  };

  return { drift: bundle, loading, refresh };
}

// ---------------------------------------------------------------------------
// Match drift → open quotes (R193)
// ---------------------------------------------------------------------------
// A drift signal is only actionable when the contractor can see which of
// their own open quotes are affected. We pattern-match drift.materialName
// against each line's description using the same first-3-token key we
// already use in TieredQuoteBuilder line hints.

interface LineLike { description: string }
interface QuoteLike {
  id: string;
  status?: string;
  lineItems?: LineLike[];
}

function firstTokens(s: string, n = 2): string {
  return s.toLowerCase().split(/\s+/).filter(Boolean).slice(0, n).join(' ');
}

/**
 * For each drift row, return the IDs of OPEN quotes (status = draft | sent)
 * whose line items reference the same material (by first-2-token fuzzy
 * match against the line description).
 *
 * Returned map is keyed by driftRow.materialName (already lower-cased).
 */
export function matchQuotesToDrift(
  drifts: MaterialDriftRow[],
  quotes: QuoteLike[],
): Record<string, string[]> {
  if (!drifts || drifts.length === 0) return {};
  const out: Record<string, string[]> = {};
  const openQuotes = quotes.filter(
    q => q.status === 'draft' || q.status === 'sent' || q.status === undefined,
  );
  for (const d of drifts) {
    const driftKey = firstTokens(d.materialName);
    if (!driftKey) continue;
    const affected: string[] = [];
    for (const q of openQuotes) {
      const lines = q.lineItems ?? [];
      if (lines.some(l => firstTokens(l.description).includes(driftKey) || driftKey.includes(firstTokens(l.description)))) {
        affected.push(q.id);
      }
    }
    if (affected.length > 0) out[d.materialName] = affected;
  }
  return out;
}

// Exported for tests only.
export const __internal = {
  CACHE_KEY,
  CACHE_TTL_MS,
  SEVERITY_MEDIUM_MIN,
  SEVERITY_HIGH_MIN,
  firstTokens,
};
