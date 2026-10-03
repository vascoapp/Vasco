/**
 * A project is ONE customer's (aannemer walk, 2026-10-03):
 * - its "add job" menu offers that customer's jobs (and jobs with no customer
 *   on record) — another customer's job landed in this project's P&L;
 * - its billing line states the contract in cents, as the billing screen does
 *   ("€ 0 van € 15.251" here, "€ 0,00 van € 15.250,50" one tap later).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const NOW = new Date().toISOString();
const PROJECT = {
  id: 'proj-1', title: 'Zolder isolatie', customerId: 'c1', customerName: 'Fam. de Vries',
  status: 'planning', startDate: NOW, totalBudget: 15250.5, totalQuoted: 15250.5,
  totalInvoiced: 0, totalPaid: 0, jobIds: [], quoteIds: [], invoiceIds: [],
  subcontractorIds: [], milestones: [], billingTerms: [], retentionPercent: 0,
  changeOrders: [], createdAt: NOW, updatedAt: NOW,
};
const job = (id: string, title: string, customerId?: string) => ({
  id, title, customerId, customer: title, status: 'scheduled', priority: 'normal', createdAt: NOW, scheduledDate: NOW.slice(0, 10),
});

const ProjectDetail = () => require('../app/contractor/projects/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('a project is one customer\'s', () => {
  it("offers only that customer's jobs, and states the contract in cents", async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_projects', JSON.stringify([PROJECT]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. de Vries' }, { id: 'c2', name: 'Bakkerij Smit' }]));
    await AsyncStorage.setItem('@vasco_jobs', JSON.stringify([
      job('j-own', 'CV-ketel onderhoud — Fam. de Vries', 'c1'),
      job('j-other', 'Lekkage reparatie — Bakkerij Smit', 'c2'),
      job('j-none', 'Losse klus'),
    ]));
    const r = await walkScreen(ProjectDetail(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;

    const menus = root.findAll((n: any) => Array.isArray(n.props?.items) && n.props.items.some((i: any) => i.key === 'j-own'), { deep: true });
    expect(menus.length).toBeGreaterThan(0);
    const keys = menus[0].props.items.map((i: any) => i.key).sort();
    expect(keys).toEqual(['j-none', 'j-own']);

    const texts = root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children as string);
    expect(texts.some((s: string) => s.includes('15.250,50'))).toBe(true);
    teardown(r);
  });
});
