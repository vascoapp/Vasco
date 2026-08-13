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
