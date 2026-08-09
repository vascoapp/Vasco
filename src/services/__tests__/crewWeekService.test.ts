/**
 * "Is week 3 staffed?" — the question a day planner cannot answer.
 *
 * ProjectMilestone has carried `trade` + `weekNumber` since it was written and
 * nothing read it, so a renovation plan could reach the week that needs a tiler
 * with no tiler booked and the app would say nothing.
 */
import {
  milestoneWeekStart,
  staffingGapsForWeek,
  crewWeekLoad,
  type CrewWeekJob,
  type CrewWeekWorker,
} from '../crewWeekService';
import { weekKeys, localDateKey } from '../../utils/dateKey';

// Monday 2026-08-03. Fixed, so the test does not drift with the calendar.
const PROJECT_START = '2026-08-03';
const week = (offset: number) => {
  const d = new Date(`${PROJECT_START}T12:00:00`);
  d.setDate(d.getDate() + offset * 7);
  return weekKeys(d);
};

const project = (milestones: any[]): any => ({
  id: 'p-1',
  title: 'Badkamer renovatie',
  status: 'active',
  startDate: PROJECT_START,
  milestones,
  jobIds: ['j-1'],
});

const WORKERS: CrewWeekWorker[] = [
  { id: 'w-plumb', name: 'Ahmed', trade: 'plumbing', isActive: true },
  { id: 'w-tile', name: 'Sanne', trade: 'tiling', isActive: true },
  { id: 'w-gone', name: 'Oud-collega', trade: 'tiling', isActive: false },
];

const job = (over: Partial<CrewWeekJob> = {}): CrewWeekJob => ({
  id: 'j-1',
  projectId: 'p-1',
  scheduledDate: week(0)[0],
  ...over,
});

describe('milestoneWeekStart', () => {
  it('counts weekNumber 1 as the project\'s own first week', () => {
    const p = project([{ id: 'm', title: 'Sloop', trade: 'general', weekNumber: 1, completed: false, jobIds: [] }]);
    expect(localDateKey(milestoneWeekStart(p, p.milestones[0])!)).toBe(week(0)[0]);
  });

  it('offsets later weeks from the start', () => {
    const p = project([{ id: 'm', title: 'Tegels', trade: 'tiling', weekNumber: 3, completed: false, jobIds: [] }]);
    expect(localDateKey(milestoneWeekStart(p, p.milestones[0])!)).toBe(week(2)[0]);
  });

  it('returns null without a start date rather than inventing an anchor', () => {
    const p = { ...project([{ id: 'm', title: 'x', trade: 'tiling', weekNumber: 2, completed: false, jobIds: [] }]), startDate: undefined };
    expect(milestoneWeekStart(p as any, p.milestones[0])).toBeNull();
  });
});

describe('staffingGapsForWeek', () => {
  const tileWeek3 = [{ id: 'm3', title: 'Tegelwerk', trade: 'tiling', weekNumber: 3, completed: false, jobIds: [] }];

  it('flags the week whose trade nobody is booked for', () => {
    const gaps = staffingGapsForWeek({
      projects: [project(tileWeek3)],
      jobs: [job({ scheduledDate: week(2)[1], assignedWorkerId: 'w-plumb' })], // a plumber, not a tiler
      workers: WORKERS,
      weekDayKeys: week(2),
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].trade).toBe('tiling');
    expect(gaps[0].nobodyOnProject).toBe(false);
  });

  it('is quiet when the right trade is on it', () => {
    const gaps = staffingGapsForWeek({
      projects: [project(tileWeek3)],
      jobs: [job({ scheduledDate: week(2)[1], assignedWorkerId: 'w-tile' })],
      workers: WORKERS,
      weekDayKeys: week(2),
    });
    expect(gaps).toHaveLength(0);
  });

  it('does not count a deactivated worker as cover', () => {
    const gaps = staffingGapsForWeek({
      projects: [project(tileWeek3)],
      jobs: [job({ scheduledDate: week(2)[1], assignedWorkerId: 'w-gone' })],
      workers: WORKERS,
      weekDayKeys: week(2),
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].nobodyOnProject).toBe(true);
  });

  it('only reports the week being looked at', () => {
    const args = { projects: [project(tileWeek3)], jobs: [], workers: WORKERS };
    expect(staffingGapsForWeek({ ...args, weekDayKeys: week(2) })).toHaveLength(1);
    expect(staffingGapsForWeek({ ...args, weekDayKeys: week(1) })).toHaveLength(0);
  });

  it('stays quiet on completed milestones and on plans that name no trade', () => {
    const done = [{ id: 'a', title: 'Tegels', trade: 'tiling', weekNumber: 3, completed: true, jobIds: [] }];
    const untraded = [{ id: 'b', title: 'Oplevering', weekNumber: 3, completed: false, jobIds: [] }];
    const base = { jobs: [], workers: WORKERS, weekDayKeys: week(2) };
    expect(staffingGapsForWeek({ ...base, projects: [project(done)] })).toHaveLength(0);
    // No trade named = nothing to check. Warning anyway trains people to
    // ignore the strip.
    expect(staffingGapsForWeek({ ...base, projects: [project(untraded as any)] })).toHaveLength(0);
  });

  it('treats a worker with no trade recorded as able to cover', () => {
    const gaps = staffingGapsForWeek({
      projects: [project(tileWeek3)],
      jobs: [job({ scheduledDate: week(2)[1], assignedWorkerId: 'w-any' })],
      workers: [...WORKERS, { id: 'w-any', name: 'Nieuw', isActive: true }],
      weekDayKeys: week(2),
    });
    // A blank field is not evidence the crew cannot do the work.
    expect(gaps).toHaveLength(0);
  });

  it('ignores finished projects', () => {
    const p = { ...project(tileWeek3), status: 'completed' };
    expect(staffingGapsForWeek({ projects: [p as any], jobs: [], workers: WORKERS, weekDayKeys: week(2) })).toHaveLength(0);
  });
});

describe('crewWeekLoad', () => {
  it('counts days, hours and distinct sites per person', () => {
    const load = crewWeekLoad({
      jobs: [
        job({ id: 'a', scheduledDate: week(0)[0], assignedWorkerId: 'w-plumb', address: { city: 'Amsterdam' } }),
        job({ id: 'b', scheduledDate: week(0)[1], assignedWorkerId: 'w-plumb', address: { city: 'Utrecht' } }),
        job({ id: 'c', scheduledDate: week(0)[1], assignedWorkerId: 'w-plumb', address: { city: 'Utrecht' } }),
      ],
      weekDayKeys: week(0),
      hoursFor: () => 4,
    });
    const row = load.get('w-plumb')!;
    expect(row.days.size).toBe(2);     // two calendar days, three jobs
    expect(row.hours).toBe(12);
    expect(row.sites.size).toBe(2);    // Utrecht counted once
  });
});

/**
 * The gap underneath all of the above: until the milestone editor shipped,
 * `projects.tsx` created every project with `milestones: []` and nothing in the
 * app could add one. Every assertion in this file constructs its milestones
 * directly, which is correct for a unit test and proves nothing about whether
 * such a row could exist — so the whole feature passed its tests while being
 * unreachable for every user. This pins the boundary explicitly.
 */
describe('an empty milestone list — what every project used to have', () => {
  it('reports no staffing gap, because there is no plan to check against', () => {
    const gaps = staffingGapsForWeek({
      projects: [project([])],
      jobs: [],
      workers: WORKERS,
      weekDayKeys: week(0),
    });
    expect(gaps).toEqual([]);
  });

  it('reports a gap as soon as one milestone is planned', () => {
    const gaps = staffingGapsForWeek({
      projects: [project([
        { id: 'ms-1', title: 'Tegelwerk', trade: 'tiling', weekNumber: 1, completed: false, jobIds: [] },
      ])],
      jobs: [],
      workers: WORKERS,
      weekDayKeys: week(0),
    });
    expect(gaps).toHaveLength(1);
    expect(gaps[0].trade).toBe('tiling');
  });
});
