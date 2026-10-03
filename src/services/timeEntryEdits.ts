/**
 * Correcting the hours a contractor clocked (aannemer walk, 2026-10-03).
 *
 * The timesheet could only clock in and out: a forgotten clock-out ran on for
 * hours, a forgotten clock-in was lost, and nothing could be fixed — while
 * those hours feed the payroll export, the job's labour cost and an hours-based
 * invoice (jobBillingBasis). An entry lives TWICE: in the timesheet's own list
 * and in `job.timeEntries` (what everything else reads). These pure helpers
 * keep the two in step: an edit that moves an entry to another job takes it
 * off the old job and puts it on the new one, by the entry's id.
 */

import { round2 } from '../utils/round2';

/** "7:30", "07:30", "7.30" or "730" → minutes after midnight; null if not a time. */
export function parseClockTime(raw: string | undefined | null): number | null {
  const s = String(raw ?? '').trim().replace('.', ':');
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "HH:MM", zero-padded — how the timesheet shows and stores times. */
export function formatClockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Hours between two clock times on one day, minus a break, to 2 decimals.
 * null when either time is unreadable or the end is not after the start
 * (a night shift is two entries; an inverted pair is a typo, not 20 hours).
 */
export function hoursBetween(clockIn: string, clockOut: string, breakMinutes = 0): number | null {
  const a = parseClockTime(clockIn);
  const b = parseClockTime(clockOut);
  if (a === null || b === null || b <= a) return null;
  const worked = b - a - Math.max(0, breakMinutes || 0);
  if (worked <= 0) return null;
  return round2(worked / 60);
}

export interface JobTimeEntry {
  id: string;
  date: string;
  hours: number;
  workerId?: string;
  clockIn?: string;
  clockOut?: string;
}

export interface JobWithEntries {
  id: string;
  timeEntries?: JobTimeEntry[] | null;
}

export interface EntryOnJob {
  id: string;
  date: string;
  hours: number;
  clockIn?: string;
  clockOut?: string;
  jobId?: string | null;
}

export interface JobEntriesPatch {
  jobId: string;
  timeEntries: JobTimeEntry[];
  actualHours: number;
}

const sumHours = (es: JobTimeEntry[]) => round2(es.reduce((s, e) => s + (e.hours ?? 0), 0));

/**
 * The job updates an add / edit / delete needs. `before` null = a new entry;
 * `after` null = deleted. An entry with no job (clocked "without a job") lives
 * only in the timesheet and patches nothing.
 */
export function jobEntryPatches(
  jobs: JobWithEntries[],
  before: Pick<EntryOnJob, 'id' | 'jobId'> | null,
  after: EntryOnJob | null,
): JobEntriesPatch[] {
  const next = new Map<string, JobTimeEntry[]>();
  const entriesOf = (jobId: string) => next.get(jobId) ?? [...(jobs.find((j) => j.id === jobId)?.timeEntries ?? [])];

  if (before?.jobId && jobs.some((j) => j.id === before.jobId)) {
    next.set(before.jobId, entriesOf(before.jobId).filter((e) => e.id !== before.id));
  }
  if (after?.jobId && jobs.some((j) => j.id === after.jobId)) {
    const list = entriesOf(after.jobId).filter((e) => e.id !== after.id);
    const kept = (jobs.find((j) => j.id === after.jobId)?.timeEntries ?? []).find((e) => e.id === after.id);
    list.push({
      // A team member's entry keeps whose it is; this screen's own entries have none.
      ...(kept?.workerId ? { workerId: kept.workerId } : {}),
      id: after.id,
      date: after.date,
      hours: after.hours,
      clockIn: after.clockIn,
      clockOut: after.clockOut,
    });
    next.set(after.jobId, list);
  }
  return [...next.entries()].map(([jobId, timeEntries]) => ({ jobId, timeEntries, actualHours: sumHours(timeEntries) }));
}
