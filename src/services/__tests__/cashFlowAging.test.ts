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

describe('a DRAFT invoice is not a receivable', () => {
  // The German cashflow screen read "Zu erhalten 1.440,00 €" while the Geld
  // tab said 800,00 € for the same moment. The extra 640 was the De Jong
  // DRAFT, sitting in the "Aktuell" bucket: never sent, so the customer has
  // not been billed, nothing is owed, and there is no due date they could have
  // missed. Same rule as the collection-rate denominator.
  it('excludes drafts from every bucket', () => {
    const aging = computeInvoiceAging([
      inv({ id: 'sent-overdue', amount: 350, dueDate: dayBefore(14) }),
      inv({ id: 'draft-640', amount: 640, dueDate: dayBefore(0), status: 'draft' }),
    ] as any, NOW);

    expect(aging.days30).toEqual({ count: 1, total: 350 });
    expect(aging.current).toEqual({ count: 0, total: 0 });
    const grand = aging.current.total + aging.days30.total + aging.days60.total + aging.days90Plus.total;
    expect(grand).toBe(350);
  });

  it('still counts VIEWED invoices — issued, unpaid, genuinely owed', () => {
    // The filter is an exclusion rather than a whitelist precisely so this
    // status is not silently dropped: hiding money owed is the dangerous
    // direction on a receivables screen.
    const aging = computeInvoiceAging([
      inv({ id: 'viewed-200', amount: 200, dueDate: dayBefore(5), status: 'viewed' }),
    ] as any, NOW);

    expect(aging.days30).toEqual({ count: 1, total: 200 });
  });

  it('still excludes paid and cancelled', () => {
    const aging = computeInvoiceAging([
      inv({ id: 'paid', amount: 999, dueDate: dayBefore(5), status: 'paid' }),
      inv({ id: 'cancelled', amount: 999, dueDate: dayBefore(5), status: 'cancelled' }),
    ] as any, NOW);

    const grand = aging.current.total + aging.days30.total + aging.days60.total + aging.days90Plus.total;
    expect(grand).toBe(0);
  });
});
