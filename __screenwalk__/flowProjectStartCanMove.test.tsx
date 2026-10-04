/**
 * The aannemer can move a project's start.
 *
 * The create form stamps today and nothing in the app could change it, so a
 * project planned six weeks ahead reported its week-1 trades late after one
 * week (open since the templates work — learnings #139 gave the plan its
 * anchor, no screen ever let anyone move it). Fires the real handlers: open
 * the start card, six weeks later, save — the card and the stored project
 * both carry the new Monday.
 *
 * ONE test per file (module-scoped AppState; FadeIn screen — see
 * flowPromisedHandover.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { localDateKey, parseLocalDateKey } from '../src/utils/dateKey';
import { shiftedProjectStart } from '../src/services/projectSequenceService';
import { formatDateShort } from '../src/i18n/formatting';

const TODAY = localDateKey(new Date());
const NOW = new Date().toISOString();

const PROJECT = {
  id: 'proj-1', title: 'Badkamer renovatie', customerId: 'c1', customerName: 'Fam. Jansen',
  status: 'planning', startDate: TODAY, totalBudget: 20000, totalQuoted: 0,
  totalInvoiced: 0, totalPaid: 0, jobIds: [], quoteIds: [], invoiceIds: [],
  subcontractorIds: [], billingTerms: [], retentionPercent: 0, changeOrders: [],
  milestones: [
    { id: 'm1', title: 'Sloopwerk', trade: 'demolition', weekNumber: 1, completed: false, jobIds: [], dependsOn: [] },
  ],
  createdAt: NOW, updatedAt: NOW,
};

const textOf = (tree: any, id: string): string => {
  const n = tree.root.findAll((x: any) => x.props?.testID === id, { deep: true })[0];
  const c = n?.props?.children;
  return Array.isArray(c) ? c.join('') : String(c ?? '');
};

const press = async (tree: any, id: string) => {
  const target = tree.root.findAll((n: any) => n.props?.testID === id && typeof n.props?.onPress === 'function', { deep: true })[0];
  expect(target).toBeDefined();
  await act(async () => { target.props.onPress(); });
};

const ProjectDetail = () => require('../app/contractor/projects/[id]').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('project start', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('moves by week, saves, and the card shows the new Monday', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_projects', JSON.stringify([PROJECT]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));

    const r = await walkScreen(ProjectDetail(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    expect(r.error).toBeNull();
    const tree = r.tree as any;
    const label = (key: string) => formatDateShort(parseLocalDateKey(key) as Date, 'NL' as any);

    const thisMonday = shiftedProjectStart(TODAY, 0, new Date());
    expect(textOf(tree, 'project-start-value')).toContain(label(thisMonday));

    await press(tree, 'project-start');
    for (let i = 0; i < 6; i++) await press(tree, 'project-start-later');
    const target = shiftedProjectStart(TODAY, 6, new Date());
    expect(textOf(tree, 'project-start-picked')).toContain(label(target));
    await press(tree, 'project-start-save');

    // The card now reads the new week...
    expect(textOf(tree, 'project-start-value')).toContain(label(target));
    // ...and it is the project's stored start, not screen state.
    await act(async () => { await new Promise((res) => setTimeout(res, 50)); });
    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_projects')) ?? '[]');
    expect(stored.find((p: any) => p.id === 'proj-1')?.startDate).toBe(target);
    teardown(r);
  });
});
