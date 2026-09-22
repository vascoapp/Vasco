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

export async function getMyPriceWatch(): Promise<PriceWatch> {
  const uid = getAuthedUserId();
  if (!isSupabaseConfigured || !uid) return { tracked: 0, rises: [] };
  try {
    const { data, error } = await (supabase.from('material_price_history') as any)
      .select('supplier_id, supplier_name, material_name, canonical_name, unit, price_excl_vat, observed_at')
      .eq('observed_by', uid)
      .order('observed_at', { ascending: false })
      .limit(2000);
    if (error || !Array.isArray(data)) return { tracked: 0, rises: [] };
    return computePriceRises(data as PriceRow[]);
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
