// =============================================================================
// GENERATOR OUTCOME ATTRIBUTOR — Stage 6 of intelligence retrofit
// =============================================================================
// Recomputes the same "problem count" each Stage 3 generator (lead-followup,
// worker-capacity, license-renewal-action) uses as its `predictedValue`, then
// feeds it back into the calibration system as the `actualValue` to grade
// the generator's prior predictions.
//
// Called from AppState mutators on entity-state changes — the resolver
// chain in learningStorage handles the actual scoring + persistence.
//
// Why duplicate the count logic from the generators? Two reasons:
//   1. Generators are React hooks; we need to call this from non-React
//      AppState callbacks. Calling a hook from non-React code is illegal.
//   2. The generator filters on `useMemo` over reactive state. Here we
//      recompute synchronously off the post-mutation entity snapshot
//      passed in — no stale closures.
// =============================================================================

import type { Lead } from '../domain/lead';
import type { Worker } from '../domain/worker';
import type { ContractorLicense } from '../domain/business';
import {
  resolveOutcomesFromLeadStateChange,
  resolveOutcomesFromCrewStateChange,
  resolveOutcomesFromLicenseStateChange,
} from './learningStorage';

// Mirror the generator constants — duplicated intentionally; the
// generators consume them as React-side defaults, this module needs
// them in plain TS for synchronous resolution.
const STALE_HOURS_NEW = 24;
const STALE_HOURS_CONTACTED = 72;
const STALE_DAYS_ESTIMATE = 7;

const OVERBOOK_THRESHOLD = 5;
const IDLE_DAYS_THRESHOLD = 7;
const ACTIVE_JOB_STATUSES = new Set([
  'lead',
  'quoted',
  'scheduled',
  'in_progress',
  'active',
]);

const LICENSE_EXPIRES_SOON_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Lead followup
// ---------------------------------------------------------------------------

export function countStaleLeads(leads: Lead[], nowMs: number = Date.now()): number {
  let count = 0;
  for (const l of leads) {
    const updatedMs = new Date(l.updatedAt ?? l.createdAt).getTime();
    const hoursSince = (nowMs - updatedMs) / 3_600_000;
    if (l.status === 'new' && hoursSince >= STALE_HOURS_NEW) count++;
    else if (l.status === 'contacted' && hoursSince >= STALE_HOURS_CONTACTED) count++;
    else if (l.status === 'estimate_sent' && hoursSince >= STALE_DAYS_ESTIMATE * 24) count++;
  }
  return count;
}

/**
 * Grade prior `lead-followup` predictions against the current stale-lead
 * count. Best-effort — failures are silent (calibration is non-blocking).
 */
export function attributeLeadFollowupOutcome(leads: Lead[]): void {
  const current = countStaleLeads(leads);
  resolveOutcomesFromLeadStateChange(current).catch(() => {});
}

// ---------------------------------------------------------------------------
// Worker capacity
// ---------------------------------------------------------------------------

export function countCrewProblems(
  workers: Worker[],
  jobs: Array<{ status?: string; assignedWorkerId?: string | null; scheduledDate?: string; updatedAt?: string; createdAt?: string }>,
  nowMs: number = Date.now(),
): number {
  if (!workers || workers.length < 2) return 0;
  const activeWorkers = workers.filter((w) => w.isActive !== false);
  if (activeWorkers.length === 0) return 0;

  const activeJobs = (jobs ?? []).filter((j) => j.status && ACTIVE_JOB_STATUSES.has(j.status));
  const jobsByWorker = new Map<string, typeof activeJobs>();
  for (const j of activeJobs) {
    const wid = j.assignedWorkerId;
    if (!wid) continue;
    const list = jobsByWorker.get(wid) ?? [];
    list.push(j);
    jobsByWorker.set(wid, list);
  }

  let overbooked = 0;
  let idle = 0;
  for (const w of activeWorkers) {
    const list = jobsByWorker.get(w.id) ?? [];
    if (list.length >= OVERBOOK_THRESHOLD) {
      overbooked++;
      continue;
    }
    if (list.length === 0) {
      const mostRecentMs = list
        .map((j) => new Date(j.scheduledDate ?? j.updatedAt ?? j.createdAt ?? 0).getTime())
        .filter((n) => Number.isFinite(n))
        .reduce((max, n) => Math.max(max, n), 0);
      const daysSinceLast = mostRecentMs === 0 ? Infinity : (nowMs - mostRecentMs) / MS_PER_DAY;
      if (daysSinceLast >= IDLE_DAYS_THRESHOLD) idle++;
    }
  }
  return overbooked + idle;
}

export function attributeCrewCapacityOutcome(
  workers: Worker[],
  jobs: Array<{ status?: string; assignedWorkerId?: string | null; scheduledDate?: string; updatedAt?: string; createdAt?: string }>,
): void {
  const current = countCrewProblems(workers, jobs);
  resolveOutcomesFromCrewStateChange(current).catch(() => {});
}

// ---------------------------------------------------------------------------
// License renewal
// ---------------------------------------------------------------------------

export function countExpiringLicenses(licenses: ContractorLicense[] | undefined, nowMs: number = Date.now()): number {
  if (!licenses) return 0;
  let count = 0;
  for (const l of licenses) {
    const daysUntil = Math.floor((new Date(l.expiryDate).getTime() - nowMs) / MS_PER_DAY);
    if (daysUntil <= LICENSE_EXPIRES_SOON_DAYS) count++;
  }
  return count;
}

export function attributeLicenseRenewalOutcome(licenses: ContractorLicense[] | undefined): void {
  const current = countExpiringLicenses(licenses);
  resolveOutcomesFromLicenseStateChange(current).catch(() => {});
}
