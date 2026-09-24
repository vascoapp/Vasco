/**
 * Every document an invoice becomes is built by ONE module, so the copies
 * cannot drift again (2026-09-24):
 *   - the ES/IT e-invoice named the buyer by the raw `invoice.customer` — an
 *     id on converted invoices (#214) — filed with SDI / FACe as the name;
 *   - the emailed PDF lacked the FR 2026 mentions and the persisted delivery
 *     date that the viewed PDF had.
 */
import fs from 'fs';
import path from 'path';
import { buildEInvoiceData, buildEInvoiceSource, invoicePdfExtras, invoiceLinesFor } from '../invoiceDocuments';
import { stripComments } from '../../utils/stripComments';

const customers = [{ id: 'C-1787349342347', name: 'Panificio Bruno S.r.l.', city: 'Milano', postcode: '20100', vatId: 'IT01234567890', country: 'IT' }];
// An R13.2-era invoice: the customer ID sits in the name slot.
const invoice: any = { id: 'FT-2026-0003', customer: 'C-1787349342347', job: 'Impianto', amount: 1220, status: 'sent', dueInDays: 30, createdAt: '2026-09-01T10:00:00Z' };
const inputs = (over: any = {}) => ({
  invoice, customers, businessProfile: { businessName: 'Idraulica Rossi', vatNumber: 'IT09876543210', country: 'IT', city: 'Torino' } as any,
  country: 'IT', effectiveRate: 0.22,
  lines: invoiceLinesFor(invoice, [{ description: 'Impianto', quantity: 1, unitPrice: 1000, vatRate: 22 }], 0.22, 'Servizi'),
  ...over,
});

it('both e-invoice paths name the buyer by the resolved customer, never the id in the name slot', () => {
  expect(buildEInvoiceData(inputs()).buyerName).toBe('Panificio Bruno S.r.l.');
  expect(buildEInvoiceSource(inputs()).buyer.name).toBe('Panificio Bruno S.r.l.');
  expect(buildEInvoiceSource(inputs()).buyer.vatId).toBe('IT01234567890');
});

it('totals follow the lines and their own rates', () => {
  const d = buildEInvoiceData(inputs());
  expect(d.totalNet).toBe(1000);
  expect(d.totalVat).toBeCloseTo(220, 2);
  expect(d.totalGross).toBeCloseTo(1220, 2);
  expect(buildEInvoiceSource(inputs()).lines[0].vatRate).toBe(22);
});

it('an invoice without stored lines gets one line from its gross amount', () => {
  const lines = invoiceLinesFor({ ...invoice, amount: 1190 }, undefined, 0.19, 'Leistungen');
  expect(lines).toHaveLength(1);
  expect(lines[0].unitPrice).toBeCloseTo(1000, 6);
});

it('PDF extras: the persisted delivery date wins over the job; FR mentions carry the buyer VAT id', () => {
  const inv = { ...invoice, jobId: 'j1', deliveryDate: '2026-08-15' };
  const x = invoicePdfExtras({ invoice: inv, customers, jobs: [{ id: 'j1', completedAt: '2026-08-20' }], businessProfile: { tvaSurLesDebits: true } as any });
  expect(x.deliveryDate?.toISOString().slice(0, 10)).toBe('2026-08-15');
  expect(x.frMentions.buyerVatId).toBe('IT01234567890');
  expect(x.frMentions.tvaSurLesDebits).toBe(true);
  const y = invoicePdfExtras({ invoice: { ...invoice, jobId: 'j1' }, customers, jobs: [{ id: 'j1', completedAt: '2026-08-20' }], businessProfile: null });
  expect(y.deliveryDate?.toISOString().slice(0, 10)).toBe('2026-08-20');
});

it('every invoice-PDF call on the invoice screen carries the shared extras', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '../../../app/invoices/[id].tsx'), 'utf8'));
  const calls = [...src.matchAll(/(?:generateInvoicePdf|buildInvoicePdfBase64)\(([\s\S]*?)\n\s*\);/g)].map((m) => m[1]);
  expect(calls).toHaveLength(2);
  for (const c of calls) expect(c).toMatch(/frMentions: extras\.frMentions/);
  // …and no handler assembles its own e-invoice or buyer again.
  expect(src).not.toMatch(/const data: EInvoiceData = \{/);
  expect(src).not.toMatch(/name: invoice\?\.customer \?\? ''/);
});

it('"due on receipt" (0 days) is filed as due that day, not 14 days later', () => {
  const inv0 = { ...invoice, dueDate: undefined, dueInDays: 0 };
  const today = new Date().toISOString().slice(0, 10);
  expect(buildEInvoiceData(inputs({ invoice: inv0 })).dueDate).toBe(today);
  expect(buildEInvoiceSource(inputs({ invoice: inv0 })).dueDate).toBe(today);
});
