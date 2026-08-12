import type { ProjectMilestone } from '../types/project';

/**
 * How far along a project is.
 *
 * The projects LIST computed this as completed jobs / total jobs, while the
 * project DETAIL renders the milestone plan. On the demo aannemer that put two
 * answers on screen for one project: the card said "Voortgang 0%" while the
 * detail showed "Sloopwerk gereed" ticked off. A renovation GC plans in trade
 * milestones — that is what the project templates write, 7 to 11 of them — so
 * when a plan exists it is the plan that says how far along the work is. One
 * job being unfinished is not the same statement.
 *
 * Jobs remain the fallback for projects with no plan, which is every project
 * created before templates existed.
 *
 * `basis: 'none'` means there is nothing to measure — no milestones and no
 * jobs. Callers must render nothing in that case rather than "0%": an empty
 * set is not zero progress, and this screen already shows "—" for a margin it
 * cannot compute.
 */
export type ProgressBasis = 'milestones' | 'jobs' | 'none';

export interface ProjectProgress {
  pct: number;
  basis: ProgressBasis;
  completed: number;
  total: number;
}

/** Job statuses that count as done, in both the English and Dutch vocabularies. */
const DONE_STATUSES = [
  'completed', 'invoiced', 'paid',
  'gereed', 'gefactureerd', 'betaald',
];

export function isJobDone(status: string | undefined): boolean {
  return !!status && DONE_STATUSES.includes(status);
}

export function projectProgress(
  milestones: readonly Pick<ProjectMilestone, 'completed'>[] | undefined,
  jobStatuses: readonly (string | undefined)[],
): ProjectProgress {
  const plan = milestones ?? [];
  if (plan.length > 0) {
    const completed = plan.filter((m) => m.completed).length;
    return {
      pct: Math.round((completed / plan.length) * 100),
      basis: 'milestones',
      completed,
      total: plan.length,
    };
  }

  if (jobStatuses.length > 0) {
    const completed = jobStatuses.filter(isJobDone).length;
    return {
      pct: Math.round((completed / jobStatuses.length) * 100),
      basis: 'jobs',
      completed,
      total: jobStatuses.length,
    };
  }

  return { pct: 0, basis: 'none', completed: 0, total: 0 };
}
