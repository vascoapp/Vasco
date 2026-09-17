import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TFunction } from 'i18next';

/**
 * The three package names and their bullet points.
 *
 * These were three hardcoded DUTCH literals inside `TieredQuoteBuilder`
 * ('Basis' / 'Standaard' / 'Premium', 'Standaard materiaal', 'Garantie 1
 * jaar', ...). Two problems with that:
 *
 *  1. The tier NAME becomes the quote's title in `addQuote`, so it is the one
 *     string here the customer actually reads. A German contractor's customer
 *     received a quote titled "Standaard".
 *  2. A contractor's packages are their own commercial offer — "Garantie 2
 *     jaar" is a promise, not chrome. It has to be theirs to write.
 *
 * So: localized defaults, overridable per contractor, stored locally next to
 * the pricebook and template libraries (same AsyncStorage-singleton shape).
 */
export type TierKey = 'good' | 'better' | 'best';

export interface TierPreset {
  name: string;
  features: string[];
}

export type TierPresets = Record<TierKey, TierPreset>;

export const TIER_KEYS: TierKey[] = ['good', 'better', 'best'];

/** How many bullets a package can carry. The tier card shows them in full. */
export const MAX_TIER_FEATURES = 4;

/**
 * What each package multiplies the contractor's own price by.
 *
 * DECIDED 2026-09-17 (user): **every tier defaults to the contractor's own
 * price.** It used to send the default package out at +25% and Premium at
 * +55% of the price in their pricebook, silently, under a tier named
 * "Standard" — so a contractor's very first quote was 25% above what they
 * thought they were charging (#339 P25).
 *
 * The markup is still available, per service, as a pricebook VARIANT price for
 * that tier (`tierUnitPrice` prefers it). That is an explicit number the
 * contractor typed, which is the difference that matters.
 */
export const TIER_MULTIPLIER: Record<TierKey, number> = { good: 1, better: 1, best: 1 };

/**
 * The unit price a package quotes for one pricebook service.
 *
 * A pricebook VARIANT for that tier wins; otherwise the base price times the
 * tier multiplier, **rounded to cents**. It used to round to whole euros
 * (`Math.round(basePrice * multiplier)`), which threw away the cents the
 * contractor typed even on Basis, where the multiplier is 1: €185,50 was
 * quoted, saved, exported and invoiced as €186 (#339).
 */
export function tierUnitPrice(basePrice: number, tier: TierKey, variantPrice?: number): number {
  if (typeof variantPrice === 'number') return variantPrice;
  return Math.round(basePrice * TIER_MULTIPLIER[tier] * 100) / 100;
}

const STORAGE_KEY = '@vasco_quote_tier_presets';

/**
 * The warranty bullets these packages used to ship with, in every language.
 *
 * DECIDED 2026-09-17 (user): a statutory right is not a feature. The basic
 * package advertised "1 year warranty" and the paid ones "2 years" — but the
 * customer's rights are set by law whatever a quote says (DE §634a BGB: two
 * years on work, five on building works; IT two; FR one/two/ten), so the cheap
 * tier UNDERSTATED what the buyer is owed and the upgrades charged for
 * something they already had. Advertising statutory rights as a distinctive
 * feature is a banned practice in itself (UCPD Annex I No. 10).
 *
 * These strings are stripped ONCE from presets already saved on a device —
 * removing the defaults alone would have left every existing contractor still
 * sending them.
 */
const LEGACY_WARRANTY_FEATURES = [
  '1 year warranty', '2 year warranty',
  '1 jaar garantie', '2 jaar garantie',
  '1 Jahr Gewährleistung', '2 Jahre Gewährleistung',
  '1 an de garantie', '2 ans de garantie',
  '1 año de garantía', '2 años de garantía',
  '1 anno di garanzia', '2 anni di garanzia',
].map((x) => x.toLowerCase());

const isLegacyWarrantyFeature = (feature: string): boolean =>
  LEGACY_WARRANTY_FEATURES.includes(feature.trim().toLowerCase());

/**
 * Defaults in the contractor's own language. Deliberately generic — a plumber
 * and a painter both start here and edit from it.
 */
export function defaultTierPresets(t: TFunction): TierPresets {
  return {
    good: {
      name: t('quotes.tierGoodName', 'Basic'),
      features: [
        t('quotes.tierGoodFeature1', 'Standard materials'),
      ],
    },
    better: {
      name: t('quotes.tierBetterName', 'Standard'),
      features: [
        t('quotes.tierBetterFeature1', 'Quality materials'),
      ],
    },
    best: {
      name: t('quotes.tierBestName', 'Premium'),
      features: [
        t('quotes.tierBestFeature1', 'Premium materials'),
        t('quotes.tierBestFeature3', 'Free follow-up check'),
      ],
    },
  };
}

/** Drop empties and cap, so a blank row in the editor never reaches a quote. */
function cleanPreset(raw: unknown, fallback: TierPreset): TierPreset {
  const p = (raw ?? {}) as Partial<TierPreset>;
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : fallback.name;
  const cleaned = Array.isArray(p.features)
    ? p.features
        .filter((f): f is string => typeof f === 'string')
        .map(f => f.trim())
        .filter(Boolean)
        // A preset saved before 2026-09-17 still carries the warranty bullet.
        .filter(f => !isLegacyWarrantyFeature(f))
        .slice(0, MAX_TIER_FEATURES)
    : [];
  // An array that cleans down to nothing (corrupt storage, or every row
  // blanked) falls back rather than shipping a package with no promises on it.
  // A contractor who genuinely wants a bare package renames it instead.
  return { name, features: cleaned.length > 0 ? cleaned : fallback.features };
}

/**
 * Merge stored overrides over localized defaults.
 *
 * Merging rather than replacing matters: a contractor who renamed only
 * "Premium" must not have the other two frozen in whatever language they used
 * the app in that day.
 */
export function mergeTierPresets(stored: unknown, defaults: TierPresets): TierPresets {
  const s = (stored ?? {}) as Partial<Record<TierKey, unknown>>;
  return {
    good: cleanPreset(s.good, defaults.good),
    better: cleanPreset(s.better, defaults.better),
    best: cleanPreset(s.best, defaults.best),
  };
}

export async function loadTierPresets(t: TFunction): Promise<TierPresets> {
  const defaults = defaultTierPresets(t);
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    return mergeTierPresets(JSON.parse(raw), defaults);
  } catch {
    return defaults;
  }
}

export async function saveTierPresets(presets: TierPresets): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Non-fatal: the quote in front of the contractor already uses the edited
    // values; worst case the next quote starts from the defaults again.
  }
}

export async function resetTierPresets(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function useTierPresets(t: TFunction) {
  const [presets, setPresets] = useState<TierPresets>(() => defaultTierPresets(t));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadTierPresets(t).then(p => {
      if (!alive) return;
      setPresets(p);
      setLoaded(true);
    });
    return () => { alive = false; };
    // Re-reads on a language change so an unedited default follows the UI.
  }, [t]);

  const save = useCallback(async (next: TierPresets) => {
    const cleaned = mergeTierPresets(next, defaultTierPresets(t));
    setPresets(cleaned);
    await saveTierPresets(cleaned);
    return cleaned;
  }, [t]);

  const reset = useCallback(async () => {
    const defaults = defaultTierPresets(t);
    setPresets(defaults);
    await resetTierPresets();
    return defaults;
  }, [t]);

  return { presets, loaded, save, reset };
}
