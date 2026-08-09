// =============================================================================
// PROJECT SEQUENCE — what is blocked, by what, and has my end date moved?
// =============================================================================
// `crewWeekService` answers "week 3 has arrived and no tiler is booked". This
// answers the question one step downstream: booking a tiler would not help,
// because the plumber is not finished.
//
// `ProjectMilestone.weekNumber` is an absolute offset from the project start
// and nothing moves it. If the plumber runs four days over, the tiler's
// milestone still claims week 3, and the aannemer finds out on the Monday when
// a tiler arrives to a room that isn't ready. The missing fact is not a date —
// it is which milestone cannot start until which other milestone is finished.
// That is `dependsOn`; this file derives everything that follows from it.
//
// Deliberately NOT a Gantt engine: no durations, no float, no critical path, no
// resource levelling. Milestones are week-grained because `weekNumber` is.
//
// Pure functions over data the caller already has — no singleton, no store.
// =============================================================================

import { startOfWeek } from '../utils/dateKey';
import type { Project, ProjectMilestone } from '../types/project';

/** What sequencing says about one milestone. `weekNumber` is never mutated. */
export interface SequencedMilestone {
  milestone: ProjectMilestone;
  /**
   * Predecessors that are incomplete AND whose planned week has already
   * passed. Empty when nothing is holding this milestone up. Ordered by
   * planned week so the most overdue reads first.
   */
  blockedBy: ProjectMilestone[];
  /**
   * The earliest week this milestone could now complete, given what is
   * demonstrably late. Equals `weekNumber` when nothing has slipped — including
   * when a predecessor slipped but this milestone had enough room in the plan
   * to absorb it. Derived on every read, never stored (learnings #115).
   */
  projectedWeek: number;
  /** projectedWeek - weekNumber. 0 when on plan. Never negative. */
  slipWeeks: number;
  /** True when this milestone is part of a dependency cycle (see below). */
  inCycle: boolean;
}

/**
 * Which project-week the given date falls in, 1-based to match `weekNumber`.
 *
 * Returns null when the project has no start date: then the plan has no anchor
 * and there is no such thing as "its week has passed". Same posture as
 * `milestoneWeekStart` — no anchor means no claim, rather than a deadline
 * invented out of the render date.
 */
export function currentProjectWeek(project: Project, today: Date): number | null {
  if (!project.startDate) return null;
  const start = startOfWeek(new Date(project.startDate));
  if (Number.isNaN(start.getTime())) return null;
  const here = startOfWeek(today);
  if (Number.isNaN(here.getTime())) return null;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  // Both operands are week starts, so DST shifts inside a week cannot round
  // this across a boundary.
  const weeks = Math.round((here.getTime() - start.getTime()) / msPerWeek);
  return weeks + 1;
}

/**
 * Milestone ids that sit on a dependency cycle.
 *
 * `dependsOn` is a graph and nothing stops a user drawing A -> B -> A. On
 * detection we treat every milestone in the cycle as having NO dependency,
 * rather than throwing or looping: same posture as crewWeekService's missing
 * `startDate`. A cycle is a planning mistake to surface, not a crash — and
 * refusing to render the project would hide the mistake behind an error.
 */
export function milestonesInCycle(milestones: ProjectMilestone[]): Set<string> {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  const state = new Map<string, 'visiting' | 'done'>();
  const cycled = new Set<string>();

  // Iterative DFS — a deep chain must not blow the JS stack on a user's plan.
  for (const root of milestones) {
    if (state.get(root.id)) continue;
    const path: string[] = [];
    const onPath = new Set<string>();
    const stack: Array<{ id: string; next: number }> = [{ id: root.id, next: 0 }];
    state.set(root.id, 'visiting');
    path.push(root.id);
    onPath.add(root.id);

    while (stack.length) {
      const frame = stack[stack.length - 1];
      const deps = byId.get(frame.id)?.dependsOn ?? [];
      if (frame.next >= deps.length) {
        state.set(frame.id, 'done');
        onPath.delete(frame.id);
        path.pop();
        stack.pop();
        continue;
      }
      const depId = deps[frame.next++];
      if (!byId.has(depId)) continue; // unknown/deleted id — ignored, not a cycle
      if (onPath.has(depId)) {
        // Everything from depId to the top of the path is on the cycle.
        const from = path.indexOf(depId);
        for (let i = from; i < path.length; i++) cycled.add(path[i]);
        continue;
      }
      if (state.get(depId) === 'done') continue;
      state.set(depId, 'visiting');
      path.push(depId);
      onPath.add(depId);
      stack.push({ id: depId, next: 0 });
    }
  }
  return cycled;
}

/**
 * Sequence a project's milestones against today.
 *
 * Two rules, and the distance between them is the whole point:
 *
 *  - BLOCKED is a present-tense fact: a predecessor is incomplete and its
 *    planned week has already passed. The claim is "this cannot start yet".
 *  - PROJECTED WEEK propagates that fact forward as a lower bound. It does NOT
 *    guess how late the predecessor will be — we do not know that. An
 *    incomplete milestone whose week has passed cannot complete before the
 *    current week; that is the only evidence used, and a successor with room
 *    in the plan absorbs the delay rather than inheriting it. Anything
 *    stronger is a fabricated date on a plan the aannemer staffs against.
 *
 * A predecessor whose week has NOT yet passed blocks nothing: it still has its
 * week to finish in, and warning early would train the aannemer to ignore this.
 *
 * Completion comes only from `completed`. Deriving it from `jobIds` all being
 * done would make a milestone with no jobs auto-complete — an empty set scored
 * as a good outcome — and here that would silently unblock the whole chain.
 */
export function sequenceMilestones(args: {
  project: Project;
  today?: Date;
}): SequencedMilestone[] {
  const { project } = args;
  const today = args.today ?? new Date();
  const milestones = project.milestones ?? [];
  if (!milestones.length) return [];

  const byId = new Map(milestones.map((m) => [m.id, m]));
  const cycled = milestonesInCycle(milestones);
  const currentWeek = currentProjectWeek(project, today);

  const plannedWeek = (m: ProjectMilestone) => Math.max(1, m.weekNumber ?? 1);

  /** Predecessors that actually count: known id, and not neutralised by a cycle. */
  const effectiveDeps = (m: ProjectMilestone): ProjectMilestone[] => {
    if (cycled.has(m.id)) return [];
    return (m.dependsOn ?? [])
      .map((id) => byId.get(id))
      .filter((p): p is ProjectMilestone => !!p && p.id !== m.id && !cycled.has(p.id));
  };

  const projectedCache = new Map<string, number>();
  const resolving = new Set<string>();

  const projectedFor = (m: ProjectMilestone): number => {
    const cached = projectedCache.get(m.id);
    if (cached !== undefined) return cached;
    // Cycles are already neutralised above; this guard only protects against a
    // shape that slipped past it, and claims the plan rather than looping.
    if (resolving.has(m.id)) return plannedWeek(m);
    resolving.add(m.id);

    const planned = plannedWeek(m);
    let projected = planned;

    // A completed milestone is history — it makes no claim about the future,
    // and letting a late predecessor push a finished milestone forward would
    // report a slip on work that is already done.
    if (!m.completed) {
      // Its own week has passed and it is not done, so it cannot now complete
      // before the current week. This is the ONLY evidence of lateness in the
      // file; everything below propagates it, nothing invents more.
      if (currentWeek !== null && planned < currentWeek) projected = currentWeek;

      for (const p of effectiveDeps(m)) {
        // Carrying the plan's FULL interval forward would convert float into
        // slip: a week-8 milestone would be reported late because a week-1
        // predecessor ran one week over, which asserts the whole seven-week
        // gap is serial work. The plan never said that, and this is not a
        // Gantt engine — there are no durations to say it with.
        //
        // So the claim is only the lower bound: a successor cannot complete in
        // the same week as its predecessor unless the plan itself put them in
        // the same week (concurrent trades). One week is the smallest non-zero
        // unit at this grain.
        const gap = Math.min(Math.max(0, planned - plannedWeek(p)), 1);
        projected = Math.max(projected, projectedFor(p) + gap);
      }
    }

    resolving.delete(m.id);
    projectedCache.set(m.id, projected);
    return projected;
  };

  return milestones.map((m) => {
    const deps = effectiveDeps(m);
    const blockedBy = m.completed
      ? []
      : deps
          .filter((p) => !p.completed && currentWeek !== null && plannedWeek(p) < currentWeek)
          .sort((a, b) => plannedWeek(a) - plannedWeek(b));
    const projectedWeek = projectedFor(m);
    return {
      milestone: m,
      blockedBy,
      projectedWeek,
      slipWeeks: Math.max(0, projectedWeek - plannedWeek(m)),
      inCycle: cycled.has(m.id),
    };
  });
}

/** Sequencing keyed by milestone id, for screens that render one row at a time. */
export function sequenceByMilestoneId(args: {
  project: Project;
  today?: Date;
}): Map<string, SequencedMilestone> {
  return new Map(sequenceMilestones(args).map((s) => [s.milestone.id, s]));
}

/**
 * The project's projected finish, in project-weeks, and whether it has moved.
 *
 * Reads the LAST milestone by projected week rather than by plan, because a
 * slipped middle milestone can overtake the one the plan put last.
 */
export function projectSlip(args: { project: Project; today?: Date }): {
  plannedEndWeek: number;
  projectedEndWeek: number;
  slipWeeks: number;
} | null {
  const seq = sequenceMilestones(args);
  if (!seq.length) return null;
  const open = seq.filter((s) => !s.milestone.completed);
  if (!open.length) return null;
  const plannedEndWeek = Math.max(...open.map((s) => Math.max(1, s.milestone.weekNumber ?? 1)));
  const projectedEndWeek = Math.max(...open.map((s) => s.projectedWeek));
  return {
    plannedEndWeek,
    projectedEndWeek,
    slipWeeks: Math.max(0, projectedEndWeek - plannedEndWeek),
  };
}

/**
 * Default `dependsOn` for a milestone being added: the latest milestone planned
 * strictly before it.
 *
 * A renovation is a chain far more often than it is a graph, so defaulting the
 * link means the aannemer only edits the exceptions instead of drawing the
 * whole sequence by hand. Strictly-before matters: two milestones in the same
 * week are concurrent trades, and chaining them would invent a handover the
 * plan does not claim.
 */
export function defaultDependsOn(
  existing: ProjectMilestone[],
  weekNumber: number,
  selfId?: string,
): string[] {
  const earlier = existing
    .filter((m) => m.id !== selfId && Math.max(1, m.weekNumber ?? 1) < Math.max(1, weekNumber))
    .sort((a, b) => Math.max(1, a.weekNumber ?? 1) - Math.max(1, b.weekNumber ?? 1));
  const prev = earlier[earlier.length - 1];
  return prev ? [prev.id] : [];
}

/**
 * Every milestone `id` transitively depends on. Cycle-safe.
 *
 * Used by the picker to keep a cycle from being drawn in the first place: a
 * milestone that already sits behind this one cannot also come before it.
 * `sequenceMilestones` survives a cycle either way, but silently neutralising
 * the dependency the user just picked would look like the tap did nothing.
 */
export function transitivePredecessors(
  milestones: ProjectMilestone[],
  id: string,
): Set<string> {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const stack = [...(byId.get(id)?.dependsOn ?? [])];
  while (stack.length) {
    const next = stack.pop() as string;
    if (seen.has(next) || !byId.has(next)) continue;
    seen.add(next);
    stack.push(...(byId.get(next)?.dependsOn ?? []));
  }
  return seen;
}

/**
 * Drop a deleted milestone from every other milestone's `dependsOn`.
 *
 * `sequenceMilestones` already ignores unknown ids, so this is housekeeping
 * rather than correctness — but leaving dead ids in the stored array means the
 * next reader has to know that rule too, and a re-created id could silently
 * reconnect a chain the user broke on purpose.
 */
export function removeMilestoneFromChain(
  milestones: ProjectMilestone[],
  removedId: string,
): ProjectMilestone[] {
  return milestones
    .filter((m) => m.id !== removedId)
    .map((m) =>
      (m.dependsOn ?? []).includes(removedId)
        ? { ...m, dependsOn: (m.dependsOn ?? []).filter((id) => id !== removedId) }
        : m,
    );
}
