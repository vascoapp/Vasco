// The format half of `checkInvoiceReadiness` ran for the Netherlands only, so
// every other market's registration number passed on "non-empty" — the exact
// state R66r39 removed for the Dutch BTW after a malformed one reached a
// customer's accountant. France is the one that mattered: `getRequiredFields`
// DEMANDS a SIRET and nothing looked at it.
import { isValidSIRET, isValidPartitaIVA, isValidSpanishTaxId, isValidVATNumber } from '../validation';
import { checkInvoiceReadiness } from '../businessProfileValidation';
import type { BusinessProfile } from '../../domain/business';
import {
  DE_BUSINESS_PROFILE,
  FR_BUSINESS_PROFILE,
  ES_BUSINESS_PROFILE,
  IT_BUSINESS_PROFILE,
  DEMO_CUSTOMER_VAT_IDS,
} from '../../data/mockBusiness';
import { lateFeeCountry, lateFeeCustomerType } from '../../services/lateFeeService';

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

// The app only SHAPE-checks NL/DE/FR VAT numbers, so these reference
// implementations live here to hold the fixtures to the real algorithms. Each
// is first proven against published identifiers, so a fixture failing below is
// the fixture, not the checker.
const nlElfproef = (v: string) => {
  const n = v.slice(2, 11);
  let s = 0;
  for (let i = 0; i < 8; i++) s += Number(n[i]) * (9 - i);
  return /^NL\d{9}B\d{2}$/.test(v) && s % 11 === Number(n[8]);
};
const deMod1110 = (v: string) => {
  if (!/^DE\d{9}$/.test(v)) return false;
  let p = 10;
  for (const ch of v.slice(2, 10)) {
    let s = (Number(ch) + p) % 10;
    if (s === 0) s = 10;
    p = (2 * s) % 11;
  }
  const c = (11 - p) % 10;
  return c === Number(v[10]);
};
const frKeyValid = (v: string) =>
  /^FR\d{11}$/.test(v)
  && isValidSIRET(v.slice(4)) // a 9-digit SIREN, Luhn
  && String((12 + 3 * (Number(v.slice(4)) % 97)) % 97).padStart(2, '0') === v.slice(2, 4);

describe('reference VAT checksums', () => {
  it('accept published identifiers', () => {
    for (const v of ['DE136695976', 'DE123475223', 'DE811569869']) expect(deMod1110(v)).toBe(true);
    for (const v of ['FR40303265045', 'FR59542051180', 'FR83404833048']) expect(frKeyValid(v)).toBe(true);
    expect(nlElfproef('NL004495445B01')).toBe(true);
  });
  it('reject a single mistyped digit', () => {
    expect(deMod1110('DE136695977')).toBe(false);
    expect(frKeyValid('FR41303265045')).toBe(false);
    expect(nlElfproef('NL004495446B01')).toBe(false);
  });
});

describe('demo VAT ids pass the real algorithms', () => {
  it('DE and FR seller profiles (FR VAT agrees with its own SIRET)', () => {
    expect(deMod1110(DE_BUSINESS_PROFILE.vatNumber ?? '')).toBe(true);
    expect(frKeyValid(FR_BUSINESS_PROFILE.vatNumber ?? '')).toBe(true);
    expect((FR_BUSINESS_PROFILE.registrationNumber ?? '').slice(0, 9))
      .toBe((FR_BUSINESS_PROFILE.vatNumber ?? '').slice(4));
  });

  it('every demo business customer, in its own market', () => {
    const checks: Record<string, (v: string) => boolean> = {
      NL: nlElfproef,
      DE: deMod1110,
      FR: frKeyValid,
      ES: (v) => /^ESB/.test(v) && isValidSpanishTaxId(v),
      IT: (v) => /^IT\d{11}$/.test(v) && isValidPartitaIVA(v),
    };
    const entries = Object.entries(DEMO_CUSTOMER_VAT_IDS);
    expect(entries.length).toBe(12);
    for (const [, vat] of entries) {
      const check = checks[vat.slice(0, 2)];
      expect({ vat, valid: !!check && check(vat) }).toEqual({ vat, valid: true });
      expect(isValidVATNumber(vat)).toBe(true);
    }
    expect(new Set(entries.map(([, v]) => v)).size).toBe(entries.length);
  });

  // The point of these ids: they are what makes a demo business customer
  // eligible for the B2B late fee — and no demo seller shares one.
  it('are read as businesses by the late-fee rule, and never reuse a seller id', () => {
    const sellers = [DE_BUSINESS_PROFILE, FR_BUSINESS_PROFILE, ES_BUSINESS_PROFILE, IT_BUSINESS_PROFILE]
      .map((p) => p.vatNumber);
    for (const vat of Object.values(DEMO_CUSTOMER_VAT_IDS)) {
      const country = lateFeeCountry(vat.slice(0, 2));
      expect(country).not.toBeNull();
      expect(lateFeeCustomerType({ vatId: vat }, country!)).toBe('business');
      expect(sellers).not.toContain(vat);
    }
  });
});
