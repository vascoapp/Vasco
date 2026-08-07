// =============================================================================
// HOW LONG IS THIS JOB *TODAY* — the slot, not the whole-job estimate
// =============================================================================
// `Job.estimatedDuration` is the estimate for the ENTIRE job: a Badkamer
// renovatie carries 24, spread over many days. `scheduledStartTime`/
// `scheduledEndTime` are that job's slot on ONE day (13:30–17:00 = 3.5h).
//
// Reaching for estimatedDuration when a day-length is wanted has now produced
// the same bug three separate times:
//   - the Werk list badge read "24u" beside the slot "13:30 – 17:00"
//   - Dagplanning drew a block from "13:00 – 37:00" and put Bezetting at 270%
//   - Weekoverzicht summed a day to "27h", which does not fit in a day
//
// Each was fixed on its own screen with its own copy of the arithmetic, which
// is exactly how the three drifted apart. This is that arithmetic, once.
// =============================================================================

/** The scheduling fields any of these surfaces actually read. */
export interface SlotLike {
  scheduledStartTime?: string | null;
  scheduledEndTime?: string | null;
  estimatedDuration?: number | null;
}

/** "HH:MM" → minutes since midnight; null if unparseable. */
function toMinutes(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return null;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

/**
 * Hours this job occupies on its scheduled day, derived from the slot.
 *
 * Returns null when the slot cannot be derived — callers decide whether to
 * fall back or omit, rather than silently receiving a whole-job estimate that
 * looks like a day length.
 *
 * An end at or before the start yields null rather than a negative or zero
 * span: that is bad data, not a zero-length job.
 */
export function slotHours(job: SlotLike | null | undefined): number | null {
  if (!job) return null;
  const start = toMinutes(job.scheduledStartTime);
  const end = toMinutes(job.scheduledEndTime);
  if (start === null || end === null || end <= start) return null;
  return Math.round(((end - start) / 60) * 100) / 100;
}

/**
 * Slot hours, falling back to the whole-job estimate and then to `fallback`.
 *
 * Use this only where a number is genuinely required. The fallback is a
 * whole-job estimate, so on a multi-day job it will overstate the day — which
 * is the original bug, merely bounded. Prefer `slotHours` and omit when null.
 */
export function slotHoursOr(job: SlotLike | null | undefined, fallback = 2): number {
  return slotHours(job) ?? job?.estimatedDuration ?? fallback;
}

/**
 * Total hours booked across a day's jobs, counting only jobs whose slot is
 * known. A day whose jobs carry no times reports 0 booked hours rather than
 * inventing a duration per job.
 */
export function bookedHours(jobs: readonly SlotLike[]): number {
  const total = jobs.reduce<number>((sum, j) => sum + (slotHours(j) ?? 0), 0);
  return Math.round(total * 100) / 100;
}
