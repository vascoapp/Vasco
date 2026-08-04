// =============================================================================
// MAINTENANCE OPPORTUNITIES — find the recurring work already in the history
// =============================================================================
// ServiceTitan and Jobber both sell "memberships": the contractor designs a
// plan, then goes and puts customers on it. The design work and the recruiting
// are both manual, which is why most contractors never do either.
//
// Vasco already holds every job that contractor has completed. So the useful
// question is not "what plan would you like to sell?" but "which of your
// customers are ALREADY on a maintenance rhythm, and what do you actually
// charge them?" That is a fact about their history, not a product decision, and
// it is the part a contractor cannot easily see for themselves.
//
// This complements the existing Maintenance workflow pack rather than repeating
// it. That pack fires a reminder a fixed 335 days after ANY completed job —
// which is right for a boiler service and wrong for a one-off interior repaint,
// because it cannot tell them apart. This can: a rhythm is something you observe
// across several visits, not something you assume from one.
//
// -----------------------------------------------------------------------------
// WHAT THIS WILL NOT DO
// -----------------------------------------------------------------------------
// Every number it reports is observed. There is no "typical annual contract is
// worth €X" table anywhere in here, because we do not have one and inventing it
// is how a screen ends up quoting a made-up market rate back at the person who
// set the prices (learnings #103). Where a figure cannot be derived from this
// contractor's own jobs it is null, and the caller shows nothing.
// =============================================================================

const MS_PER_DAY = 86_400_000;

/**
 * Minimum completed visits before we will claim a rhythm exists.
 *
 * Three, not two. Two visits give exactly ONE interval, and a single gap is not
 * a pattern — a customer who happened to call twice fourteen months apart is
 * indistinguishable from an annual service until the third visit lands.
 */
export const MIN_VISITS_FOR_RHYTHM = 3;

/** Beyond this the gaps are too irregular to call a schedule. */
const LOOSE_SPREAD_RATIO = 0.4;

/** Ignore gaps below this — two visits in the same week are one job, split. */
const MIN_INTERVAL_DAYS = 14;

export interface MaintenanceVisit {
  /** When the work was actually done. */
  completedAt: string;
  /** What the customer was charged, when known. */
  amount?: number;
  trade?: string;
}

export type IntervalConfidence = 'firm' | 'loose';

export interface MaintenanceOpportunity {
  customerId: string;
  customerName: string;
  /** How many completed visits the rhythm was read from. */
  visits: number;
  /** The observed rhythm, in days — the median gap between visits. */
  intervalDays: number;
  /**
   * `loose` when the gaps vary widely around the median. Still worth showing —
   * an irregular repeat customer is exactly who a contract helps — but the UI
   * should not present it as a schedule.
   */
  confidence: IntervalConfidence;
  lastVisit: string;
  /** Negative when the next visit is already overdue. */
  dueInDays: number;
  /** Median of what they were actually charged, or null if no job carried an amount. */
  medianVisitValue: number | null;
  /** medianVisitValue × visits per year. Null whenever the median is null. */
  estimatedAnnualValue: number | null;
  trade?: string;
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Gaps between consecutive visits, in days, oldest first.
 * Gaps below MIN_INTERVAL_DAYS are dropped as same-visit noise rather than
 * being allowed to drag the median toward zero.
 */
export function intervalsBetween(visits: MaintenanceVisit[]): number[] {
  const times = visits
    .map((v) => new Date(v.completedAt).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const days = (times[i] - times[i - 1]) / MS_PER_DAY;
    if (days >= MIN_INTERVAL_DAYS) gaps.push(days);
  }
  return gaps;
}

/**
 * How tightly the gaps cluster around their median. `loose` once any gap is
 * more than 40% away from it.
 */
export function confidenceFor(intervals: number[], med: number): IntervalConfidence {
  if (med <= 0) return 'loose';
  const worst = Math.max(...intervals.map((d) => Math.abs(d - med) / med));
  return worst <= LOOSE_SPREAD_RATIO ? 'firm' : 'loose';
}

/**
 * Read a rhythm out of one customer's completed visits, or null when there
 * isn't one to read.
 */
export function detectRhythm(
  customerId: string,
  customerName: string,
  visits: MaintenanceVisit[],
  now: number = Date.now(),
): MaintenanceOpportunity | null {
  if (visits.length < MIN_VISITS_FOR_RHYTHM) return null;

  const intervals = intervalsBetween(visits);
  // Two surviving gaps, i.e. three real visits. Dropping same-week duplicates
  // above can take a 3-visit customer below the bar, which is correct.
  if (intervals.length < MIN_VISITS_FOR_RHYTHM - 1) return null;

  const intervalDays = median(intervals);
  if (intervalDays === null || intervalDays <= 0) return null;

  const sorted = [...visits].sort(
    (a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime(),
  );
  const last = sorted[sorted.length - 1];
  const daysSinceLast = (now - new Date(last.completedAt).getTime()) / MS_PER_DAY;

  // Amounts are optional on a job, so this is null far more often than it is
  // zero. Zero would read as "you do this for free".
  const amounts = visits.map((v) => v.amount).filter((a): a is number => typeof a === 'number' && a > 0);
  const medianVisitValue = median(amounts);

  const visitsPerYear = 365 / intervalDays;
  const estimatedAnnualValue =
    medianVisitValue === null ? null : Math.round(medianVisitValue * visitsPerYear);

  return {
    customerId,
    customerName,
    visits: visits.length,
    intervalDays: Math.round(intervalDays),
    confidence: confidenceFor(intervals, intervalDays),
    lastVisit: last.completedAt,
    dueInDays: Math.round(intervalDays - daysSinceLast),
    medianVisitValue,
    estimatedAnnualValue,
    trade: last.trade,
  };
}

/**
 * Opportunities worth surfacing now: the next visit is due within `horizonDays`
 * or is already overdue. Overdue first, then soonest.
 */
export function rankOpportunities(
  opportunities: MaintenanceOpportunity[],
  horizonDays = 60,
): MaintenanceOpportunity[] {
  return opportunities
    .filter((o) => o.dueInDays <= horizonDays)
    .sort((a, b) => a.dueInDays - b.dueInDays);
}

// ---------------------------------------------------------------------------
// Hook — reads the contractor's own job history
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { useAppState } from '../state/AppState';

/** Statuses that mean the work actually happened. */
const DONE_STATUSES = new Set(['completed', 'invoiced', 'paid']);

/**
 * Opportunities across every customer, ranked, from real jobs.
 *
 * `completedAt` is only written from 2026-08-04 onward, so jobs finished before
 * that carry none. Rather than drop that history — which would leave every
 * existing contractor with an empty screen and no way to know why — a done job
 * falls back to `updatedAt`, which for a finished job is when it was last
 * touched and is the closest honest approximation available. `createdAt` is
 * deliberately NOT used: it is when the job was booked, which for a long job is
 * a different month.
 */
export function useMaintenanceOpportunities(horizonDays = 60) {
  const { jobs, customers, projects } = useAppState();

  return useMemo(() => {
    // Jobs that belong to a project are PHASES of one commission, not repeat
    // visits. An aannemer's single renovation carries several trade jobs spread
    // over months; counting them as visits reads a "rhythm every six weeks,
    // worth €X a year" out of one job that will never recur. Exclude them here
    // and let the project itself stand as one visit below.
    const projectJobIds = new Set<string>();
    for (const p of projects) {
      for (const id of p.jobIds ?? []) projectJobIds.add(id);
      for (const m of p.milestones ?? []) {
        for (const id of m.jobIds ?? []) projectJobIds.add(id);
      }
    }

    const byCustomer = new Map<string, MaintenanceVisit[]>();
    const push = (customerId: string, v: MaintenanceVisit) => {
      const list = byCustomer.get(customerId) ?? [];
      list.push(v);
      byCustomer.set(customerId, list);
    };

    for (const job of jobs) {
      if (!job.customerId) continue;
      if (!DONE_STATUSES.has(job.status)) continue;
      if (projectJobIds.has(job.id)) continue;
      const when = job.completedAt ?? job.updatedAt;
      if (!when) continue;
      push(job.customerId, {
        completedAt: when,
        amount: job.agreedAmount ?? job.quotedAmount,
        trade: job.trade,
      });
    }

    // A completed project counts as ONE visit. That is what makes this work for
    // an aannemer: the recurring signal there is a customer who commissions a
    // job every year — a property manager, a housing association — not the
    // phases within a single build.
    for (const p of projects) {
      if (p.status !== 'completed') continue;
      if (!p.customerId) continue;
      const when = p.actualEndDate ?? p.targetEndDate;
      if (!when) continue;
      push(p.customerId, {
        completedAt: when,
        // Invoiced beats quoted: what was actually billed is the better record
        // of what the customer paid for the work.
        amount: p.totalInvoiced || p.totalQuoted || undefined,
      });
    }

    const found: MaintenanceOpportunity[] = [];
    for (const [customerId, visits] of byCustomer) {
      const customer = customers.find((c) => c.id === customerId);
      // No name means we cannot tell the contractor who this is about, and a
      // raw id is not an answer (learnings #67).
      if (!customer?.name) continue;
      const rhythm = detectRhythm(customerId, customer.name, visits);
      if (rhythm) found.push(rhythm);
    }

    return rankOpportunities(found, horizonDays);
  }, [jobs, customers, projects, horizonDays]);
}
