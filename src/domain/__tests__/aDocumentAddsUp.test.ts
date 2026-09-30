/**
 * @jest-environment node
 */
// An invoice is a legal document: what it prints has to add up. Subtotal plus
// the per-rate VAT rows must equal the Total, and each rate's VAT must be that
// rate's own net times its rate — the figure a tax authority reconciles.
//
// Two ways this was wrong (#354):
//  • the VAT rows were accumulated per rate UNROUNDED and rounded at render,
//    while the Total came from `documentVatBreakdown`, which rounded once over
//    the whole document: 3 × € 8,83 at 21 % + 1 × € 10,04 at 9 % printed rows
//    adding to € 42,99 under a Total of € 43,00;
//  • `round2` lost a cent to float representation: `1.5 * 0.19` is
//    `0.28499999999999998`, so € 1,50 at 19 % rounded to € 0,28 where the
//    exact 0,285 rounds up to € 0,29.
import { documentVatBreakdown, grossFromDocumentLines, vatRateGroups, round2 } from '../business';
import { generateXRechnungXML, type EInvoiceData } from '../../integrations/einvoice';

const XML_BASE: Omit<EInvoiceData, 'lineItems' | 'totalNet' | 'totalVat' | 'totalGross'> = {
  sellerName: 'Elektro Meyer GmbH', sellerAddress: 'Hauptstraße 14', sellerVatId: 'DE123456789',
  sellerCity: 'Berlin', sellerPostalCode: '10115', sellerContactName: 'Jörg Meyer',
  sellerPhone: '+49 30 1234567', sellerEmail: 'buchhaltung@elektro-meyer.de', sellerVatExempt: false,
  buyerName: 'Bäckerei Schmidt', buyerAddress: 'Marktplatz 3', buyerCity: 'Berlin', buyerPostalCode: '10178',
  invoiceNumber: 'R-2026-0042', invoiceDate: '2026-08-19', dueDate: '2026-09-18', currency: 'EUR',
} as any;

const line = (quantity: number, unitPrice: number, vatRate?: number) => ({ quantity, unitPrice, vatRate });

describe('round2 rounds the value, not its float representation', () => {
  it('a half cent rounds up', () => {
    expect(round2(1.5 * 0.19)).toBe(0.29);
    expect(round2(0.285)).toBe(0.29);
    expect(round2(2.675)).toBe(2.68);
  });

  it('rounds a negative half-cent away from zero, like its positive twin', () => {
    // A credit note or a minderwerk line. `Math.round` rounds half toward +∞,
    // so −0,285 became −0,28 while +0,285 became +0,29 — the same amount
    // rounded two different ways depending on its sign.
    expect(round2(-0.285)).toBe(-0.29);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(-2.675)).toBe(-2.68);
  });

  it('passes NaN and Infinity through rather than inventing a number', () => {
    expect(Number.isNaN(round2(NaN))).toBe(true);
    expect(round2(Infinity)).toBe(Infinity);
  });

  it('leaves exact values alone', () => {
    expect(round2(33.33 * 0.21)).toBe(7);
    expect(round2(10)).toBe(10);
    expect(round2(0)).toBe(0);
  });
});

describe('a document adds up', () => {
  const cases: { name: string; net: number; lines: ReturnType<typeof line>[]; fallback: number }[] = [
    {
      name: 'the mixed-rate invoice that printed 42,99 under a total of 43,00',
      net: 36.53,
      lines: [line(3, 8.83, 21), line(1, 10.04, 9)],
      fallback: 21,
    },
    { name: 'one line of 1,50 at 19%', net: 1.5, lines: [line(1, 1.5, 19)], fallback: 19 },
    { name: 'ten lines of 13,37 at 21%', net: 133.7, lines: Array.from({ length: 10 }, () => line(1, 13.37, 21)), fallback: 21 },
    { name: 'NL plumbing: 9% labour + 21% materials', net: 1000, lines: [line(1, 600, 9), line(1, 400, 21)], fallback: 21 },
    { name: 'a line-less document on the profile rate', net: 840.34, lines: [], fallback: 19 },
    { name: 'a Kleinunternehmer document', net: 500, lines: [line(1, 500, 0)], fallback: 0 },
  ];

  it.each(cases)('$name', ({ net, lines, fallback }) => {
    const bd = documentVatBreakdown(net, lines, fallback);
    const rowsSum = round2(bd.groups.reduce((s, g) => s + g.vat, 0));

    // What the PDF prints: Subtotaal + the VAT rows = Totaal.
    expect({ sum: round2(bd.net + rowsSum), total: bd.gross })
      .toEqual({ sum: bd.gross, total: bd.gross });
    // …and the VAT line agrees with the rows it is a summary of.
    expect(bd.vat).toBe(rowsSum);
    // The stored amount uses the same rule, so the record and the document
    // it prints cannot drift apart.
    expect(grossFromDocumentLines(net, lines, fallback)).toBe(bd.gross);
  });

  it('each rate group is its own net times its own rate', () => {
    const groups = vatRateGroups(1000, [line(1, 600, 9), line(1, 400, 21)], 21);
    expect(groups).toEqual([
      { ratePct: 21, net: 400, vat: 84 },
      { ratePct: 9, net: 600, vat: 54 },
    ]);
  });

  it('a Kleinunternehmer document has no VAT rows at all', () => {
    const bd = documentVatBreakdown(500, [line(1, 500, 0)], 0);
    expect(bd.groups).toEqual([]);
    expect({ vat: bd.vat, gross: bd.gross }).toEqual({ vat: 0, gross: 500 });
  });

  it('keeps the agreed rate when the lines no longer add up to the amount', () => {
    // A discount or a hand-edited total. The rate agreed is still the rate.
    const bd = documentVatBreakdown(900, [line(1, 1000, 10)], 20);
    expect({ vat: bd.vat, gross: bd.gross, ratePct: bd.ratePct })
      .toEqual({ vat: 90, gross: 990, ratePct: 10 });
  });

  it('a genuinely mixed document reports no single rate', () => {
    expect(documentVatBreakdown(1000, [line(1, 600, 9), line(1, 400, 21)], 21).ratePct).toBeNull();
  });
});

describe('the PDFs print those groups rather than their own sum', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

  it.each(['services/invoicePdfService.ts', 'services/quotePdfService.ts'])('%s', (rel) => {
    const src = read(rel);
    expect(src).toMatch(/for \(const group of vatRateGroups\(/);
    // The accumulate-then-round-at-render loop that could disagree.
    expect(src).not.toMatch(/const vatAmt = li\.quantity \* li\.unitPrice \* li\.vatRate \/ 100;/);
  });
});

// A guard that enumerates the cases you remember only tests your memory (#349).
// These fuzz the invariant over thousands of documents the author never thought
// of, in every EU6 rate combination, with quantities and prices that land on
// half-cents on purpose.
describe('the invariant holds for documents nobody wrote a case for', () => {
  const RATES = [0, 5, 7, 9, 10, 19, 20, 21, 22];

  /** Deterministic PRNG — a fuzz that cannot be reproduced is a flake. */
  function rng(seed: number) {
    let x = seed >>> 0;
    return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  it('subtotal + every VAT row equals the printed total, 5000 documents', () => {
    const rand = rng(20260921);
    const failures: unknown[] = [];
    for (let i = 0; i < 5000; i++) {
      const fallback = RATES[Math.floor(rand() * RATES.length)];
      const n = 1 + Math.floor(rand() * 5);
      const lines = Array.from({ length: n }, () => ({
        // Quantities and prices chosen to land on halves and thirds of a cent.
        quantity: Math.round(rand() * 2000) / 100,
        unitPrice: Math.round(rand() * 50000) / 100,
        vatRate: RATES[Math.floor(rand() * RATES.length)],
      }));
      const netAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const b = documentVatBreakdown(netAmount, lines, fallback);
      const rowSum = round2(b.groups.reduce((s, g) => s + g.vat, 0));
      if (round2(b.net + rowSum) !== b.gross) {
        failures.push({ i, fallback, lines, net: b.net, rowSum, gross: b.gross });
      }
    }
    expect(failures.slice(0, 3)).toEqual([]);
  });

  it('the total the document stores is the total its rows imply, 5000 documents', () => {
    // grossFromDocumentLines computes the STORED amount; documentVatBreakdown
    // feeds what is PRINTED. #354 batch 2 was these two disagreeing, so the fix
    // had to go in the helper — changing only the PDF would have left the
    // record and the document saying different things.
    const rand = rng(777);
    const failures: unknown[] = [];
    for (let i = 0; i < 5000; i++) {
      const fallback = RATES[Math.floor(rand() * RATES.length)];
      const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ({
        quantity: Math.round(rand() * 1000) / 100,
        unitPrice: Math.round(rand() * 30000) / 100,
        vatRate: RATES[Math.floor(rand() * RATES.length)],
      }));
      const netAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const stored = grossFromDocumentLines(netAmount, lines, fallback);
      const printed = documentVatBreakdown(netAmount, lines, fallback).gross;
      if (stored !== printed) failures.push({ i, fallback, lines, stored, printed });
    }
    expect(failures.slice(0, 3)).toEqual([]);
  });

  // #360, closed 2026-09-30: VAT used to be taken on the UNROUNDED line sum, so
  // a 21 % group summing to 231,5476 printed net 231,55 / VAT 48,62 while its
  // XRechnung — which follows EN 16931: line nets in cents (BT-131), their sum
  // (BT-116), × rate (BT-117) — stated 48,63. Paper and XML disagreed by a
  // cent on one invoice. The standard decides; every row is now re-derivable
  // from what it prints.
  it('every rate group is its printed net times its rate, to the cent', () => {
    const rand = rng(31337);
    const failures: unknown[] = [];
    for (let i = 0; i < 3000; i++) {
      const fallback = RATES[1 + Math.floor(rand() * (RATES.length - 1))];
      const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ({
        quantity: Math.round(rand() * 900) / 100,
        unitPrice: Math.round(rand() * 20000) / 100,
        vatRate: RATES[Math.floor(rand() * RATES.length)],
      }));
      const netAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      for (const g of vatRateGroups(netAmount, lines, fallback)) {
        if (g.vat !== round2(g.net * (g.ratePct / 100))) failures.push({ i, g });
      }
      // And the printed LINES add up to the printed subtotal.
      const printedLines = round2(lines.reduce((s, l) => s + round2(l.quantity * l.unitPrice), 0));
      if (documentVatBreakdown(netAmount, lines, fallback).net !== printedLines) failures.push({ i, printedLines });
    }
    expect(failures.slice(0, 3)).toEqual([]);
  });

  // Review 2026-09-30: lines WITHOUT a rate took VAT on the unrounded amount
  // while the net was the lines in cents; the invoice PDF fills the rate in
  // and regroups, so its VAT row missed its own Total by a cent (1.5 × 149,56
  // + 2.5 × 138,19 at 19 % printed 569,82 + 108,27 = 678,08). Quote lines are
  // stored unrated, so every quote-made invoice went through here.
  it('unrated lines: what is stored = what the PDF prints after filling the rate in, 20000 documents', () => {
    const rand = rng(90210);
    const failures: unknown[] = [];
    for (let i = 0; i < 20000; i++) {
      const rate = RATES[1 + Math.floor(rand() * (RATES.length - 1))];
      const lines = Array.from({ length: 1 + Math.floor(rand() * 4) }, () => ({
        quantity: Math.round(rand() * 900) / 100,
        unitPrice: Math.round(rand() * 20000) / 100,
      }));
      const netAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const stored = grossFromDocumentLines(netAmount, lines, rate);
      const b = documentVatBreakdown(netAmount, lines, rate);
      const rated = lines.map((l) => ({ ...l, vatRate: rate }));
      const pdfVat = round2(vatRateGroups(netAmount, rated, rate).reduce((s, g) => s + g.vat, 0));
      if (stored !== b.gross || pdfVat !== b.vat || round2(b.net + pdfVat) !== stored) {
        failures.push({ i, rate, lines, stored, gross: b.gross, vat: b.vat, pdfVat });
      }
    }
    expect(failures.slice(0, 2)).toEqual([]);
  });

  it('the PDF states what the XRechnung states, 3000 documents', () => {
    const rand = rng(4242);
    const failures: unknown[] = [];
    const amount = (xml: string, tag: string) => Number(xml.match(new RegExp(`<cbc:${tag}[^>]*>([-\\d.]+)<`))![1]);
    for (let i = 0; i < 3000; i++) {
      const lines = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => ({
        quantity: Math.round(rand() * 900) / 100,
        unitPrice: Math.round(rand() * 20000) / 100,
        vatRate: [19, 7][Math.floor(rand() * 2)],
      }));
      const netAmount = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
      const b = documentVatBreakdown(netAmount, lines, 19);
      const xml = generateXRechnungXML({
        ...XML_BASE,
        lineItems: lines.map((l, n) => ({
          description: `L${n}`, quantity: l.quantity, unitCode: 'stuk', unitPrice: l.unitPrice,
          vatRate: l.vatRate, vatAmount: 0, lineTotal: l.quantity * l.unitPrice,
        })),
        totalNet: b.net, totalVat: b.vat, totalGross: b.gross,
      });
      const perRate = [...xml.matchAll(/<cac:TaxSubtotal>[\s\S]*?<cbc:TaxAmount[^>]*>([-\d.]+)<[\s\S]*?<cbc:Percent>([\d.]+)</g)]
        .map((m) => ({ ratePct: Number(m[2]), vat: Number(m[1]) }))
        // A category used only by a zero-amount line: the XML must still list
        // it (EN 16931 wants a breakdown per category used), the PDF prints no
        // "VAT 19 %: 0,00" row. Only the amounts have to agree.
        .filter((r) => r.vat !== 0)
        .sort((a, c) => c.ratePct - a.ratePct);
      const ours = b.groups.map((g) => ({ ratePct: g.ratePct, vat: g.vat }));
      if (
        amount(xml, 'TaxExclusiveAmount') !== b.net
        || amount(xml, 'TaxInclusiveAmount') !== b.gross
        || JSON.stringify(perRate) !== JSON.stringify(ours)
      ) {
        failures.push({ i, lines, b, xmlNet: amount(xml, 'TaxExclusiveAmount'), xmlGross: amount(xml, 'TaxInclusiveAmount'), perRate });
      }
    }
    expect(failures.slice(0, 2)).toEqual([]);
  });
});
