// Facturen → Offertes: a concept quote never sent was labelled "Verstuurd"
// ('draft' and 'expired' fell through to the sent label), and the row showed
// the NET amount (€ 443,63) beside a quote whose own screen and invoice said
// € 536,79 incl. btw (walk, 2026-09-29).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { grossFromDocumentLines } from '../domain/business';

const src = stripComments(fs.readFileSync(path.resolve(__dirname, '../../app/(contractor)/facturen.tsx'), 'utf8'));
const block = src.slice(src.indexOf('function QuoteItem('), src.indexOf('type TabView'));

it('draft and expired have their own labels', () => {
  expect(block).toMatch(/case 'draft':\s*return \{ label: t\('invoices\.quoteDraft'/);
  expect(block).toMatch(/case 'expired':\s*return \{ label: t\('invoices\.quoteExpired'/);
});

it('the row shows the gross total, like the quote and its invoice', () => {
  expect(block).toMatch(/formatCurrency\(grossFromDocumentLines\(quote\.total, lineItems\[quote\.id\], getEffectiveVatRate\(businessProfile\)\), country\)/);
  expect(grossFromDocumentLines(443.63, [{ quantity: 45.5, unitPrice: 9.75, vatRate: 21 }] as any, 21)).toBeCloseTo(536.79, 2);
});
