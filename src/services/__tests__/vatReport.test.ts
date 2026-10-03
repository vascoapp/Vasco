// The VAT report the contractor hands their accountant (src/services/vatReport.ts).
// Its one promise: the figures ARE the invoices — added up through the same
// function the PDF prints with — so report == Σ invoices to the cent.
import { buildVatReport, reportPeriod } from '../vatReport';
import { pdfInvoiceFromRecord } from '../invoicePdfSource';

const inv = (id: string, over: Record<string, unknown> = {}) => ({
  id, reference: id, amount: 0, status: 'sent', customerId: 'c1', job: 'Job', sentAt: '2026-08-15T10:00:00.000Z', createdAt: '2026-08-15T09:00:00.000Z', ...over,
}) as any;
const line = (q: number, p: number, vatRate?: number, vatNature?: string): any => ({ description: 'x', quantity: q, unitPrice: p, ...(vatRate !== undefined ? { vatRate } : {}), ...(vatNature ? { vatNature } : {}) });
const base = { periodStart: '2026-07-01', periodEnd: '2026-09-30', standardRatePct: 21, customers: [{ id: 'c1', name: 'Bakker' }], expenses: [] as any[] };

it('a mixed-rate invoice is reported per rate — not guessed into one box', () => {
  const r = buildVatReport({ ...base, invoices: [inv('F1')], lineItems: { F1: [line(3, 8.83, 21), line(1, 10.04, 9)] } });
  expect(r.sales.rows).toEqual([{ ratePct: 21, net: 26.49, vat: 5.56 }, { ratePct: 9, net: 10.04, vat: 0.9 }]);
  expect(r.sales.vat).toBe(6.46);
  expect(r.sales.invoices[0]).toMatchObject({ number: 'F1', customer: 'Bakker', net: 36.53, vat: 6.46, gross: 42.99 });
});

it('PROPERTY: the report states exactly what the invoices print, to the cent', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let run = 0; run < 200; run++) {
    const invoices: any[] = []; const lineItems: Record<string, any[]> = {};
    let printedVat = 0; let printedNet = 0;
    for (let i = 0; i < 1 + Math.floor(rnd() * 6); i++) {
      const id = `F${run}-${i}`;
      // 4-decimal unit prices (DATANORM, hours × rate) and 0 % lines with a reason:
      // the review's shapes, where a recomputed grouping tipped into the wrong branch.
      const ls = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => {
        const rate = [21, 9, 0, 21][Math.floor(rnd() * 4)];
        const price = rnd() < 0.5 ? Math.round(rnd() * 50000) / 100 : Math.round(rnd() * 500000) / 10000;
        return line(1 + Math.floor(rnd() * 9), price, rate, rate === 0 && rnd() < 0.5 ? 'N2.2' : undefined);
      });
      invoices.push(inv(id)); lineItems[id] = ls;
      const pdf = pdfInvoiceFromRecord({ invoice: inv(id), lines: ls, fallbackVatRatePercent: 21, fallbackDescription: '' });
      printedVat += pdf.vatAmount; printedNet += pdf.subtotal;
    }
    const r = buildVatReport({ ...base, invoices, lineItems });
    expect(r.sales.vat).toBe(Math.round(printedVat * 100) / 100);
    expect(r.sales.net).toBe(Math.round(printedNet * 100) / 100);
    // …and the per-rate rows add up to the same totals.
    expect(Math.round(r.sales.rows.reduce((s, x) => s + x.vat, 0) * 100) / 100).toBe(r.sales.vat);
    expect(Math.round(r.sales.rows.reduce((s, x) => s + x.net, 0) * 100) / 100).toBe(r.sales.net);
  }
});

it('drafts are not counted — but they are LISTED, because a shared draft may have gone out', () => {
  const r = buildVatReport({ ...base, invoices: [inv('F1'), inv('F2', { status: 'draft', amount: 121 })], lineItems: { F1: [line(1, 100, 21)] } });
  expect(r.sales.invoices.map((i) => i.number)).toEqual(['F1']);
  expect(r.notIncluded.drafts).toEqual([{ id: 'F2', number: 'F2', gross: 121 }]);
});

it('outside the period is outside the report; the day is the LOCAL day', () => {
  const r = buildVatReport({ ...base, invoices: [inv('JUN', { sentAt: '2026-06-30T12:00:00.000Z' }), inv('OCT', { sentAt: '2026-10-01T12:00:00.000Z' }), inv('SEP', { sentAt: '2026-09-30T12:00:00.000Z' })], lineItems: { JUN: [line(1, 10, 21)], OCT: [line(1, 10, 21)], SEP: [line(1, 10, 21)] } });
  expect(r.sales.invoices.map((i) => i.number)).toEqual(['SEP']);
});

it('cash basis (Ist / kasstelsel): counted on the day it was PAID; unpaid ones listed', () => {
  const invoices = [
    inv('PAID', { status: 'paid', sentAt: '2026-06-20T10:00:00.000Z', paidAt: '2026-07-05T10:00:00.000Z' }),
    inv('OPEN', { status: 'sent', sentAt: '2026-08-01T10:00:00.000Z', amount: 121 }),
  ];
  const r = buildVatReport({ ...base, vatBasis: 'ist', invoices, lineItems: { PAID: [line(1, 100, 21)], OPEN: [line(1, 100, 21)] } });
  expect(r.basis).toBe('cash');
  expect(r.sales.invoices.map((i) => [i.number, i.date])).toEqual([['PAID', '2026-07-05']]);
  expect(r.notIncluded.unpaidOnCashBasis.map((i) => i.number)).toEqual(['OPEN']);
});

it('KOR / Kleinunternehmer: no VAT either way', () => {
  const r = buildVatReport({ ...base, vatScheme: 'small_business_DE_kleinunternehmer', invoices: [inv('F1', { amount: 100 })], lineItems: {}, expenses: [{ id: 'e1', description: 'Rohr', amount: 50, vatAmount: 9.5, vatRate: 19, date: '2026-08-02' }] });
  expect(r.exempt).toBe(true);
  expect(r.sales.vat).toBe(0);
  expect(r.purchases.vat).toBe(0);
  expect(r.balance).toBe(0);
});

it('Italy: a 0 % line keeps its reason (Natura) in the report', () => {
  const r = buildVatReport({ ...base, standardRatePct: 22, invoices: [inv('FT1')], lineItems: { FT1: [line(1, 1000, 22), line(1, 500, 0, 'N6.3')] } });
  expect(r.sales.rows).toEqual([{ ratePct: 22, net: 1000, vat: 220 }, { ratePct: 0, nature: 'N6.3', net: 500, vat: 0 }]);
});

it('purchases: the VAT the receipt states, in the period; the balance is what is owed', () => {
  const r = buildVatReport({
    ...base, invoices: [inv('F1')], lineItems: { F1: [line(1, 1000, 21)] },
    expenses: [
      { id: 'e1', description: 'Koperen buis', supplier: 'Technische Unie', amount: 125, vatAmount: 26.25, vatRate: 21, date: '2026-08-02' },
      { id: 'e2', description: 'Te vroeg', amount: 100, vatAmount: 21, vatRate: 21, date: '2026-06-30' },
    ],
  });
  expect(r.purchases.items.map((i) => i.id)).toEqual(['e1']);
  expect(r.purchases.vat).toBe(26.25);
  expect(r.balance).toBe(210 - 26.25);
});

it('periods are calendar days', () => {
  expect(reportPeriod('quarter', 'previous', new Date(2026, 9, 3))).toEqual({ start: '2026-07-01', end: '2026-09-30' });
  expect(reportPeriod('quarter', 'current', new Date(2026, 0, 15))).toEqual({ start: '2026-01-01', end: '2026-03-31' });
  expect(reportPeriod('quarter', 'previous', new Date(2026, 0, 15))).toEqual({ start: '2025-10-01', end: '2025-12-31' });
  expect(reportPeriod('month', 'previous', new Date(2026, 0, 15))).toEqual({ start: '2025-12-01', end: '2025-12-31' });
});

it('the spreadsheet opens in the accountant\'s Excel: ; and decimal comma in NL/DE/FR/ES/IT, , and point in English', () => {
  const { vatReportCsv } = require('../vatReportExport');
  const r = buildVatReport({ ...base, invoices: [inv('F1')], lineItems: { F1: [line(2, 1234.5, 21)] }, expenses: [{ id: 'e1', description: 'Buis; 22mm', supplier: 'TU', amount: 100, vatAmount: 21, vatRate: 21, date: '2026-08-02' }] });
  const t = (k: string, o?: any) => (o?.defaultValue ?? k).replace('{{rate}}', o?.rate ?? '').replace('{{nature}}', o?.nature ?? '');
  const nl = vatReportCsv(r, t, 'nl').split('\r\n');
  expect(nl[1]).toBe('Sale;2026-08-15;F1;Bakker;21 %;2469,00;518,49');
  expect(nl[2]).toBe('Purchase;2026-08-02;"Buis; 22mm";TU;21 %;100,00;21,00'); // a ; inside a cell is quoted
  const en = vatReportCsv(r, t, 'en').split('\r\n');
  expect(en[1]).toBe('Sale,2026-08-15,F1,Bakker,21 %,2469.00,518.49');
});


it('review shapes: 4-decimal prices never tax a 0 % line, and the rows ARE the totals', () => {
  const a = buildVatReport({ ...base, standardRatePct: 22, invoices: [inv('IT1')], lineItems: { IT1: [line(4, 10.0049, 22), line(1, 100, 0, 'N2.2')] } });
  expect(a.sales.rows).toEqual([{ ratePct: 22, net: 40.02, vat: 8.8 }, { ratePct: 0, nature: 'N2.2', net: 100, vat: 0 }]);
  expect(a.sales.vat).toBe(8.8);
  const b = buildVatReport({ ...base, invoices: [inv('NL1')], lineItems: { NL1: [line(3, 3.3349, 21), line(3, 3.3349, 21), line(3, 3.3349, 21), line(1, 50, 9)] } });
  const sumVat = Math.round(b.sales.rows.reduce((x, r) => x + r.vat, 0) * 100) / 100;
  expect(sumVat).toBe(b.sales.vat);
  expect(b.sales.rows.map((r) => r.ratePct)).toEqual([21, 9]);
});

it('a customer id in the name slot is resolved to the name (#214)', () => {
  const r = buildVatReport({ ...base, customers: [{ id: 'cust-uuid-1', name: 'Bakker' }], invoices: [inv('F1', { customerId: undefined, customer: 'cust-uuid-1' })], lineItems: { F1: [line(1, 100, 21)] } });
  expect(r.sales.invoices[0].customer).toBe('Bakker');
});

it('a retention release is listed, not counted again as 0 % turnover', () => {
  const r = buildVatReport({ ...base, invoices: [inv('F1'), inv('R1', { isRetentionRelease: true, amount: 605 })], lineItems: { F1: [line(1, 1000, 21)] } });
  expect(r.sales.net).toBe(1000);
  expect(r.sales.rows).toEqual([{ ratePct: 21, net: 1000, vat: 210 }]);
  expect(r.notIncluded.retentionReleases.map((x) => x.number)).toEqual(['R1']);
});

it('the CSV opens as UTF-8 in Excel and a text cell cannot run as a formula', () => {
  const { vatReportCsv } = require('../vatReportExport');
  const t = (k: string, o?: any) => (o?.defaultValue ?? k).replace('{{rate}}', o?.rate ?? '').replace('{{nature}}', o?.nature ?? '');
  const r = buildVatReport({ ...base, customers: [{ id: 'c1', name: '=HYPERLINK("x")' }], invoices: [inv('F1')], lineItems: { F1: [line(1, 100, 21)] } });
  const csv = vatReportCsv(r, t, 'eu');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
});

it('a paid invoice keeps its payment day locally (cash basis reads it before any reload)', () => {
  const fs = require('fs'); const path = require('path');
  const { stripComments } = require('../../utils/stripComments');
  const src: string = stripComments(fs.readFileSync(path.join(__dirname, '../../state/AppState.tsx'), 'utf8'));
  const at = src.indexOf('markInvoicePaid: (id) =>');
  expect(src.slice(at, at + 2500)).toMatch(/status: 'paid', dueInDays: 0, paidAt \}/);
});
