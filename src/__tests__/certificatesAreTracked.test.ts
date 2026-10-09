/**
 * Certificates, insurance and licences are TRACKED (decision 3a, 2026-10-09).
 * The compliance store was in-memory only and nothing could add an item, so
 * the expiry watch scanned an empty list and every "Add"/"Renew" was hidden.
 *
 * Real store, real expiry agent, real queue — only the account and auth are
 * faked.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockRows: Array<{ user_id: string; kind: string; item_id: string; data: any; updated_at: string }> = [];
let mockUid: string | null = 'user-a';

jest.mock('../lib/currentUser', () => ({
  ...jest.requireActual('../lib/currentUser'),
  getAuthedUserId: () => mockUid,
  getCurrentUserId: () => mockUid,
  // Subscribed during IMPORT (before any const here exists): kept on globalThis.
  subscribeUserChange: (cb: (u: string | null) => void) => {
    ((globalThis as any).__mockUserChange ??= []).push(cb);
    return () => {};
  },
}));
const mockUserChange = (): Array<(u: string | null) => void> => (globalThis as any).__mockUserChange ?? [];
jest.mock('../services/offlineWriteQueue', () => ({
  persistOrQueue: async (_t: string, _op: string, run: () => Promise<void>) => { await run(); },
}));
jest.mock('../lib/supabase', () => {
  const from = () => {
    const filters: Record<string, string> = {};
    const q: any = {
      select: () => q,
      eq: (c: string, v: string) => { filters[c] = v; return q; },
      then: (res: any, rej: any) =>
        Promise.resolve({ data: mockRows.filter((r) => r.user_id === filters.user_id && r.kind === filters.kind), error: null }).then(res, rej),
      upsert: async (row: any) => {
        const i = mockRows.findIndex((r) => r.user_id === row.user_id && r.kind === row.kind && r.item_id === row.item_id);
        if (i >= 0) mockRows[i] = row; else mockRows.push(row);
        return { error: null };
      },
    };
    return q;
  };
  return { supabase: { from }, isSupabaseConfigured: true };
});

import { parseTypedDay, endOfLocalDay } from '../utils/typedDate';
import { expiryStatus } from '../services/complianceService';

const DAY = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * DAY);
const settle = () => new Promise((r) => setImmediate(r));

/** A fresh app start: new module instances over the same (faked) account. */
function freshApp() {
  let mods: any;
  jest.isolateModules(() => {
    mods = {
      store: require('../services/complianceService').complianceService,
      agent: require('../services/complianceAgentService'),
      queue: require('../services/aiActionQueueService'),
    };
  });
  return mods as { store: any; agent: any; queue: any };
}

const pendingRenewals = async (queue: any) =>
  (await queue.getQueue()).filter((q: any) => q.type === 'cert_renewal' && q.status === 'pending');

beforeEach(async () => { mockRows.length = 0; mockUid = 'user-a'; await AsyncStorage.clear(); });

describe('a typed expiry date', () => {
  it('is read day first, with any market’s separator', () => {
    for (const v of ['31-12-2027', '31.12.2027', '31/12/2027', '2027-12-31']) {
      expect(parseTypedDay(v)).toEqual({ year: 2027, month: 12, day: 31 });
    }
  });
  it('a day that does not exist, or a two-digit year, is refused — not guessed', () => {
    for (const v of ['31-02-2027', '00-01-2027', '12-13-2027', '31-12-27', 'soon']) expect(parseTypedDay(v)).toBeNull();
  });
  it('valid until the 31st includes the 31st', () => {
    const end = endOfLocalDay({ year: 2027, month: 12, day: 31 });
    expect(expiryStatus(end, new Date(2027, 11, 31, 18, 0))).toBe('expiring_soon');
    expect(expiryStatus(end, new Date(2028, 0, 1, 0, 1))).toBe('expired');
  });
});

describe('the store', () => {
  it('status follows the date, not what was stored', async () => {
    const { store } = freshApp();
    await store.load();
    store.saveTrackedItem({ type: 'certification', name: 'Gas Safe', expiryDate: inDays(-1) });
    store.saveTrackedItem({ type: 'insurance', name: 'Van', expiryDate: inDays(10) });
    store.saveTrackedItem({ type: 'license', name: 'Waste carrier', expiryDate: inDays(200) });
    expect(store.getCertifications()[0].status).toBe('expired');
    expect(store.getInsurancePolicies()[0].status).toBe('expiring_soon');
    expect(store.getLicenses()[0].status).toBe('valid');
  });

  it('what is added survives a restart AND a logout (new phone): it lives in the account', async () => {
    const a = freshApp();
    await a.store.load();
    const { id } = a.store.saveTrackedItem({ type: 'insurance', name: 'Public liability', issuer: 'Hiscox', number: 'PL-1', expiryDate: inDays(90) });
    await settle();
    // In the account at once — not only when this phone next loads (it may never).
    expect(mockRows.filter((r) => r.kind === 'compliance_item').map((r) => r.item_id)).toEqual([id]);

    const restarted = freshApp();
    await restarted.store.load();
    expect(restarted.store.getInsurancePolicies().map((p: any) => p.id)).toEqual([id]);

    await AsyncStorage.clear(); // logout wipes the device copy
    const newPhone = freshApp();
    await newPhone.store.load();
    const p = newPhone.store.getInsurancePolicies()[0];
    expect(p).toMatchObject({ id, name: 'Public liability', provider: 'Hiscox', policyNumber: 'PL-1' });
    expect(p.endDate).toBeInstanceOf(Date);
  });

  it('a deleted item does not come back from the account', async () => {
    const a = freshApp();
    await a.store.load();
    const { id } = a.store.saveTrackedItem({ type: 'certification', name: 'Temp', expiryDate: inDays(90) });
    a.store.removeTrackedItem(id);
    await settle();
    await AsyncStorage.clear();
    const b = freshApp();
    await b.store.load();
    expect(b.store.getCertifications()).toEqual([]);
  });

  it('changing the type moves the item, same id', async () => {
    const { store } = freshApp();
    await store.load();
    const { id } = store.saveTrackedItem({ type: 'certification', name: 'Liability', expiryDate: inDays(90) });
    store.saveTrackedItem({ id, type: 'insurance', name: 'Liability', expiryDate: inDays(90) });
    expect(store.getCertifications()).toEqual([]);
    expect(store.getInsurancePolicies().map((p: any) => p.id)).toEqual([id]);
  });
});

describe('the reminders', () => {
  it('an item 5 days from expiry gets ONE card, named as the contractor typed it', async () => {
    const { store, agent, queue } = freshApp();
    await store.load();
    store.saveTrackedItem({ type: 'insurance', name: 'Van insurance', expiryDate: inDays(5) });
    await agent.scan({ force: true });
    await agent.scan({ force: true });
    const cards = await pendingRenewals(queue);
    expect(cards).toHaveLength(1);
    expect(cards[0].preparedData.name).toBe('Van insurance');
  });

  it('renewing withdraws the card; the next expiry starts a new cycle', async () => {
    const { store, agent, queue } = freshApp();
    await store.load();
    const { id } = store.saveTrackedItem({ type: 'certification', name: 'Gas Safe', expiryDate: inDays(5) });
    await agent.scan({ force: true });
    expect(await pendingRenewals(queue)).toHaveLength(1);

    // Renewed for a year: the card goes.
    store.saveTrackedItem({ id, type: 'certification', name: 'Gas Safe', expiryDate: inDays(365) });
    await queue.withdrawComplianceCards(id);
    await agent.scan({ force: true });
    expect(await pendingRenewals(queue)).toHaveLength(0);

    // A year on it runs out again — that must be queued, not deduped away.
    store.saveTrackedItem({ id, type: 'certification', name: 'Gas Safe', expiryDate: inDays(3) });
    await queue.withdrawComplianceCards(id);
    await agent.scan({ force: true });
    expect(await pendingRenewals(queue)).toHaveLength(1);
  });

  it('a dismissed card does not come back after a restart', async () => {
    const a = freshApp();
    await a.store.load();
    a.store.saveTrackedItem({ type: 'certification', name: 'Gas Safe', expiryDate: inDays(5) });
    await settle();
    await a.agent.scan({ force: true });
    const [card] = await pendingRenewals(a.queue);
    await a.queue.rejectItem(card.id);

    const b = freshApp(); // alerts are in memory: every stage looks new again
    await b.store.load();
    await b.agent.scan({ force: true });
    expect(await pendingRenewals(b.queue)).toHaveLength(0);
  });

  it('two expiring items keep two cards — renewing one leaves the other', async () => {
    const { store, agent, queue } = freshApp();
    await store.load();
    const a = store.saveTrackedItem({ type: 'certification', name: 'A', expiryDate: inDays(5) });
    store.saveTrackedItem({ type: 'certification', name: 'B', expiryDate: inDays(6) });
    await agent.scan({ force: true });
    expect(await pendingRenewals(queue)).toHaveLength(2);
    await queue.withdrawComplianceCards(a.id);
    expect((await pendingRenewals(queue)).map((c: any) => c.preparedData.name)).toEqual(['B']);
  });
});

describe('review 2026-10-09', () => {
  it('editing an item (a typo in the name) keeps its reminder', async () => {
    const { store, agent, queue } = freshApp();
    await store.load();
    const { id } = store.saveTrackedItem({ type: 'certification', name: 'Gas Saef', expiryDate: inDays(5) });
    await agent.scan({ force: true });
    // What the sheet's save does: save, withdraw, rescan (rescanAfterChange).
    store.saveTrackedItem({ id, type: 'certification', name: 'Gas Safe', expiryDate: store.findTrackedItem(id).expiryDate });
    await queue.withdrawComplianceCards(id);
    await agent.scan({ force: true });
    const cards = await pendingRenewals(queue);
    expect(cards).toHaveLength(1);
    expect(cards[0].preparedData.name).toBe('Gas Safe');
  });

  it('a snoozed card stays snoozed after a restart', async () => {
    const a = freshApp();
    await a.store.load();
    a.store.saveTrackedItem({ type: 'certification', name: 'Gas Safe', expiryDate: inDays(5) });
    await settle();
    await a.agent.scan({ force: true });
    const [card] = await pendingRenewals(a.queue);
    await a.queue.snoozeQueueItem(card.id, 48);

    const b = freshApp();
    await b.store.load();
    await b.agent.scan({ force: true });
    const all = (JSON.parse((await AsyncStorage.getItem('@vasco_ai_queue')) ?? '[]') as any[])
      .filter((q) => q.type === 'cert_renewal' && q.status === 'pending');
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(card.id);
    expect(all[0].snoozedUntil).toBeTruthy();
  });
});

it('a load still reading the cache at logout does not carry account A’s items into B', async () => {
  const a = freshApp();
  await a.store.load();
  a.store.saveTrackedItem({ type: 'certification', name: 'A only', expiryDate: inDays(90) });
  await settle();
  mockRows.length = 0; // B's account starts empty; A's rows are not B's

  const b = freshApp(); // cold start, A's cache still on the device
  const loading = b.store.load();
  mockUid = 'user-b';
  mockUserChange().forEach((cb) => cb('user-b')); // the account switch, mid-read
  await AsyncStorage.clear(); // …and the logout wipe that comes with it
  await loading.catch(() => {});
  await b.store.load();
  await settle();
  expect(b.store.getCertifications().map((c: any) => c.name)).not.toContain('A only');
  expect(mockRows.filter((r) => r.user_id === 'user-b')).toEqual([]);
});
