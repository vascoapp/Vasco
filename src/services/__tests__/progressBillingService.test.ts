// =============================================================================
// PROGRESS BILLING — termijnfacturen + retentie
// =============================================================================
// The arithmetic here decides what a customer owes and what a contractor is
// still holding, so the properties worth pinning are the ones that cost money
// when wrong: the VAT base, over-billing the contract, and releasing retention
// early.
// =============================================================================

import {
  contractValue,
  termAmount,
  validateBillingSchedule,
  retentionForTerm,
  payableNow,
  retentionHeld,
  canReleaseRetention,
  nextTermToInvoice,
  billingProgress,
  markTermsReadyForCompletedMilestones,
} from '../progressBillingService';
import type { Project, ProjectBillingTerm } from '../../types/project';
import type { Invoice } from '../../domain/documents';

function term(over: Partial<ProjectBillingTerm> = {}): ProjectBillingTerm {
  return {
    id: 't1',
    title: 'Start',
    basis: 'percent',
    percent: 30,
    status: 'pending',
    sortOrder: 1,
    ...over,
  };
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    title: 'Renovatie',
    customerId: 'c1',
    status: 'active',
    totalBudget: 60000,
    totalQuoted: 80000,
    totalInvoiced: 0,
    totalPaid: 0,
    milestones: [],
    billingTerms: [],
    retentionPercent: 5,
    jobIds: [],
    quoteIds: [],
    invoiceIds: [],
    subcontractorIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('contract value', () => {
  it('bills against the quoted value, not the internal budget', () => {
    // Budget is the contractor's cost planning. Billing a customer against it
    // would bill them for the contractor's costs, not the agreed price.
    expect(contractValue(project({ totalQuoted: 80000, totalBudget: 60000 }))).toBe(80000);
  });

  it('falls back to budget only when nothing has been quoted', () => {
    expect(contractValue(project({ totalQuoted: 0, totalBudget: 60000 }))).toBe(60000);
  });
});

describe('term amounts', () => {
  it('resolves a percentage of the contract', () => {
    expect(termAmount(project(), term({ percent: 30 }))).toBe(24000);
  });

  it('resolves a fixed amount as-is', () => {
    expect(termAmount(project(), term({ basis: 'fixed', amount: 12500 }))).toBe(12500);
  });
});

// ── The rule that matters ───────────────────────────────────────────────────
describe('retentie is withheld from payment, not deducted from the invoice', () => {
  const p = project({ retentionPercent: 5 });
  const t = term({ percent: 30 }); // 24,000 of an 80,000 contract

  it('leaves the invoice face value whole, so VAT is charged on the full amount', () => {
    // If retention were deducted from the total, VAT would be charged on
    // 22,800 instead of 24,000 -- under-reporting it, and producing an
    // e-invoice whose total disagrees with the contract.
    expect(termAmount(p, t)).toBe(24000);
  });

  it('records what is withheld separately', () => {
    expect(retentionForTerm(p, t)).toBe(1200);
  });

  it('derives what the customer pays now from the two', () => {
    expect(payableNow(p, t)).toBe(22800);
    expect(payableNow(p, t)).toBe(termAmount(p, t) - retentionForTerm(p, t));
  });

  it('withholds nothing when the contract has no retention', () => {
    const noRet = project({ retentionPercent: 0 });
    expect(retentionForTerm(noRet, t)).toBe(0);
    expect(payableNow(noRet, t)).toBe(termAmount(noRet, t));
  });
});

describe('schedule validation', () => {
  it('accepts a normal 30/30/30/10 schedule', () => {
    const p = project({
      billingTerms: [
        term({ id: 'a', percent: 30, sortOrder: 1 }),
        term({ id: 'b', percent: 30, sortOrder: 2 }),
        term({ id: 'c', percent: 30, sortOrder: 3 }),
        term({ id: 'd', percent: 10, sortOrder: 4 }),
      ],
    });
    expect(validateBillingSchedule(p)).toEqual([]);
  });

  it('rejects terms that bill more than the whole contract', () => {
    const p = project({
      billingTerms: [
        term({ id: 'a', percent: 60, sortOrder: 1 }),
        term({ id: 'b', percent: 60, sortOrder: 2 }),
      ],
    });
    expect(validateBillingSchedule(p).map((e) => e.code)).toContain('percent_over_100');
  });

  it('tolerates a three-way split that rounds to 99.99%', () => {
    const p = project({
      billingTerms: [
        term({ id: 'a', percent: 33.33, sortOrder: 1 }),
        term({ id: 'b', percent: 33.33, sortOrder: 2 }),
        term({ id: 'c', percent: 33.33, sortOrder: 3 }),
      ],
    });
    expect(validateBillingSchedule(p)).toEqual([]);
  });

  it('rejects fixed terms exceeding the contract value', () => {
    const p = project({
      billingTerms: [term({ id: 'a', basis: 'fixed', amount: 90000, sortOrder: 1 })],
    });
    expect(validateBillingSchedule(p).map((e) => e.code)).toContain('fixed_over_contract');
  });

  it('rejects an out-of-range retention rate', () => {
    expect(validateBillingSchedule(project({ retentionPercent: 150 })).map((e) => e.code))
      .toContain('retention_out_of_range');
  });

  it('rejects two terms sharing a position, which would leave billing order undefined', () => {
    const p = project({
      billingTerms: [
        term({ id: 'a', percent: 50, sortOrder: 1 }),
        term({ id: 'b', percent: 50, sortOrder: 1 }),
      ],
    });
    expect(validateBillingSchedule(p).map((e) => e.code)).toContain('duplicate_sort_order');
  });

  it('rejects a term triggered by a milestone that no longer exists', () => {
    // Otherwise it can never become ready and sits unbilled forever with
    // nothing surfacing why.
    const p = project({
      milestones: [{ id: 'm1', title: 'Rough-in', weekNumber: 3, completed: false, jobIds: [] }],
      billingTerms: [term({ id: 'a', percent: 30, sortOrder: 1, milestoneId: 'm-gone' })],
    });
    expect(validateBillingSchedule(p).map((e) => e.code)).toContain('unknown_milestone');
  });

  it('flags a term that bills nothing', () => {
    const p = project({ billingTerms: [term({ id: 'a', percent: 0, sortOrder: 1 })] });
    expect(validateBillingSchedule(p).map((e) => e.code)).toContain('empty_term');
  });
});

describe('retention held', () => {
  const invoices = (over: Partial<Invoice>[] = []): Invoice[] =>
    over.map((o, i) => ({
      id: `inv-${i}`,
      customer: 'c1',
      job: '',
      amount: 24000,
      status: 'sent',
      dueInDays: 30,
      projectId: 'p1',
      retentionAmount: 1200,
      ...o,
    })) as Invoice[];

  it('sums what was actually withheld on each invoice', () => {
    expect(retentionHeld('p1', invoices([{}, {}, {}]))).toBe(3600);
  });

  it('reads the recorded figure rather than re-deriving it', () => {
    // A term may have been invoiced before the retention rate changed, or the
    // invoice adjusted by hand. What was withheld is a historical fact.
    expect(retentionHeld('p1', invoices([{ retentionAmount: 500 }]))).toBe(500);
  });

  it('ignores invoices from other projects', () => {
    expect(retentionHeld('p1', invoices([{ projectId: 'other' }]))).toBe(0);
  });

  it('nets off a release', () => {
    const list = [
      ...invoices([{}, {}]), // 2400 withheld
      ...invoices([{ amount: 2400, retentionAmount: 0, isRetentionRelease: true }]),
    ];
    expect(retentionHeld('p1', list)).toBe(0);
  });
});

describe('releasing retention', () => {
  const billed = [
    term({ id: 'a', percent: 50, sortOrder: 1, status: 'invoiced' }),
    term({ id: 'b', percent: 50, sortOrder: 2, status: 'paid' }),
  ];

  it('refuses before oplevering', () => {
    const r = canReleaseRetention(project({ status: 'active', billingTerms: billed }), 4000);
    expect(r.allowed).toBe(false);
  });

  it('refuses while a term is still unbilled, even on a completed project', () => {
    // A project can be marked complete with an instalment outstanding.
    // Releasing then gives up the contractor's leverage for nothing.
    const p = project({
      status: 'completed',
      billingTerms: [...billed, term({ id: 'c', percent: 0.1, sortOrder: 3, status: 'pending' })],
    });
    expect(canReleaseRetention(p, 4000).allowed).toBe(false);
  });

  it('refuses when nothing is held', () => {
    expect(canReleaseRetention(project({ status: 'completed', billingTerms: billed }), 0).allowed).toBe(false);
  });

  it('allows once complete and fully billed', () => {
    expect(canReleaseRetention(project({ status: 'completed', billingTerms: billed }), 4000).allowed).toBe(true);
  });
});

describe('progress', () => {
  it('picks the next term in schedule order, not array order', () => {
    const p = project({
      billingTerms: [
        term({ id: 'c', sortOrder: 3 }),
        term({ id: 'a', sortOrder: 1 }),
        term({ id: 'b', sortOrder: 2 }),
      ],
    });
    expect(nextTermToInvoice(p)?.id).toBe('a');
  });

  it('skips terms already invoiced', () => {
    const p = project({
      billingTerms: [
        term({ id: 'a', sortOrder: 1, status: 'paid' }),
        term({ id: 'b', sortOrder: 2, status: 'pending' }),
      ],
    });
    expect(nextTermToInvoice(p)?.id).toBe('b');
  });

  it('reconciles billed against the contract', () => {
    const p = project({
      billingTerms: [
        term({ id: 'a', percent: 30, sortOrder: 1, status: 'invoiced' }),
        term({ id: 'b', percent: 70, sortOrder: 2, status: 'pending' }),
      ],
    });
    const prog = billingProgress(p, []);
    expect(prog.contractValue).toBe(80000);
    expect(prog.invoiced).toBe(24000);
    expect(prog.remaining).toBe(56000);
    expect(prog.percentInvoiced).toBe(30);
    expect(prog.termsInvoiced).toBe(1);
  });
});

describe('milestone triggers', () => {
  it('makes a term ready when its milestone completes', () => {
    const p = project({
      milestones: [{ id: 'm1', title: 'Rough-in', weekNumber: 3, completed: true, jobIds: [] }],
      billingTerms: [term({ id: 'a', sortOrder: 1, milestoneId: 'm1', status: 'pending' })],
    });
    expect(markTermsReadyForCompletedMilestones(p)[0].status).toBe('ready');
  });

  it('leaves an already-invoiced term alone', () => {
    const p = project({
      milestones: [{ id: 'm1', title: 'Rough-in', weekNumber: 3, completed: true, jobIds: [] }],
      billingTerms: [term({ id: 'a', sortOrder: 1, milestoneId: 'm1', status: 'invoiced' })],
    });
    expect(markTermsReadyForCompletedMilestones(p)[0].status).toBe('invoiced');
  });

  it('does not touch terms with no milestone trigger', () => {
    const p = project({ billingTerms: [term({ id: 'a', sortOrder: 1, status: 'pending' })] });
    expect(markTermsReadyForCompletedMilestones(p)[0].status).toBe('pending');
  });
});
