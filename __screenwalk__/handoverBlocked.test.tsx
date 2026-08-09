/**
 * A blocked handover reads differently from an unstaffed week — on the screen,
 * not just in the service.
 *
 * The week view's staffing strip said "nobody of that trade is booked", which
 * tells the aannemer to book someone. When the predecessor trade is not
 * finished, booking someone would not help: the room is not ready. Those are
 * opposite instructions and the strip asserted the first over both, so the
 * blocked case is now its own card with its own heading (#127 — extending a
 * screen to a new dimension leaves every aggregate measuring the old one).
 *
 * Walked in Dutch, because Dutch is the data here and not chrome.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

// Project week 1 started three weeks ago, so a week-1 milestone is overdue and
// a week-3 milestone is due now. Anchored to the run date rather than a fixed
// calendar date, because the screen reads the real clock.
const weeksAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString();
};

const PROJECTS = [
  {
    id: 'proj-1', title: 'Badkamer renovatie', customerId: 'c1', status: 'active',
    startDate: weeksAgo(2), targetEndDate: new Date().toISOString(),
    totalBudget: 20000, jobIds: [], quoteIds: [], invoiceIds: [], subcontractorIds: [],
    milestones: [
      // Overdue: due week 1, we are in week 3, not ticked off.
      { id: 'ms-loodgieter', title: 'Leidingwerk klaar', trade: 'plumbing', weekNumber: 1, completed: false, jobIds: [] },
      // Due now, and waiting on the one above.
      { id: 'ms-tegels', title: 'Tegelwerk klaar', trade: 'tiling', weekNumber: 3, completed: false, jobIds: [], dependsOn: ['ms-loodgieter'] },
    ],
    billingTerms: [], retentionPercent: 0, changeOrders: [],
    createdAt: weeksAgo(3), updatedAt: new Date().toISOString(),
  },
];

async function seed() {
  await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
  await AsyncStorage.setItem('@vasco_projects', JSON.stringify(PROJECTS));
  await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));
}

const ProjectDetail = () => require('../app/contractor/projects/[id]').default;

const describeBlocked = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

describeBlocked('a blocked handover says so', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('names what the milestone is waiting on, on project detail', async () => {
    await seed();
    const r = await walkScreen(ProjectDetail(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    const text = r.texts.join(' | ');
    // "Wacht op Leidingwerk klaar" — the predecessor is named. A bare "blocked"
    // would leave the aannemer to work out which trade to chase.
    expect(text).toMatch(/wacht op/i);
    expect(text).toMatch(/Leidingwerk klaar/);
    teardown(r);
  });

  it('shows the plan and the forecast together, not one replacing the other', async () => {
    await seed();
    const r = await walkScreen(ProjectDetail(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    const text = r.texts.join(' | ');
    // A slip is only visible as the distance between planned and projected, so
    // both weeks have to be on screen. Overwriting weekNumber would erase it.
    expect(text).toMatch(/week 3/i);
    expect(text).toMatch(/→ week/i);
    teardown(r);
  });

  it('does not claim a handover failure before the predecessor is actually late', async () => {
    // Same chain, but the project started this week: nothing is overdue yet, so
    // there is no blocked claim to make. Warning early trains people to ignore it.
    const onTime = [{ ...PROJECTS[0], startDate: new Date().toISOString() }];
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_projects', JSON.stringify(onTime));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));
    const r = await walkScreen(ProjectDetail(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    const text = r.texts.join(' | ');
    expect(text).not.toMatch(/wacht op/i);
    expect(text).not.toMatch(/→ week/i);
    teardown(r);
  });
});
