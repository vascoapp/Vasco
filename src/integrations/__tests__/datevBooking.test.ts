/**
 * @jest-environment node
 */
// The DATEV Buchungsstapel goes to the contractor's Steuerberater and becomes
// the filed UStVA. Three defects sat in it with no test at all (sweep
// 2026-09-17):
//
// 1. `umsatz` carried the NET. On a row that has a BU-Schlüssel, DATEV treats
//    Umsatz as GROSS and derives net + USt from it, so a € 1.190,00 invoice at
//    19% was booked as Erlöse € 840,34 + USt € 159,66.
// 2. Belegdatum was MMDD ('2026-09-17' → '0917'), which DATEV reads as day 09
//    of month 17.
// 3. A mixed 19/7 invoice was exported entirely at the FIRST line's rate.
import { invoiceToDATEVRecords, generateDATEVCSV, DATEV_TAX_CODES } from '../datev';

describe('a DATEV booking row', () => {
  const row = (over: Partial<Parameters<typeof invoiceToDATEVRecords>[0]> = {}) =>
    invoiceToDATEVRecords({
      id: 'RE-2026-0087',
      customerName: 'Bäckerei Lindner GmbH',
      amount: 1190,
      vatRate: 19,
      date: '2026-09-17',
      isPaid: false,
      ...over,
    })[0];

  it('books the GROSS amount, because DATEV derives the tax from it', () => {
    expect(row().umsatz).toBe(1190);
  });

  it('writes the Belegdatum as DDMM', () => {
    expect(row().belegdatum).toBe('1709');
    expect(row({ date: '2026-01-05' }).belegdatum).toBe('0501');
  });

  it('carries the BU-Schlüssel for the rate', () => {
    expect(row().steuerschluessel).toBe(DATEV_TAX_CODES['19_percent']);
    expect(row({ vatRate: 7 }).steuerschluessel).toBe(DATEV_TAX_CODES['7_percent']);
    expect(row({ vatRate: 0 }).steuerschluessel).toBe(DATEV_TAX_CODES['0_percent']);
  });

  it('puts that gross figure in the CSV Umsatz column', () => {
    const csv = generateDATEVCSV(invoiceToDATEVRecords({
      id: 'RE-1', customerName: 'K', amount: 1190, vatRate: 19, date: '2026-09-17', isPaid: false,
    }));
    const dataLine = csv.trim().split('\n').pop() as string;
    expect(dataLine.split(';')[0]).toMatch(/^1190([.,]00)?$/);
  });
});

describe('the DATEV export splits an invoice by VAT rate', () => {
  // Read statically: the mapping lives in the accounting façade, which imports
  // the DATEV module lazily and is not worth instantiating here.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../accounting.ts'), 'utf8');
  const block = src.slice(src.indexOf("case 'datev'"), src.indexOf('return result.success', src.indexOf("case 'datev'")));

  it('groups the lines by rate instead of taking the first line for all of them', () => {
    expect(block).toMatch(/grossByRate/);
    expect(block).not.toMatch(/blendedVat/);
  });

  it('sends one entry per rate, each with its own rate', () => {
    expect(block).toMatch(/\[\.\.\.grossByRate\.entries\(\)\]\.map\(\(\[vatRate, amount\]\)/);
    expect(block).toMatch(/vatRate,/);
  });
});
