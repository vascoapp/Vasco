/**
 * @jest-environment node
 */
// Money sweep, 2026-09-19 (#354). The rules being enforced are the repo's own:
//
//  • A document states its totals ONCE, from the lines it prints (#345).
//  • `Quote.amount` is NET, `Invoice.amount` is GROSS (#241/#242).
//  • Retention is withheld from PAYMENT — the invoice total and its VAT stay
//    whole, and payable-now is derived (progress-billing).
//  • VAT is neither income nor cost: a P&L is NET on both sides.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';
import { analyzeFinancials } from '../services/financialAnalysisService';
import type { Invoice, Quote } from '../domain/documents';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

describe('a retention release does not charge the VAT twice', () => {
  // The release recovers money already invoiced AND already taxed on the term
  // invoices, so its gross carries no new VAT. It has no stored lines, so both
  // the screen and the PDF used to split it by the profile rate: € 1.512,50
  // printed as "Subtotaal € 1.250,00 / BTW € 262,50".
  it('the PDF source zeroes the rate for a release', () => {
    const SRC = read('src/services/invoicePdfSource.ts');
    expect(SRC).toMatch(/isRetentionRelease\?: boolean;/);
    expect(SRC).toMatch(/const fallbackVatRatePercent = invoice\.isRetentionRelease \? 0 : args\.fallbackVatRatePercent;/);
  });

  it('the invoice screen does too', () => {
    const SRC = read('app/invoices/[id].tsx');
    expect(SRC).toMatch(/const effectiveRate = invoice\?\.isRetentionRelease \? 0 : profileRate;/);
    // …and nothing else re-derives a rate behind its back.
    expect(SRC).not.toMatch(/const effectiveRate = businessProfile \?/);
  });
});

describe('the quote PDF prints what the screen shows', () => {
  const SRC = read('app/quotes/[id].tsx');

  it('sharePdf uses the displayed lines, not the raw map', () => {
    const at = SRC.indexOf('const sharePdf');
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf('const pdfData', at));
    // A quote with no STORED lines still has an amount; the screen synthesises
    // one line for it and the PDF used to print an empty table and € 0,00.
    expect(body).toMatch(/const items = displayLineItems;/);
    expect(body).toMatch(/const sub = subtotal;/);
    expect(body).not.toMatch(/lineItems\[quote\.id\]/);
  });
});

describe('what the message asks for is what the link charges', () => {
  const SRC = read('app/(contractor)/facturen.tsx');

  it('no reminder or share text quotes the full total', () => {
    // Retention withheld from an instalment is not due yet: the checkout
    // charges `amountPayableNow`, so the text beside it must too.
    expect(SRC).not.toMatch(/amount: formatCurrency\(autoInv\.total, country\)/);
    expect(SRC).not.toMatch(/amount: formatCurrency\(invoice\.amount, country\)/);
    const payableNow = [...SRC.matchAll(/formatCurrency\(amountPayableNow\([^)]*\), country\)/g)];
    expect(payableNow.length).toBeGreaterThanOrEqual(4);
  });

  it('the dunning email uses the same basis as its own interest line', () => {
    const INV = read('app/invoices/[id].tsx');
    expect(INV).toMatch(/amount: formatCurrency\(amountPayableNow\(invoice\), country\)/);
  });
});

describe('a purchase order adds the rate it prints', () => {
  it('the PO total is grossed at its own vatRate', () => {
    const SRC = read('src/services/procurementAgentService.ts');
    expect(SRC).toMatch(/totalInclVat: Math\.round\(totalExclVat \* \(1 \+ vatRate \/ 100\) \* 100\) \/ 100/);
    // The hardcoded NL factor that made every German PO say 19% and add 21%.
    expect(SRC).not.toMatch(/totalExclVat \* 1\.21/);
  });

  it('a supplier order taxes the same base it totals', () => {
    const SRC = read('src/services/supplierIntegrationService.ts');
    // Delivery is a taxable supply: it belongs in the VAT base, not only in
    // the total. And both figures are cents.
    expect(SRC).toMatch(/const net = round2\(cart\.subtotal \+ cart\.deliveryCost\);/);
    expect(SRC).toMatch(/const tax = round2\(net \* \(rate \/ 100\)\);/);
    expect(SRC).toMatch(/return \{ tax, total: round2\(net \+ tax\) \};/);
  });
});

describe('a P&L is net on both sides', () => {
  const paidInvoice = (id: string, gross: number): Invoice => ({
    id,
    customer: 'Hotel NH',
    job: 'Badkamer',
    amount: gross,
    status: 'paid',
    dueInDays: 0,
    paidAt: '2026-09-10T12:00:00.000Z',
    createdAt: '2026-09-01T12:00:00.000Z',
  } as Invoice);

  const NOW = new Date('2026-09-19T12:00:00.000Z');

  it('gross revenue is converted before costs are subtracted', () => {
    // € 12.100 paid at 21% is € 10.000 of turnover. Subtracting € 2.000 of NET
    // expense from the GROSS reported a margin of 83% where it is 80%.
    const summary = analyzeFinancials(
      [paidInvoice('F-1', 12100)],
      [] as Quote[],
      NOW,
      [{ id: 'e1', amount: 2000, vatAmount: 420, vatRate: 21, date: '2026-09-05', category: 'materials', description: 'Tegels' }] as never,
      undefined,
      21,
    );
    expect(summary.totalRevenue).toBe(10000);
  });

  it('a Kleinunternehmer / KOR contractor charges no VAT, so nothing is divided', () => {
    const summary = analyzeFinancials([paidInvoice('F-2', 5000)], [] as Quote[], NOW, [], undefined, 0);
    expect(summary.totalRevenue).toBe(5000);
  });

  it('the top-customer figures use the same turnover as the headline', () => {
    const summary = analyzeFinancials(
      [paidInvoice('F-3', 12100), paidInvoice('F-4', 2420)],
      [] as Quote[],
      NOW,
      [],
      [{ id: 'c1', name: 'Hotel NH' }],
      21,
    );
    const top = summary.topCustomers.reduce((s, c) => s + c.revenue, 0);
    expect({ top, headline: summary.totalRevenue }).toEqual({ top: 12000, headline: 12000 });
  });

  it("the production caller passes the contractor's effective rate", () => {
    const SRC = read('src/services/financialAnalysisService.ts');
    expect(SRC).toMatch(/businessProfile \? getEffectiveVatRate\(businessProfile\) : 0,/);
  });
});
