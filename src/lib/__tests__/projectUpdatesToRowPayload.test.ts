// =============================================================================
// PROJECT WRITE MAPPER — can a field be cleared, or only set?
// =============================================================================
// This logic used to live inline inside AppState.updateProject, guarded on
// `!== undefined`. That can SET a field and never CLEAR one: an explicit
// `undefined` leaves a key JSON.stringify drops, so the column keeps its old
// value while the local spread shows it gone — cleared on screen, still in the
// database, back on the next cold start (learnings #143).
//
// It was unreachable by every test in the suite while it sat in a closure
// (#138), which is why it stayed wrong. It lives in mappers.ts now.
// =============================================================================

import { projectUpdatesToRowPayload } from '../mappers';

describe('projectUpdatesToRowPayload', () => {
  it('maps the camelCase patch onto row columns', () => {
    expect(
      projectUpdatesToRowPayload({
        title: 'Badkamer renovatie',
        status: 'active',
        startDate: '2026-08-03',
        totalBudget: 12500,
        retentionPercent: 5,
      }),
    ).toEqual({
      name: 'Badkamer renovatie',
      status: 'active',
      start_date: '2026-08-03',
      total_budget: 12500,
      retention_percent: 5,
    });
  });

  it('leaves out anything the caller did not mention', () => {
    expect(projectUpdatesToRowPayload({})).toEqual({});
    expect(projectUpdatesToRowPayload({ title: 'x' })).toEqual({ name: 'x' });
  });

  describe('nullable columns can be cleared', () => {
    const NULLABLE: Array<[string, string]> = [
      ['description', 'description'],
      ['startDate', 'start_date'],
      ['targetEndDate', 'target_end_date'],
      ['actualEndDate', 'actual_end_date'],
      ['totalBudget', 'total_budget'],
      ['address', 'address'],
    ];

    it.each(NULLABLE)('%s clears to null', (field, column) => {
      const out = projectUpdatesToRowPayload({ [field]: undefined } as any);
      expect(out).toEqual({ [column]: null });
      // The whole point of the null: an undefined value would not survive the
      // trip to the database, so the clear would silently never happen.
      expect(JSON.parse(JSON.stringify(out))).toEqual({ [column]: null });
    });

    it('clears a promised handover — the case that exposed the bug', () => {
      expect(projectUpdatesToRowPayload({ targetEndDate: undefined })).toEqual({
        target_end_date: null,
      });
    });
  });

  describe('NOT NULL columns are never nulled', () => {
    it('does not null name or status', () => {
      // Coalescing these would send a null the database must reject, turning a
      // clear that cannot work into a failed write of the whole row.
      const out = projectUpdatesToRowPayload({ title: undefined, status: undefined } as any);
      expect(out.name).toBeUndefined();
      expect(out.status).toBeUndefined();
    });

    it('falls back to the column default for the NOT NULL collections', () => {
      const out = projectUpdatesToRowPayload({
        milestones: undefined,
        billingTerms: undefined,
        changeOrders: undefined,
        retentionPercent: undefined,
      } as any);
      expect(out).toEqual({
        milestones: [],
        billing_terms: [],
        change_orders: [],
        retention_percent: 0,
      });
    });
  });

  it('keeps a real zero rather than reading it as cleared', () => {
    // Nullish-only coalescing: a project budgeted at 0 with 0% retention is a
    // statement, not an absence. `||` here would have erased both.
    expect(projectUpdatesToRowPayload({ totalBudget: 0, retentionPercent: 0 })).toEqual({
      total_budget: 0,
      retention_percent: 0,
    });
  });

  it('still writes the fields progress billing depends on', () => {
    // Rule #8 step 4 for billing: these were the reason the inline version
    // existed, and extracting it must not drop them.
    const out = projectUpdatesToRowPayload({
      billingTerms: [{ id: 't1' } as any],
      changeOrders: [{ id: 'c1' } as any],
      milestones: [{ id: 'm1' } as any],
    });
    expect(out).toEqual({
      billing_terms: [{ id: 't1' }],
      change_orders: [{ id: 'c1' }],
      milestones: [{ id: 'm1' }],
    });
  });
});
