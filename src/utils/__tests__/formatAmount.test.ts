/**
 * @jest-environment node
 *
 * `formatAmount` formatted money in the DEVICE locale with a hardcoded '€'.
 *
 * On the simulator (device en-US, contractor NL) the Vandaag banner read
 * "VASCO BESPAARDE €2.00" — US grouping, US decimal point — directly above
 * amounts on the same screen rendered correctly as "€ 350". Fourteen call
 * sites across Vandaag, Klanten, the savings hub, recurring contracts and
 * VascoCard shared it.
 *
 * These pin that the contractor's COUNTRY drives both separator and symbol.
 * Assertions compare against Intl output rather than hardcoded strings, so
 * they test the routing rather than re-encoding ICU's data (which shifts
 * between Node versions — nl-NL emits a NBSP after the € sign).
 */
jest.mock('../../lib/currentUser', () => ({
  getCurrentCountry: () => mockCountry,
}));

let mockCountry: string | undefined = 'NL';

import { formatAmount, formatChange, formatUnitPrice } from '../formatAmount';

const expected = (amount: number, locale: string, currency: string, digits: number) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);

describe('formatAmount follows the contractor country, not the device', () => {
  afterEach(() => { mockCountry = 'NL'; });

  it('uses Dutch grouping and a euro for an NL contractor', () => {
    mockCountry = 'NL';
    expect(formatAmount(2)).toBe(expected(2, 'nl-NL', 'EUR', 2));
    // The regression that was on screen: a decimal POINT never appears.
    expect(formatAmount(2)).toContain('2,00');
    expect(formatAmount(2)).not.toContain('2.00');
  });

  it('uses pounds for a UK contractor rather than a hardcoded euro', () => {
    mockCountry = 'UK';
    expect(formatAmount(2)).toBe(expected(2, 'en-GB', 'GBP', 2));
    expect(formatAmount(2)).toContain('£');
    expect(formatAmount(2)).not.toContain('€');
  });

  it('uses dollars for a US contractor', () => {
    mockCountry = 'US';
    expect(formatAmount(2)).toContain('$');
    expect(formatAmount(1234)).toContain('1,234');
  });

  it('drops decimals at or above 1000 so KPI tiles still fit', () => {
    mockCountry = 'NL';
    expect(formatAmount(1000)).toBe(expected(1000, 'nl-NL', 'EUR', 0));
    expect(formatAmount(999)).toBe(expected(999, 'nl-NL', 'EUR', 2));
    // Boundary is on magnitude, so a large negative drops decimals too.
    expect(formatAmount(-1500)).toBe(expected(-1500, 'nl-NL', 'EUR', 0));
  });

  it('falls back to NL when no contractor country is known yet', () => {
    mockCountry = undefined;
    expect(formatAmount(2)).toBe(expected(2, 'nl-NL', 'EUR', 2));
  });

  it('honours an explicit country over the ambient one', () => {
    mockCountry = 'NL';
    expect(formatAmount(2, 'UK')).toContain('£');
  });

  it('formatUnitPrice keeps 2 decimals even above 1000', () => {
    mockCountry = 'NL';
    expect(formatUnitPrice(1500)).toBe(expected(1500, 'nl-NL', 'EUR', 2));
  });

  it('formatChange prefixes a sign without breaking the format', () => {
    mockCountry = 'NL';
    expect(formatChange(50)).toBe(`+${formatAmount(50)}`);
    expect(formatChange(-50)).toBe(formatAmount(-50));
  });
});
