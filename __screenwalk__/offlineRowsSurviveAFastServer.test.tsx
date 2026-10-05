/**
 * Work created offline survives a server that answers before the cache.
 *
 * A temp-id customer (created offline, not on the server yet) exists ONLY in
 * the cache. refreshData keeps it by merging with what is in memory — which
 * holds it only once the cache hydrate has landed. A first fix for the
 * hydrate/refresh race ("skip the cache once the server answered") lost such
 * rows — and, worse, offline line items, which are never queued (review
 * 2026-10-05). The refresh now waits for the cache; this pins it.
 */
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-00000000cafe';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-00000000cafe' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-00000000cafe', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'NL', language: 'nl' } };
  m.supabase.auth.signInWithPassword = async () => ({ data: { user, session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getSession = async () => ({ data: { session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getUser = async () => ({ data: { user }, error: null });
  return m;
});

import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { useAppState } from '../src/state/AppState';

const fake = require('../src/lib/supabase').__fake as FakeSupabase;
let app: ReturnType<typeof useAppState>;
function Probe() { app = useAppState(); return null; }
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const runInProd = process.env.EXPO_PUBLIC_DEMO_MODE === 'false' ? it : it.skip;

runInProd('an offline-only customer is still there after the server answered first', async () => {
  fake.seed('customers', [{ user_id: UID, name: 'Familie Server' }]);
  await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-1700000000000', name: 'Familie Offline' }]));

  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  const mockGet = AsyncStorage.getItem as unknown as jest.Mock;
  const realGet = mockGet.getMockImplementation()!;
  mockGet.mockImplementation(async (k: string) => {
    if (k === '@vasco_customers') await gate;
    return realGet(k);
  });

  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 14, language: 'nl' });
  expect(r.error).toBeNull();
  await act(async () => { open(); });
  await settle(20);
  mockGet.mockImplementation(realGet);

  const names = app.customers.map((c) => c.name);
  expect(names).toContain('Familie Offline');
  expect(names).toContain('Familie Server');
  // …and on disk, so the next start still has it.
  const stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
  expect(stored.map((c: any) => c.name)).toContain('Familie Offline');
  teardown(r);
});

runInProd('offline line items (never queued — the cache is their only copy) survive too', async () => {
  // Lines of a document the server does not have: only the cache holds them.
  const lines = { 'Q-OFF-1': [{ id: 'li-1', description: 'Kraan vervangen', quantity: 1, unitPrice: 120, vatRate: 21 }] };
  await AsyncStorage.setItem('@vasco_line_items', JSON.stringify(lines));

  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  const mockGet = AsyncStorage.getItem as unknown as jest.Mock;
  const realGet = mockGet.getMockImplementation()!;
  mockGet.mockImplementation(async (k: string) => {
    if (k === '@vasco_line_items') await gate;
    return realGet(k);
  });

  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 14, language: 'nl' });
  expect(r.error).toBeNull();
  await act(async () => { open(); });
  await settle(20);
  mockGet.mockImplementation(realGet);

  expect((app.lineItems as any)['Q-OFF-1']?.[0]?.description).toBe('Kraan vervangen');
  const stored = JSON.parse((await AsyncStorage.getItem('@vasco_line_items')) ?? '{}');
  expect(stored['Q-OFF-1']?.[0]?.description).toBe('Kraan vervangen');
  teardown(r);
});
