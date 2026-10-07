/**
 * The quote and invoice shown in each market's App Store / Play screenshots
 * add up — to the cent (2026-10-07).
 *
 * scripts/shoot-ios.sh opens one quote and one invoice per language. Their
 * line items are seeded in src/data/mockLineItems.ts; before this the Italian
 * and English documents had NO lines (a total floating over an empty list)
 * and the Dutch invoice showed one placeholder line. A screenshot is a claim
 * to every reader of the store page, so the arithmetic is held here:
 *   quote:   Σ lines == the quote's NET amount
 *   invoice: Σ lines + VAT at the market's rate == the invoice's GROSS amount
 */
import { quoteLineItems } from '../data/mockLineItems';
import {
  quotes, invoices, deQuotes, deInvoices, frQuotes, frInvoices,
  esQuotes, esInvoices, itQuotes, itInvoices, ukQuotes, ukInvoices,
} from '../data/mockDocuments';
import { round2 } from '../utils/round2';

const SHOTS: Array<[string, string, string, number, Array<{ id: string; amount?: number }>, Array<{ id: string; amount?: number }>]> = [
  // market, quote id, invoice id, VAT %, quotes, invoices — same ids as scripts/shoot-ios.sh
  ['nl', 'Q-2026-0033', 'i-1043', 21, quotes, invoices],
  ['de', 'AN-2026-0041', 'inv-de-1', 19, deQuotes, deInvoices],
  ['fr', 'DE-2026-0041', 'inv-fr-1', 20, frQuotes, frInvoices],
  ['es', 'PR-2026-0041', 'inv-es-1', 21, esQuotes, esInvoices],
  ['it', 'PV-2026-0041', 'inv-it-3', 22, itQuotes, itInvoices],
  ['en', 'QT-2026-0041', 'inv-uk-1', 20, ukQuotes, ukInvoices],
];

const net = (id: string) => round2((quoteLineItems[id] ?? []).reduce((s, l) => s + l.quantity * l.unitPrice, 0));

describe.each(SHOTS)('%s', (_m, quoteId, invoiceId, rate, qs, invs) => {
  it('the quote has lines, and they make its net amount', () => {
    expect((quoteLineItems[quoteId] ?? []).length).toBeGreaterThan(1);
    expect(net(quoteId)).toBe(qs.find((q) => q.id === quoteId)?.amount);
  });
  it('the invoice has lines; with VAT they make its gross amount, to the cent', () => {
    expect((quoteLineItems[invoiceId] ?? []).length).toBeGreaterThan(0);
    const n = net(invoiceId);
    expect(round2(n + round2(n * rate / 100))).toBe(invs.find((i) => i.id === invoiceId)?.amount);
  });
});

it('the capture script opens exactly these documents', () => {
  const sh = require('fs').readFileSync(require('path').join(__dirname, '../../scripts/shoot-ios.sh'), 'utf8') as string;
  for (const [m, q, i] of SHOTS) {
    expect(sh).toMatch(new RegExp(`${m}\\) echo ${q} ;;`));
    expect(sh).toMatch(new RegExp(`${m}\\) echo ${i} ;;`));
  }
});
