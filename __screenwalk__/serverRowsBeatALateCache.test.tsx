/**
 * Rows the server just delivered are not overwritten by a SLOWER cache read.
 *
 * On sign-in, refreshData (network) and hydrateFor (AsyncStorage cache) start
 * from the same user-change event. When storage is the slower one — Android
 * AsyncStorage on a big store — the cache's setCustomers ran AFTER the server's
 * and put stale rows back until the next refresh (sweep 2026-09-24 follow-up).
 * The cache read is parked at a gate until the server rows are in.
 */
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-00000000beef';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-00000000beef' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-00000000beef', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'NL', language: 'nl' } };
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

// The cache hydrate only runs in PRODUCTION posture (demo mode seeds instead),
// so in the demo walk this would pass without looking at anything — skip it.
const runInProd = process.env.EXPO_PUBLIC_DEMO_MODE === 'false' ? it : it.skip;

/** Park the CACHE read of one key until `open()`. */
function gateCacheRead(key: string) {
  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  const mockGet = AsyncStorage.getItem as unknown as jest.Mock;
  const realGet = mockGet.getMockImplementation()!;
  mockGet.mockImplementation(async (k: string) => {
    if (k === key) await gate;
    return realGet(k);
  });
  return { open, restore: () => mockGet.mockImplementation(realGet) };
}

runInProd('server rows win over a cache read that was slower than the server', async () => {
  fake.seed('customers', [{ user_id: UID, name: 'Familie Server' }]);
  await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-stale', name: 'Familie Cache' }]));
  const gate = gateCacheRead('@vasco_customers');

  // Sign-in: the hydrate parks on the gate, the refresh has the server rows
  // and must WAIT for the cache rather than be overwritten by it.
  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 14, language: 'nl' });
  expect(r.error).toBeNull();
  await act(async () => { gate.open(); });
  await settle(20);
  gate.restore();
  expect(app.customers.map((c) => c.name)).toContain('Familie Server');
  expect(app.customers.map((c) => c.name)).not.toContain('Familie Cache');
  teardown(r);
});
