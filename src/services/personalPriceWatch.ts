// =============================================================================
// PERSONAL PRICE WATCH — has YOUR supplier raised a price you pay? (2026-09-22)
// =============================================================================
// DATANORM price lists and supplier e-invoices land in material_price_history
// under the contractor's own id. Every existing price card on Inkoop is
// COHORT-level (MaterialDriftCard ≥3 observers, PriceDropAlertCard ≥5), so
// with a handful of contractors per region they stay empty — and none ever
// compared a contractor with their own history. This does: same supplier,
// same material, same unit, latest price against the one before it.
//
// Reads only the contractor's own rows (RLS: "Users read own material
// prices"). Nothing leaves the device and nothing is written.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAuthedUserId } from '../lib/currentUser';

export interface PriceRow {
  supplier_id: string | null;
  supplier_name: string | null;
  material_name: string;
  canonical_name: string | null;
  unit: string | null;
  price_excl_vat: number | null;
  observed_at: string;
}

export interface PriceRise {
  key: string;
  materialName: string;
  supplierName: string;
  unit: string;
  previous: number;
  latest: number;
  /** Whole percent, e.g. 8 for +8 %. */
  pct: number;
  latestAt: string;
}

export interface PriceWatch {
  /** Material × supplier × unit combinations seen at least twice. */
  tracked: number;
  rises: PriceRise[];
}

/** A rise smaller than this is noise (rounding, a pack size) — not an alert. */
export const PRICE_RISE_THRESHOLD_PCT = 5;

const dayOf = (iso: string) => iso.slice(0, 10);

/**
 * Pure: group by supplier + material + unit, compare the latest observation
 * with the most recent one from an EARLIER day. Two rows from the same import
 * (same day) are the same price list, not a change.
 */
export function computePriceRises(rows: PriceRow[], limit = 5): PriceWatch {
  const groups = new Map<string, PriceRow[]>();
  for (const r of rows) {
    if (!r.price_excl_vat || r.price_excl_vat <= 0 || !r.observed_at) continue;
    const material = (r.canonical_name || r.material_name || '').trim().toLowerCase();
    if (!material) continue;
    const key = `${r.supplier_id ?? r.supplier_name ?? '?'}|${material}|${(r.unit ?? '').toLowerCase()}`;
    const list = groups.get(key);
    if (list) list.push(r); else groups.set(key, [r]);
  }

  let tracked = 0;
  const rises: PriceRise[] = [];
  for (const [key, list] of groups) {
    list.sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    const latest = list[0];
    const previous = list.find((r) => dayOf(r.observed_at) < dayOf(latest.observed_at));
    if (!previous) continue;
    tracked++;
    const from = previous.price_excl_vat as number;
    const to = latest.price_excl_vat as number;
    const pct = Math.round(((to - from) / from) * 100);
    if (pct >= PRICE_RISE_THRESHOLD_PCT) {
      rises.push({
        key,
        materialName: latest.material_name,
        supplierName: latest.supplier_name ?? latest.supplier_id ?? '',
        unit: latest.unit ?? '',
        previous: from,
        latest: to,
        pct,
        latestAt: latest.observed_at,
      });
    }
  }
  rises.sort((a, b) => b.pct - a.pct);
  return { tracked, rises: rises.slice(0, limit) };
}

/** One row per supplier + material + unit, from get_my_price_pairs. */
interface PricePair {
  supplier_id: string;
  supplier_name: string | null;
  material_name: string;
  unit: string;
  previous_price: number;
  previous_day: string;
  latest_price: number;
  latest_day: string;
  total_pairs: number;
}

/**
 * The database groups ALL of the contractor's rows (get_my_price_pairs,
 * migration 20260923000001) and returns latest vs previous per group, biggest
 * rise first, with the true total. Reading the newest 2,000 raw rows instead
 * saw only the latest import of a large price list — no earlier price, no
 * rise, ever (review #366). The pairs are turned back into two observations
 * each so computePriceRises stays the single definition of "a rise".
 */
export async function getMyPriceWatch(): Promise<PriceWatch> {
  const uid = getAuthedUserId();
  if (!isSupabaseConfigured || !uid) return { tracked: 0, rises: [] };
  try {
    const { data, error } = await (supabase.rpc as any)('get_my_price_pairs', { p_limit: 200 });
    if (error || !Array.isArray(data) || data.length === 0) return { tracked: 0, rises: [] };
    const pairs = data as PricePair[];
    const rows: PriceRow[] = pairs.flatMap((p) => {
      const base = { supplier_id: p.supplier_id, supplier_name: p.supplier_name, material_name: p.material_name, canonical_name: null, unit: p.unit };
      return [
        { ...base, price_excl_vat: Number(p.previous_price), observed_at: `${p.previous_day}T00:00:00Z` },
        { ...base, price_excl_vat: Number(p.latest_price), observed_at: `${p.latest_day}T00:00:00Z` },
      ];
    });
    const watch = computePriceRises(rows);
    return { tracked: Number(pairs[0].total_pairs) || watch.tracked, rises: watch.rises };
  } catch {
    return { tracked: 0, rises: [] };
  }
}

export function useMyPriceWatch(): { watch: PriceWatch; loaded: boolean; refresh: () => void } {
  const [watch, setWatch] = useState<PriceWatch>({ tracked: 0, rises: [] });
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getMyPriceWatch().then((w) => { if (!cancelled) { setWatch(w); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [tick]);
  // After an import: re-read, so a rise the new price list reveals shows at once.
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { watch, loaded, refresh };
}
