/**
 * @jest-environment node
 */
// #345 imposed one rule on the three XML exporters: a document states its
// totals ONCE, derived from the lines it actually prints. The ACCOUNTING
// providers were not part of that sweep, and Lexoffice — the German one, so
// the beachhead market — computed net, gross and tax as three independent
// unrounded sums of the same lines (#354).
//
// Three sums rounded independently by the receiver need not agree. It does not
// take a pathological invoice: ONE line of € 1,50 at 19 % is enough.
import { vascoToLexofficeInvoice } from '../lexoffice';
import { requiresMarcaDaBollo } from '../fattureincloud';

const line = (unitPrice: number, quantity: number, vatRate: number) => ({
  description: 'Arbeitszeit',
  quantity,
  unitPrice,
  vatRate,
  unit: 'Stück',
});

const invoiceWith = (lineItems: ReturnType<typeof line>[]) => ({
  customerName: 'Bergmann Sanitär & Heizung GmbH',
  date: '2026-09-19',
  lineItems,
});

describe('a Lexoffice invoice cannot contradict itself', () => {
  const cases: { name: string; lines: ReturnType<typeof line>[] }[] = [
    // The case that fails with three independent sums. 1.50 × 0.19 = 0.285,
    // which floats represent as 0.28499999999999998 and rounds DOWN to 0.28,
    // while 1.50 × 1.19 = 1.785 rounds UP to 1.79.
    { name: 'one line of 1,50 at 19%', lines: [line(1.5, 1, 19)] },
    { name: 'three lines of 0,115 at 19%', lines: [line(0.115, 1, 19), line(0.115, 1, 19), line(0.115, 1, 19)] },
    { name: 'a mixed-rate invoice', lines: [line(100, 3, 19), line(49.99, 2, 7), line(12.5, 1, 19)] },
    { name: 'an exempt invoice', lines: [line(250, 1, 0)] },
    { name: 'awkward cents', lines: [line(13.37, 10, 19), line(0.01, 7, 7)] },
  ];

  it.each(cases)('$name: net + tax === gross', ({ lines }) => {
    const { totalPrice } = vascoToLexofficeInvoice(invoiceWith(lines));
    const sum = Math.round((totalPrice.totalNetAmount + totalPrice.totalTaxAmount) * 100) / 100;
    expect({ sum, gross: totalPrice.totalGrossAmount })
      .toEqual({ sum: totalPrice.totalGrossAmount, gross: totalPrice.totalGrossAmount });
  });

  it.each(cases)('$name: every figure is a whole number of cents', ({ lines }) => {
    const { totalPrice } = vascoToLexofficeInvoice(invoiceWith(lines));
    for (const [key, value] of Object.entries(totalPrice)) {
      if (typeof value !== 'number') continue;
      // 47.730900000000005 is not an amount of money.
      expect({ key, cents: Math.abs(value * 100 - Math.round(value * 100)) < 1e-9 })
        .toEqual({ key, cents: true });
    }
  });

  it('the totals still describe the lines it sends', () => {
    // Deriving the tax must not quietly change what is charged: the net is
    // the sum of the line nets, to the cent.
    const lines = [line(100, 3, 19), line(49.99, 2, 7)];
    const { totalPrice } = vascoToLexofficeInvoice(invoiceWith(lines));
    // 3 × 100,00 at 19 % = 357,00; 2 × 49,99 at 7 % = 106,98 (106,9786).
    expect(totalPrice.totalNetAmount).toBe(399.98);
    expect(totalPrice.totalGrossAmount).toBe(463.98);
    expect(totalPrice.totalTaxAmount).toBe(64);
  });
});

describe('the marca da bollo threshold is about the amount, not the unit price', () => {
  // The parameter was named `netPrice` — which in that file means the UNIT
  // price — while both callers passed `price * quantity`. The arithmetic was
  // right by luck; the signature invited the next caller to get it wrong.
  it('ten exempt lines of 10,00 are 100,00 and need the stamp', () => {
    const lines = Array.from({ length: 10 }, () => ({ lineTotal: 10, vatRate: 0 }));
    expect(requiresMarcaDaBollo(lines)).toBe(true);
  });

  it('only exempt lines count toward it', () => {
    expect(requiresMarcaDaBollo([
      { lineTotal: 1000, vatRate: 22 },
      { lineTotal: 50, vatRate: 0 },
    ])).toBe(false);
  });

  it('77,47 exactly is not over the threshold', () => {
    expect(requiresMarcaDaBollo([{ lineTotal: 77.47, vatRate: 0 }])).toBe(false);
    expect(requiresMarcaDaBollo([{ lineTotal: 77.48, vatRate: 0 }])).toBe(true);
  });
});
