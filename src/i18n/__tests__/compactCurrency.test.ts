import { compactCurrency } from '../formatting';

describe('compactCurrency', () => {
  test('amounts under 1000 render whole, never "0.0K"', () => {
    expect(compactCurrency(24)).not.toMatch(/K/);
    expect(compactCurrency(0)).not.toMatch(/0\.0K|0,0K/);
    expect(compactCurrency(760)).toMatch(/760/);
  });
  test('thousands and millions get K / M suffixes', () => {
    expect(compactCurrency(4500)).toMatch(/4[.,]5K/);
    expect(compactCurrency(1_200_000)).toMatch(/1[.,]2M/);
  });
  test('uses the locale decimal separator (NL = comma)', () => {
    expect(compactCurrency(4500, 'NL')).toMatch(/4,5K/);
  });
  test('negatives keep their sign', () => {
    expect(compactCurrency(-4500)).toMatch(/-/);
  });
});
