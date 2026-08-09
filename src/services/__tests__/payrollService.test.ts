import { buildPayroll, periodBounds, type PayrollJob, type PayrollWorker } from '../payrollService';

// Wednesday 2026-08-12, so the Mon-based week is 08-10..08-16 and the month
// is 08-01..08-31. Fixed date: these assertions must not depend on when the
// suite runs (learnings #119 — a bug that only appears after lunch).
const NOW = new Date(2026, 7, 12, 10, 0, 0);

const workers: PayrollWorker[] = [
  { id: 'w-ahmed', name: 'Ahmed', hourlyCost: 30, isActive: true },
  { id: 'w-sanne', name: 'Sanne', hourlyCost: 40, isActive: true },
  { id: 'w-norate', name: 'Joris', isActive: true },
  { id: 'w-gone', name: 'Piet', hourlyCost: 25, isActive: false },
];

const build = (jobs: PayrollJob[], period: 'week' | 'month' = 'week') =>
  buildPayroll({ jobs, workers, period, now: NOW, contractorName: 'Ik' });

describe('periodBounds', () => {
  it('weeks run Monday to Sunday', () => {
    expect(periodBounds('week', NOW)).toEqual({ from: '2026-08-10', to: '2026-08-16' });
  });

  it('months run first to last day', () => {
    expect(periodBounds('month', NOW)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });
});

describe('buildPayroll', () => {
  it('groups hours by the person who worked them, not the current assignee', () => {
    const r = build([
      { id: 'j1', timeEntries: [
        { date: '2026-08-10', hours: 4, workerId: 'w-ahmed' },
        { date: '2026-08-11', hours: 3, workerId: 'w-sanne' },
      ] },
      { id: 'j2', timeEntries: [{ date: '2026-08-12', hours: 2, workerId: 'w-ahmed' }] },
    ]);

    const ahmed = r.lines.find((l) => l.workerId === 'w-ahmed')!;
    expect(ahmed.hours).toBe(6);
    expect(ahmed.jobCount).toBe(2);
    expect(ahmed.cost).toBe(180); // 6 × 30
    expect(r.totalHours).toBe(9);
  });

  it('excludes entries outside the period', () => {
    const r = build([
      { id: 'j1', timeEntries: [
        { date: '2026-08-09', hours: 8, workerId: 'w-ahmed' }, // Sunday before
        { date: '2026-08-10', hours: 5, workerId: 'w-ahmed' }, // Monday, in
        { date: '2026-08-17', hours: 8, workerId: 'w-ahmed' }, // Monday after
      ] },
    ]);
    expect(r.totalHours).toBe(5);
  });

  it('counts the whole month when asked', () => {
    const r = build([
      { id: 'j1', timeEntries: [
        { date: '2026-08-03', hours: 8, workerId: 'w-ahmed' },
        { date: '2026-08-12', hours: 2, workerId: 'w-ahmed' },
      ] },
    ], 'month');
    expect(r.totalHours).toBe(10);
  });

  it('attributes entries with no workerId to the contractor', () => {
    const r = build([{ id: 'j1', timeEntries: [{ date: '2026-08-11', hours: 7 }] }]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].workerId).toBeNull();
    expect(r.lines[0].name).toBe('Ik');
  });

  // The two refusals to invent a number — the point of the service.
  it('leaves cost UNDEFINED when no rate is recorded, never 0', () => {
    const r = build([{ id: 'j1', timeEntries: [{ date: '2026-08-11', hours: 10, workerId: 'w-norate' }] }]);
    const line = r.lines[0];
    expect(line.hours).toBe(10);
    expect(line.cost).toBeUndefined();
    expect(line.hourlyCost).toBeUndefined();
  });

  it('reports unpriced hours separately so knownCost is never read as the whole bill', () => {
    const r = build([
      { id: 'j1', timeEntries: [
        { date: '2026-08-11', hours: 10, workerId: 'w-ahmed' },  // 300
        { date: '2026-08-11', hours: 8, workerId: 'w-norate' },  // unknown
      ] },
    ]);
    expect(r.knownCost).toBe(300);
    expect(r.unpricedCount).toBe(1);
    expect(r.unpricedHours).toBe(8);
    expect(r.totalHours).toBe(18);
  });

  it('applies no overtime premium — 50 hours costs 50 × the rate', () => {
    const r = build([
      { id: 'j1', timeEntries: [
        { date: '2026-08-10', hours: 25, workerId: 'w-sanne' },
        { date: '2026-08-11', hours: 25, workerId: 'w-sanne' },
      ] },
    ]);
    expect(r.lines[0].hours).toBe(50);
    expect(r.lines[0].cost).toBe(2000); // 50 × 40, NOT 40×40 + 10×60
  });

  it('still pays a deactivated worker who worked in the period', () => {
    const r = build([{ id: 'j1', timeEntries: [{ date: '2026-08-11', hours: 6, workerId: 'w-gone' }] }]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].name).toBe('Piet');
    expect(r.lines[0].cost).toBe(150);
    expect(r.lines[0].isInactive).toBe(true);
  });

  it('keeps hours for a worker deleted outright rather than dropping them', () => {
    const r = build([{ id: 'j1', timeEntries: [{ date: '2026-08-11', hours: 3, workerId: 'w-vanished' }] }]);
    expect(r.totalHours).toBe(3);
    expect(r.lines[0].cost).toBeUndefined();
  });

  it('is empty, not flattering, with no entries at all', () => {
    const r = build([{ id: 'j1', timeEntries: [] }, { id: 'j2' }]);
    expect(r.lines).toHaveLength(0);
    expect(r.totalHours).toBe(0);
    expect(r.knownCost).toBe(0);
    expect(r.unpricedCount).toBe(0);
  });

  it('sorts the biggest line of the wage bill first', () => {
    const r = build([
      { id: 'j1', timeEntries: [
        { date: '2026-08-11', hours: 2, workerId: 'w-ahmed' },
        { date: '2026-08-11', hours: 9, workerId: 'w-sanne' },
      ] },
    ]);
    expect(r.lines.map((l) => l.name)).toEqual(['Sanne', 'Ahmed']);
  });
});
