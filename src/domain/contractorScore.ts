// =============================================================================
// CONTRACTOR SCORE — computed only from what the job records can show
// =============================================================================
// Extracted from app/contractor/profile.tsx so it can be tested. Its history
// (learnings #217, #334): placeholders that scored "no data" as success, then
// as failure; and a completion rate that counted only `completed`, so invoiced
// and paid jobs — the most finished jobs there are — read as not done, while
// every lead and next month's bookings sat in the denominator. The German demo
// showed "Abschlussrate 20% · Auftragnehmer-Score 12/100" for a contractor
// with no unfinished past work at all.
// =============================================================================

import { isJobFinished } from './jobs';
import { parseCalendarDay, calendarDaysBetween } from '../utils/dateKey';

interface ScoreJob {
  status?: string;
  customerId?: string | null;
  scheduledDate?: string;
  completedAt?: string;
  endDate?: string;
}

export interface ContractorScore {
  score: number | null;
  completionRate: number | null;
  onTimeRate: number | null;
  repeatRate: number | null;
}

/** Active work: agreed and underway or booked. Leads and quotes are not work yet. */
const ACTIVE = ['accepted', 'scheduled', 'in-progress', 'geaccepteerd', 'ingepland', 'bezig'];

export function computeContractorScore(jobs: ScoreJob[], today: Date = new Date()): ContractorScore {
  const finished = jobs.filter((j) => isJobFinished(j.status));

  // Completion: of the work that should be finished by now, how much is.
  // Due = finished jobs + active jobs whose date has passed. Future bookings,
  // leads and quotes are not late, so they are not in the denominator.
  const overdueActive = jobs.filter((j) => {
    if (!ACTIVE.includes(j.status ?? '')) return false;
    const day = parseCalendarDay(j.scheduledDate);
    return day !== null && calendarDaysBetween(day, today) > 0;
  });
  const due = finished.length + overdueActive.length;
  const completionRate = due > 0 ? finished.length / due : null;

  // On time: judged only against a date the job carried (#217).
  const dated = finished.filter((j) => j.completedAt && (j.endDate || j.scheduledDate));
  const onTime = dated.filter((j) =>
    new Date(j.completedAt as string) <= new Date(`${(j.endDate ?? j.scheduledDate) as string}T23:59:59`)).length;
  const onTimeRate = dated.length > 0 ? onTime / dated.length : null;

  const perCustomer = new Map<string, number>();
  jobs.forEach((j) => {
    if (j.customerId) perCustomer.set(j.customerId, (perCustomer.get(j.customerId) ?? 0) + 1);
  });
  const repeatRate = perCustomer.size > 0
    ? Array.from(perCustomer.values()).filter((c) => c >= 2).length / perCustomer.size
    : null;

  // Only measurable components, rescaled to 100 — an unknown is neither a
  // success nor a zero (#217).
  const components = [
    ...(completionRate !== null ? [{ value: completionRate, weight: 40 }] : []),
    ...(onTimeRate !== null ? [{ value: onTimeRate, weight: 35 }] : []),
    ...(repeatRate !== null ? [{ value: repeatRate, weight: 25 }] : []),
  ];
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const score = finished.length > 0 && totalWeight > 0
    ? Math.min(100, Math.round((components.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight) * 100))
    : null;

  const pct = (x: number | null) => (x === null ? null : Math.round(x * 100));
  return { score, completionRate: pct(completionRate), onTimeRate: pct(onTimeRate), repeatRate: pct(repeatRate) };
}
