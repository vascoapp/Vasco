/**
 * Verloning against the crew the aannemer actually has.
 *
 * The screen read `teamManagementService` — a demo-only singleton with no
 * persistence that nothing in the app ever adds a member to. So an aannemer
 * who had built a five-person crew in Team was told "no team members yet",
 * and in demo builds the export offered their bookkeeper a CSV of three
 * fabricated employees at fabricated rates.
 *
 * These assert the wiring (real `workers` + real `Job.timeEntries`) and the
 * two refusals to invent a number that `payrollService` is built around.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { todayKey } from '../src/utils/dateKey';

const today = todayKey();

const WORKERS = [
  { id: 'w-1', name: 'Ahmed', role: 'lead_tech', trade: 'plumbing', hourlyCost: 30, isActive: true, createdAt: '', updatedAt: '' },
  // No hourlyCost recorded — must show hours but never a fabricated cost.
  { id: 'w-2', name: 'Joris', role: 'apprentice', trade: 'plumbing', isActive: true, createdAt: '', updatedAt: '' },
];

const JOBS = [
  {
    id: 'j-a', title: 'Badkamer Jansen', status: 'in-progress', customerId: 'c1',
    scheduledDate: today, assignedWorkerId: 'w-1', estimatedDuration: 8,
    timeEntries: [
      { id: 'te-1', date: today, hours: 6, workerId: 'w-1' },
      { id: 'te-2', date: today, hours: 4, workerId: 'w-2' },
    ],
  },
  {
    id: 'j-b', title: 'Keuken Smit', status: 'in-progress', customerId: 'c2',
    scheduledDate: today, assignedWorkerId: 'w-1', estimatedDuration: 4,
    // No workerId: the contractor's own hours.
    timeEntries: [{ id: 'te-3', date: today, hours: 2 }],
  },
];

async function seed() {
  await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
  await AsyncStorage.setItem('@vasco_workers', JSON.stringify(WORKERS));
  await AsyncStorage.setItem('@vasco_jobs', JSON.stringify(JOBS));
  await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
    { id: 'c1', name: 'Fam. Jansen' }, { id: 'c2', name: 'Bakkerij Smit' },
  ]));
}

const Screen = () => require('../app/contractor/payroll').default;

// Same reasoning as crewBoard: the `fresh` posture correctly overwrites an
// AsyncStorage fixture when the backend answers "no rows", so pin these where
// the fixture holds. The screen's behaviour is under test, not the backend.
const describePayroll = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

describePayroll('Verloning reads the real crew', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('lists the crew who logged hours instead of "no team members yet"', async () => {
    await seed();
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    expect(text).toContain('Ahmed');
    expect(text).toContain('Joris');
    // The old copy asserted the aannemer had no crew at all.
    expect(text).not.toMatch(/nog geen teamleden|no team members/i);
    teardown(r);
  });

  it('never renders a fabricated employee from the demo singleton', async () => {
    await seed();
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    // These three were shipped as DEMO_TEAMMEMBERS with invented hourly rates.
    expect(text).not.toContain('Maria de Vries');
    expect(text).not.toContain('Anna Bakker');
    expect(text).not.toContain('Henk Jansen');
    teardown(r);
  });

  it('costs the priced worker and leaves the unpriced one blank, not zero', async () => {
    await seed();
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    // Ahmed 6h × €30 = €180. The total covers only priced people.
    expect(text).toMatch(/180/);
    // Joris has 4 logged hours and no rate: a "€ 0,00" line would read as an
    // employee who costs nothing, understating the wage bill.
    expect(text).not.toMatch(/Joris[^|]*€\s?0[.,]00/);
    teardown(r);
  });

  it('discloses that the total excludes people with no rate', async () => {
    await seed();
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    expect(text).toMatch(/zonder uurtarief|no hourly cost/i);
    teardown(r);
  });

  it('counts the contractor’s own unattributed hours as a line', async () => {
    await seed();
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    // 6 + 4 + 2 = 12 total hours across three lines.
    expect(text).toMatch(/12/);
    teardown(r);
  });
});
