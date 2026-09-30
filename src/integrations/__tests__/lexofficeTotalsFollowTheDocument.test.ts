/**
 * @jest-environment node
 */
// The Lexoffice export stated its own totals (net rounded once, gross summed
// per line unrounded) and landed a cent away from the PDF and the XRechnung of
// the same invoice (review, 2026-09-30). It now takes the document's breakdown.
import { vascoToLexofficeInvoice } from '../lexoffice';
import { documentVatBreakdown } from '../../domain/business';

const invoice = (lineItems: Array<{ quantity: number; unitPrice: number; vatRate: number }>) =>
  vascoToLexofficeInvoice({
    customerName: 'Bäckerei Lindner GmbH', date: '2026-09-30',
    lineItems: lineItems.map((l, i) => ({ ...l, description: `L${i}`, unit: 'Stück' })),
  } as any).totalPrice;

it('states the PDF\'s totals, including mixed rates and sub-cent lines', () => {
  const lines = [
    { quantity: 1.95, unitPrice: 63.9, vatRate: 7 },
    { quantity: 1.15, unitPrice: 157.69, vatRate: 19 },
    { quantity: 4.09, unitPrice: 69.35, vatRate: 7 },
  ];
  const b = documentVatBreakdown(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), lines, 19);
  expect(invoice(lines)).toMatchObject({ totalNetAmount: b.net, totalTaxAmount: b.vat, totalGrossAmount: b.gross });
});

it('a leading 0 % line does not erase the VAT on the others', () => {
  const t = invoice([
    { quantity: 1, unitPrice: 100, vatRate: 0 },
    { quantity: 1, unitPrice: 100, vatRate: 19 },
  ]);
  expect(t).toMatchObject({ totalNetAmount: 200, totalTaxAmount: 19, totalGrossAmount: 219 });
});
