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
