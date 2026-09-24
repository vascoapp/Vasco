/**
 * A logout DURING a refresh does not bring the previous contractor back.
 *
 * refreshData's loads take seconds. A logout in between wiped state — and the
 * refresh then committed the previous contractor's customers and documents
 * back into it, and from there into storage, for whoever used the device next
 * (live-schema prod walk, 2026-09-24). A behaviour test: the real AppState on
 * the live-schema fake, the backend held at a gate, the user switched out
 * while it is held.
 */
import React from 'react';
import { act } from 'react-test-renderer';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-00000000c0de';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-00000000c0de' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-00000000c0de', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'DE', language: 'de' } };
  m.supabase.auth.signInWithPassword = async () => ({ data: { user, session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getSession = async () => ({ data: { session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getUser = async () => ({ data: { user }, error: null });
  return m;
});

import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { useAppState } from '../src/state/AppState';
import { setCurrentUser } from '../src/lib/currentUser';

const fake = require('../src/lib/supabase').__fake as FakeSupabase;
let app: ReturnType<typeof useAppState>;
function Probe() { app = useAppState(); return null; }
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

it("a refresh that finishes after the logout commits nothing of the previous contractor's", async () => {
  fake.seed('customers', [{ user_id: UID, name: 'Familie Becker' }]);
  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 12, language: 'de' });
  expect(r.error).toBeNull();
  await act(async () => { await app.refreshData(); });
  await settle();
  expect(app.customers.map((c) => c.name)).toContain('Familie Becker');

  // Hold every backend answer at a gate.
  let open!: () => void;
  const gate = new Promise<void>((res) => { open = res; });
  const from = fake.client.from.bind(fake.client);
  (fake.client as any).from = (t: string) => {
    const q = from(t);
    const then = q.then.bind(q);
    q.then = (res: any, rej: any) => gate.then(() => then(res, rej));
    return q;
  };

  let refreshing!: Promise<void>;
  await act(async () => { refreshing = app.refreshData(); });
  await settle(3);
  // The contractor logs out while the loads are in flight: AppState wipes.
  await act(async () => { setCurrentUser(null); });
  await settle(3);
  expect(app.customers).toHaveLength(0);

  // The loads now answer — with the previous contractor's rows.
  await act(async () => { open(); await refreshing; });
  await settle();
  expect(app.customers).toHaveLength(0);
  (fake.client as any).from = from;
  teardown(r);
});
