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
  parseRetentionPercent,
  retentionForTerm,
  payableNow,
  retentionHeld,
  canReleaseRetention,
  nextTermToInvoice,
  billingProgress,
  markTermsReadyForCompletedMilestones,
  blockingErrorsForTerm,
  changeOrderTotal,
  projectValue,
  canInvoiceChangeOrder,
  validateChangeOrders,
} from '../progressBillingService';
import type { Project, ProjectBillingTerm, ProjectChangeOrder } from '../../types/project';
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
    changeOrders: [],
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

// ── Meerwerk / minderwerk ───────────────────────────────────────────────────
function order(over: Partial<ProjectChangeOrder> = {}): ProjectChangeOrder {
  return {
    id: 'co1',
    title: 'Extra stopcontacten',
    amount: 2000,
    status: 'approved',
    warnedAt: '2026-02-01T09:00:00.000Z',
    warnedVia: 'whatsapp',
    createdAt: '2026-02-01T09:00:00.000Z',
    sortOrder: 1,
    ...over,
  };
}

describe('change orders and project value', () => {
  it('adds approved meerwerk to the project value, leaving the contract alone', () => {
    const p = project({ changeOrders: [order({ amount: 20000 })] });
    expect(contractValue(p)).toBe(80000);
    expect(projectValue(p)).toBe(100000);
  });

  it('subtracts minderwerk', () => {
    const p = project({ changeOrders: [order({ amount: -5000, warnedAt: undefined })] });
    expect(projectValue(p)).toBe(75000);
  });

  it('ignores orders the customer has not agreed to', () => {
    const p = project({
      changeOrders: [
        order({ id: 'a', amount: 5000, status: 'proposed' }),
        order({ id: 'b', amount: 3000, status: 'rejected' }),
        order({ id: 'c', amount: 1000, status: 'draft' }),
      ],
    });
    expect(changeOrderTotal(p)).toBe(0);
    expect(projectValue(p)).toBe(80000);
  });
});

// This is the property that makes the two features safe together.
describe('approved meerwerk does NOT re-base the billing terms', () => {
  const withChange = project({
    billingTerms: [
      term({ id: 'a', percent: 30, sortOrder: 1, status: 'invoiced' }),
      term({ id: 'b', percent: 70, sortOrder: 2, status: 'pending' }),
    ],
    changeOrders: [order({ amount: 20000 })],
  });

  it('keeps each term anchored to the original contract', () => {
    // Re-basing would make term b 70% of 100k = 70,000, and with term a
    // already billed at 24,000 the project would invoice 94,000 of a 100,000
    // job -- 6,000 lost, silently.
    expect(termAmount(withChange, withChange.billingTerms[0])).toBe(24000);
    expect(termAmount(withChange, withChange.billingTerms[1])).toBe(56000);
  });

  it('so terms plus changes bill the project exactly', () => {
    const terms = withChange.billingTerms.reduce((s, t) => s + termAmount(withChange, t), 0);
    expect(terms + changeOrderTotal(withChange)).toBe(projectValue(withChange));
  });

  it('reports the contract and the changes separately', () => {
    const prog = billingProgress(withChange, []);
    expect(prog.contractValue).toBe(80000);
    expect(prog.projectValue).toBe(100000);
    expect(prog.changeOrders).toBe(20000);
    expect(prog.changeOrdersUnbilled).toBe(20000);
  });
});

// art. 7:755 BW — the contractor may charge for meerwerk only if they warned
// the client in time that it carried a price increase.
describe('billing a change order', () => {
  it('refuses meerwerk with no record of the price warning', () => {
    const gate = canInvoiceChangeOrder(order({ warnedAt: undefined }));
    expect(gate.allowed).toBe(false);
    // The caller needs to know it is the warning that is missing, so it can
    // offer to send one rather than fail opaquely.
    expect(gate.needsWarning).toBe(true);
  });

  it('allows meerwerk that was warned about', () => {
    expect(canInvoiceChangeOrder(order()).allowed).toBe(true);
  });

  it('does not require a warning for minderwerk', () => {
    // A reduction is in the customer's favour.
    expect(canInvoiceChangeOrder(order({ amount: -1500, warnedAt: undefined })).allowed).toBe(true);
  });

  it('refuses anything the customer has not approved', () => {
    expect(canInvoiceChangeOrder(order({ status: 'proposed' })).allowed).toBe(false);
    expect(canInvoiceChangeOrder(order({ status: 'rejected' })).allowed).toBe(false);
    expect(canInvoiceChangeOrder(order({ status: 'draft' })).allowed).toBe(false);
  });

  it('refuses to bill the same order twice', () => {
    expect(canInvoiceChangeOrder(order({ status: 'invoiced' })).allowed).toBe(false);
  });

  it('refuses an order with no amount', () => {
    expect(canInvoiceChangeOrder(order({ amount: 0 })).allowed).toBe(false);
  });
});

describe('change order validation', () => {
  it('flags an approved order with no warning while the work is still fresh', () => {
    const p = project({ changeOrders: [order({ warnedAt: undefined })] });
    expect(validateChangeOrders(p).map((e) => e.code)).toContain('approved_without_warning');
  });

  it('flags reductions that exceed the contract', () => {
    const p = project({ changeOrders: [order({ amount: -90000, warnedAt: undefined })] });
    expect(validateChangeOrders(p).map((e) => e.code)).toContain('reduces_below_zero');
  });

  it('accepts a normal approved order', () => {
    expect(validateChangeOrders(project({ changeOrders: [order()] }))).toEqual([]);
  });
});

describe('the release invoice settles the balance', () => {
  // The release invoice raised by addRetentionReleaseInvoice has
  // amount = everything held and withholds nothing itself. Pinning the round
  // trip stops a future change from letting a project be released twice.
  const held = (invs: Partial<Invoice>[]) =>
    retentionHeld(
      'p1',
      invs.map((o, i) => ({
        id: `inv-${i}`, customer: 'c1', job: '', amount: 24000, status: 'sent',
        dueInDays: 30, projectId: 'p1', retentionAmount: 1200, ...o,
      })) as Invoice[],
    );

  it('drops the balance to zero once released', () => {
    const before = held([{}, {}, {}]);
    expect(before).toBe(3600);
    const after = held([
      {}, {}, {},
      { amount: before, retentionAmount: 0, isRetentionRelease: true },
    ]);
    expect(after).toBe(0);
  });

  it('so a second release is refused', () => {
    const p = project({
      status: 'completed',
      billingTerms: [term({ id: 'a', percent: 100, sortOrder: 1, status: 'paid' })],
    });
    expect(canReleaseRetention(p, 0).allowed).toBe(false);
  });

  it('never reports a negative balance if a release overshoots', () => {
    // A hand-edited release should not make the project look owed-to.
    expect(held([{}, { amount: 9999, retentionAmount: 0, isRetentionRelease: true }])).toBe(0);
  });
});

describe('which errors block which term', () => {
  // Refusing to bill instalment A because instalment C has a dangling
  // milestone trigger strands the contractor on an unrelated row.
  const errs = [
    { code: 'unknown_milestone' as const, message: 'C has a dead trigger', termId: 'c' },
    { code: 'empty_term' as const, message: 'C bills nothing', termId: 'c' },
  ];

  it('lets an unaffected term bill through another term\'s problem', () => {
    expect(blockingErrorsForTerm(errs, 'a')).toEqual([]);
  });

  it('still blocks the term that has the problem', () => {
    expect(blockingErrorsForTerm(errs, 'c')).toHaveLength(2);
  });

  it('blocks every term on a contract-level error', () => {
    const overBilled = [{ code: 'percent_over_100' as const, message: 'over' }];
    expect(blockingErrorsForTerm(overBilled, 'a')).toHaveLength(1);
    expect(blockingErrorsForTerm(overBilled, 'z')).toHaveLength(1);
  });

  it('treats duplicate ordering as contract-level, since "next" has no answer', () => {
    const dupe = [{ code: 'duplicate_sort_order' as const, message: 'dupe', termId: 'b' }];
    expect(blockingErrorsForTerm(dupe, 'a')).toHaveLength(1);
  });
});

describe('parseRetentionPercent', () => {
  // Retention was hardcoded 0 at project creation and written nowhere else, so
  // `retentionForTerm`'s `pct <= 0` early return fired for every project that
  // has ever existed and the retentie surface could never render. The parse is
  // now the ONLY thing between a typed number and that dead branch, and every
  // one of its failure modes is silent.
  it('reads a decimal comma, which five of the six locales type', () => {
    // Number('7,5') is NaN — that would have turned a real 7.5% into "no
    // retention" for every contractor outside the UK, with no error.
    expect(parseRetentionPercent('7,5')).toBe(7.5);
    expect(parseRetentionPercent('7.5')).toBe(7.5);
  });

  it('treats blank, junk and negatives as no retention rather than throwing', () => {
    for (const raw of ['', '   ', 'abc', '-5', 'NaN']) {
      expect(parseRetentionPercent(raw)).toBe(0);
    }
  });

  it('clamps above 100 instead of deferring to a later billing error', () => {
    expect(parseRetentionPercent('150')).toBe(100);
    expect(parseRetentionPercent('100')).toBe(100);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseRetentionPercent(' 5 ')).toBe(5);
  });

  it('produces a value validateBillingSchedule always accepts', () => {
    // The parse and the validator must not disagree: anything the form can
    // produce has to survive the schedule check, or a project becomes
    // un-billable because of what was typed into a create field.
    for (const raw of ['', '5', '7,5', '150', '-3', 'abc', '99.999']) {
      const errors = validateBillingSchedule(
        project({ retentionPercent: parseRetentionPercent(raw) }),
      );
      expect(errors.filter(e => e.code === 'retention_out_of_range')).toEqual([]);
    }
  });

  it('actually escapes the dead branch it exists to escape', () => {
    // The whole point: a parsed percentage must make retentionForTerm return a
    // real number instead of its `pct <= 0` early return.
    const p = project({ totalQuoted: 10000, retentionPercent: parseRetentionPercent('5') });
    const t = term({ percent: 100 });
    expect(retentionForTerm(p, t)).toBe(500);
    expect(payableNow(p, t)).toBe(9500);
  });
});
