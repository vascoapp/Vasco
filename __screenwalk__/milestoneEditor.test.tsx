/**
 * Milestones can be created, and the staffing strip that reads them can fire.
 *
 * Every project was created with `milestones: []`, project detail rendered the
 * list read-only, and addMilestone/updateMilestone/setMilestones had zero call
 * sites anywhere. So `trade` / `weekNumber` / `completed` were empty for every
 * project that had ever existed, and the week-view staffing-gap strip shipped
 * in 7ad78bc read a list that was always empty — 11 passing tests over a
 * feature that could never fire for a single user.
 *
 * These assert the editor is reachable and that a milestone with a trade
 * reaches the service that was waiting for one.
 */
// The service half of this gap (a planned milestone actually reaching the
// staffing check) lives in `src/services/__tests__/crewWeekService.test.ts`
// with the rest of that service. Keeping pure assertions out of this file
// matters: they finish instantly, and the process then tears down while
// FadeIn's mount timer is still pending, which crashes the worker.
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';


const PROJECTS = [
  {
    id: 'proj-1', title: 'Badkamer renovatie', customerId: 'c1', status: 'active',
    startDate: new Date().toISOString(), targetEndDate: new Date().toISOString(),
    totalBudget: 20000, jobIds: [], quoteIds: [], invoiceIds: [], subcontractorIds: [],
    milestones: [], billingTerms: [], retentionPercent: 0, changeOrders: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

async function seed() {
  await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
  await AsyncStorage.setItem('@vasco_projects', JSON.stringify(PROJECTS));
  await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));
}

const Screen = () => require('../app/contractor/projects/[id]').default;

const describeEditor = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

describeEditor('project milestones can be planned', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('offers a way to create the first milestone instead of only saying there are none', async () => {
    await seed();
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    const text = r.texts.join(' | ');
    // Previously the empty state was a dead end: a sentence and nothing else.
    expect(text).toMatch(/volgorde van de vakken|trade sequence/i);
    teardown(r);
  });
});
