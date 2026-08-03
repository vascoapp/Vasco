// =============================================================================
// PROGRESS BILLING (termijnfacturen) + RETENTIE
// =============================================================================
// An aannemer bills a project in instalments -- 30% at start, 30% at rough-in,
// 30% at finish, 10% at oplevering -- and the customer withholds retentie
// (commonly 5%) until the waarborgtermijn expires.
//
// Pure and synchronous: no AppState, no network, no Supabase. Everything here
// is a function of (project, invoices), so the arithmetic that decides what a
// customer owes is testable without a database.
//
// THE RULE THAT MATTERS: retentie is withheld from PAYMENT, not deducted from
// the invoice. The invoice is issued for the full term amount and VAT is
// charged on the full amount; the customer simply pays less now. So
// `amount` stays whole, `retentionAmount` records what is held back, and
// "payable now" is derived from the two. Storing a reduced total instead would
// under-report VAT and produce an e-invoice total that disagrees with the
// contract.
// =============================================================================

import type { Project, ProjectBillingTerm, ProjectChangeOrder } from '../types/project';
import type { Invoice } from '../domain/documents';

/** Currency rounding. Money is compared and summed in cents to avoid the
 *  0.1 + 0.2 problem accumulating across a ten-term schedule. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Contract value
// ---------------------------------------------------------------------------

/**
 * What the percentages are a percentage OF.
 *
 * Quoted value first: that is what the customer agreed to. Budget is the
 * contractor's own cost planning and is the wrong base to bill against, so it
 * is only a fallback for projects created before a quote exists.
 */
export function contractValue(project: Pick<Project, 'totalQuoted' | 'totalBudget'>): number {
  const quoted = Number(project.totalQuoted ?? 0);
  if (quoted > 0) return quoted;
  return Number(project.totalBudget ?? 0);
}

/** Resolve a term to euros, whichever basis it uses. */
export function termAmount(
  project: Pick<Project, 'totalQuoted' | 'totalBudget'>,
  term: ProjectBillingTerm,
): number {
  if (term.basis === 'fixed') return round2(Number(term.amount ?? 0));
  const pct = Number(term.percent ?? 0);
  return round2((contractValue(project) * pct) / 100);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface BillingScheduleError {
  code:
    | 'percent_over_100'
    | 'fixed_over_contract'
    | 'retention_out_of_range'
    | 'duplicate_sort_order'
    | 'unknown_milestone'
    | 'empty_term'
    | 'negative_amount';
  message: string;
  termId?: string;
}

/**
 * Guard rails on a schedule before it can be used.
 *
 * The failure that costs real money is over-billing the contract -- terms
 * summing past 100% -- so that is checked on both bases.
 */
export function validateBillingSchedule(
  project: Pick<Project, 'totalQuoted' | 'totalBudget' | 'billingTerms' | 'retentionPercent' | 'milestones'>,
): BillingScheduleError[] {
  const errors: BillingScheduleError[] = [];
  const terms = project.billingTerms ?? [];

  const retention = Number(project.retentionPercent ?? 0);
  if (retention < 0 || retention > 100) {
    errors.push({
      code: 'retention_out_of_range',
      message: `Retention must be between 0 and 100, got ${retention}`,
    });
  }

  let percentTotal = 0;
  let fixedTotal = 0;
  const seenOrder = new Set<number>();
  const milestoneIds = new Set((project.milestones ?? []).map((m) => m.id));

  for (const term of terms) {
    if (term.basis === 'percent') {
      const pct = Number(term.percent ?? 0);
      if (pct < 0) {
        errors.push({ code: 'negative_amount', message: `Term "${term.title}" has a negative percent`, termId: term.id });
      }
      if (pct === 0) {
        errors.push({ code: 'empty_term', message: `Term "${term.title}" bills nothing`, termId: term.id });
      }
      percentTotal += pct;
    } else {
      const amt = Number(term.amount ?? 0);
      if (amt < 0) {
        errors.push({ code: 'negative_amount', message: `Term "${term.title}" has a negative amount`, termId: term.id });
      }
      if (amt === 0) {
        errors.push({ code: 'empty_term', message: `Term "${term.title}" bills nothing`, termId: term.id });
      }
      fixedTotal += amt;
    }

    if (seenOrder.has(term.sortOrder)) {
      errors.push({
        code: 'duplicate_sort_order',
        message: `Two terms share position ${term.sortOrder}; the billing order would be undefined`,
        termId: term.id,
      });
    }
    seenOrder.add(term.sortOrder);

    // A term whose trigger no longer exists can never become `ready`, so it
    // would sit unbilled forever without anything surfacing why.
    if (term.milestoneId && !milestoneIds.has(term.milestoneId)) {
      errors.push({
        code: 'unknown_milestone',
        message: `Term "${term.title}" is triggered by a milestone that no longer exists`,
        termId: term.id,
      });
    }
  }

  // Tolerance of a cent: a 3-way split of 100% is 33.33 x 3 = 99.99, and
  // rejecting that would be pedantic. Anything past a cent is a real mistake.
  if (percentTotal > 100.01) {
    errors.push({
      code: 'percent_over_100',
      message: `Terms bill ${round2(percentTotal)}% of the contract, more than the whole of it`,
    });
  }

  const value = contractValue(project);
  if (value > 0 && fixedTotal > value + 0.01) {
    errors.push({
      code: 'fixed_over_contract',
      message: `Fixed terms total ${round2(fixedTotal)}, more than the contract value ${round2(value)}`,
    });
  }

  return errors;
}

/**
 * Errors that must stop a specific term from being billed.
 *
 * Not every schedule error is a reason to refuse every term. A term whose
 * trigger milestone was deleted is a problem with THAT term; blocking an
 * unrelated instalment because of it strands the contractor. What genuinely
 * has to block is anything that would over-bill the contract (a contract-level
 * fact, so it blocks everything) or a defect on the term being billed.
 */
export function blockingErrorsForTerm(
  errors: BillingScheduleError[],
  termId: string,
): BillingScheduleError[] {
  const CONTRACT_LEVEL: ReadonlyArray<BillingScheduleError['code']> = [
    'percent_over_100',
    'fixed_over_contract',
    'retention_out_of_range',
    // Ordering is global: with duplicate positions, "which term is next" has
    // no answer, so no term should be billed until it is resolved.
    'duplicate_sort_order',
  ];
  return errors.filter(
    (e) => CONTRACT_LEVEL.includes(e.code) || e.termId === termId,
  );
}

// ---------------------------------------------------------------------------
// Retentie
// ---------------------------------------------------------------------------

/** Retentie withheld from one instalment. */
export function retentionForTerm(
  project: Pick<Project, 'totalQuoted' | 'totalBudget' | 'retentionPercent'>,
  term: ProjectBillingTerm,
): number {
  const pct = Number(project.retentionPercent ?? 0);
  if (pct <= 0) return 0;
  return round2((termAmount(project, term) * pct) / 100);
}

/**
 * What the customer pays on this instalment now.
 *
 * Derived, never stored. The invoice keeps its full face value for VAT.
 */
export function payableNow(
  project: Pick<Project, 'totalQuoted' | 'totalBudget' | 'retentionPercent'>,
  term: ProjectBillingTerm,
): number {
  return round2(termAmount(project, term) - retentionForTerm(project, term));
}

/**
 * Total retentie held across a project.
 *
 * Read from the invoices actually raised, NOT re-derived from the current
 * percentages: a term may have been invoiced before the retention rate
 * changed, or an invoice adjusted by hand. What was withheld is a historical
 * fact recorded on the document, and re-deriving it would quietly rewrite it.
 */
export function retentionHeld(projectId: string, invoices: Invoice[]): number {
  let held = 0;
  for (const inv of invoices) {
    if (inv.projectId !== projectId) continue;
    if (inv.isRetentionRelease) {
      // A release hands back what was withheld.
      held -= Number(inv.amount ?? 0);
      continue;
    }
    held += Number(inv.retentionAmount ?? 0);
  }
  return round2(Math.max(0, held));
}

/**
 * Whether the withheld money can be released.
 *
 * Releasing early is the expensive failure: the contractor gives up their only
 * leverage before the work is signed off. So this requires BOTH that the
 * project is finished and that nothing is left unbilled -- a project can be
 * marked complete while a term is still outstanding.
 */
export function canReleaseRetention(
  project: Pick<Project, 'status' | 'billingTerms'>,
  heldAmount: number,
): { allowed: boolean; reason?: string } {
  if (heldAmount <= 0) {
    return { allowed: false, reason: 'Nothing is being withheld on this project' };
  }
  if (project.status !== 'completed') {
    return { allowed: false, reason: 'Retention is released at oplevering; this project is not complete' };
  }
  const unbilled = (project.billingTerms ?? []).filter(
    (t) => t.status !== 'invoiced' && t.status !== 'paid',
  );
  if (unbilled.length > 0) {
    return {
      allowed: false,
      reason: `${unbilled.length} term(s) are still unbilled; invoice those before releasing retention`,
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Meerwerk / minderwerk (change orders)
// ---------------------------------------------------------------------------
// Change orders are billed on their OWN invoice and deliberately do not
// re-base the percentage terms. Re-spreading them across the remaining terms
// under-bills the project: bill 30% of 80k, approve 20k of meerwerk, then bill
// the remaining 70% of the new 100k, and you have invoiced 94k of a 100k job.
// Keeping the schedule anchored to the original contract makes total billed
// exactly contract + changes.
// ---------------------------------------------------------------------------

/** Sum of change orders in the given states. Signed: minderwerk subtracts. */
export function changeOrderTotal(
  project: Pick<Project, 'changeOrders'>,
  statuses: ReadonlyArray<ProjectChangeOrder['status']> = ['approved', 'invoiced'],
): number {
  return round2(
    (project.changeOrders ?? [])
      .filter((c) => statuses.includes(c.status))
      .reduce((sum, c) => sum + Number(c.amount ?? 0), 0),
  );
}

/**
 * What the project is worth now: the contract plus agreed changes.
 *
 * Distinct from `contractValue`, which stays anchored to the original quote
 * because the percentage terms are computed against it.
 */
export function projectValue(
  project: Pick<Project, 'totalQuoted' | 'totalBudget' | 'changeOrders'>,
): number {
  return round2(contractValue(project) + changeOrderTotal(project));
}

export interface ChangeOrderGate {
  allowed: boolean;
  reason?: string;
  /** Set when the block is the art. 7:755 warning, so the UI can offer to send it. */
  needsWarning?: boolean;
}

/**
 * Whether a change order can be billed.
 *
 * The warning check is the one that matters. Art. 7:755 BW gives the
 * contractor a right to the price increase only if they warned the client in
 * time that the change required one. Invoicing meerwerk that was never
 * notified is how a contractor ends up unable to collect it — so this refuses,
 * and tells the caller it is the warning that is missing rather than failing
 * opaquely.
 *
 * Minderwerk is exempt: a reduction is in the customer's favour and needs no
 * warning.
 */
export function canInvoiceChangeOrder(order: ProjectChangeOrder): ChangeOrderGate {
  if (order.status === 'invoiced') {
    return { allowed: false, reason: `"${order.title}" has already been billed` };
  }
  if (order.status === 'rejected') {
    return { allowed: false, reason: `"${order.title}" was declined by the customer` };
  }
  if (order.status !== 'approved') {
    return { allowed: false, reason: `"${order.title}" has not been approved by the customer yet` };
  }
  if (Number(order.amount ?? 0) === 0) {
    return { allowed: false, reason: `"${order.title}" has no amount` };
  }
  if (Number(order.amount) > 0 && !order.warnedAt) {
    return {
      allowed: false,
      needsWarning: true,
      reason:
        `"${order.title}" has no record of the customer being warned that this ` +
        `carried a price increase (art. 7:755 BW). Record the warning before billing it.`,
    };
  }
  return { allowed: true };
}

export interface ChangeOrderError {
  code: 'no_amount' | 'approved_without_warning' | 'duplicate_sort_order' | 'reduces_below_zero';
  message: string;
  changeOrderId?: string;
}

export function validateChangeOrders(
  project: Pick<Project, 'totalQuoted' | 'totalBudget' | 'changeOrders'>,
): ChangeOrderError[] {
  const errors: ChangeOrderError[] = [];
  const orders = project.changeOrders ?? [];
  const seen = new Set<number>();

  for (const order of orders) {
    if (Number(order.amount ?? 0) === 0) {
      errors.push({ code: 'no_amount', message: `"${order.title}" has no amount`, changeOrderId: order.id });
    }
    // Surfaced as a warning-level problem at approval time rather than only at
    // billing time, so the contractor can still send the notice while the work
    // is fresh rather than discovering it when they try to invoice.
    if (order.status === 'approved' && Number(order.amount ?? 0) > 0 && !order.warnedAt) {
      errors.push({
        code: 'approved_without_warning',
        message: `"${order.title}" is approved but has no record of the price warning (art. 7:755 BW)`,
        changeOrderId: order.id,
      });
    }
    if (seen.has(order.sortOrder)) {
      errors.push({
        code: 'duplicate_sort_order',
        message: `Two change orders share position ${order.sortOrder}`,
        changeOrderId: order.id,
      });
    }
    seen.add(order.sortOrder);
  }

  // Minderwerk that wipes out more than the contract is a data-entry error, not
  // a negotiation outcome.
  if (projectValue(project) < 0) {
    errors.push({
      code: 'reduces_below_zero',
      message: 'Reductions exceed the contract value, leaving the project worth less than nothing',
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/** The next term to raise an invoice for, in schedule order. */
export function nextTermToInvoice(
  project: Pick<Project, 'billingTerms'>,
): ProjectBillingTerm | null {
  const pending = (project.billingTerms ?? [])
    .filter((t) => t.status === 'ready' || t.status === 'pending')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return pending[0] ?? null;
}

export interface BillingProgress {
  /** The original contract. Percentage terms are computed against this. */
  contractValue: number;
  /** Contract + approved changes: what the project is worth now. */
  projectValue: number;
  /** Approved meerwerk/minderwerk, signed. */
  changeOrders: number;
  /** Approved changes not yet billed. */
  changeOrdersUnbilled: number;
  /** Face value of every term already invoiced. */
  invoiced: number;
  /** Contract value not yet covered by a term invoice. */
  remaining: number;
  /** Percent of the contract invoiced so far, 0-100. */
  percentInvoiced: number;
  retentionHeld: number;
  termsTotal: number;
  termsInvoiced: number;
}

/**
 * Where a project stands. `invoiced` is the sum of term face values so the
 * figure reconciles against the contract; retention is reported separately
 * because it is a payment timing matter, not a billing one.
 */
export function billingProgress(
  project: Pick<Project, 'totalQuoted' | 'totalBudget' | 'retentionPercent' | 'billingTerms' | 'changeOrders'> & { id: string },
  invoices: Invoice[],
): BillingProgress {
  const terms = project.billingTerms ?? [];
  const value = contractValue(project);
  const billed = terms
    .filter((t) => t.status === 'invoiced' || t.status === 'paid')
    .reduce((sum, t) => sum + termAmount(project, t), 0);

  const unbilled = (project.changeOrders ?? [])
    .filter((c) => c.status === 'approved')
    .reduce((sum, c) => sum + Number(c.amount ?? 0), 0);

  return {
    contractValue: round2(value),
    projectValue: projectValue(project),
    changeOrders: changeOrderTotal(project),
    changeOrdersUnbilled: round2(unbilled),
    invoiced: round2(billed),
    remaining: round2(Math.max(0, value - billed)),
    percentInvoiced: value > 0 ? round2((billed / value) * 100) : 0,
    retentionHeld: retentionHeld(project.id, invoices),
    termsTotal: terms.length,
    termsInvoiced: terms.filter((t) => t.status === 'invoiced' || t.status === 'paid').length,
  };
}

/**
 * Mark the terms whose milestone has completed as `ready`.
 *
 * Returns a NEW array; callers persist it through the normal project mutator so
 * the change goes through the same write mapper as any other edit.
 */
export function markTermsReadyForCompletedMilestones(
  project: Pick<Project, 'billingTerms' | 'milestones'>,
): ProjectBillingTerm[] {
  const completed = new Set(
    (project.milestones ?? []).filter((m) => m.completed).map((m) => m.id),
  );
  return (project.billingTerms ?? []).map((term) =>
    term.status === 'pending' && term.milestoneId && completed.has(term.milestoneId)
      ? { ...term, status: 'ready' as const }
      : term,
  );
}
