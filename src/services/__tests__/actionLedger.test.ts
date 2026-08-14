/**
 * The action ledger reports what VascoCard actually did.
 *
 * It replaces a headline that counted route optimisation, `supplierDiscount
 * × 0.4` and `quickWins × 0.5` — none of which were VascoCard approvals — as
 * "Vasco saved you €X". These tests pin the rules that keep the replacement
 * honest, because a number the contractor is asked to trust has to be
 * defensible line by line.
 */
import {
  summariseLedger,
  familyOf,
  type LedgerEntry,
} from '../actionLedgerService';

const AUG = new Date(2026, 7, 14); // 14 Aug 2026, local time

const entry = (over: Partial<LedgerEntry> & Pick<LedgerEntry, 'id'>): LedgerEntry => ({
  type: 'draft_invoice',
  at: new Date(2026, 7, 10, 9, 0).toISOString(),
  executed: true,
  ...over,
});

describe('only work that actually fired is counted', () => {
  it('counts an approval whose execution reported success', () => {
    const s = summariseLedger([entry({ id: 'a' })], AUG);
    expect(s.total).toBe(1);
  });

  it('does NOT count an informational alert, which executes nothing', () => {
    // queueItemExecutor returns {executed: false, via: 'inform'} for
    // low_win_alert / late_payment_risk_alert when the producer supplied no
    // deep-linkable id. Approving one is a dismissal, not work.
    // (supplier_comparison used to be in that set and no longer is — it now
    // opens the comparison screen its own button names.)
    const s = summariseLedger(
      [entry({ id: 'a', type: 'low_win_alert', executed: false, via: 'inform' })],
      AUG,
    );
    expect(s.total).toBe(0);
  });

  it('does NOT count an approval whose executor never reported back', () => {
    // undefined is "we do not know", and the honest direction for an unknown
    // in a trust number is to under-count (learnings #103).
    const s = summariseLedger([entry({ id: 'a', executed: undefined })], AUG);
    expect(s.total).toBe(0);
  });

  it('an empty ledger produces zero, not a placeholder', () => {
    const s = summariseLedger([], AUG);
    expect(s).toEqual({ total: 0, byFamily: [], confirmed: 0, firstAt: null });
  });
});

describe('the period is the calendar month, measured at APPROVAL time', () => {
  it('excludes an action approved last month', () => {
    const s = summariseLedger(
      [entry({ id: 'a', at: new Date(2026, 6, 31, 23, 0).toISOString() })],
      AUG,
    );
    expect(s.total).toBe(0);
  });

  it('excludes an action approved next month', () => {
    const s = summariseLedger(
      [entry({ id: 'a', at: new Date(2026, 8, 1, 0, 30).toISOString() })],
      AUG,
    );
    expect(s.total).toBe(0);
  });

  it('includes an action approved on the first instant of the month', () => {
    const s = summariseLedger(
      [entry({ id: 'a', at: new Date(2026, 7, 1, 0, 0).toISOString() })],
      AUG,
    );
    expect(s.total).toBe(1);
  });

  it('reports the earliest counted approval so callers can say "since"', () => {
    const early = new Date(2026, 7, 3, 8, 0).toISOString();
    const s = summariseLedger(
      [entry({ id: 'a' }), entry({ id: 'b', at: early })],
      AUG,
    );
    expect(s.firstAt).toBe(early);
  });
});

describe('the breakdown names concrete work', () => {
  it('groups by family, largest first', () => {
    const s = summariseLedger(
      [
        entry({ id: '1', type: 'draft_invoice' }),
        entry({ id: '2', type: 'batch_invoices' }),
        entry({ id: '3', type: 'draft_reminder' }),
      ],
      AUG,
    );
    expect(s.byFamily).toEqual([
      { family: 'invoicing', count: 2 },
      { family: 'chasing', count: 1 },
    ]);
  });

  it('breaks ties by name so the list does not reshuffle between reads', () => {
    const s = summariseLedger(
      [
        entry({ id: '1', type: 'draft_quote' }),   // quoting
        entry({ id: '2', type: 'draft_reminder' }), // chasing
      ],
      AUG,
    );
    expect(s.byFamily.map((f) => f.family)).toEqual(['chasing', 'quoting']);
  });

  it('omits families with no actions rather than showing them at zero', () => {
    const s = summariseLedger([entry({ id: '1', type: 'draft_invoice' })], AUG);
    expect(s.byFamily).toHaveLength(1);
    expect(s.byFamily.every((f) => f.count > 0)).toBe(true);
  });

  it('the family counts always sum to the headline total', () => {
    // The breakdown is the justification for the headline. If they disagree,
    // the headline is unsupported — which is how the banner it replaces broke.
    const s = summariseLedger(
      [
        entry({ id: '1', type: 'draft_invoice' }),
        entry({ id: '2', type: 'reorder_materials' }),
        entry({ id: '3', type: 'cert_renewal' }),
        entry({ id: '4', type: 'low_win_alert', executed: false }),
      ],
      AUG,
    );
    expect(s.byFamily.reduce((n, f) => n + f.count, 0)).toBe(s.total);
    expect(s.total).toBe(3);
  });
});

describe('"confirmed" means the customer responded — nothing weaker', () => {
  it('counts only a positive outcome', () => {
    const s = summariseLedger(
      [
        entry({ id: '1', outcome: 'positive' }),
        entry({ id: '2', outcome: 'negative' }),
        entry({ id: '3', outcome: 'neutral' }),
        entry({ id: '4' }), // no outcome yet
      ],
      AUG,
    );
    expect(s.total).toBe(4);
    expect(s.confirmed).toBe(1);
  });

  it('never reports more confirmations than actions', () => {
    const s = summariseLedger(
      [entry({ id: '1', outcome: 'positive' }), entry({ id: '2', executed: false, outcome: 'positive' })],
      AUG,
    );
    expect(s.confirmed).toBeLessThanOrEqual(s.total);
    expect(s.confirmed).toBe(1);
  });
});

describe('every queue type is classified', () => {
  it('maps known types to their family', () => {
    expect(familyOf('draft_invoice')).toBe('invoicing');
    expect(familyOf('draft_reminder')).toBe('chasing');
    expect(familyOf('quote_expiry')).toBe('quoting');
    expect(familyOf('permit_renewal')).toBe('compliance');
    expect(familyOf('bulk_purchase')).toBe('purchasing');
    expect(familyOf('maintenance_due')).toBe('planning');
    expect(familyOf('job_handover')).toBe('customer');
  });

  it('buckets an unknown type rather than dropping the action', () => {
    // A ledger written by a newer build can carry a type this build lacks.
    // Losing the entry would silently shrink the contractor's tally.
    expect(familyOf('some_future_type' as never)).toBe('other');
  });
});

describe('an unknown type is bucketed honestly, not mislabelled', () => {
  it('files it under "other" rather than an existing family', () => {
    // Filing it under `customer` would report "1 customer update" for work
    // that was not one. Dropping it would shrink the tally. Neither is
    // acceptable for a number whose purpose is to be believed.
    const s = summariseLedger(
      [
        entry({ id: 'a', type: 'draft_invoice' }),
        entry({ id: 'b', type: 'from_a_newer_build' as never }),
      ],
      AUG,
    );
    expect(s.total).toBe(2);
    expect(s.byFamily).toContainEqual({ family: 'other', count: 1 });
    expect(s.byFamily).toContainEqual({ family: 'invoicing', count: 1 });
  });
});

describe('concurrent approvals do not lose each other', () => {
  // Each mutation is read-modify-write on one AsyncStorage key. Unserialised,
  // B reads before A's write lands and A vanishes — an undercount that is
  // indistinguishable from "Vasco did less", which is the one thing this
  // ledger must never get wrong.
  const { recordApproval, attachExecution, getLedger, __clearLedger } =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('../actionLedgerService');

  beforeEach(async () => { await __clearLedger(); });

  it('keeps every approval when six are fired without awaiting in turn', async () => {
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        recordApproval({ id: `c-${i}`, type: 'draft_invoice' }),
      ),
    );
    const entries = await getLedger();
    expect(entries).toHaveLength(6);
    expect(new Set(entries.map((e: LedgerEntry) => e.id)).size).toBe(6);
  });

  it('keeps executions attached to the right entries under interleaving', async () => {
    await Promise.all([
      recordApproval({ id: 'a', type: 'draft_invoice' }),
      recordApproval({ id: 'b', type: 'draft_reminder' }),
    ]);
    await Promise.all([
      attachExecution('a', { executed: true, via: 'navigate' }),
      attachExecution('b', { executed: false, via: 'inform' }),
    ]);
    const entries: LedgerEntry[] = await getLedger();
    expect(entries.find((e) => e.id === 'a')?.executed).toBe(true);
    expect(entries.find((e) => e.id === 'b')?.executed).toBe(false);
  });

  it('still does not double-count a re-approval of the same id', async () => {
    await Promise.all([
      recordApproval({ id: 'dup', type: 'draft_invoice' }),
      recordApproval({ id: 'dup', type: 'draft_invoice' }),
    ]);
    expect(await getLedger()).toHaveLength(1);
  });
});
