// =============================================================================
// MAINTENANCE OPPORTUNITIES
// =============================================================================
// The properties worth pinning are the ones that would put a made-up number, or
// a made-up pattern, in front of a contractor about their own customers.
// =============================================================================

import {
  detectRhythm,
  intervalsBetween,
  confidenceFor,
  median,
  rankOpportunities,
  MIN_VISITS_FOR_RHYTHM,
  type MaintenanceVisit,
  type MaintenanceOpportunity,
} from '../maintenanceOpportunityService';

const NOW = new Date('2026-08-04T12:00:00.000Z').getTime();
const DAY = 86_400_000;
/** A visit `daysAgo` before NOW. */
const visit = (daysAgo: number, amount?: number, trade?: string): MaintenanceVisit => ({
  completedAt: new Date(NOW - daysAgo * DAY).toISOString(),
  amount,
  trade,
});

describe('median', () => {
  it('is null for no observations rather than 0', () => {
    expect(median([])).toBeNull();
  });

  it('averages the middle pair when even', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('ignores input order', () => {
    expect(median([365, 30, 200])).toBe(200);
  });
});

describe('intervals', () => {
  it('measures gaps between consecutive visits regardless of input order', () => {
    const gaps = intervalsBetween([visit(0), visit(730), visit(365)]);
    expect(gaps.map(Math.round)).toEqual([365, 365]);
  });

  it('drops same-week duplicates instead of dragging the median to zero', () => {
    // A job split across two days is one visit. Counting the 1-day gap would
    // halve the median and invent a fortnightly "rhythm".
    const gaps = intervalsBetween([visit(0), visit(1), visit(365)]);
    expect(gaps.map(Math.round)).toEqual([364]);
  });
});

describe('confidence', () => {
  it('is firm when the gaps cluster', () => {
    expect(confidenceFor([360, 365, 370], 365)).toBe('firm');
  });

  it('is loose when one gap is far from the median', () => {
    // 90 days against a 365 median is not a schedule, even though a median
    // exists. Presenting it as one would be the fabrication.
    expect(confidenceFor([365, 370, 90], 365)).toBe('loose');
  });
});

describe('detecting a rhythm', () => {
  it('reads an annual service off three visits', () => {
    const o = detectRhythm('c1', 'Hotel NH', [visit(740, 120), visit(375, 130), visit(10, 140)], NOW)!;
    expect(o.intervalDays).toBe(365);
    expect(o.confidence).toBe('firm');
    expect(o.visits).toBe(3);
    // One interval after a visit 10 days ago.
    expect(o.dueInDays).toBe(355);
  });

  it('refuses to call two visits a pattern', () => {
    // Two visits are ONE gap. A customer who happened to call twice is not yet
    // distinguishable from an annual service.
    expect(detectRhythm('c1', 'Hotel NH', [visit(365), visit(0)], NOW)).toBeNull();
    expect(MIN_VISITS_FOR_RHYTHM).toBe(3);
  });

  it('refuses when duplicates take the real visit count below the bar', () => {
    // Three rows, but two are the same visit split across days → one gap.
    expect(detectRhythm('c1', 'X', [visit(400), visit(1), visit(0)], NOW)).toBeNull();
  });

  it('reports overdue as a negative number of days', () => {
    // Annual rhythm, last seen 400 days ago → 35 days late.
    const o = detectRhythm('c1', 'X', [visit(1130, 100), visit(765, 100), visit(400, 100)], NOW)!;
    expect(o.intervalDays).toBe(365);
    expect(o.dueInDays).toBe(-35);
  });
});

describe('money — the part that must never be invented', () => {
  it('is null when no visit carried an amount', () => {
    // A job's amount is optional. Zero would read as "you do this for free";
    // a guessed figure would be a market rate we do not have.
    const o = detectRhythm('c1', 'X', [visit(730), visit(365), visit(0)], NOW)!;
    expect(o.medianVisitValue).toBeNull();
    expect(o.estimatedAnnualValue).toBeNull();
  });

  it('uses the median of what they were actually charged', () => {
    const o = detectRhythm('c1', 'X', [visit(730, 100), visit(365, 120), visit(0, 500)], NOW)!;
    // Median, not mean: one unusual 500 job must not drag the estimate up.
    expect(o.medianVisitValue).toBe(120);
  });

  it('scales the annual estimate by the observed rhythm, not by assuming yearly', () => {
    // Quarterly at 200 a visit is 800 a year, not 200.
    const o = detectRhythm('c1', 'X', [visit(270, 200), visit(180, 200), visit(90, 200)], NOW)!;
    expect(o.intervalDays).toBe(90);
    expect(o.estimatedAnnualValue).toBe(811); // 200 × 365/90
  });

  it('ignores zero and negative amounts when taking the median', () => {
    const o = detectRhythm('c1', 'X', [visit(730, 0), visit(365, 100), visit(0, 100)], NOW)!;
    expect(o.medianVisitValue).toBe(100);
  });
});

describe('ranking', () => {
  const o = (id: string, dueInDays: number): MaintenanceOpportunity => ({
    customerId: id, customerName: id, visits: 3, intervalDays: 365,
    confidence: 'firm', lastVisit: new Date(NOW).toISOString(), dueInDays,
    medianVisitValue: 100, estimatedAnnualValue: 100,
  });

  it('puts the most overdue first and hides work that is not due yet', () => {
    const ranked = rankOpportunities([o('soon', 30), o('late', -40), o('far', 300)], 60);
    expect(ranked.map((r) => r.customerId)).toEqual(['late', 'soon']);
  });
});

describe('aannemer: project phases are not a rhythm', () => {
  // The detector is shape-agnostic; what protects the aannemer is the hook
  // excluding project-linked jobs and counting a completed project as ONE
  // visit. These pin the arithmetic that decision rests on.

  it('would read a false annual rhythm from phases if they were counted', () => {
    // Three trade jobs inside ONE renovation, six weeks apart. If the hook let
    // project jobs through, this is what the contractor would be told — a
    // rhythm, and a yearly value, for a job that will never recur.
    const phases = [visit(84, 20000), visit(42, 30000), visit(0, 30000)];
    const wrong = detectRhythm('c1', 'Renovatie Jansen', phases, NOW)!;
    expect(wrong).not.toBeNull();
    expect(wrong.intervalDays).toBe(42);
    // Documented so the exclusion in useMaintenanceOpportunities is never
    // "simplified" away: this is the number it exists to prevent.
    expect(wrong.estimatedAnnualValue).toBe(260714);
  });

  it('reads a real rhythm from repeat commissions a year apart', () => {
    // A property manager who commissions one project a year IS repeat work,
    // and each completed project counts once.
    const commissions = [visit(750, 18000), visit(385, 22000), visit(20, 20000)];
    const o = detectRhythm('c2', 'City Property Management', commissions, NOW)!;
    expect(o.intervalDays).toBe(365);
    expect(o.confidence).toBe('firm');
    expect(o.medianVisitValue).toBe(20000);
    expect(o.dueInDays).toBe(345);
  });
});
