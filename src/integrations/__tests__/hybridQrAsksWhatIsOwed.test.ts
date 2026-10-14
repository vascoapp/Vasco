/**
 * The transfer QR on the ZUGFeRD / Factur-X hybrid asks for what is OWED
 * (review 2026-10-14). It used the gross on every status: a German progress
 * invoice of € 10.000 with € 500 retention asked € 10.000 while the screen and
 * the printed PDF said € 9.500, and a PAID invoice exported later carried a
 * scannable "pay" code — an invitation to pay twice. The printed PDF already
 * followed both rules (invoicePdfService); the hybrid draws its own page (#418).
 */
import fs from 'fs';
import path from 'path';

const mockPayloads: Array<{ amount: number }> = [];
jest.mock('../../utils/epcQr', () => {
  const actual = jest.requireActual('../../utils/epcQr');
  return { ...actual, epcPayload: (a: any) => { mockPayloads.push(a); return actual.epcPayload(a); } };
});

import { buildPdfA3Invoice } from '../pdfA3Invoice';
import type { EInvoiceData } from '../einvoice';

const font = (w: string) => new Uint8Array(fs.readFileSync(path.join(
  __dirname, '..', '..', '..', 'node_modules', '@expo-google-fonts', 'inter', w, `Inter_${w}.ttf`)));
const fonts = { regular: font('400Regular'), bold: font('700Bold') };

const data: EInvoiceData = {
  sellerName: 'Sanitär Bergmann GmbH', sellerAddress: 'Hauptstraße 14', sellerVatId: 'DE123456789',
  sellerCity: 'Köln', sellerPostalCode: '50667', sellerCountry: 'DE', sellerEmail: 'a@b.de',
  buyerName: 'Bäckerei Lindner GmbH', buyerAddress: 'Marktplatz 3', buyerCity: 'Köln', buyerPostalCode: '50676',
  buyerEmail: 'r@l.de', invoiceNumber: 'RE-2026-0087', invoiceDate: '2026-09-30', dueDate: '2026-10-30',
  currency: 'EUR', iban: 'DE89370400440532013000',
  lineItems: [{ description: 'Abschlag 1', quantity: 1, unitPrice: 8403.36, vatRate: 19, unitCode: 'piece', vatAmount: 0, lineTotal: 8403.36 }],
  totalNet: 0, totalVat: 0, totalGross: 0, sellerVatExempt: false,
} as EInvoiceData;
const build = (o: { retentionWithheld?: number; paid?: boolean }) =>
  buildPdfA3Invoice(data, { profile: 'zugferd', language: 'de', fonts, now: new Date('2026-09-30T10:00:00Z'), ...o });

beforeEach(() => { mockPayloads.length = 0; });

it('asks for the amount payable now, not the gross', async () => {
  const r = await build({ retentionWithheld: 500 });
  expect(r.totals.gross).toBe(10000);
  expect(mockPayloads.map((p) => p.amount)).toEqual([9500]);
});

it('draws no code on a paid invoice', async () => {
  await build({ retentionWithheld: 500, paid: true });
  expect(mockPayloads).toEqual([]);
});

it('the invoice screen hands the builder what is payable and whether it is paid', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../../app/invoices/[id].tsx'), 'utf8');
  const call = src.slice(src.indexOf('await buildPdfA3Invoice(data, {'));
  const opts = call.slice(0, call.indexOf('});'));
  expect(opts).toMatch(/retentionWithheld:\s*retentionDeductedOnInvoice\(country\) \? 0 : \(invoice\.retentionAmount \?\? 0\)/);
  expect(opts).toMatch(/paid:\s*invoice\.status === 'paid'/);
});
