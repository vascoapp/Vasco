// =============================================================================
// SALES-TAX SERVICE — TaxJar-backed per-zip US tax lookup (R82 US Phase 5)
// =============================================================================
// US sales tax is brutal: state base rate is only ~30% of what the customer
// actually pays. Counties, cities, and special districts add 2-5% on top.
// A Houston customer pays 8.25% (6.25% TX state + 1% Houston + 1% MTA),
// not 6.25%. An Austin customer pays 8.25% (6.25% TX state + 2% Austin).
// LA: 9.5%. NYC: 8.875%. Without a real lookup, every multi-jurisdictional
// invoice ships wrong tax.
//
// This service wraps a Supabase tax-lookup edge function proxying to
// TaxJar's `/v2/rates/{zip}` endpoint. Falls back to the static state
// rate (usSalesTax.ts) when:
//   - feature flag tax_real_lookup is off
//   - TaxJar creds aren't set (returns 503)
//   - the network call fails
//
// API cost: TaxJar charges ~$0.04 per /rates call. Per-invoice this is
// negligible (one lookup per invoice); at scale it's ~$50/mo per active
// contractor doing 1k invoices.
//
// Cache: per-zip rates are cached for 24h in AsyncStorage since rates
// change infrequently (state legislatures move slowly) and we don't want
// to burn a TaxJar call on every invoice preview.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import { isFeatureEnabled } from './featureFlagService';
import { getStateBaseRate } from '../data/usSalesTax';

export interface SalesTaxBreakdown {
  // Combined effective rate as a decimal (e.g. 0.0825 for 8.25%).
  rate: number;
  // Component breakdown — present when TaxJar returned them, undefined
  // when we fell back to the state-only table.
  components?: {
    state?: number;
    county?: number;
    city?: number;
    special?: number; // transit/stadium/etc. districts
  };
  // Where did this rate come from? Drives the disclosure shown on the
  // invoice PDF ("Rate per TaxJar zip lookup" vs "Rate per state default").
  source: 'taxjar' | 'state_default' | 'cache';
  jurisdiction?: string; // e.g. "Austin · Travis County · TX"
}

interface CachedRate {
  zip: string;
  data: SalesTaxBreakdown;
  cachedAt: number;
}

const CACHE_KEY_PREFIX = '@vasco_tax_rate:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cacheKey(zip: string): string {
  return `${CACHE_KEY_PREFIX}${zip.slice(0, 5)}`;
}

async function readCache(zip: string): Promise<CachedRate | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(zip));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRate;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(zip: string, data: SalesTaxBreakdown): Promise<void> {
  try {
    await AsyncStorage.setItem(
      cacheKey(zip),
      JSON.stringify({ zip, data, cachedAt: Date.now() } as CachedRate),
    );
  } catch {}
}

/**
 * Look up the combined sales-tax rate for a US ZIP. Caller is the invoice
 * builder (per-customer zip) + the estimate-builder preview pane.
 *
 * Behavior:
 *   - When `tax_real_lookup` flag is off OR supabase isn't configured:
 *     returns the static state rate from usSalesTax.ts
 *   - Cache hit (<24h old): returns cached breakdown immediately
 *   - Otherwise: calls the `tax-lookup` edge fn (proxies to TaxJar),
 *     caches the result, returns it
 *   - On any error: falls back to state rate so the invoice still ships
 *     with *some* tax line (logged as a warning for ops to investigate)
 */
export async function getSalesTax(
  zip: string,
  stateCode: string,
): Promise<SalesTaxBreakdown> {
  const stateRate = getStateBaseRate(stateCode);
  const fallback: SalesTaxBreakdown = {
    rate: stateRate / 100,
    source: 'state_default',
  };

  // Short-circuit when the feature is off OR we're not in a Supabase-
  // backed context (dev / demo with no live BE).
  if (!isFeatureEnabled('tax_real_lookup') || !isSupabaseConfigured) {
    return fallback;
  }

  // Cache hit?
  const cached = await readCache(zip);
  if (cached) {
    return { ...cached.data, source: 'cache' };
  }

  // Live lookup.
  try {
    const { data, error } = await supabase.functions.invoke('tax-lookup', {
      body: { zip, state: stateCode },
    });
    if (error) {
      logWarn('getSalesTax', `tax-lookup edge fn error: ${error.message}`);
      return fallback;
    }
    if (data?.rate != null) {
      const breakdown: SalesTaxBreakdown = {
        rate: data.rate,
        components: data.components,
        source: 'taxjar',
        jurisdiction: data.jurisdiction,
      };
      await writeCache(zip, breakdown);
      return breakdown;
    }
    return fallback;
  } catch (e) {
    logWarn('getSalesTax', `threw: ${(e as Error).message}`);
    return fallback;
  }
}

/**
 * Compute the tax amount on a subtotal given a breakdown. Pulled into a
 * helper so the invoice PDF + the estimate preview pane render the same
 * math without duplicating it.
 */
export function applySalesTax(
  subtotal: number,
  breakdown: SalesTaxBreakdown,
): { tax: number; total: number } {
  const tax = Math.round(subtotal * breakdown.rate * 100) / 100;
  return { tax, total: subtotal + tax };
}

/**
 * Render-friendly disclosure for the invoice PDF footer.
 * "Tax: 8.25% (Austin · Travis County · TX) via TaxJar"
 * vs
 * "Tax: 6.25% (TX state default — local rates may apply)"
 */
export function taxDisclosure(breakdown: SalesTaxBreakdown): string {
  const pct = (breakdown.rate * 100).toFixed(2).replace(/\.00$/, '').replace(/0$/, '');
  if (breakdown.source === 'taxjar' || breakdown.source === 'cache') {
    const where = breakdown.jurisdiction ? ` (${breakdown.jurisdiction})` : '';
    return `Tax ${pct}%${where}`;
  }
  return `Tax ${pct}% (state default — local rates may apply)`;
}
