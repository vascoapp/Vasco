/**
 * @jest-environment node
 *
 * R66r50 — country-aware VAT helper.
 */

import {
  isSmallBusinessExempt,
  getStandardVatRate,
  getEffectiveVatRate,
  getReducedVatRate,
  getVatExemptionNote,
} from '../business';

describe('isSmallBusinessExempt', () => {
  it('returns false for standard scheme', () => {
    expect(isSmallBusinessExempt({ vatScheme: 'standard' })).toBe(false);
  });
  it('returns false for undefined scheme', () => {
    expect(isSmallBusinessExempt({})).toBe(false);
  });
  it('returns true for NL KOR', () => {
    expect(isSmallBusinessExempt({ vatScheme: 'small_business_NL_KOR' })).toBe(true);
  });
  it('returns true for DE Kleinunternehmer', () => {
    expect(isSmallBusinessExempt({ vatScheme: 'small_business_DE_kleinunternehmer' })).toBe(true);
  });
});

describe('getStandardVatRate', () => {
  it('returns 21 for NL', () => expect(getStandardVatRate('NL')).toBe(21));
  it('returns 19 for DE', () => expect(getStandardVatRate('DE')).toBe(19));
  it('returns 20 for FR', () => expect(getStandardVatRate('FR')).toBe(20));
  it('returns 21 for ES', () => expect(getStandardVatRate('ES')).toBe(21));
  it('returns 22 for IT', () => expect(getStandardVatRate('IT')).toBe(22));
  it('returns 20 for UK', () => expect(getStandardVatRate('UK')).toBe(20));
  it('falls back to 21 for undefined', () => expect(getStandardVatRate(undefined)).toBe(21));
});

describe('getEffectiveVatRate', () => {
  it('returns country rate when not exempt', () => {
    expect(getEffectiveVatRate({ country: 'DE', vatScheme: 'standard' })).toBe(19);
    expect(getEffectiveVatRate({ country: 'IT', vatScheme: 'standard' })).toBe(22);
  });
  it('returns 0 when KOR regardless of country', () => {
    expect(getEffectiveVatRate({ country: 'NL', vatScheme: 'small_business_NL_KOR' })).toBe(0);
  });
  it('returns 0 when Kleinunternehmer regardless of country', () => {
    expect(getEffectiveVatRate({ country: 'DE', vatScheme: 'small_business_DE_kleinunternehmer' })).toBe(0);
  });
  it('falls back to NL 21 when country undefined and scheme standard', () => {
    expect(getEffectiveVatRate({ vatScheme: 'standard' })).toBe(21);
  });
});

describe('getReducedVatRate', () => {
  it('returns 9 for NL (renovation labor on homes >2 years old)', () => {
    expect(getReducedVatRate('NL')).toBe(9);
  });
  it('returns 10 for FR/IT/ES — construction labor DOES have a reduced bracket there', () => {
    // These three returned null until 2026-08-29, on the stated grounds that
    // their reduced rates covered "food/books/energy/transport — not
    // construction labor". That was wrong, and the toggle in the quote builder
    // renders only when this is non-null, so a French artisan had no way to
    // quote a renovation at anything but 20%.
    expect(getReducedVatRate('FR')).toBe(10); // CGI art. 279-0 bis
    expect(getReducedVatRate('IT')).toBe(10); // DPR 633/1972 Tab. A III 127-quaterdecies
    expect(getReducedVatRate('ES')).toBe(10); // Ley 37/1992 art. 91.Uno.2.10º
  });
  it('returns null for DE and UK — no general reduced bracket for trade labor', () => {
    // DE 7% is food/books/transport. UK 5% exists but only for specific
    // conversions and long-empty dwellings, which needs its own product case.
    expect(getReducedVatRate('DE')).toBeNull();
    expect(getReducedVatRate('UK')).toBeNull();
  });
  it('returns null for undefined country', () => {
    expect(getReducedVatRate(undefined)).toBeNull();
  });
});

describe('getVatExemptionNote', () => {
  it('returns NL note for KOR', () => {
    expect(getVatExemptionNote('NL', 'small_business_NL_KOR')).toMatch(/KOR/);
  });
  it('returns DE note for Kleinunternehmer', () => {
    expect(getVatExemptionNote('DE', 'small_business_DE_kleinunternehmer')).toMatch(/§ 19/);
  });
  it('returns null for standard', () => {
    expect(getVatExemptionNote('NL', 'standard')).toBeNull();
  });
});
