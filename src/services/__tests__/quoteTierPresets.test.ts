import type { TFunction } from 'i18next';
import {
  defaultTierPresets,
  mergeTierPresets,
  MAX_TIER_FEATURES,
  tierUnitPrice,
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
    // The NL basic package used to promise "Garantie 1 jaar" here.
    expect(n.good.features.length).toBeGreaterThan(0);
    expect(n.good.features.every(f => /materia/i.test(f))).toBe(true);
  });

  // DECIDED 2026-09-17 (user): a statutory right is not a feature. The basic
  // package promised one year and the paid ones two, while the law gives the
  // customer two years on work and five on building works in DE whatever the
  // quote says — so the cheap tier understated the buyer's rights and the
  // upgrades sold them something they already had (UCPD Annex I No. 10).
  it('no package advertises a warranty', () => {
    for (const dict of [de, nl, en]) {
      const p = defaultTierPresets(tFor(dict));
      for (const key of ['good', 'better', 'best'] as const) {
        for (const f of p[key].features) {
          expect(`${key}:${f}`).not.toMatch(/warrant|garant|gewährleistung/i);
        }
      }
    }
  });

  it('strips the warranty bullet from a preset saved before the decision', () => {
    const merged = mergeTierPresets(
      { good: { name: 'Basis', features: ['Standardmaterial', '1 Jahr Gewährleistung'] } },
      defaultTierPresets(tFor(de)),
    );
    expect(merged.good.features).toEqual(['Standardmaterial']);
  });

  it('falls back rather than shipping an empty package when the warranty was the only bullet', () => {
    const defaults = defaultTierPresets(tFor(de));
    const merged = mergeTierPresets({ best: { name: 'Premium', features: ['2 Jahre Gewährleistung'] } }, defaults);
    expect(merged.best.features).toEqual(defaults.best.features);
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

describe('tierUnitPrice — the cents the contractor typed', () => {
  it('keeps cents on the basic package, where the multiplier is 1', () => {
    // Was Math.round(185.5 * 1) = 186, on the quote, the PDF and the invoice.
    expect(tierUnitPrice(185.5, 'good')).toBe(185.5);
  });

  // DECIDED 2026-09-17 (user): every tier quotes the contractor's OWN price.
  // The default package used to leave at +25% and Premium at +55%, silently,
  // under a tier named "Standard".
  it('quotes the contractor price, to the cent, on every tier', () => {
    expect(tierUnitPrice(185.5, 'good')).toBe(185.5);
    expect(tierUnitPrice(185.5, 'better')).toBe(185.5);
    expect(tierUnitPrice(185.5, 'best')).toBe(185.5);
    // …and still to the CENT, which is what #339 fixed here.
    expect(tierUnitPrice(12.345, 'better')).toBe(12.35);
  });

  it('a markup is an explicit variant price the contractor typed', () => {
    expect(tierUnitPrice(185.5, 'best', 249.99)).toBe(249.99);
  });

  it('lets a pricebook variant price win untouched', () => {
    expect(tierUnitPrice(185.5, 'best', 249.99)).toBe(249.99);
    expect(tierUnitPrice(185.5, 'good', 0)).toBe(0);
  });
});

describe('the package rate reaches the saved quote', () => {
  // The builder resolves the VAT rate per tier (exempt / reduced opt-in /
  // country standard) and shows the customer a total computed with it. The
  // map that turns tier lines into quote lines dropped `vatRate`, so addQuote
  // re-rated every line at the profile's standard rate — a Dutch 9% quote was
  // saved, exported and invoiced at 21% (#253's shape, one screen on).
  it('the builder prices tier lines through tierUnitPrice, not its own rounding', () => {
    const fs = require('fs');
    const path = require('path');
    const { stripComments } = require('../../utils/stripComments');
    const src: string = stripComments(
      fs.readFileSync(path.join(__dirname, '../../components/contractor/TieredQuoteBuilder.tsx'), 'utf8'),
    );
    expect(src).toMatch(/tierUnitPrice\(/);
    // No hand-rolled multiplier/rounding on a pricebook price.
    expect(src).not.toMatch(/Math\.round\([^)\n]*basePrice/);
    expect(src).not.toMatch(/basePrice\s*\*\s*(1\.25|1\.55)/);
  });

  it('tiered-quote passes each line a vatRate', () => {
    const fs = require('fs');
    const path = require('path');
    const { stripComments } = require('../../utils/stripComments');
    const src: string = stripComments(
      fs.readFileSync(path.join(__dirname, '../../../app/contractor/tiered-quote.tsx'), 'utf8'),
    );
    const map = src.slice(src.indexOf('const lineItems = ('), src.indexOf('}));', src.indexOf('const lineItems = (')));
    expect(map).toMatch(/vatRate:/);
  });
});
