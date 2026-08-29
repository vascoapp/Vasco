// The format half of `checkInvoiceReadiness` ran for the Netherlands only, so
// every other market's registration number passed on "non-empty" — the exact
// state R66r39 removed for the Dutch BTW after a malformed one reached a
// customer's accountant. France is the one that mattered: `getRequiredFields`
// DEMANDS a SIRET and nothing looked at it.
import { isValidSIRET, isValidPartitaIVA, isValidSpanishTaxId } from '../validation';
import { checkInvoiceReadiness } from '../businessProfileValidation';
import type { BusinessProfile } from '../../domain/business';
import { FR_BUSINESS_PROFILE, ES_BUSINESS_PROFILE, IT_BUSINESS_PROFILE } from '../../data/mockBusiness';

describe('isValidSIRET', () => {
  it('accepts a real 14-digit SIRET and its 9-digit SIREN', () => {
    expect(isValidSIRET('73282932000074')).toBe(true);
    expect(isValidSIRET('732 829 320 00074')).toBe(true);  // as printed on paper
    expect(isValidSIRET('732829320')).toBe(true);          // sole traders quote the SIREN
  });

  it('rejects a single mistyped digit — the whole point of a checksum', () => {
    expect(isValidSIRET('73282932000075')).toBe(false);
  });

  it('rejects wrong lengths and non-digits', () => {
    expect(isValidSIRET('1234567890123')).toBe(false);   // 13
    expect(isValidSIRET('7328293200007A')).toBe(false);
    expect(isValidSIRET('')).toBe(false);
  });
});

describe('isValidPartitaIVA', () => {
  it('accepts valid numbers with and without the IT prefix', () => {
    expect(isValidPartitaIVA('00743110157')).toBe(true);
    expect(isValidPartitaIVA('IT00743110157')).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidPartitaIVA('00743110158')).toBe(false);
  });

  it('rejects wrong lengths', () => {
    expect(isValidPartitaIVA('0074311015')).toBe(false);
    expect(isValidPartitaIVA('007431101577')).toBe(false);
  });
});

describe('the readiness gate applies them', () => {
  const fr = (reg: string): BusinessProfile => ({
    businessName: 'Plomberie Moreau', address: '1 rue de la Paix',
    country: 'FR', registrationNumber: reg, vatNumber: 'FR12345678901',
  } as BusinessProfile);

  it('a French profile with a mistyped SIRET is NOT ready', () => {
    const bad = checkInvoiceReadiness(fr('73282932000075'));
    expect(bad.ready).toBe(false);
    expect(bad.invalid).toContain('profile.siretFormatInvalid');
  });

  it('a French profile with a valid SIRET passes the format check', () => {
    const ok = checkInvoiceReadiness(fr('73282932000074'));
    expect(ok.invalid).not.toContain('profile.siretFormatInvalid');
  });

  it('an Italian profile with a bad Partita IVA check digit is NOT ready', () => {
    const bad = checkInvoiceReadiness({
      businessName: 'Idraulico Rossi', address: 'Via Roma 1',
      country: 'IT', vatNumber: 'IT00743110158',
    } as BusinessProfile);
    expect(bad.ready).toBe(false);
    expect(bad.invalid).toContain('profile.partitaIvaChecksumInvalid');
  });

  it('a valid Partita IVA raises no checksum complaint', () => {
    const ok = checkInvoiceReadiness({
      businessName: 'Idraulico Rossi', address: 'Via Roma 1',
      country: 'IT', vatNumber: 'IT00743110157',
    } as BusinessProfile);
    expect(ok.invalid).not.toContain('profile.partitaIvaChecksumInvalid');
  });

  it('does not fire on markets that have no such number', () => {
    const es = checkInvoiceReadiness({
      businessName: 'Fontanería García', address: 'Calle Mayor 1',
      country: 'ES', vatNumber: 'ESA12345678',
    } as BusinessProfile);
    expect(es.invalid).not.toContain('profile.siretFormatInvalid');
    expect(es.invalid).not.toContain('profile.partitaIvaChecksumInvalid');
  });
});

describe('isValidSpanishTaxId', () => {
  it('accepts a DNI, a NIE and a CIF', () => {
    expect(isValidSpanishTaxId('12345678Z')).toBe(true);   // DNI
    expect(isValidSpanishTaxId('X1234567L')).toBe(true);   // NIE
    expect(isValidSpanishTaxId('A58818501')).toBe(true);   // CIF
    expect(isValidSpanishTaxId('Q2826000H')).toBe(true);   // the tax agency's own CIF
    expect(isValidSpanishTaxId('ESA58818501')).toBe(true); // as the app stores it
  });

  it('rejects a wrong control character', () => {
    expect(isValidSpanishTaxId('12345678A')).toBe(false);
    expect(isValidSpanishTaxId('X1234567A')).toBe(false);
    expect(isValidSpanishTaxId('A58818502')).toBe(false);
  });

  it('a Spanish profile with a bad control character is NOT ready', () => {
    const bad = checkInvoiceReadiness({
      businessName: 'Fontanería García', address: 'Calle Mayor 1',
      country: 'ES', vatNumber: 'ESA58818502',
    } as BusinessProfile);
    expect(bad.ready).toBe(false);
    expect(bad.invalid).toContain('profile.nifControlInvalid');
  });
});

describe('the demo profiles the EU markets are screenshotted from', () => {
  // These carried identifiers that were merely well-SHAPED: the FR SIRET failed
  // Luhn, the ES CIF failed its control digit, the IT partita IVA failed its
  // check digit. Harmless until the checksums above existed — at which point
  // the demo for all three markets would have been blocked from invoicing.
  it('FR/ES/IT demo profiles pass their own country checks', () => {
    expect(isValidSIRET(FR_BUSINESS_PROFILE.registrationNumber ?? '')).toBe(true);
    expect(isValidSpanishTaxId(ES_BUSINESS_PROFILE.vatNumber ?? '')).toBe(true);
    expect(isValidPartitaIVA(IT_BUSINESS_PROFILE.vatNumber ?? '')).toBe(true);
  });

  it('and are therefore invoice-ready', () => {
    for (const p of [FR_BUSINESS_PROFILE, ES_BUSINESS_PROFILE, IT_BUSINESS_PROFILE]) {
      expect(checkInvoiceReadiness(p).invalid).toEqual([]);
    }
  });
});
