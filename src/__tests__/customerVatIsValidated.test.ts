// The customer sheet saved the VAT id "NL12" without a word (walk,
// 2026-09-29); a buyer VAT id goes onto every B2B invoice and e-invoice. It
// is now checked like the contractor's own, before anything is written.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { isValidVATNumber, isValidCustomerVatId, normalizeCustomerVatId, looksLikeEntityCodiceFiscale } from '../utils/validation';

it('the verdicts the sheet relies on', () => {
  expect(isValidVATNumber('NL12')).toBe(false);
  expect(isValidVATNumber('NL123456789B01')).toBe(true);
  expect(isValidVATNumber('DE123456789')).toBe(true);
});

it('a Spanish customer\'s NIF without "ES" passes for a Spanish contractor — on its control character', () => {
  expect(isValidCustomerVatId('P2807900B', 'ES')).toBe(true);    // public body (FACe)
  expect(isValidCustomerVatId('ESP2807900B', 'ES')).toBe(true);
  expect(isValidCustomerVatId('B87654323', 'ES')).toBe(true);    // S.L.
  expect(isValidCustomerVatId('12345678Z', 'ES')).toBe(true);    // DNI
  expect(isValidCustomerVatId('P2807900X', 'ES')).toBe(false);   // wrong control
  expect(isValidCustomerVatId('12345678A', 'ES')).toBe(false);
  // Nothing loosened elsewhere: a bare NIF is not a VAT id in another market,
  // and the other countries' rules are the same as before.
  expect(isValidCustomerVatId('P2807900B', 'DE')).toBe(false);
  expect(isValidCustomerVatId('P2807900B', undefined)).toBe(false);
  expect(isValidCustomerVatId('NL12', 'NL')).toBe(false);
  expect(isValidCustomerVatId('NL123456789B01', 'NL')).toBe(true);
  expect(isValidCustomerVatId('DE12345678', 'DE')).toBe(false);
});

it('an Italian customer\'s bare partita IVA passes for an Italian contractor — on its check digit — and is stored with IT', () => {
  expect(isValidCustomerVatId('01234567897', 'IT')).toBe(true);
  expect(normalizeCustomerVatId('01234567897', 'IT')).toBe('IT01234567897');
  expect(normalizeCustomerVatId(' 012 345 678 97 ', 'IT')).toBe('IT01234567897');
  expect(isValidCustomerVatId('01234567896', 'IT')).toBe(false);  // wrong check digit
  expect(isValidCustomerVatId('00000000000', 'IT')).toBe(false);  // never assigned
  expect(isValidCustomerVatId('IT01234567897', 'IT')).toBe(true);
  // Only for an Italian contractor; anything else is returned as typed.
  expect(isValidCustomerVatId('01234567897', 'DE')).toBe(false);
  expect(normalizeCustomerVatId('01234567897', 'DE')).toBe('01234567897');
  expect(normalizeCustomerVatId('P2807900B', 'ES')).toBe('P2807900B');
  expect(normalizeCustomerVatId('012-345-678/97', 'IT')).toBe('IT01234567897');
});

it('an 11-digit codice fiscale of a condominio / association (8 or 9 first) is NOT made into a partita IVA', () => {
  // 93012345679 passes the same check digit — a fake IT VAT id on the e-invoice
  // would also silence the N6 "buyer has no VAT id" warning (review 2026-10-03).
  expect(normalizeCustomerVatId('93012345679', 'IT')).toBe('93012345679');
  expect(isValidCustomerVatId('93012345679', 'IT')).toBe(false);
  expect(looksLikeEntityCodiceFiscale('93012345679', 'IT')).toBe(true);
  expect(looksLikeEntityCodiceFiscale('01234567897', 'IT')).toBe(false);
  expect(looksLikeEntityCodiceFiscale('93012345679', 'DE')).toBe(false);
  // A real partita IVA starting with 8/9 can still be typed with its prefix.
  expect(isValidCustomerVatId('IT93012345679', 'IT')).toBe(true);
});

it('the sheet refuses a malformed VAT id before any write', () => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../components/shared/AddCustomerSheet.tsx'), 'utf8'));
  const check = src.indexOf('!isValidCustomerVatId(cleanVat, country)');
  expect(check).toBeGreaterThan(-1);
  expect(check).toBeLessThan(src.indexOf('await updateCustomer('));
  expect(check).toBeLessThan(src.indexOf('await addCustomer('));
});
