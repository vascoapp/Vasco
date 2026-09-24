/**
 * The retention duty shown before an account is deleted, per market. The
 * contractor keeps their own records (export, then delete — 2026-09-24), so a
 * wrong number here is advice they act on.
 *
 * DE is 8 since BEG IV (2025; was 10). UK: HMRC VAT records, 6 years. US: no
 * statutory figure in this codebase → no number, never a borrowed one.
 */
import { invoiceRetentionYears } from '../recordRetention';

it.each([
  ['NL', 7], ['DE', 8], ['FR', 10], ['IT', 10], ['ES', 6], ['UK', 6],
])('%s keeps invoices %i years', (country, years) => {
  expect(invoiceRetentionYears(country)).toBe(years);
});

it('an unknown or unsupported market gets no number', () => {
  expect(invoiceRetentionYears('US')).toBeNull();
  expect(invoiceRetentionYears(undefined)).toBeNull();
  expect(invoiceRetentionYears('XX')).toBeNull();
});
