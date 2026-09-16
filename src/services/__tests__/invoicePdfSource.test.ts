/**
 * @jest-environment node
 *
 * The PDF of a real invoice.
 *
 * Every invoice PDF — detail-screen button, invoice-email attachment, Facturen
 * share, PDF modal — read `invoiceAutomationService.getInvoice(id)`, an
 * in-memory list no real flow fills. For every invoice a contractor actually
 * created: a success haptic and no PDF, and emails without the attachment.
 * Found by the 2026-09-16 money sweep, verified in code (#339).
 */
import fs from 'fs';
import path from 'path';
import { pdfInvoiceFromRecord } from '../invoicePdfSource';
import { stripComments } from '../../utils/stripComments';
import type { PdfSourceInvoice } from '../invoicePdfSource';

const base: PdfSourceInvoice = {
  id: 'RE-2026-0087',
  customer: 'Bäckerei Lindner',
  customerId: 'c1',
  job: 'Trinkwasserleitung erneuern',
  amount: 5200,
  status: 'sent',
  dueInDays: 14,
  dueDate: '2026-09-30',
  sentAt: '2026-09-16T08:00:00.000Z',
};

describe('pdfInvoiceFromRecord', () => {
  it('uses the stored lines and one VAT rule', () => {
    const pdf = pdfInvoiceFromRecord({
      invoice: base,
      lines: [{ description: 'Rohr', quantity: 2, unitPrice: 1000, vatRate: 19 }],
      customer: { id: 'c1', name: 'Bäckerei Lindner', email: 'l@x.test', address: 'Venloer Str. 1', postcode: '50672', city: 'Köln' },
      fallbackVatRatePercent: 19,
      fallbackDescription: 'Leistungen',
    });
    expect(pdf.invoiceNumber).toBe('RE-2026-0087');
    expect(pdf.subtotal).toBe(2000);
    expect(pdf.vatAmount).toBe(380);
    expect(pdf.total).toBe(2380);
    expect(pdf.lineItems).toEqual([{ description: 'Rohr', quantity: 2, unitPrice: 1000, vatRate: 19, total: 2000 }]);
    expect(pdf.customerAddress).toBe('Venloer Str. 1, 50672 Köln');
    expect(pdf.customerEmail).toBe('l@x.test');
    expect(pdf.dueDate.getDate()).toBe(30);
  });

  it('splits one line out of the GROSS amount when nothing is stored', () => {
    const pdf = pdfInvoiceFromRecord({
      invoice: base, lines: [], fallbackVatRatePercent: 19, fallbackDescription: 'Leistungen',
    });
    expect(pdf.lineItems).toHaveLength(1);
    expect(pdf.lineItems[0].description).toBe('Trinkwasserleitung erneuern');
    expect(pdf.lineItems[0].unitPrice).toBe(4369.75);
    expect(pdf.total).toBe(5200);
  });

  it('charges no VAT for a Kleinunternehmer', () => {
    const pdf = pdfInvoiceFromRecord({
      invoice: { ...base, amount: 185.5 }, lines: [{ description: 'Wartung', quantity: 1, unitPrice: 185.5 }],
      fallbackVatRatePercent: 0, fallbackDescription: 'Leistungen',
    });
    expect(pdf.vatAmount).toBe(0);
    expect(pdf.total).toBe(185.5);
  });
});

describe('no invoice PDF is sourced from the empty automation service', () => {
  const ROOT = path.resolve(__dirname, '../../..');
  const files = ['app/invoices/[id].tsx', 'app/(contractor)/facturen.tsx', 'app/(modals)/pdf.tsx'];

  it.each(files)('%s builds each PDF from pdfInvoiceFromRecord', (rel) => {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
    const calls = [...src.matchAll(/\b(generateInvoicePdf|buildInvoicePdfBase64)\(/g)].map((m) => m.index ?? 0);
    expect(calls.length).toBeGreaterThan(0);
    for (const at of calls) {
      // The handler that feeds this call: back to the nearest `async (` / `=> {`.
      const window = src.slice(Math.max(0, at - 2500), at);
      const lastHandler = Math.max(window.lastIndexOf('async ('), window.lastIndexOf('async () =>'));
      const body = window.slice(lastHandler < 0 ? 0 : lastHandler);
      expect({ rel, sourcedFromService: /invoiceAutomationService\.getInvoice\(/.test(body) })
        .toEqual({ rel, sourcedFromService: false });
      expect(body).toMatch(/pdfInvoiceFromRecord\(|pdfForThisInvoice\(/);
    }
  });
});
