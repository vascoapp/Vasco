/**
 * The promised-handover picker opens on a project with no promise yet.
 *
 * The 2026-08-10 sim walk confirmed every new surface RENDERS, but that session
 * had no computer-use and System Events clicks failed (-25204) — nothing could
 * be tapped or scrolled. These fire the real handlers through the walk harness.
 * Not a substitute for a thumb (they cannot see layout or truncation), but they
 * prove the wiring behind a control, which is where every defect this session
 * actually lived.
 *
 * ONE test per file: the harness keeps a module-scoped AppState, so a second
 * walk in the same file inherits the first one's hydrated store and renders
 * "Project niet gevonden". Every existing __screenwalk__ file is single-test
 * for the same reason.
 */
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const NOW = new Date().toISOString();

const PROJECT = {
  id: 'proj-1', title: 'Badkamer renovatie', customerId: 'c1', customerName: 'Fam. Jansen',
  status: 'active', startDate: NOW, totalBudget: 20000, totalQuoted: 20000,
  totalInvoiced: 0, totalPaid: 0, jobIds: [], quoteIds: [], invoiceIds: [],
  subcontractorIds: [], milestones: [], billingTerms: [], retentionPercent: 0,
  changeOrders: [], createdAt: NOW, updatedAt: NOW,
};

async function seed(over: Record<string, unknown> = {}) {
  await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
  await AsyncStorage.setItem('@vasco_projects', JSON.stringify([{ ...PROJECT, ...over }]));
  await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. Jansen' }]));
}

/** Every node carrying an accessibilityLabel matching `re`, with an onPress. */
function pressables(tree: any, re: RegExp) {
  return tree.root.findAll(
    (n: any) =>
      typeof n.props?.accessibilityLabel === 'string' &&
      re.test(n.props.accessibilityLabel) &&
      typeof n.props?.onPress === 'function',
    { deep: true },
  );
}

const ProjectDetail = () => require('../app/contractor/projects/[id]').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('interactive flow', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('the promised-handover picker opens and offers a week to commit to', async () => {
    // targetEndDate is unset, so the card must still be reachable — that was
    // the whole point of rendering it before a promise exists.
    await seed({ milestones: [
      { id: 'm1', title: 'Sloopwerk', trade: 'demolition', weekNumber: 1, completed: false, jobIds: [], dependsOn: [] },
      { id: 'm2', title: 'Oplevering', weekNumber: 3, completed: false, jobIds: [], dependsOn: ['m1'] },
    ] });
    const r = await walkScreen(ProjectDetail(), { as: 'aannemer', settlePasses: 14, params: { id: 'proj-1' } });
    expect(r.error).toBeNull();
    expect(r.texts.join(' | ')).toMatch(/Verwachte oplevering/);

    const card = pressables(r.tree, /Opleverdatum vastleggen|Set promised handover/);
    expect(card.length).toBeGreaterThan(0);
    await act(async () => { card[0].props.onPress(); });

    const after = (r.tree as any).root.findAll(
      (n: any) => typeof n.props?.children === 'string', { deep: true },
    ).map((n: any) => n.props.children).join(' | ');
    // The stepper is showing a concrete week, not a blank picker.
    expect(after).toMatch(/week van/i);
    teardown(r);
  });
});
