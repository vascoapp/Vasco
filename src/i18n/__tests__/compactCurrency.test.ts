import { compactCurrency } from '../formatting';

describe('compactCurrency', () => {
  test('amounts under 1000 render whole, never "0.0K"', () => {
    expect(compactCurrency(24)).not.toMatch(/K/);
    expect(compactCurrency(0)).not.toMatch(/0\.0K|0,0K/);
    expect(compactCurrency(760)).toMatch(/760/);
  });
  test('thousands and millions get a compact suffix in the market\'s own words', () => {
    // The suffix is localised, not a hardcoded English "K"/"M": Dutch writes
    // "mln", German "Tsd."/"Mio.". Assert the NUMBER is scaled and a suffix is
    // present, not which letters it is.
    expect(compactCurrency(4500, 'NL')).toMatch(/4,5\s?K/);
    expect(compactCurrency(1_200_000, 'NL')).toMatch(/1,2\s?mln/i);
    expect(compactCurrency(4500, 'DE')).toMatch(/4,5\s?Tsd/i);
    expect(compactCurrency(1_200_000, 'DE')).toMatch(/1,2\s?Mio/i);
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
