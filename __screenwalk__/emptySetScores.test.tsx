/**
 * An empty set is not a good result.
 *
 * Three separate scores treated "no data" as "perfect", because the absence of
 * a bad signal was counted as a good one:
 *
 *   compliance score   totalCount === 0            -> 100 "Uitstekend"
 *   on-time rate       completedJobs === 0         -> 1   (100%)
 *   financial health   no invoices -> no overdue   -> 50 + 20 = 70
 *
 * The contractor score compounded it: on-time carries 35 of 100 points, so a
 * brand-new account was shown "Aannemer Score 35/100" derived entirely from a
 * placeholder. Each now reports UNKNOWN and the screens render an em-dash —
 * the same treatment the savings-trend fabrication got.
 *
 * These assertions are on the SHAPES, not the screens, because that is where
 * the bug lived.
 */

describe('scores with nothing to score', () => {
  it('financial health is unknown, not 70, on an account with no invoices', () => {
    const { cashFlowService } = require('../src/services/cashFlowService');
    const summary = cashFlowService.getCashFlowSummary();
    // The singleton starts empty (R26 removed its seed), which is exactly the
    // day-one contractor this guards.
    expect(summary.healthScore).toBeNull();
  });

  it('a score built from an absent signal never lands on a flattering number', () => {
    // The arithmetic that produced 70: base 50, +20 for "no overdue invoices",
    // +0 for a balance under 5000. Locked so nobody reinstates the +20 for an
    // empty set.
    const noOverdueBonus = 20;
    const base = 50;
    const emptyAccountWouldScore = base + noOverdueBonus;
    expect(emptyAccountWouldScore).toBe(70);

    const { cashFlowService } = require('../src/services/cashFlowService');
    expect(cashFlowService.getCashFlowSummary().healthScore).not.toBe(emptyAccountWouldScore);
  });
});
