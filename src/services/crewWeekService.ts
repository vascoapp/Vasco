// =============================================================================
// CREW WEEK — is next week actually staffed?
// =============================================================================
// The question a renovation GC asks that a day planner cannot answer.
//
// A Dutch or German aannemer does not dispatch call-outs around a city; they
// run a handful of sites for weeks at a time, in trade order — sloop, then
// loodgieter, then tegelzetter, then stucwerk. The expensive failure is not a
// wasted drive, it is arriving at week 3 having never booked a tiler, and
// discovering it on the Monday.
//
// `ProjectMilestone` already models exactly that plan: a `trade` and a
// `weekNumber` counted from the project's start. Nothing read it. This maps
// those milestones onto real calendar weeks and checks each one against who is
// actually assigned that week.
//
// Pure functions over data the caller already has — no singleton, no store.
// =============================================================================

import { localDateKey, startOfWeek } from '../utils/dateKey';
import { sequenceByMilestoneId } from './projectSequenceService';
import type { Project, ProjectMilestone } from '../types/project';

export interface CrewWeekJob {
  id: string;
  title?: string;
  trade?: string;
  scheduledDate?: string;
  assignedWorkerId?: string;
  projectId?: string;
  address?: { city?: string } | null;
}

export interface CrewWeekWorker {
  id: string;
  name: string;
  trade?: string;
  isActive: boolean;
}

/** A milestone whose week has arrived with nobody of that trade on it. */
export interface StaffingGap {
  projectId: string;
  projectTitle: string;
  milestoneTitle: string;
  /** The trade the plan calls for. Undefined milestones are not gaps. */
  trade: string;
  /** Monday of the week the milestone falls in, as a local date key. */
  weekStartKey: string;
  /** True when nobody at all is booked on the project that week. */
  nobodyOnProject: boolean;
  /**
   * Title of the milestone this one is waiting on, when a handover is overdue.
   *
   * Set means booking the trade would NOT fix the gap — the room is not ready.
   * That is a different instruction from "nobody booked", so the two must not
   * be rendered with the same sentence.
   */
  blockedByTitle?: string;
}

/**
 * Which calendar week a milestone lands in.
 *
 * `weekNumber` is 1-based from the project's start (see types/project.ts), so
 * week 1 is the project's own first week — not the first week after it.
 * Returns null when the project has no start date, because then the plan has
 * no anchor and guessing one would invent a deadline.
 */
export function milestoneWeekStart(project: Project, milestone: ProjectMilestone): Date | null {
  if (!project.startDate) return null;
  const start = startOfWeek(new Date(project.startDate));
  if (Number.isNaN(start.getTime())) return null;
  const offset = Math.max(0, (milestone.weekNumber ?? 1) - 1);
  const out = new Date(start);
  out.setDate(start.getDate() + offset * 7);
  return out;
}

/** Jobs scheduled inside the given week, keyed by local date. */
export function jobsInWeek<T extends CrewWeekJob>(jobs: T[], weekDayKeys: string[]): T[] {
  const days = new Set(weekDayKeys);
  return jobs.filter((j) => j.scheduledDate && days.has(j.scheduledDate));
}

/**
 * Milestones falling in this week that have nobody of the required trade on
 * the project.
 *
 * Deliberately NOT flagged:
 *  - completed milestones — the work is done, staffing it is moot
 *  - milestones with no `trade` — the plan does not say who is needed, so
 *    there is nothing to check against. Warning anyway would train the
 *    contractor to ignore the strip.
 *
 * Trade matching is case-insensitive and tolerates the display/slug mismatch
 * the demo data carries ("plumbing" vs "Loodgieterij"): a worker with no trade
 * recorded is treated as able to cover anything, because the alternative is
 * telling a contractor their own crew cannot do the work when all they have
 * done is leave a field blank.
 */
export function staffingGapsForWeek(args: {
  projects: Project[];
  jobs: CrewWeekJob[];
  workers: CrewWeekWorker[];
  weekDayKeys: string[];
  /** Now, for the handover check. Injectable so tests do not read the clock. */
  today?: Date;
}): StaffingGap[] {
  const { projects, jobs, workers, weekDayKeys } = args;
  const today = args.today ?? new Date();
  if (!weekDayKeys.length) return [];
  const weekStartKey = weekDayKeys[0];
  const weekJobs = jobsInWeek(jobs, weekDayKeys);
  const activeById = new Map(workers.filter((w) => w.isActive).map((w) => [w.id, w]));
  const gaps: StaffingGap[] = [];

  for (const project of projects) {
    if (project.status === 'completed' || project.status === 'cancelled') continue;
    // Blocked is judged as of NOW, not as of the week being looked at: a
    // predecessor that is not yet overdue is not yet a handover failure, and
    // claiming one for a future week would be a forecast, not a fact.
    const sequence = sequenceByMilestoneId({ project, today });
    for (const milestone of project.milestones ?? []) {
      if (milestone.completed) continue;
      const trade = milestone.trade?.trim();
      if (!trade) continue;
      const start = milestoneWeekStart(project, milestone);
      if (!start || localDateKey(start) !== weekStartKey) continue;

      const projectJobs = weekJobs.filter(
        (j) => j.projectId === project.id || (project.jobIds ?? []).includes(j.id),
      );
      const staffed = projectJobs.filter((j) => j.assignedWorkerId && activeById.has(j.assignedWorkerId));
      const covered = staffed.some((j) => {
        const w = activeById.get(j.assignedWorkerId as string);
        if (!w) return false;
        // No trade recorded = can cover anything. See the note above.
        if (!w.trade) return true;
        return w.trade.toLowerCase() === trade.toLowerCase();
      });
      if (covered) continue;

      gaps.push({
        projectId: project.id,
        projectTitle: project.title,
        milestoneTitle: milestone.title,
        trade,
        weekStartKey,
        nobodyOnProject: staffed.length === 0,
        blockedByTitle: sequence.get(milestone.id)?.blockedBy[0]?.title,
      });
    }
  }
  return gaps;
}

/** Per-person load for the week: days booked, hours, and distinct sites. */
export function crewWeekLoad(args: {
  jobs: CrewWeekJob[];
  weekDayKeys: string[];
  hoursFor: (job: CrewWeekJob) => number;
}): Map<string, { days: Set<string>; hours: number; sites: Set<string> }> {
  const { jobs, weekDayKeys, hoursFor } = args;
  const out = new Map<string, { days: Set<string>; hours: number; sites: Set<string> }>();
  for (const j of jobsInWeek(jobs, weekDayKeys)) {
    const key = j.assignedWorkerId ?? '';
    const row = out.get(key) ?? { days: new Set<string>(), hours: 0, sites: new Set<string>() };
    if (j.scheduledDate) row.days.add(j.scheduledDate);
    row.hours += hoursFor(j);
    const city = j.address?.city;
    if (city) row.sites.add(city);
    out.set(key, row);
  }
  return out;
}
