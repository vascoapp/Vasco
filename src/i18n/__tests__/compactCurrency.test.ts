import { compactCurrency, compactSuffixFor } from '../formatting';

describe('compactCurrency', () => {
  test('amounts under 1000 render whole, never "0.0K"', () => {
    expect(compactCurrency(24)).not.toMatch(/K/);
    expect(compactCurrency(0)).not.toMatch(/0\.0K|0,0K/);
    expect(compactCurrency(760)).toMatch(/760/);
  });
  test('thousands and millions get a compact suffix in the reader\'s own words', () => {
    // Not a hardcoded English "K"/"M": Dutch writes "mln", German "Tsd."/"Mio.".
    expect(compactCurrency(4500, 'NL', 'nl')).toMatch(/4,5\s?K/);
    expect(compactCurrency(1_200_000, 'NL', 'nl')).toMatch(/1,2\s?mln/i);
    expect(compactCurrency(4500, 'DE', 'de')).toMatch(/4,5\s?Tsd/i);
    expect(compactCurrency(1_200_000, 'DE', 'de')).toMatch(/1,2\s?Mio/i);
  });

  test('the suffix follows the LANGUAGE, the separators follow the COUNTRY', () => {
    // Regression: the table was keyed on country, so a German account whose UI
    // is Spanish rendered "€ 3,2 Tsd." — the German word for thousand, on a
    // Spanish screen. A separator is a currency convention; an abbreviation is
    // a word, and words follow the reader.
    expect(compactCurrency(3200, 'DE', 'es')).not.toMatch(/Tsd/i);
    expect(compactCurrency(3200, 'DE', 'de')).toMatch(/Tsd/i);
    // ...while German grouping survives the language switch either way.
    expect(compactCurrency(3200, 'DE', 'es')).toContain('3,2');
    expect(compactCurrency(3200, 'DE', 'de')).toContain('3,2');
  });

  test('every shipped language has a suffix pair', () => {
    for (const l of ['en', 'nl', 'de', 'fr', 'es', 'it'] as const) {
      const [k, m] = compactSuffixFor(l);
      expect(typeof k).toBe('string');
      expect(typeof m).toBe('string');
      expect(k.trim().length).toBeGreaterThan(0);
      expect(m.trim().length).toBeGreaterThan(0);
    }
  });

  test('the euro sign leads, in every euro market', () => {
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT'] as const) {
      expect(compactCurrency(4500, c).trimStart().startsWith('€')).toBe(true);
    }
  });
  test('uses the locale decimal separator (NL = comma)', () => {
    expect(compactCurrency(4500, 'NL')).toMatch(/4,5K/);
  });
  test('negatives keep their sign', () => {
    expect(compactCurrency(-4500)).toMatch(/-/);
  });
});

describe('currencySymbol', () => {
  const { currencySymbol } = require('../formatting');

  /**
   * Regression: this used `formatToParts`, which Hermes does not implement, so
   * on device it threw and the catch returned a hardcoded '€' for EVERY
   * country. A UK contractor was asked for "Preis (€)" directly above a
   * pricebook listing "£55.00/Std.". Node's ICU has formatToParts, which is
   * exactly why the old version passed its tests.
   */
  it('gives each market its own symbol, never a hardcoded euro', () => {
    expect(currencySymbol('UK')).toBe('£');
    expect(currencySymbol('US')).toBe('$');
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT'] as const) {
      expect(currencySymbol(c)).toBe('€');
    }
  });

  it('returns a symbol, not a number or a blank', () => {
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT', 'UK', 'US'] as const) {
      const s = currencySymbol(c);
      expect(s.length).toBeGreaterThan(0);
      expect(s).not.toMatch(/[0-9]/);
    }
  });
});

/**
 * Hermes does not implement `Intl.NumberFormat.prototype.formatToParts`. Node
 * does — which is why every test in this repo passes over a call that throws on
 * every real device, and why this fault shipped TWICE in one day
 * (compactCurrency, then currencySymbol twelve lines below it).
 *
 * Nothing may call it. Derive a symbol by formatting 0 and stripping digits.
 */
describe('formatToParts is never called', () => {
  it('appears nowhere in src/ or app/ outside comments', () => {
    const fs = require('fs');
    const path = require('path');
    const ROOT = path.join(__dirname, '..', '..', '..');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (['node_modules', '__tests__', '.git'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(e.name) || e.name.includes('.test.')) continue;
        const src: string = fs.readFileSync(full, 'utf8');
        src.split('\n').forEach((line: string, i: number) => {
          if (!line.includes('formatToParts')) return;
          const t = line.trim();
          // A comment warning about it is the point, not a violation.
          if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return;
          hits.push(`${path.relative(ROOT, full)}:${i + 1}`);
        });
      }
    };
    for (const d of ['src', 'app']) walk(path.join(ROOT, d));
    expect(hits).toEqual([]);
  });
});
