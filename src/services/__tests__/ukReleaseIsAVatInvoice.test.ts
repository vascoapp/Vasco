/**
 * UK: a retention release is the retention's VAT invoice (VAT Regs 1995 reg.
 * 89), so the VAT report counts it; in NL the VAT was declared on the
 * instalment and the release stays "not included" (review, 2026-10-08).
 */
import { buildVatReport } from '../vatReport';

const base = {
  periodStart: '2026-10-01', periodEnd: '2026-12-31', standardRatePct: 20, expenses: [],
  invoices: [{ id: 'INV0009', amount: 600, status: 'sent', createdAt: '2026-11-02', isRetentionRelease: true, projectId: 'p' }] as any,
  lineItems: { INV0009: [{ description: 'Retention release — refit', quantity: 1, unitPrice: 500, vatRate: 20 }] } as any,
};

it('UK: the release is counted with its VAT', () => {
  const r = buildVatReport({ ...base, country: 'UK' } as any);
  expect(r.notIncluded.retentionReleases).toHaveLength(0);
  expect(r.sales.vat).toBe(100);
  expect(r.sales.net).toBe(500);
});

it('NL: the release stays listed, not counted', () => {
  const r = buildVatReport({ ...base, country: 'NL', standardRatePct: 21,
    lineItems: {} } as any);
  expect(r.notIncluded.retentionReleases).toHaveLength(1);
  expect(r.sales.vat).toBe(0);
});
