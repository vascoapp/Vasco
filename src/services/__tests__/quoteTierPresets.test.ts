import type { TFunction } from 'i18next';
import {
  defaultTierPresets,
  mergeTierPresets,
  MAX_TIER_FEATURES,
} from '../quoteTierPresetService';
import de from '../../i18n/locales/de.json';
import nl from '../../i18n/locales/nl.json';
import en from '../../i18n/locales/en.json';

/**
 * The three packages used to be Dutch literals inside TieredQuoteBuilder, and
 * the tier NAME becomes the quote's title — the one string on that screen the
 * customer reads. These tests pin the two properties that mattered:
 *   1. the defaults come from the locale files, so a German contractor's
 *      customer never receives a quote titled "Standaard";
 *   2. a contractor's edit survives, and a partial edit does not freeze the
 *      other two packages in whatever language they were shown in.
 */
function tFor(dict: Record<string, any>): TFunction {
  const fn = (key: string, fallback?: string) => {
    const [ns, k] = key.split('.');
    return (dict?.[ns]?.[k] as string) ?? fallback ?? key;
  };
  return fn as unknown as TFunction;
}

describe('quote tier presets', () => {
  it('takes its default names from the locale, not from a Dutch literal', () => {
    expect(defaultTierPresets(tFor(de)).good.name).toBe('Basis');
    expect(defaultTierPresets(tFor(de)).better.name).toBe('Standard'); // not "Standaard"
    expect(defaultTierPresets(tFor(nl)).better.name).toBe('Standaard');
    expect(defaultTierPresets(tFor(en)).better.name).toBe('Standard');
  });

  it('carries localized promises, in the contractor language', () => {
    const d = defaultTierPresets(tFor(de));
    expect(d.best.features).toContain('Premiummaterial');
    expect(d.best.features.some(f => /jaar|materiaal/.test(f))).toBe(false);
    const n = defaultTierPresets(tFor(nl));
    expect(n.good.features).toContain('Garantie 1 jaar');
  });

  it('every locale ships all three package names', () => {
    for (const [name, dict] of Object.entries({ de, nl, en })) {
      const p = defaultTierPresets(tFor(dict));
      for (const key of ['good', 'better', 'best'] as const) {
        expect(`${name}:${p[key].name}`).not.toMatch(/quotes\.tier/); // key leaked = missing string
        expect(p[key].features.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps a contractor edit and leaves the untouched packages localized', () => {
    const defaults = defaultTierPresets(tFor(de));
    const merged = mergeTierPresets({ best: { name: 'Bergmann Komplett', features: ['5 Jahre Garantie'] } }, defaults);
    expect(merged.best.name).toBe('Bergmann Komplett');
    expect(merged.best.features).toEqual(['5 Jahre Garantie']);
    expect(merged.good.name).toBe(defaults.good.name);
    expect(merged.better.features).toEqual(defaults.better.features);
  });

  it('drops blank rows and trims, so an empty editor line never reaches a quote', () => {
    const defaults = defaultTierPresets(tFor(en));
    const merged = mergeTierPresets(
      { good: { name: '  Callout  ', features: ['  Parts included ', '', '   '] } },
      defaults,
    );
    expect(merged.good.name).toBe('Callout');
    expect(merged.good.features).toEqual(['Parts included']);
  });

  it('falls back to the localized default when a stored name is blank', () => {
    const defaults = defaultTierPresets(tFor(de));
    const merged = mergeTierPresets({ better: { name: '   ', features: [] } }, defaults);
    expect(merged.better.name).toBe(defaults.better.name);
  });

  it('caps the bullet list', () => {
    const defaults = defaultTierPresets(tFor(en));
    const many = Array.from({ length: MAX_TIER_FEATURES + 3 }, (_, i) => `promise ${i}`);
    expect(mergeTierPresets({ best: { name: 'X', features: many } }, defaults).best.features)
      .toHaveLength(MAX_TIER_FEATURES);
  });

  it('survives corrupt stored data rather than blanking the packages', () => {
    const defaults = defaultTierPresets(tFor(en));
    expect(mergeTierPresets(null, defaults)).toEqual(defaults);
    expect(mergeTierPresets({ good: 'nonsense' }, defaults).good).toEqual(defaults.good);
    expect(mergeTierPresets({ best: { name: 5, features: [1, 2] } }, defaults).best).toEqual(defaults.best);
  });
});
