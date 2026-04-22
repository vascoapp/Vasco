// =============================================================================
// SEASONALITY MOAT SERVICE (R197) — per-season cohort patterns
// =============================================================================
// Two readers, both k-anonymity-gated server-side:
//   1. getQuoteSeasonalPattern(trade, country) — acceptance rate + median
//      price per season, derived from pricing_intelligence.season.
//   2. getMaterialSeasonalPattern(trade, country, materialName?) — median
//      supplier price per (season, material), derived by bucketing
//      material_price_history.observed_at into seasons server-side.
// Both share 24h AsyncStorage caching and a small season-of-now helper.
// =============================================================================

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const CACHE_KEY_QUOTE = '@vasco_seasonal_quote';
const CACHE_KEY_MATERIAL = '@vasco_seasonal_material';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export interface QuoteSeasonalRow {
  season: Season;
  medianPrice: number;
  acceptanceRate: number;
  sampleSize: number;
  contractorCount: number;
}

export interface MaterialSeasonalRow {
  season: Season;
  materialName: string;
  unit: string;
  medianPrice: number;
  sampleSize: number;
  observerCount: number;
}

export interface QuoteSeasonalBundle {
  rows: QuoteSeasonalRow[];
  fetchedAt: string;
}

export interface MaterialSeasonalBundle {
  rows: MaterialSeasonalRow[];
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Season-of-now helper (Northern-hemisphere meteorological seasons)
// ---------------------------------------------------------------------------

export function seasonOfMonth(month1to12: number): Season {
  if (month1to12 === 12 || month1to12 === 1 || month1to12 === 2) return 'winter';
  if (month1to12 >= 3 && month1to12 <= 5) return 'spring';
  if (month1to12 >= 6 && month1to12 <= 8) return 'summer';
  return 'autumn';
}

export function currentSeason(now: Date = new Date()): Season {
  return seasonOfMonth(now.getMonth() + 1);
}

// ---------------------------------------------------------------------------
// Quote seasonality (pricing_intelligence)
// ---------------------------------------------------------------------------

function quoteCacheKey(trade: string, country: string) {
  return `${CACHE_KEY_QUOTE}:${trade}:${country}`;
}

export async function getQuoteSeasonalPattern(
  trade: string,
  country: string,
): Promise<QuoteSeasonalBundle | null> {
  const key = quoteCacheKey(trade, country);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as QuoteSeasonalBundle;
      if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_seasonal_pattern', {
      p_trade: trade,
      p_country: country,
    });
    if (error || !Array.isArray(data)) return null;
    const rows: QuoteSeasonalRow[] = (data as any[]).map(r => ({
      season: r.season as Season,
      medianPrice: Number(r.median_price ?? 0),
      acceptanceRate: Number(r.acceptance_rate ?? 0),
      sampleSize: Number(r.sample_size ?? 0),
      contractorCount: Number(r.contractor_count ?? 0),
    }));
    const bundle: QuoteSeasonalBundle = { rows, fetchedAt: new Date().toISOString() };
    void AsyncStorage.setItem(key, JSON.stringify(bundle)).catch(() => {});
    return bundle;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Material seasonality (material_price_history)
// ---------------------------------------------------------------------------

function materialCacheKey(trade: string, country: string, materialName?: string | null) {
  return `${CACHE_KEY_MATERIAL}:${trade}:${country}:${materialName ?? 'all'}`;
}

export async function getMaterialSeasonalPattern(
  trade: string,
  country: string,
  materialName?: string | null,
): Promise<MaterialSeasonalBundle | null> {
  const key = materialCacheKey(trade, country, materialName);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as MaterialSeasonalBundle;
      if (Date.now() - new Date(parsed.fetchedAt).getTime() < CACHE_TTL_MS) {
        return parsed;
      }
    }
  } catch {}

  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await (supabase.rpc as any)('get_material_seasonal_pattern', {
      p_trade: trade,
      p_country: country,
      p_material_name: materialName ?? null,
    });
    if (error || !Array.isArray(data)) return null;
    const rows: MaterialSeasonalRow[] = (data as any[]).map(r => ({
      season: r.season as Season,
      materialName: String(r.material_name ?? ''),
      unit: String(r.unit ?? ''),
      medianPrice: Number(r.median_price ?? 0),
      sampleSize: Number(r.sample_size ?? 0),
      observerCount: Number(r.observer_count ?? 0),
    }));
    const bundle: MaterialSeasonalBundle = { rows, fetchedAt: new Date().toISOString() };
    void AsyncStorage.setItem(key, JSON.stringify(bundle)).catch(() => {});
    return bundle;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Analysis helpers — used by UI to decide whether a signal is worth showing
// ---------------------------------------------------------------------------

/**
 * Given a quote-seasonality bundle, return the acceptance-rate delta
 * between the current season and the best season, along with the best.
 * Returns null when data is too thin or a current-season row is absent.
 */
export function acceptanceDeltaVsBest(
  bundle: QuoteSeasonalBundle | null,
  now: Date = new Date(),
): { current: QuoteSeasonalRow; best: QuoteSeasonalRow; deltaPp: number } | null {
  if (!bundle || bundle.rows.length < 2) return null;
  const season = currentSeason(now);
  const current = bundle.rows.find(r => r.season === season);
  if (!current) return null;
  const best = bundle.rows.reduce((acc, r) =>
    r.acceptanceRate > acc.acceptanceRate ? r : acc, bundle.rows[0]);
  return {
    current,
    best,
    deltaPp: (best.acceptanceRate - current.acceptanceRate) * 100,
  };
}

/**
 * For a specific material, compute the current-season median price vs the
 * cheapest season. Returns null when fewer than 2 seasons have data for
 * that material.
 */
export function materialPriceVsCheapestSeason(
  bundle: MaterialSeasonalBundle | null,
  materialNameLower: string,
  now: Date = new Date(),
): { current: MaterialSeasonalRow; cheapest: MaterialSeasonalRow; pctAboveCheapest: number } | null {
  if (!bundle) return null;
  const forMaterial = bundle.rows.filter(r => r.materialName === materialNameLower);
  if (forMaterial.length < 2) return null;
  const season = currentSeason(now);
  const current = forMaterial.find(r => r.season === season);
  if (!current || !(current.medianPrice > 0)) return null;
  const cheapest = forMaterial.reduce((acc, r) =>
    r.medianPrice > 0 && r.medianPrice < acc.medianPrice ? r : acc, forMaterial[0]);
  if (!(cheapest.medianPrice > 0)) return null;
  return {
    current,
    cheapest,
    pctAboveCheapest: ((current.medianPrice - cheapest.medianPrice) / cheapest.medianPrice) * 100,
  };
}

// ---------------------------------------------------------------------------
// React hooks
// ---------------------------------------------------------------------------

export function useQuoteSeasonal(trade: string, country: string) {
  const [bundle, setBundle] = useState<QuoteSeasonalBundle | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getQuoteSeasonalPattern(trade, country)
      .then(b => { if (!cancelled) setBundle(b); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trade, country]);
  return { bundle, loading };
}

export function useMaterialSeasonal(
  trade: string,
  country: string,
  materialName?: string | null,
) {
  const [bundle, setBundle] = useState<MaterialSeasonalBundle | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMaterialSeasonalPattern(trade, country, materialName ?? null)
      .then(b => { if (!cancelled) setBundle(b); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trade, country, materialName]);
  return { bundle, loading };
}

export const __internal = {
  CACHE_KEY_QUOTE,
  CACHE_KEY_MATERIAL,
  CACHE_TTL_MS,
  seasonOfMonth,
  currentSeason,
};
