/**
 * @jest-environment node
 */
// Every structured invoice states its totals twice: once per line, once in a
// header the receiver re-adds. When those two are computed from different
// numbers they disagree by a cent, and a cent is a hard rejection — Facturae's
// arithmetic check for FACe, scarto 00423 for SdI.
//
// Both exporters had it: ES summed each line's already-rounded VAT and printed
// a header from `data.totalVat` (what the screen computed); IT summed the
// UNROUNDED line totals under an `ImportoTotaleDocumento` of `data.totalGross`.
// Sweep 2026-09-17.
import { facturaeTaxTotals } from '../einvoice-es';
import { fatturaDocumentTotals } from '../einvoice-it';

const tenLines = (unit: number, rate: number) =>
  Array.from({ length: 10 }, () => ({ lineTotal: unit, ivaRate: rate, prezzoTotale: unit, aliquotaIva: rate }));

describe('Facturae (ES) totals', () => {
  it('taxes the base once instead of adding up rounded per-line VAT', () => {
    // 10 x 12,34 = 123,40 taxable; x 21% = 25,914 -> 25,91.
    // Per line: 2,5914 -> 2,59, summed = 25,90.
    const totals = facturaeTaxTotals(tenLines(12.34, 21) as never);
    expect(totals.base).toBe(123.4);
    expect(totals.tax).toBe(25.91);
  });

  it('sums the line totals AS PRINTED', () => {
    // Each line prints 2,52 (2,515 rounded), so the base is 5,04 — not 5,03.
    const totals = facturaeTaxTotals([
      { lineTotal: 2.515, ivaRate: 21 },
      { lineTotal: 2.515, ivaRate: 21 },
    ] as never);
    expect(totals.base).toBe(5.04);
  });
});

describe('FatturaPA (IT) totals', () => {
  it('derives the document total from the summary', () => {
    const totals = fatturaDocumentTotals(tenLines(12.34, 22));
    expect(totals.net).toBe(123.4);
    expect(totals.tax).toBe(27.15); // 123,40 x 22% = 27,148
    expect(totals.gross).toBe(150.55);
  });

  it('sums the printed line totals, mixed rates kept apart', () => {
    const totals = fatturaDocumentTotals([
      { prezzoTotale: 2.515, aliquotaIva: 22 },
      { prezzoTotale: 2.515, aliquotaIva: 22 },
      { prezzoTotale: 10, aliquotaIva: 10 },
    ]);
    expect(totals.net).toBe(15.04);
    // 5,04 x 22% = 1,11 and 10,00 x 10% = 1,00.
    expect(totals.tax).toBe(2.11);
    expect(totals.gross).toBe(17.15);
  });
});

describe('the generators use those helpers, not the screen totals', () => {
  // A full FatturaPA/Facturae document needs seller, buyer and payment blocks;
  // the arithmetic above is the part that was wrong, and this pins the wiring
  // so the header cannot go back to `data.total*`.
  const fs = require('fs');
  const path = require('path');
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');

  it('FatturaPA states a total derived from its own summary (plus bollo/cassa)', () => {
    const src = read('einvoice-it.ts');
    expect(src).toMatch(/<ImportoTotaleDocumento>\$\{fatturaTotals\.gross\.toFixed\(2\)\}/);
    expect(src).not.toMatch(/<ImportoTotaleDocumento>\$\{data\.totalGross/);
    const at = src.indexOf('const fatturaTotals');
    expect(src.slice(at, at + 400)).toMatch(/bolloVirtuale/);
  });

  it('Facturae states totals derived from its own lines', () => {
    const src = read('einvoice-es.ts');
    expect(src).toMatch(/<TotalTaxOutputs>\$\{totals\.tax\.toFixed\(2\)\}/);
    expect(src).toMatch(/<TotalGrossAmount>\$\{totals\.base\.toFixed\(2\)\}/);
    expect(src).not.toMatch(/<TotalTaxOutputs>\$\{data\.totalVat/);
  });
});
