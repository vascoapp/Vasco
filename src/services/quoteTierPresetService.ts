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

const STORAGE_KEY = '@vasco_quote_tier_presets';

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
        t('quotes.tierGoodFeature2', '1 year warranty'),
      ],
    },
    better: {
      name: t('quotes.tierBetterName', 'Standard'),
      features: [
        t('quotes.tierBetterFeature1', 'Quality materials'),
        t('quotes.tierBetterFeature2', '2 year warranty'),
      ],
    },
    best: {
      name: t('quotes.tierBestName', 'Premium'),
      features: [
        t('quotes.tierBestFeature1', 'Premium materials'),
        t('quotes.tierBestFeature2', '2 year warranty'),
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
