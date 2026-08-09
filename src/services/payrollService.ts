// =============================================================================
// PAYROLL — what do I actually owe each person this week?
// =============================================================================
// The question that turns a crew from a cost into a managed cost, and the one
// the app could not answer at all. `Verloning` read `teamManagementService`,
// a demo-only singleton with no persistence that NOTHING in the app ever adds
// a member to — so an aannemer with a five-person crew was told "no team
// members yet", and in demo builds the export button offered a CSV of three
// fabricated employees with fabricated rates.
//
// Real hours live on `Job.timeEntries` (JSONB, migration 20260507000002) and
// real people live in `workers` (migration 20260520000004) with `hourlyCost`,
// a field whose own comment says it exists for exactly this. This joins them.
//
// Pure functions over data the caller already has — no singleton, no store,
// same shape as crewWeekService.
//
// ── Two deliberate refusals to invent a number ──────────────────────────────
//
// 1. NO OVERTIME PREMIUM. The previous screen split hours at 40/week and
//    priced the remainder at 1.5×. Both halves are fabricated: the threshold
//    and the multiplier are set by the CAO / collective agreement and differ
//    across NL, DE, FR, ES, IT and UK. This output is exported to a bookkeeper
//    who applies the real agreement, so inventing a premium here produces a
//    confident wrong number on the document that determines someone's wages.
//    We report hours worked and cost at the recorded rate; the premium is the
//    bookkeeper's to apply.
//
// 2. A MISSING RATE IS UNKNOWN, NOT ZERO. `hourlyCost` is optional. Summing an
//    unrated worker as €0 understates the wage bill — the dangerous direction
//    of the two — while looking complete. Their cost stays undefined and the
//    summary reports how many people are unpriced, so the total is never read
//    as the whole bill when it isn't.
// =============================================================================

import { localDateKey, startOfWeek } from '../utils/dateKey';

export interface PayrollTimeEntry {
  date: string;
  hours: number;
  workerId?: string;
}

export interface PayrollJob {
  id: string;
  timeEntries?: PayrollTimeEntry[];
}

export interface PayrollWorker {
  id: string;
  name: string;
  hourlyCost?: number;
  isActive: boolean;
}

export interface PayrollLine {
  /** null = the contractor themselves (entries carry no workerId). */
  workerId: string | null;
  name: string;
  hours: number;
  /** Undefined when no rate is recorded for this person. */
  hourlyCost?: number;
  /** Undefined when the rate is unknown — never silently 0. */
  cost?: number;
  jobCount: number;
  /** True when this person is no longer on the crew but worked in the period. */
  isInactive: boolean;
}

export interface PayrollSummary {
  lines: PayrollLine[];
  totalHours: number;
  /** Cost of the people whose rate IS recorded. Not necessarily the whole bill. */
  knownCost: number;
  /** How many lines have hours but no rate — knownCost excludes these. */
  unpricedCount: number;
  /** Hours belonging to those unpriced lines. */
  unpricedHours: number;
}

export type PayrollPeriod = 'week' | 'month';

/**
 * Inclusive local date-key bounds for the current week (Mon-based, matching
 * the crew board) or the current month.
 */
export function periodBounds(period: PayrollPeriod, now: Date): { from: string; to: string } {
  if (period === 'week') {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { from: localDateKey(start), to: localDateKey(end) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: localDateKey(start), to: localDateKey(end) };
}

/**
 * Group every logged hour in the period by the person who worked it.
 *
 * `contractorName` labels entries with no workerId. A worker who has since
 * been deactivated still appears if they worked in the period — they were
 * paid for that work, and dropping them would understate the bill (the same
 * orphan-row trap the crew board hit with deactivated workers).
 */
export function buildPayroll(args: {
  jobs: PayrollJob[];
  workers: PayrollWorker[];
  period: PayrollPeriod;
  now: Date;
  contractorName: string;
  /**
   * The contractor's own rate (`businessProfile.hourlyRate`), for the hours
   * that carry no workerId. Without it this screen would call those hours
   * unpriced while `getProjectPnL` charges them to the project at exactly
   * this rate — the same hours costed on one screen and not the other.
   */
  contractorHourlyCost?: number;
}): PayrollSummary {
  const { jobs, workers, period, now, contractorName, contractorHourlyCost } = args;
  const { from, to } = periodBounds(period, now);

  // key: workerId ?? '' (empty string stands for the contractor)
  const acc = new Map<string, { hours: number; jobs: Set<string> }>();

  for (const job of jobs) {
    for (const e of job.timeEntries ?? []) {
      if (!e || typeof e.hours !== 'number' || !e.date) continue;
      const day = e.date.slice(0, 10);
      if (day < from || day > to) continue;
      const key = e.workerId ?? '';
      const row = acc.get(key) ?? { hours: 0, jobs: new Set<string>() };
      row.hours += e.hours;
      row.jobs.add(job.id);
      acc.set(key, row);
    }
  }

  const lines: PayrollLine[] = [];
  for (const [key, row] of acc.entries()) {
    const worker = key ? workers.find((w) => w.id === key) : undefined;
    // An entry can name a worker who has since been deleted outright. Their
    // hours still happened, so they get a line rather than vanishing.
    const name = key ? worker?.name ?? contractorName : contractorName;
    const hourlyCost = key ? worker?.hourlyCost : contractorHourlyCost;
    const hours = Math.round(row.hours * 100) / 100;
    lines.push({
      workerId: key || null,
      name,
      hours,
      hourlyCost,
      cost: typeof hourlyCost === 'number' ? Math.round(hours * hourlyCost * 100) / 100 : undefined,
      jobCount: row.jobs.size,
      isInactive: Boolean(key && worker && !worker.isActive),
    });
  }

  // Most hours first — the biggest line of the wage bill is what gets checked.
  lines.sort((a, b) => b.hours - a.hours);

  const unpriced = lines.filter((l) => l.cost === undefined);
  return {
    lines,
    totalHours: Math.round(lines.reduce((s, l) => s + l.hours, 0) * 100) / 100,
    knownCost: Math.round(lines.reduce((s, l) => s + (l.cost ?? 0), 0) * 100) / 100,
    unpricedCount: unpriced.length,
    unpricedHours: Math.round(unpriced.reduce((s, l) => s + l.hours, 0) * 100) / 100,
  };
}
