/**
 * @jest-environment node
 */
// The printed Italian invoice says WHY a 0 % line carries no IVA (2026-10-03):
// DPR 633/72 art. 17 c. 5 requires a reverse-charge invoice to carry
// "inversione contabile" and the norm; art. 21 c. 6 the same for non-soggette /
// esenti. The text is the FatturaPA's RiferimentoNormativo, so the paper and
// the XML cannot disagree. Built through the real path: the stored lines →
// pdfInvoiceFromRecord → renderInvoicePdfFile (expo-print mocked to capture
// the HTML), with the profile the screens pass (AppState's, regime included).
const mockPrinted: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: async ({ html }: { html: string }) => { mockPrinted.push(html); return { uri: 'file:///cache/x.pdf' }; },
}));

import { pdfInvoiceFromRecord } from '../invoicePdfSource';
import { renderInvoicePdfFile } from '../invoicePdfService';
import { IT_BUSINESS_PROFILE } from '../../data/mockBusiness';

const invoice = { id: 'FT-1', amount: 0, status: 'draft' as const, customerName: 'Edilizia Bruno S.r.l.', createdAt: '2026-10-01' };
const render = async (lines: any[], profile: any = IT_BUSINESS_PROFILE) => {
  mockPrinted.length = 0;
  const auto = pdfInvoiceFromRecord({ invoice, lines, fallbackVatRatePercent: 22, fallbackDescription: 'x' });
  await renderInvoicePdfFile(auto, { ...profile, language: 'it' });
  return { auto, html: mockPrinted[0] };
};

it('a reverse-charge line prints its nature and the art. 17 annotation', async () => {
  const { auto, html } = await render([
    { description: 'Subappalto impianto', quantity: 1, unitPrice: 4250, vatRate: 0, vatNature: 'N6.3' },
    { description: 'Noleggio', quantity: 1, unitPrice: 120, vatRate: 22 },
  ]);
  expect(auto.lineItems.map((l) => l.vatNature ?? null)).toEqual(['N6.3', null]);
  expect(html).toContain('0% N6.3');
  expect(html).toContain('Inversione contabile ex art. 17, c. 6, lett. a), DPR 633/72');
  // Totals untouched: 4250 + 120 + 26,40.
  expect(auto.total).toBe(4396.4);
});

it('a forfettario\'s 0 % line prints the franchise norm without a stated nature', async () => {
  const { html } = await render([{ description: 'Caldaia', quantity: 1, unitPrice: 60, vatRate: 0 }], { ...IT_BUSINESS_PROFILE, fiscalRegime: 'RF19' });
  expect(html).toContain('L. 190/2014');
});

it('nothing is printed outside Italy, nor for an ordinary 0 % line nobody explained', async () => {
  const { html: nl } = await render([{ description: 'Werk', quantity: 1, unitPrice: 60, vatRate: 0, vatNature: 'N6.3' }], { ...IT_BUSINESS_PROFILE, country: 'NL' });
  expect(nl).not.toContain('Inversione contabile');
  expect(nl).not.toContain('N6.3');
  const { html: it } = await render([{ description: 'Lavori', quantity: 1, unitPrice: 60, vatRate: 0 }]);
  expect(it).not.toContain('Operazione');
});
