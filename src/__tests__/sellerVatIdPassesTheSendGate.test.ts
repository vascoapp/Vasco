/**
 * The invoice SEND gate accepts the contractor's VAT id in every form that
 * settings accepts and saves (`isValidSellerVatId` / `normalizeSellerVatId`).
 *
 * The two disagreed: settings took an Italian partita IVA as 11 bare digits
 * and a Spanish NIF without "ES" — how both markets write them — and the gate
 * then refused to send any invoice ("Formato N° IVA non valido"). Spain was
 * fixed on its own (ES walk, 2026-10-06) and Italy hit the same wall the same
 * day (IT walk). One rule now, judged per market.
 */
import { checkInvoiceReadiness } from '../utils/businessProfileValidation';
import { isValidSellerVatId } from '../utils/validation';

const VAT_KEYS = ['profile.vatFormatInvalid', 'profile.partitaIvaChecksumInvalid', 'profile.nifControlInvalid'];

/** Each market's VAT id the way that market writes it, and the prefixed form. */
const FORMS: Array<[string, string]> = [
  ['NL', 'NL123456782B01'],
  ['DE', 'DE136695976'],
  ['FR', 'FR44732829320'],
  ['ES', '12345678Z'], ['ES', 'ES12345678Z'],
  ['IT', '01234567897'], ['IT', 'IT01234567897'], ['IT', '012 345 678 97'],
  ['UK', 'GB123456782'],
];

describe.each(FORMS)('%s %s', (country, vat) => {
  it('settings accepts it, and so does the send gate', () => {
    expect(isValidSellerVatId(vat, country)).toBe(true);
    const r = checkInvoiceReadiness({ country, vatNumber: vat } as any);
    expect(r.invalid.filter((k) => VAT_KEYS.includes(k))).toEqual([]);
  });
});

it('a typo is still refused: wrong partita IVA check digit, wrong NIF letter', () => {
  expect(checkInvoiceReadiness({ country: 'IT', vatNumber: '01234567890' } as any).invalid.some((k) => VAT_KEYS.includes(k))).toBe(true);
  expect(checkInvoiceReadiness({ country: 'ES', vatNumber: '12345678A' } as any).invalid.some((k) => VAT_KEYS.includes(k))).toBe(true);
});
