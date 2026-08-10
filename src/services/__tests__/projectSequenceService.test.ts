/**
 * "Booking a tiler would not help — the plumber isn't finished."
 *
 * crewWeekService says week 3 has arrived with no tiler booked. This is the
 * step downstream: `weekNumber` is an absolute offset and nothing moves it, so
 * when the plumber runs over, the board keeps asserting a plan reality has
 * already left behind.
 *
 * Every case pins `today` explicitly. A test that reads the wall clock inherits
 * the calendar's schedule and goes red on its own (learnings #134).
 */
import {
  sequenceMilestones,
  sequenceByMilestoneId,
  currentProjectWeek,
  milestonesInCycle,
  projectSlip,
  defaultDependsOn,
  transitivePredecessors,
  candidatePredecessors,
  removeMilestoneFromChain,
  projectWeekStart,
  handoverOutlook,
} from '../projectSequenceService';
import type { ProjectMilestone } from '../../types/project';

// Monday. Week 1 = 2026-08-03, week 3 = 2026-08-17, week 5 = 2026-08-31.
const PROJECT_START = '2026-08-03';
const dayInWeek = (n: number) => {
  const d = new Date(`${PROJECT_START}T12:00:00`);
  d.setDate(d.getDate() + (n - 1) * 7);
  return d;
};

const ms = (over: Partial<ProjectMilestone> & { id: string }): ProjectMilestone => ({
  title: over.id,
  weekNumber: 1,
  completed: false,
  jobIds: [],
  ...over,
});

const project = (milestones: ProjectMilestone[], over: any = {}): any => ({
  id: 'p-1',
  title: 'Badkamer renovatie',
  status: 'active',
  startDate: PROJECT_START,
  jobIds: [],
  milestones,
  ...over,
});

/** sloop wk1 -> loodgieter wk2 -> tegelzetter wk3 */
const CHAIN = () => [
  ms({ id: 'sloop', trade: 'general', weekNumber: 1 }),
  ms({ id: 'loodgieter', trade: 'plumbing', weekNumber: 2, dependsOn: ['sloop'] }),
  ms({ id: 'tegels', trade: 'tiling', weekNumber: 3, dependsOn: ['loodgieter'] }),
];

const seqFor = (milestones: ProjectMilestone[], week: number) =>
  sequenceByMilestoneId({ project: project(milestones), today: dayInWeek(week) });

describe('currentProjectWeek', () => {
  it('counts the project\'s own first week as week 1', () => {
    expect(currentProjectWeek(project([]), dayInWeek(1))).toBe(1);
    expect(currentProjectWeek(project([]), dayInWeek(4))).toBe(4);
  });

  it('claims no week at all when the project has no start date', () => {
    // No anchor means no such thing as "its week has passed". Inventing one
    // from the render date would fabricate a deadline.
    expect(currentProjectWeek(project([], { startDate: undefined }), dayInWeek(3))).toBeNull();
  });
});

describe('blocking is a present-tense fact', () => {
  it('does not block on a completed predecessor', () => {
    const seq = seqFor(
      [ms({ id: 'sloop', weekNumber: 1, completed: true }), ms({ id: 'tegels', weekNumber: 3, dependsOn: ['sloop'] })],
      3,
    );
    expect(seq.get('tegels')!.blockedBy).toHaveLength(0);
    expect(seq.get('tegels')!.slipWeeks).toBe(0);
  });

  it('blocks when a predecessor is incomplete and its week has passed', () => {
    // Week 3: loodgieter was due week 2 and is not done.
    const seq = seqFor(CHAIN(), 3);
    expect(seq.get('tegels')!.blockedBy.map((m) => m.id)).toEqual(['loodgieter']);
  });

  it('does NOT block when the predecessor\'s week has not passed yet', () => {
    // Week 2: loodgieter is due THIS week. It still has the week to finish in,
    // and warning now would train the aannemer to ignore the strip.
    const seq = seqFor(CHAIN(), 2);
    expect(seq.get('tegels')!.blockedBy).toHaveLength(0);
  });

  it('never reports a completed milestone as blocked', () => {
    const seq = seqFor(
      [ms({ id: 'sloop', weekNumber: 1 }), ms({ id: 'tegels', weekNumber: 3, completed: true, dependsOn: ['sloop'] })],
      5,
    );
    expect(seq.get('tegels')!.blockedBy).toHaveLength(0);
    expect(seq.get('tegels')!.slipWeeks).toBe(0);
  });

  it('orders multiple blockers most-overdue first', () => {
    const seq = seqFor(
      [
        ms({ id: 'vroeg', weekNumber: 1 }),
        ms({ id: 'laat', weekNumber: 3 }),
        ms({ id: 'stuc', weekNumber: 5, dependsOn: ['laat', 'vroeg'] }),
      ],
      5,
    );
    expect(seq.get('stuc')!.blockedBy.map((m) => m.id)).toEqual(['vroeg', 'laat']);
  });
});

describe('slip propagates forward only, from real evidence', () => {
  it('propagates through a chain of three, carrying the plan\'s own lag', () => {
    // Week 4, nothing done. sloop was due wk1, so it cannot finish before wk4;
    // loodgieter kept its 1-week lag -> wk5; tegels -> wk6.
    const seq = seqFor(CHAIN(), 4);
    expect(seq.get('sloop')!.projectedWeek).toBe(4);
    expect(seq.get('loodgieter')!.projectedWeek).toBe(5);
    expect(seq.get('tegels')!.projectedWeek).toBe(6);
    expect(seq.get('tegels')!.slipWeeks).toBe(3);
  });

  it('claims no slip while the project is still on plan', () => {
    const seq = seqFor(CHAIN(), 1);
    for (const id of ['sloop', 'loodgieter', 'tegels']) {
      expect(seq.get(id)!.slipWeeks).toBe(0);
      expect(seq.get(id)!.projectedWeek).toBe(seq.get(id)!.milestone.weekNumber);
    }
  });

  it('does not push a successor whose own plan already clears the delay', () => {
    // sloop due wk1, late, now wk2. tegels is planned wk8 — a fortnight of
    // float. Reporting a slip here would cry wolf.
    const seq = seqFor([ms({ id: 'sloop', weekNumber: 1 }), ms({ id: 'tegels', weekNumber: 8, dependsOn: ['sloop'] })], 2);
    expect(seq.get('tegels')!.projectedWeek).toBe(8);
    expect(seq.get('tegels')!.slipWeeks).toBe(0);
  });

  it('reports a milestone late on its own account, with no dependencies at all', () => {
    // The single piece of evidence the whole file rests on: incomplete, and its
    // week has passed. Everything else propagates this; nothing invents more.
    const seq = seqFor([ms({ id: 'sloop', weekNumber: 2 })], 5);
    expect(seq.get('sloop')!.projectedWeek).toBe(5);
    expect(seq.get('sloop')!.slipWeeks).toBe(3);
    expect(seq.get('sloop')!.blockedBy).toHaveLength(0); // late is not blocked
  });

  it('never moves weekNumber itself — the plan survives to be compared against', () => {
    const milestones = CHAIN();
    const before = milestones.map((m) => m.weekNumber);
    const seq = sequenceMilestones({ project: project(milestones), today: dayInWeek(6) });
    expect(milestones.map((m) => m.weekNumber)).toEqual(before);
    expect(seq.every((s) => s.projectedWeek >= s.milestone.weekNumber)).toBe(true);
  });

  it('claims nothing when the project has no start date', () => {
    const seq = sequenceByMilestoneId({
      project: project(CHAIN(), { startDate: undefined }),
      today: dayInWeek(9),
    });
    expect(seq.get('tegels')!.blockedBy).toHaveLength(0);
    expect(seq.get('tegels')!.slipWeeks).toBe(0);
  });
});

describe('degenerate graphs claim nothing rather than crashing', () => {
  it('ignores an unknown / deleted predecessor id', () => {
    // A deleted predecessor must not block the project forever.
    const seq = seqFor([ms({ id: 'tegels', weekNumber: 3, dependsOn: ['weggegooid'] })], 3);
    expect(seq.get('tegels')!.blockedBy).toHaveLength(0);
    expect(seq.get('tegels')!.slipWeeks).toBe(0);
  });

  it('treats a cycle as no dependency instead of hanging', () => {
    const cyc = [
      ms({ id: 'a', weekNumber: 1, dependsOn: ['c'] }),
      ms({ id: 'b', weekNumber: 2, dependsOn: ['a'] }),
      ms({ id: 'c', weekNumber: 3, dependsOn: ['b'] }),
    ];
    expect(milestonesInCycle(cyc)).toEqual(new Set(['a', 'b', 'c']));
    const seq = seqFor(cyc, 6);
    for (const id of ['a', 'b', 'c']) {
      expect(seq.get(id)!.inCycle).toBe(true);
      expect(seq.get(id)!.blockedBy).toHaveLength(0);
      // Each is overdue on its own account, so each projects to the current
      // week — but the cycle must not stack a handover gap round and round.
      expect(seq.get(id)!.projectedWeek).toBe(6);
    }
  });

  it('neutralises only the cycle, leaving healthy milestones sequenced', () => {
    const mixed = [
      ms({ id: 'a', weekNumber: 1, dependsOn: ['b'] }),
      ms({ id: 'b', weekNumber: 2, dependsOn: ['a'] }),
      ms({ id: 'ok', weekNumber: 1 }),
      ms({ id: 'stuc', weekNumber: 4, dependsOn: ['ok'] }),
    ];
    const seq = seqFor(mixed, 4);
    expect(seq.get('a')!.inCycle).toBe(true);
    expect(seq.get('stuc')!.inCycle).toBe(false);
    expect(seq.get('stuc')!.blockedBy.map((m) => m.id)).toEqual(['ok']);
  });

  it('ignores a milestone that depends on itself', () => {
    const seq = seqFor([ms({ id: 'solo', weekNumber: 2, dependsOn: ['solo'] })], 6);
    expect(seq.get('solo')!.blockedBy).toHaveLength(0);
  });

  it('does not reverse a successor planned before its predecessor', () => {
    // A planning mistake. Treating the lag as 0 claims less than reversing it.
    const seq = seqFor([ms({ id: 'laat', weekNumber: 5 }), ms({ id: 'vroeg', weekNumber: 2, dependsOn: ['laat'] })], 6);
    expect(seq.get('vroeg')!.projectedWeek).toBe(6);
  });
});

describe('a milestone with no trade is still a predecessor', () => {
  it('blocks its successor even though it is not a staffing gap', () => {
    // crewWeekService ignores untraded milestones because the plan does not say
    // who is needed. Sequencing is a different rule: "vergunning afgegeven" is
    // a perfectly good predecessor. The two must not be conflated.
    const seq = seqFor(
      [ms({ id: 'vergunning', weekNumber: 1 }), ms({ id: 'sloop', trade: 'general', weekNumber: 3, dependsOn: ['vergunning'] })],
      4,
    );
    expect(seq.get('vergunning')!.milestone.trade).toBeUndefined();
    expect(seq.get('sloop')!.blockedBy.map((m) => m.id)).toEqual(['vergunning']);
  });
});

describe('projectSlip', () => {
  it('claims nothing for a project with no milestones', () => {
    expect(projectSlip({ project: project([]), today: dayInWeek(3) })).toBeNull();
  });

  it('claims nothing once every milestone is completed', () => {
    const done = CHAIN().map((m) => ({ ...m, completed: true }));
    expect(projectSlip({ project: project(done), today: dayInWeek(9) })).toBeNull();
  });

  it('reports the end date moving when the chain slips', () => {
    const slip = projectSlip({ project: project(CHAIN()), today: dayInWeek(4) })!;
    expect(slip.plannedEndWeek).toBe(3);
    expect(slip.projectedEndWeek).toBe(6);
    expect(slip.slipWeeks).toBe(3);
  });

  it('reads the last milestone by projection, not by plan', () => {
    // `laat` is planned last, but the slipped chain overtakes it.
    const overtaken = [...CHAIN(), ms({ id: 'laat', weekNumber: 5 })];
    const slip = projectSlip({ project: project(overtaken), today: dayInWeek(6) })!;
    expect(slip.projectedEndWeek).toBe(8);
  });
});

describe('defaultDependsOn', () => {
  it('links to the latest milestone planned strictly before it', () => {
    expect(defaultDependsOn(CHAIN(), 4)).toEqual(['tegels']);
    expect(defaultDependsOn(CHAIN(), 3)).toEqual(['loodgieter']);
  });

  it('links nothing for the first milestone in the plan', () => {
    expect(defaultDependsOn([], 1)).toEqual([]);
    expect(defaultDependsOn(CHAIN(), 1)).toEqual([]);
  });

  it('does not chain milestones in the same week — those are concurrent trades', () => {
    const sameWeek = [ms({ id: 'a', weekNumber: 2 }), ms({ id: 'b', weekNumber: 2 })];
    expect(defaultDependsOn(sameWeek, 2)).toEqual([]);
  });

  it('never links a milestone to itself when its week is edited', () => {
    expect(defaultDependsOn(CHAIN(), 3, 'tegels')).toEqual(['loodgieter']);
    expect(defaultDependsOn(CHAIN(), 2, 'loodgieter')).toEqual(['sloop']);
  });
});

describe('transitivePredecessors', () => {
  it('walks the whole chain behind a milestone', () => {
    expect(transitivePredecessors(CHAIN(), 'tegels')).toEqual(new Set(['loodgieter', 'sloop']));
    expect(transitivePredecessors(CHAIN(), 'sloop')).toEqual(new Set());
  });

  it('terminates on a cycle instead of hanging', () => {
    const cyc = [
      ms({ id: 'a', weekNumber: 1, dependsOn: ['c'] }),
      ms({ id: 'b', weekNumber: 2, dependsOn: ['a'] }),
      ms({ id: 'c', weekNumber: 3, dependsOn: ['b'] }),
    ];
    expect(transitivePredecessors(cyc, 'a')).toEqual(new Set(['a', 'b', 'c']));
  });

  it('ignores unknown ids', () => {
    expect(transitivePredecessors([ms({ id: 'x', dependsOn: ['weg'] })], 'x')).toEqual(new Set());
  });
});

describe('candidatePredecessors', () => {
  // This rule was written inline in the modal and inverted: it read the edited
  // milestone's OWN predecessors, which hid the dependencies it already had and
  // offered every one that closed a loop. 1704 tests were green through it,
  // because nothing could reach a list computed inside a component.
  it('offers the dependencies it already has, so they can be unticked', () => {
    expect(candidatePredecessors(CHAIN(), 'tegels').map(m => m.id)).toContain('loodgieter');
    expect(candidatePredecessors(CHAIN(), 'loodgieter').map(m => m.id)).toContain('sloop');
  });

  it('never offers a milestone that already depends on this one', () => {
    // tegels -> loodgieter -> sloop. Nothing behind sloop may precede it.
    expect(candidatePredecessors(CHAIN(), 'sloop').map(m => m.id)).toEqual([]);
    expect(candidatePredecessors(CHAIN(), 'loodgieter').map(m => m.id)).toEqual(['sloop']);
  });

  it('never offers the milestone itself', () => {
    expect(candidatePredecessors(CHAIN(), 'tegels').map(m => m.id)).not.toContain('tegels');
  });

  it('offers everything for a milestone that does not exist yet', () => {
    expect(candidatePredecessors(CHAIN(), undefined).map(m => m.id)).toEqual([
      'sloop', 'loodgieter', 'tegels',
    ]);
  });

  it('orders by the plan, so the sequence reads in order', () => {
    const jumbled = [ms({ id: 'c', weekNumber: 5 }), ms({ id: 'a', weekNumber: 1 }), ms({ id: 'b', weekNumber: 3 })];
    expect(candidatePredecessors(jumbled, undefined).map(m => m.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('removeMilestoneFromChain', () => {
  it('drops the milestone and every reference to it', () => {
    const next = removeMilestoneFromChain(CHAIN(), 'loodgieter');
    expect(next.map((m) => m.id)).toEqual(['sloop', 'tegels']);
    expect(next.find((m) => m.id === 'tegels')!.dependsOn).toEqual([]);
  });

  it('leaves unrelated milestones untouched by identity', () => {
    const chain = CHAIN();
    const next = removeMilestoneFromChain(chain, 'tegels');
    expect(next.find((m) => m.id === 'sloop')).toBe(chain[0]);
  });
});

describe('projectWeekStart', () => {
  it('puts week 1 on the project start week, not the week after', () => {
    expect(projectWeekStart(project(CHAIN()), 1)).toEqual(new Date(`${PROJECT_START}T00:00:00`));
  });

  it('advances a whole week per project-week', () => {
    expect(projectWeekStart(project(CHAIN()), 3)).toEqual(new Date('2026-08-17T00:00:00'));
  });

  it('has no answer without an anchor', () => {
    expect(projectWeekStart(project(CHAIN(), { startDate: undefined }), 3)).toBeNull();
  });

  it('treats week 0 and negatives as week 1 rather than reaching back before the start', () => {
    const wk1 = new Date(`${PROJECT_START}T00:00:00`);
    expect(projectWeekStart(project(CHAIN()), 0)).toEqual(wk1);
    expect(projectWeekStart(project(CHAIN()), -4)).toEqual(wk1);
  });
});

describe('promised vs projected handover', () => {
  // The plan is week-grained and the promise is a day, so the ONLY defensible
  // claim is a lower bound: the projected week must start AFTER the promised
  // date. A projection that merely lands in the same week is not evidence —
  // the work could still finish on either side of it (#137).
  const onPlan = (over: any = {}) => project(CHAIN(), over);

  it('says nothing without a plan or without an anchor', () => {
    expect(handoverOutlook({ project: project([]), today: dayInWeek(1) })).toBeNull();
    expect(handoverOutlook({ project: onPlan({ startDate: undefined }), today: dayInWeek(1) })).toBeNull();
  });

  it('projects the plan end week when nothing has slipped', () => {
    const out = handoverOutlook({ project: onPlan(), today: dayInWeek(1) })!;
    expect(out.plannedEndWeek).toBe(3);
    expect(out.projectedEndWeek).toBe(3);
    expect(out.slipWeeks).toBe(0);
    expect(out.projectedWeekStart).toEqual(new Date('2026-08-17T00:00:00'));
  });

  it('makes no claim when no handover was ever promised', () => {
    const out = handoverOutlook({ project: onPlan(), today: dayInWeek(1) })!;
    expect(out.promised).toBeNull();
    expect(out.missesPromise).toBe(false);
  });

  it('reads the promise as a LOCAL day, not UTC midnight', () => {
    // `new Date('2026-08-28')` is UTC midnight = 02:00 local in CEST. Comparing
    // that against a local Monday boundary is hours out, which is how a promise
    // lands on the wrong side of the line.
    const out = handoverOutlook({ project: onPlan({ targetEndDate: '2026-08-28' }), today: dayInWeek(1) })!;
    expect(out.promised).toEqual(new Date('2026-08-28T00:00:00'));
  });

  it('does NOT cry late when the projected week contains the promised date', () => {
    // Projected week 3 starts Mon 17 Aug. A promise of Wed 19 Aug sits inside
    // it: still makeable, so no claim.
    const out = handoverOutlook({ project: onPlan({ targetEndDate: '2026-08-19' }), today: dayInWeek(1) })!;
    expect(out.missesPromise).toBe(false);
  });

  it('does not cry late when the promise is the first day of the projected week', () => {
    // Boundary: promised Mon 17 Aug, projected week starts Mon 17 Aug. Equal is
    // not "after", and an off-by-one here reports every on-time project late.
    const out = handoverOutlook({ project: onPlan({ targetEndDate: '2026-08-17' }), today: dayInWeek(1) })!;
    expect(out.missesPromise).toBe(false);
  });

  it('cries late only once the whole projected week is past the promise', () => {
    // Promised Sun 16 Aug; the earliest the work can now finish is the week
    // beginning Mon 17 Aug. That is certain, so it is safe to say.
    const out = handoverOutlook({ project: onPlan({ targetEndDate: '2026-08-16' }), today: dayInWeek(1) })!;
    expect(out.missesPromise).toBe(true);
  });

  it('moves the projected week out when a predecessor is demonstrably late', () => {
    // Week 5 and sloop (wk1) is still open, so it cannot finish before week 5.
    // The chain then carries ONE week per handover (never the plan's full
    // interval — that would convert float into slip): sloop 5 -> loodgieter 6
    // -> tegels 7. Week 7 begins Mon 14 Sep, so a promise of 19 Aug is now
    // certainly missed.
    const out = handoverOutlook({ project: onPlan({ targetEndDate: '2026-08-19' }), today: dayInWeek(5) })!;
    expect(out.projectedEndWeek).toBe(7);
    expect(out.slipWeeks).toBe(4);
    expect(out.projectedWeekStart).toEqual(new Date('2026-09-14T00:00:00'));
    expect(out.missesPromise).toBe(true);
  });

  it('has nothing to project once every milestone is done', () => {
    const done = CHAIN().map(m => ({ ...m, completed: true }));
    expect(handoverOutlook({ project: project(done), today: dayInWeek(9) })).toBeNull();
  });
});
