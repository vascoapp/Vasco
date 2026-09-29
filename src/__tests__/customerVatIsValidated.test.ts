// The customer sheet saved the VAT id "NL12" without a word (walk,
// 2026-09-29); a buyer VAT id goes onto every B2B invoice and e-invoice. It
// is now checked like the contractor's own, before anything is written.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { isValidVATNumber } from '../utils/validation';

it('the verdicts the sheet relies on', () => {
  expect(isValidVATNumber('NL12')).toBe(false);
  expect(isValidVATNumber('NL123456789B01')).toBe(true);
  expect(isValidVATNumber('DE123456789')).toBe(true);
});

it('the sheet refuses a malformed VAT id before any write', () => {
  const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../components/shared/AddCustomerSheet.tsx'), 'utf8'));
  const check = src.indexOf('!isValidVATNumber(cleanVat)');
  expect(check).toBeGreaterThan(-1);
  expect(check).toBeLessThan(src.indexOf('await updateCustomer('));
  expect(check).toBeLessThan(src.indexOf('await addCustomer('));
});
