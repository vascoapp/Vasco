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

  describe('customerId is a uuid FK, not free text', () => {
    // `customer_id uuid references customers(id) on delete set null`. The create
    // screen used to hand a typed NAME straight into this field, so every other
    // write site already guards with isUuid — this mapper had no line for it at
    // all, which meant a project's customer could never be changed.
    const UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

    it('writes a real uuid through', () => {
      expect(projectUpdatesToRowPayload({ customerId: UUID })).toEqual({ customer_id: UUID });
    });

    it('nulls a name rather than sending it to a uuid column', () => {
      // Reaching the database would be a type error / FK violation, failing the
      // whole row write rather than just this field.
      expect(projectUpdatesToRowPayload({ customerId: 'Fam. Jansen' })).toEqual({ customer_id: null });
    });

    it('nulls a temp id, which no customers row has yet', () => {
      expect(projectUpdatesToRowPayload({ customerId: 'c-1754831200000' })).toEqual({ customer_id: null });
    });

    it('clears on empty string and on explicit undefined', () => {
      expect(projectUpdatesToRowPayload({ customerId: '' })).toEqual({ customer_id: null });
      expect(projectUpdatesToRowPayload({ customerId: undefined } as any)).toEqual({ customer_id: null });
    });
  });
});
