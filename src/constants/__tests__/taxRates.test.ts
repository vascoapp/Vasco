/**
 * @jest-environment node
 *
 * An unknown country must not be taxed at the home market's rate.
 *
 * `VAT_RATES` had no US row and `getVATRate` fell back to 0.21, so every US
 * amount — and anything whose country had not loaded yet — was computed at
 * Dutch VAT (#339). The US has no VAT at all; sales tax is a different tax on
 * a different base, and this app does not compute it.
 */
import { VAT_RATES, getVATRate, calculateVAT } from '../taxRates';

describe('getVATRate', () => {
  it('returns each market its own rate', () => {
    expect(getVATRate('NL')).toBe(0.21);
    expect(getVATRate('DE')).toBe(0.19);
    expect(getVATRate('FR')).toBe(0.20);
    expect(getVATRate('IT')).toBe(0.22);
    expect(getVATRate('UK')).toBe(0.20);
  });

  it('is 0 for the US — there is no VAT there', () => {
    expect(VAT_RATES.US).toBe(0);
    expect(getVATRate('US')).toBe(0);
    expect(calculateVAT(100, 'US')).toBe(0);
  });

  it('is 0 — not 21% — for a country it does not know', () => {
    expect(getVATRate('ZZ')).toBe(0);
    expect(getVATRate('')).toBe(0);
    expect(calculateVAT(100, 'ZZ')).toBe(0);
  });
});
