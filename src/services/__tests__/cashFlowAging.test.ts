// Regression: the aging table was computed from the CashFlowService singleton's
// invoice Map, which R26 emptied and nothing repopulates, so all four buckets
// read € 0,00 / 0 facturen while the alert on the same screen reported two
// overdue invoices worth € 800.
//
// These tests pin the arithmetic to the invoices actually passed in. Dates are
// built relative to a FIXED `now` so the buckets don't shift with the clock.

import { computeInvoiceAging } from '../cashFlowService';

const NOW = new Date('2026-08-07T12:00:00');
const dayBefore = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

const inv = (over: Partial<any> & { id: string; amount: number; dueDate: string }) => ({
  customerId: 'c', customerName: 'C', projectId: 'p', projectName: 'P',
  status: 'overdue' as const, issueDate: dayBefore(60), remindersSent: 0,
  ...over,
});

describe('computeInvoiceAging', () => {
  it('buckets the real overdue invoices instead of returning zeros', () => {
    // The exact pair from the demo seed that exposed the bug.
    const aging = computeInvoiceAging([
      inv({ id: 'inv-seed-1', amount: 350, dueDate: dayBefore(14) }), // Hotel NH
      inv({ id: 'i-1043', amount: 450, dueDate: dayBefore(10) }),     // Bouwgroep Atlas
    ] as any, NOW);

    expect(aging.days30).toEqual({ count: 2, total: 800 });
    expect(aging.current.count).toBe(0);
    expect(aging.days60.count).toBe(0);
    expect(aging.days90Plus.count).toBe(0);
  });

  it('separates not-yet-due from overdue', () => {
    const aging = computeInvoiceAging([
      inv({ id: 'a', amount: 100, dueDate: dayBefore(-5), status: 'sent' }), // due in 5 days
      inv({ id: 'b', amount: 200, dueDate: dayBefore(1) }),
    ] as any, NOW);

    expect(aging.current).toEqual({ count: 1, total: 100 });
    expect(aging.days30).toEqual({ count: 1, total: 200 });
  });

  it('places invoices in the 31-60 and 60+ buckets by age', () => {
    const aging = computeInvoiceAging([
      inv({ id: 'a', amount: 100, dueDate: dayBefore(45) }),
      inv({ id: 'b', amount: 200, dueDate: dayBefore(120) }),
    ] as any, NOW);

    expect(aging.days60).toEqual({ count: 1, total: 100 });
    expect(aging.days90Plus).toEqual({ count: 1, total: 200 });
  });

  it('excludes paid and cancelled invoices', () => {
    const aging = computeInvoiceAging([
      inv({ id: 'a', amount: 100, dueDate: dayBefore(20), status: 'paid' }),
      inv({ id: 'b', amount: 200, dueDate: dayBefore(20), status: 'cancelled' }),
      inv({ id: 'c', amount: 300, dueDate: dayBefore(20) }),
    ] as any, NOW);

    expect(aging.days30).toEqual({ count: 1, total: 300 });
  });

  it('an invoice due today is current, not overdue', () => {
    // Calendar-day semantics: it should not tip into "1 day late" partway
    // through the afternoon just because NOW is midday.
    const aging = computeInvoiceAging(
      [inv({ id: 'a', amount: 100, dueDate: dayBefore(0), status: 'sent' })] as any,
      NOW,
    );

    expect(aging.current).toEqual({ count: 1, total: 100 });
    expect(aging.days30.count).toBe(0);
  });
});
