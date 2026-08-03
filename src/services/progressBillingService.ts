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

import type { Project, ProjectBillingTerm } from '../types/project';
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
  contractValue: number;
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
  project: Pick<Project, 'totalQuoted' | 'totalBudget' | 'retentionPercent' | 'billingTerms'> & { id: string },
  invoices: Invoice[],
): BillingProgress {
  const terms = project.billingTerms ?? [];
  const value = contractValue(project);
  const billed = terms
    .filter((t) => t.status === 'invoiced' || t.status === 'paid')
    .reduce((sum, t) => sum + termAmount(project, t), 0);

  return {
    contractValue: round2(value),
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
