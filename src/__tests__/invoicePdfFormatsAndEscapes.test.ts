// The invoice PDF — the document the customer receives — printed "45.5" as the
// quantity and "5.5%" as a French rate, and put names and line descriptions
// into its HTML unescaped ("&" / "<" broke the document; the quote PDF
// already escaped). Contractor quote/invoice walk, 2026-09-29.
let captured = '';
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async ({ html }: { html: string }) => { captured = html; return { uri: 'file://x.pdf' }; }),
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => false), shareAsync: jest.fn() }));

import { renderInvoicePdfFile } from '../services/invoicePdfService';

const invoice = (vatRate: number) => ({
  id: 'i1', invoiceNumber: 'F-2026-0100', jobId: 'j1', customerId: 'c1',
  customerName: 'Bakker & Zn <BV>', customerAddress: 'Prinsengracht 263', issueDate: new Date('2026-09-29'),
  dueDate: new Date('2026-10-29'), status: 'draft',
  lineItems: [{ description: 'Plafond sauzen <incl. afplakken>', quantity: 45.5, unitPrice: 9.75, vatRate, total: 443.63 }],
  subtotal: 443.63, vatAmount: 93.16, total: 536.79, paidAmount: 0, payments: [], reminders: [],
}) as any;

it('Dutch invoice: quantity with a comma, free text escaped', async () => {
  await renderInvoicePdfFile(invoice(21), { businessName: 'Schilder & Co', country: 'NL', language: 'nl' });
  expect(captured).toMatch(/>45,5</);
  expect(captured).not.toMatch(/>45\.5</);
  expect(captured).toContain('Bakker &amp; Zn &lt;BV&gt;');
  expect(captured).toContain('Plafond sauzen &lt;incl. afplakken&gt;');
  expect(captured).not.toContain('<BV>');
});

it('French invoice: 5,5% renovation rate', async () => {
  await renderInvoicePdfFile(invoice(5.5), { businessName: 'Artisan', country: 'FR', language: 'fr' });
  expect(captured).toMatch(/5,5%/);
  expect(captured).not.toMatch(/5\.5%/);
});
