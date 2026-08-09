/**
 * A project's profit has to include the crew that built it.
 *
 * `getProjectPnL` summed `j.timeEntries` for labour — an array NOTHING writes.
 * Hours are recorded through `updateJob(jobId, { actualHours })`. So labour was
 * structurally 0, an aannemer's project profit was revenue − materials with
 * their team free of charge, and the margin next to it measured nothing they
 * could act on. The rate was also a flat 45 for everyone, ignoring
 * `Worker.hourlyCost`, which exists for exactly this.
 *
 * Renders the real project screen rather than calling the helper, because the
 * number the contractor reads is the thing under test.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const describeDemo = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

const WORKERS = [
  // 60/hour, well away from the 45 fallback so the assertion cannot pass by
  // accident if the worker rate is ignored.
  { id: 'w-1', name: 'Ahmed', role: 'lead_tech', isActive: true, hourlyCost: 60, createdAt: '', updatedAt: '' },
];

const JOBS = [
  {
    id: 'j-1', title: 'Badkamer sloop', status: 'completed', customerId: 'c1',
    projectId: 'p-1', assignedWorkerId: 'w-1',
    actualHours: 10, quotedAmount: 4000, agreedAmount: 4000,
    photos: [], notes: [], timeEntries: [], materials: [],
    createdAt: '', updatedAt: '', description: null, trade: 'general', priority: 'normal',
  },
];

const PROJECTS = [
  {
    id: 'p-1', title: 'Badkamer renovatie', customerId: 'c1', customerName: 'Fam. Jansen',
    status: 'active', totalBudget: 12500, totalQuoted: 12500, totalInvoiced: 0, totalPaid: 0,
    milestones: [], billingTerms: [], retentionPercent: 0, changeOrders: [],
    jobIds: ['j-1'], quoteIds: [], invoiceIds: [], subcontractorIds: [],
    createdAt: '', updatedAt: '',
  },
];

async function seed() {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
  await AsyncStorage.setItem('@vasco_workers', JSON.stringify(WORKERS));
  await AsyncStorage.setItem('@vasco_jobs', JSON.stringify(JOBS));
  await AsyncStorage.setItem('@vasco_projects', JSON.stringify(PROJECTS));
  await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));
}

describeDemo('project P&L labour', () => {
  it('charges the crew to the project, at the rate that person costs', async () => {
    await seed();
    (globalThis as any).__routeParams = { id: 'p-1' };
    const Screen = require('../app/contractor/projects/[id]').default;
    const r = await walkScreen(Screen, { params: { id: 'p-1' }, as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');

    // 10 hours at Ahmed's 60/hour = 600, not 0 and not the 45 fallback (450).
    expect(text).toMatch(/600/);
    expect(text).not.toMatch(/450/);
    teardown(r);
  });

  it('never reports a crew day as free', async () => {
    await seed();
    const Screen = require('../app/contractor/projects/[id]').default;
    const r = await walkScreen(Screen, { params: { id: 'p-1' }, as: 'aannemer', settlePasses: 14 });
    const text = r.texts.join(' | ');
    // The Arbeid row read "€ 0" for every project ever, which is what made the
    // margin beside it meaningless for anyone with a team.
    expect(text).toMatch(/Arbeid/);
    expect(text).not.toMatch(/Arbeid \| € 0 \|/);
    teardown(r);
  });
});
