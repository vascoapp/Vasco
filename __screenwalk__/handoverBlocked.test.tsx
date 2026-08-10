/**
 * A blocked handover reaches the screen, and names what it is waiting on.
 *
 * The week view's staffing strip said "nobody of that trade is booked", which
 * tells the aannemer to book someone. When the predecessor trade is not
 * finished, booking someone would not help: the room is not ready. Those are
 * opposite instructions, so the blocked case is now its own card with its own
 * heading (#127 — extending a screen to a new dimension leaves every aggregate
 * measuring the old one).
 *
 * ONE mount, deliberately. `projects/[id]` renders inside `FadeIn`, whose mount
 * timer is cleared on unmount but outlives a suite that ends before it fires —
 * with several mounts in one file the worker dies on teardown and reports it as
 * unrelated failures elsewhere. The same note is on `milestoneEditor.test.tsx`.
 *
 * The RULES (what blocks, when a slip is claimed, what a cycle does) belong to
 * `src/services/__tests__/projectSequenceService.test.ts` and are covered there
 * in 33 cases. This file asserts only that the screen shows what the service
 * says — which is the half a pure test cannot reach.
 *
 * Walked in Dutch, because Dutch is the data here and not chrome.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

// Project week 1 started two weeks ago, so the week-1 milestone is overdue and
// the week-3 one is due now. Anchored to the run date, not a fixed calendar
// date, because the screen reads the real clock.
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

const ProjectDetail = () => require('../app/contractor/projects/[id]').default;

const describeBlocked = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

describeBlocked('a blocked handover says so', () => {
  it('names the predecessor, and keeps the plan beside the forecast', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_projects', JSON.stringify(PROJECTS));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));

    const r = await walkScreen(ProjectDetail(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    const text = r.texts.join(' | ');

    // "Wacht op Leidingwerk klaar" — the predecessor is NAMED. A bare "blocked"
    // would leave the aannemer to work out which trade to go and chase.
    expect(text).toMatch(/wacht op/i);
    expect(text).toMatch(/Leidingwerk klaar/);

    // A slip is only visible as the distance between planned and projected, so
    // both weeks have to be on screen. Writing the forecast into weekNumber
    // would erase the very thing that makes the slip legible.
    expect(text).toMatch(/week 3/i);
    expect(text).toMatch(/→ week/i);

    teardown(r);
  });
});
