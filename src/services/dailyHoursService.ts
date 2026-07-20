// =============================================================================
// DAILY HOURS SUMMARY
// =============================================================================
// Aggregates timeEntries across jobs into a per-day total, plus the per-job
// split. Used by Vandaag and the Timesheet screen so the contractor can see
// "you've logged 6.5h today across 3 jobs" without opening each one.
// =============================================================================

import type { Job } from '../types/contractor';
import { localDateKey } from '../utils/dateKey';

export interface PerJobSummary {
  jobId: string;
  jobTitle: string;
  hours: number;
}

export interface DailySummary {
  date: string;               // YYYY-MM-DD
  totalHours: number;
  perJob: PerJobSummary[];
  jobsTouched: number;
  active?: { jobId: string; jobTitle: string; sinceMs: number };
}

function dateKey(d: Date): string {
  return localDateKey(d);
}

/** Produce the per-day view of time entries within the last `days` days. */
export function buildDailyHours(jobs: Job[], days: number = 7): DailySummary[] {
  const now = new Date();
  const buckets = new Map<string, Map<string, { title: string; hours: number }>>();

  // Seed every day in the window so the UI can render a zero row
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(dateKey(d), new Map());
  }

  for (const j of jobs) {
    const entries = ((j as any).timeEntries ?? []) as Array<{ date?: string; hours?: number }>;
    for (const e of entries) {
      if (!e.date || typeof e.hours !== 'number') continue;
      const key = e.date.slice(0, 10);
      const dayBucket = buckets.get(key);
      if (!dayBucket) continue;
      const prev = dayBucket.get(j.id) ?? { title: j.title, hours: 0 };
      prev.hours += e.hours;
      dayBucket.set(j.id, prev);
    }
  }

  const out: DailySummary[] = [];
  for (const [date, perJob] of buckets.entries()) {
    const rows: PerJobSummary[] = [...perJob.entries()].map(([jobId, v]) => ({
      jobId,
      jobTitle: v.title,
      hours: Math.round(v.hours * 100) / 100,
    }));
    const total = rows.reduce((s, r) => s + r.hours, 0);
    out.push({
      date,
      totalHours: Math.round(total * 100) / 100,
      perJob: rows.sort((a, b) => b.hours - a.hours),
      jobsTouched: rows.length,
    });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

/** Today-only summary, merging an active clock-in (unclosed timer) if present. */
export function todaySummary(jobs: Job[], active?: { jobId: string; jobTitle: string; startTimeMs: number }): DailySummary {
  const today = dateKey(new Date());
  const base = buildDailyHours(jobs, 1).find((d) => d.date === today)
    ?? { date: today, totalHours: 0, perJob: [], jobsTouched: 0 };

  if (active) {
    const sinceMs = Date.now() - active.startTimeMs;
    const hoursSoFar = Math.max(0, sinceMs / (60 * 60 * 1000));
    const existingIdx = base.perJob.findIndex((r) => r.jobId === active.jobId);
    if (existingIdx >= 0) {
      base.perJob[existingIdx].hours = Math.round((base.perJob[existingIdx].hours + hoursSoFar) * 100) / 100;
    } else {
      base.perJob.unshift({ jobId: active.jobId, jobTitle: active.jobTitle, hours: Math.round(hoursSoFar * 100) / 100 });
      base.jobsTouched += 1;
    }
    base.totalHours = Math.round((base.totalHours + hoursSoFar) * 100) / 100;
    return { ...base, active: { jobId: active.jobId, jobTitle: active.jobTitle, sinceMs } };
  }

  return base;
}
