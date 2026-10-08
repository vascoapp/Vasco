/**
 * A UK sole trader invoices without a company number.
 *
 * UK walk, 2026-10-08: the send gate demanded "Company number" from every UK
 * business, so a sole trader — the most common UK form, with no Companies
 * House registration — could send no invoice at all. Companies Act 2006 s.82
 * puts the number on a COMPANY's documents only.
 */
import { checkInvoiceReadiness } from '../utils/businessProfileValidation';

const uk = {
  country: 'UK', businessName: 'Hughes Plumbing', address: '14 Brick Lane', postcode: 'E1 6AN',
  city: 'London', vatNumber: 'GB123456782', iban: 'GB29NWBK60161331926819',
} as any;

it('a sole trader is ready without a company number', () => {
  const r = checkInvoiceReadiness({ ...uk, businessType: 'soleTrader' });
  expect(r.missing).toEqual([]);
  expect(r.ready).toBe(true);
});

it('a partnership is ready without a company number', () => {
  expect(checkInvoiceReadiness({ ...uk, businessType: 'partnership' }).missing).toEqual([]);
});

it('an unknown form is not presumed to be a company', () => {
  expect(checkInvoiceReadiness({ ...uk }).missing).not.toContain('profile.registrationCoNo');
});

it('a Ltd still needs its company number', () => {
  expect(checkInvoiceReadiness({ ...uk, businessType: 'limited' }).missing).toContain('profile.registrationCoNo');
  expect(checkInvoiceReadiness({ ...uk, businessType: 'limited', registrationNumber: '12345678' }).missing).toEqual([]);
});
