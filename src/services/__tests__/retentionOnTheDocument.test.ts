/**
 * The retention is stated on the customer's document (UK walk, 2026-10-08:
 * the invoice screen and PDF asked for the full £6,660.18 and never mentioned
 * the £333.01 withheld).
 *  - EU instalment: total, then "retention withheld" and "payable now".
 *  - UK instalment: the deduction is a line; nothing is withheld on top.
 *  - A release withholds nothing.
 */
import { pdfInvoiceFromRecord } from '../invoicePdfSource';

const base = {
  invoice: { id: 'INV0001', amount: 6660.18, status: 'sent' as const, retentionAmount: 333.01, job: 'Deposit' },
  lines: [{ description: 'Deposit (30%) — Kitchen refit', quantity: 1, unitPrice: 5550.15, vatRate: 20 }],
  fallbackVatRatePercent: 20,
  fallbackDescription: 'Services rendered',
};

it('an EU instalment prints the retention the customer withholds', () => {
  const doc = pdfInvoiceFromRecord({ ...base, country: 'NL' });
  expect(doc.total).toBe(6660.18);
  expect(doc.retentionWithheld).toBe(333.01);
});

it('a UK instalment carries the deduction as a line, nothing withheld on top', () => {
  const doc = pdfInvoiceFromRecord({
    ...base,
    invoice: { ...base.invoice, amount: 6327.17 },
    lines: [...base.lines, { description: 'Less retention (5%)', quantity: 1, unitPrice: -277.51, vatRate: 20 }],
    country: 'UK',
  });
  expect(doc.subtotal).toBe(5272.64);
  expect(doc.total).toBe(6327.17);
  expect(doc.retentionWithheld).toBeUndefined();
});

it('a release withholds nothing', () => {
  const doc = pdfInvoiceFromRecord({ ...base, invoice: { ...base.invoice, isRetentionRelease: true }, country: 'NL' });
  expect(doc.retentionWithheld).toBeUndefined();
});
