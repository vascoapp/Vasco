/**
 * @jest-environment node
 */
// A UK invoice PDF reads like a UK invoice (UK walk, 2026-10-08): British dates
// ("8 October 2026", not "October 8, 2026"), sort code + account to pay to, and
// an EU instalment's retention stated with what is payable now. Built through
// the real path (pdfInvoiceFromRecord → renderInvoicePdfFile, expo-print mocked).
const mockPrinted: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: async ({ html }: { html: string }) => { mockPrinted.push(html); return { uri: 'file:///cache/x.pdf' }; },
}));

import { pdfInvoiceFromRecord } from '../invoicePdfSource';
import { renderInvoicePdfFile } from '../invoicePdfService';

const uk = {
  country: 'UK', language: 'en', businessName: 'Hughes Plumbing', address: '14 Brick Lane', postcode: 'E1 6AN', city: 'London',
  vatNumber: 'GB123456782', iban: 'GB29NWBK60161331926819', routingNumber: '20-00-00', bankAccountNumber: '55555555',
} as any;
const render = async (invoice: any, lines: any[], profile: any, country: string) => {
  mockPrinted.length = 0;
  const auto = pdfInvoiceFromRecord({ invoice, lines, fallbackVatRatePercent: 20, fallbackDescription: 'x', country });
  await renderInvoicePdfFile(auto, profile);
  return mockPrinted[0];
};

it('dates are British and payment goes to a sort code + account', async () => {
  const html = await render(
    { id: 'INV0001', amount: 222.6, status: 'sent', customerName: 'Sarah Jones', createdAt: '2026-10-08', dueDate: '2026-10-22' },
    [{ description: 'Replace kitchen mixer tap', quantity: 1, unitPrice: 185.5, vatRate: 20 }], uk, 'UK');
  expect(html).toContain('8 October 2026');
  expect(html).not.toContain('October 8, 2026');
  expect(html).toContain('Sort code 20-00-00 · Account 55555555');
});

it('an EU instalment states the retention and what is payable now', async () => {
  const nl = { ...uk, country: 'NL', language: 'en', routingNumber: undefined, bankAccountNumber: undefined, iban: 'NL91ABNA0417164300' };
  const html = await render(
    { id: 'INV0002', amount: 6660.18, status: 'sent', customerName: 'Fam. Jansen', createdAt: '2026-10-08', retentionAmount: 333.01 },
    [{ description: 'Deposit (30%)', quantity: 1, unitPrice: 5550.15, vatRate: 20 }], nl, 'NL');
  expect(html).toContain('Retention withheld until handover');
  expect(html).toMatch(/Payable now[^<]*<\/span><span>€?\s?6,327\.17/);
});

it('a negative line prints the sign before the symbol (re-walk W188)', async () => {
  const html = await render(
    { id: 'INV0003', amount: 8436.23, status: 'sent', customerName: 'Mr & Mrs Patel', createdAt: '2026-10-09' },
    [{ description: 'First fix (40%)', quantity: 1, unitPrice: 7400.2, vatRate: 20 },
     { description: 'Less retention (5%)', quantity: 1, unitPrice: -370.01, vatRate: 20 }], uk, 'UK');
  expect(html).toContain('−£370.01');
  expect(html).not.toContain('£-370.01');
});
