/**
 * Geld's cashflow card reported "KOSTEN 660,00 € · GEWINN 100,00 € · 13%" for a
 * month in which the contractor had recorded no expenses at all. The figure was
 * `invoiced * 0.30` — a hardcoded fraction of revenue, backed by no stored
 * field.
 *
 * It also disagreed with the P&L on the same month, which fabricated
 * DIFFERENTLY (25% materials + 10% opex). Fixing the P&L first (97a0828) left
 * the two contradicting each other more loudly, which is what surfaced this.
 */
import { analyzeFinancials } from '../financialAnalysisService';

const NOW = new Date('2026-08-13T12:00:00');

const paid = (id: string, amount: number, paidAt: string) => ({
  id, customer: 'Hotel NH', job: 'j', amount, status: 'paid' as const,
  dueInDays: 0, paidAt, createdAt: paidAt,
});

const expense = (amount: number, date: string, category = 'kantoor') =>
  ({ id: `e-${amount}-${date}`, description: 'x', category, amount, vatAmount: 0,
     vatRate: 0, date: new Date(date), deductible: true, deductionPercentage: 100 } as never);

describe('cashflow costs are recorded, never a fraction of revenue', () => {
  it('reports UNKNOWN costs when nothing has been recorded', () => {
    const fin = analyzeFinancials([paid('i1', 760, '2026-08-05T10:00:00')] as never, [], NOW);
    expect(fin.totalExpenses).toBeNull();
    expect(fin.netIncome).toBeNull();
    expect(fin.profitMargin).toBeNull();
  });

  it('never derives costs from revenue', () => {
    // The regression: 30% of 760 = 228. Must not reappear at any revenue.
    const fin = analyzeFinancials([paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW);
    expect(fin.totalExpenses).not.toBe(300);
    expect(fin.totalExpenses).toBeNull();
  });

  it('sums the real ledger and completes profit and margin', () => {
    const fin = analyzeFinancials(
      [paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW,
      [expense(250, '2026-08-06T10:00:00')],
    );
    expect(fin.totalExpenses).toBe(250);
    expect(fin.netIncome).toBe(750);
    expect(fin.profitMargin).toBe(75);
  });

  it('buckets expenses into the month they fall in', () => {
    const fin = analyzeFinancials(
      [paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW,
      [expense(100, '2026-08-06T10:00:00'), expense(999, '2026-05-06T10:00:00')],
    );
    const aug = fin.monthlyRevenue?.find?.((m: any) => m.month === '2026-08');
    if (aug) expect(aug.expenses).toBe(100);
    // Both months are inside the 12-month window, so the total carries both.
    expect(fin.totalExpenses).toBe(1099);
  });

  it('a recorded expense of zero still counts as data', () => {
    const fin = analyzeFinancials(
      [paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW,
      [expense(0, '2026-08-06T10:00:00')],
    );
    expect(fin.totalExpenses).toBe(0);
    expect(fin.netIncome).toBe(1000);
    expect(fin.profitMargin).toBe(100);
  });
});

describe('the projection says whether it is net or gross', () => {
  it('is NOT net when no expenses are recorded — outflows are 0, so it is income', () => {
    const fin = analyzeFinancials([paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW);
    expect(fin.projectedIsNet).toBe(false);
    // The number itself is still real — it is the CLAIM that changes.
    expect(typeof fin.projectedCashflow).toBe('number');
  });

  it('is net once costs are known', () => {
    const fin = analyzeFinancials(
      [paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW,
      [expense(250, '2026-08-06T10:00:00')],
    );
    expect(fin.projectedIsNet).toBe(true);
  });

  it('recording expenses lowers the projection — it stops assuming zero cost', () => {
    const gross = analyzeFinancials([paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW);
    const net = analyzeFinancials(
      [paid('i1', 1000, '2026-08-05T10:00:00')] as never, [], NOW,
      [expense(300, '2026-08-06T10:00:00')],
    );
    expect(net.projectedCashflow).toBeLessThan(gross.projectedCashflow);
  });
});

// 2026-09-14, German device: "ERWARTETER EINGANG € 10.619" was 90% a typed-in
// "30% likely next month" × a win rate computed from ONE decided quote, and
// "Hohe Konzentration" warned a contractor with ONE paid invoice.
const quote = (id: string, amount: number, status: string) =>
  ({ id, customer: 'c', job: 'j', amount, status } as never);

describe('projections and rates stand on recorded outcomes', () => {
  it('the projection does not add a fraction of the open pipeline', () => {
    const invoices = [paid('i1', 3000, '2026-08-05T10:00:00')] as never;
    const without = analyzeFinancials(invoices, [], NOW);
    // Five decided quotes, so the win rate is REAL (100%) — with fewer it is 0
    // and the old pipeline term would vanish on its own, proving nothing.
    const withPipeline = analyzeFinancials(invoices, [
      quote('q1', 30000, 'sent'),
      ...['a', 'b', 'c', 'd', 'e'].map((id) => quote(id, 9000, 'accepted')),
    ], NOW);
    expect(withPipeline.quotePipeline).toBe(30000);
    expect(withPipeline.quoteWinRate).toBe(100);
    expect(withPipeline.projectedCashflow).toBe(without.projectedCashflow);
  });

  it('reports no win rate from fewer than five decided quotes', () => {
    const four = analyzeFinancials([] as never, [
      quote('a', 1, 'accepted'), quote('b', 1, 'rejected'), quote('c', 1, 'rejected'), quote('d', 1, 'expired'),
    ], NOW);
    expect(four.quoteWinRate).toBe(0);
    const five = analyzeFinancials([] as never, [
      quote('a', 1, 'accepted'), quote('b', 1, 'rejected'), quote('c', 1, 'rejected'), quote('d', 1, 'expired'), quote('e', 1, 'accepted'),
    ], NOW);
    expect(five.quoteWinRate).toBe(40);
  });

  it('does not call one paid invoice a concentration risk', () => {
    const one = analyzeFinancials([paid('i1', 3200, '2026-08-05T10:00:00')] as never, [], NOW);
    expect(one.topCustomers[0].percentage).toBe(100);
    expect(one.concentrationRisk).toBe(false);
    const five = analyzeFinancials(
      ['1', '2', '3', '4', '5'].map((n) => paid(`i${n}`, 1000, `2026-08-0${n}T10:00:00`)) as never, [], NOW,
    );
    expect(five.concentrationRisk).toBe(true);
  });
});
