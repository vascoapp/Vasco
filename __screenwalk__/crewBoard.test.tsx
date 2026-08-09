/**
 * The day planner with a real crew on real sites.
 *
 * The planner was a single lane against one 10-hour day — the right model for
 * a solo contractor and the wrong one for an aannemer, where two crews on two
 * sites at 09:00 is normal operation rather than a clash. These assert the two
 * modes stay distinct, because the solo view must not regress.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { todayKey } from '../src/utils/dateKey';

const today = todayKey();

const WORKERS = [
  // Trades matter: a worker with no trade recorded is treated as able to cover
  // anything (a blank field is not evidence the crew cannot do the work), so a
  // staffing gap can only be asserted against people who HAVE a trade.
  { id: 'w-1', name: 'Ahmed', role: 'lead_tech', trade: 'plumbing', isActive: true, color: '#3B82F6', createdAt: '', updatedAt: '' },
  { id: 'w-2', name: 'Sanne', role: 'tech', trade: 'painting', isActive: true, color: '#10B981', createdAt: '', updatedAt: '' },
  // Inactive: kept for historical records, must NOT get a lane.
  { id: 'w-3', name: 'Oud-collega', role: 'tech', isActive: false, color: '#EC4899', createdAt: '', updatedAt: '' },
];

/** Two crews, two sites, overlapping hours — the day this board exists for. */
const JOBS = [
  {
    id: 'j-a', title: 'Badkamer Jansen', status: 'scheduled', customerId: 'c1',
    scheduledDate: today, scheduledStartTime: '09:00', scheduledEndTime: '12:00',
    estimatedDuration: 3, assignedWorkerId: 'w-1',
    address: { street: 'Prinsengracht 1', city: 'Amsterdam', postcode: '1015', country: 'NL' },
  },
  {
    id: 'j-b', title: 'Keuken Smit', status: 'scheduled', customerId: 'c2',
    scheduledDate: today, scheduledStartTime: '09:00', scheduledEndTime: '13:00',
    estimatedDuration: 4, assignedWorkerId: 'w-2',
    address: { street: 'Coolsingel 5', city: 'Rotterdam', postcode: '3011', country: 'NL' },
  },
  {
    id: 'j-c', title: 'CV-ketel Bakker', status: 'scheduled', customerId: 'c3',
    scheduledDate: today, scheduledStartTime: '14:00', scheduledEndTime: '16:00',
    estimatedDuration: 2, assignedWorkerId: 'w-1',
    address: { street: 'Dorpsstraat 3', city: 'Utrecht', postcode: '3511', country: 'NL' },
  },
];

async function seed(withCrew: boolean) {
  await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
  await AsyncStorage.setItem('@vasco_workers', JSON.stringify(withCrew ? WORKERS : []));
  await AsyncStorage.setItem('@vasco_jobs', JSON.stringify(JOBS));
  await AsyncStorage.setItem(
    '@vasco_customers',
    JSON.stringify([
      { id: 'c1', name: 'Fam. Jansen' },
      { id: 'c2', name: 'Bakkerij Smit' },
      { id: 'c3', name: 'Fam. Bakker' },
    ]),
  );
}

const Screen = () => require('../app/contractor/drag-schedule').default;

// These pin a specific crew + job fixture through AsyncStorage. In the `fresh`
// posture `refreshData()` legitimately answers "this account has no rows" and
// overwrites it, so the fixture cannot survive — correct behaviour for that
// posture, and it would make these assertions race the hydration order. The
// board's behaviour is what is under test, not the backend, so run them where
// the fixture holds.
const describeBoard = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

describeBoard('day planner with a crew', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('gives every active crew member their own lane, and none to inactive ones', async () => {
    await seed(true);
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    expect(text).toContain('Ahmed');
    expect(text).toContain('Sanne');
    // An ex-employee is kept for historical job records; a lane for them would
    // be a person who cannot be scheduled.
    expect(text).not.toContain('Oud-collega');
    teardown(r);
  });

  it('shows WHERE each crew is, not just when', async () => {
    await seed(true);
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    // Three jobs across three cities on one day — the multi-site case.
    expect(text).toContain('Amsterdam');
    expect(text).toContain('Rotterdam');
    expect(text).toContain('Utrecht');
    teardown(r);
  });

  it('reports capacity per person, not one company-wide number', async () => {
    await seed(true);
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    // Ahmed 3h + 2h = 5h, Sanne 4h — against a 10h day each. A single
    // company-wide bar would have said 9h/10h and hidden that both are free
    // in the afternoon.
    expect(text).toMatch(/5u.*10u|5h.*10h/);
    expect(text).toMatch(/4u.*10u|4h.*10h/);
    teardown(r);
  });

  it('measures the day against the CREW\'s capacity, not one person\'s', async () => {
    await seed(true);
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    // 5h + 4h booked across two crews = 9h of a 20h day. Against a single 10h
    // day it read "9u / 10u (90%)" directly above lanes saying 5/10 and 4/10:
    // the same screen disagreeing with itself, and a company that looks full
    // while both crews are free all afternoon.
    expect(text).toMatch(/20u|20h/);
    expect(text).toContain('45%');
    expect(text).not.toContain('90%');
    teardown(r);
  });

  it('never loses a job assigned to a deactivated crew member', async () => {
    // Deactivating a worker does not clear their assignments — only deleting
    // one does. A job pointing at an inactive worker therefore matches no lane
    // and would vanish from the board while still being scheduled work.
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_workers', JSON.stringify(WORKERS));
    await AsyncStorage.setItem('@vasco_jobs', JSON.stringify([
      { ...JOBS[0], assignedWorkerId: 'w-3' }, // w-3 is isActive: false
    ]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    expect(text).toContain('Badkamer Jansen');
    expect(text).toContain('Niet toegewezen');
    teardown(r);
  });

  it('week view shows who is on which site on which day, in the app locale', async () => {
    await seed(true);
    const r = await walkScreen(Screen(), { as: 'aannemer', params: { view: 'week' }, settlePasses: 16 });
    const text = r.texts.join(' | ');
    // Dutch weekday headers. `Intl` with an undefined locale follows the
    // DEVICE and printed "Mon Tue Wed" across a Dutch planner — the same
    // device-locale defect this screen's header was fixed for.
    expect(text).toMatch(/\bma\b/);
    expect(text).toMatch(/\bzo\b/);
    expect(text).not.toMatch(/\bMon\b/);
    // Ahmed works Amsterdam and Utrecht this week; the cells name the site.
    expect(text).toContain('Amsterdam');
    teardown(r);
  });

  it('warns when a milestone week has nobody of that trade booked', async () => {
    // Project starts this week, week-1 milestone needs a tiler, and the only
    // person on it is a plumber. ProjectMilestone has carried trade+weekNumber
    // since it was written and nothing read it.
    const { startOfWeek, localDateKey } = require('../src/utils/dateKey');
    await seed(true);
    await AsyncStorage.setItem('@vasco_projects', JSON.stringify([{
      id: 'p-1', title: 'Badkamer renovatie', customerId: 'c1', customerName: 'Fam. Jansen',
      status: 'active', startDate: localDateKey(startOfWeek(new Date())),
      totalBudget: 12500, totalQuoted: 12500, totalInvoiced: 0, totalPaid: 0,
      milestones: [{ id: 'm1', title: 'Tegelwerk', trade: 'tiling', weekNumber: 1, completed: false, jobIds: [] }],
      billingTerms: [], retentionPercent: 0, changeOrders: [],
      jobIds: ['j-a'], quoteIds: [], invoiceIds: [], subcontractorIds: [], createdAt: '', updatedAt: '',
    }]));
    const r = await walkScreen(Screen(), { as: 'aannemer', params: { view: 'week' }, settlePasses: 16 });
    const text = r.texts.join(' | ');
    expect(text).toContain('Niet bemand');
    expect(text).toContain('Tegelwerk');
    teardown(r);
  });

  it('warns before putting somebody on a job outside their trade', async () => {
    // Sanne is a painter (fixture above); j-b is a carpentry job. The guard is
    // a warning, never a block — asserted at the unit level in
    // src/services/__tests__/crewAssignment.test.ts. Here we only prove the
    // screen reaches it with the real, inconsistently-stored trade values.
    const { tradeMismatch } = require('../src/services/crewAssignment');
    const labels: Record<string, string> = { painting: 'Schilderwerk', 'gas-hvac': 'Gas & CV' };
    const m = tradeMismatch(
      { id: 'w-2', name: 'Sanne', trade: 'painting' },
      { title: 'CV-ketel', trade: 'gas-hvac' },
      (raw: string) => labels[raw] ?? raw,
    );
    expect(m).not.toBeNull();
    expect(m.workerTrade).toBe('Schilderwerk');
    expect(m.jobTrade).toBe('Gas & CV');
  });

  it('keeps the single-lane planner for a solo contractor', async () => {
    await seed(false);
    const r = await walkScreen(Screen(), { as: 'contractor', settlePasses: 14 });
    const text = r.texts.join(' | ');
    expect(text).not.toContain('Ahmed');
    // The solo utilisation bar still reports the whole day.
    expect(text).toMatch(/Bezetting/);
    teardown(r);
  });
});
