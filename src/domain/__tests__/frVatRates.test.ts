/**
 * France has THREE rates a contractor legitimately picks between: 20% standard,
 * 10% general renovation, and 5.5% energy renovation (CGI art. 278-0 bis A).
 * Before this, the builder offered a BOOLEAN toggle — standard or "the" reduced
 * rate — so 5.5% was unreachable and an energy-renovation devis was overcharged
 * by 4.5 points of VAT.
 */
import {
  getStandardVatRate,
  getReducedVatRate,
  getEnergyRenovationVatRate,
  getSelectableVatRates,
} from '../business';

describe('FR reduced VAT brackets', () => {
  it('offers 5.5% only in France', () => {
    expect(getEnergyRenovationVatRate('FR')).toBe(5.5);
    for (const c of ['NL', 'DE', 'ES', 'IT', 'UK'] as const) {
      expect(getEnergyRenovationVatRate(c)).toBeNull();
    }
  });

  it('keeps the existing brackets untouched', () => {
    expect(getStandardVatRate('FR')).toBe(20);
    expect(getReducedVatRate('FR')).toBe(10);
    expect(getReducedVatRate('NL')).toBe(9);
    expect(getReducedVatRate('DE')).toBeNull();
  });

  it('gives France three selectable rates, high to low', () => {
    expect(getSelectableVatRates('FR')).toEqual([20, 10, 5.5]);
  });

  it('gives other markets only what they actually have', () => {
    expect(getSelectableVatRates('NL')).toEqual([21, 9]);
    expect(getSelectableVatRates('DE')).toEqual([19]);
    expect(getSelectableVatRates('IT')).toEqual([22, 10]);
    expect(getSelectableVatRates('ES')).toEqual([21, 10]);
  });

  it('never offers a zero or negative rate', () => {
    for (const c of ['NL', 'DE', 'FR', 'ES', 'IT', 'UK'] as const) {
      for (const r of getSelectableVatRates(c)) expect(r).toBeGreaterThan(0);
    }
  });
});
