/**
 * A quote has ONE job, whoever accepts it (W119 review).
 *
 * A customer's portal acceptance now creates the job server-side
 * (decide_acceptance_link, migration 20261006000001). A contractor whose app
 * still showed the quote as 'sent' tapped Accept and convertQuoteToJob
 * inserted a second job for it. jobs (user_id, quote_id) is UNIQUE now; the
 * app's insert is refused with 23505 and must ADOPT the server's job.
 *
 * The real AppState on the live-schema fake (which emulates the index).
 * ONE test per file.
 */
import React from 'react';
import { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-0000000000f4';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-0000000000f4' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-0000000000f4', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'IT', language: 'it' } };
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
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

const runInProd = process.env.EXPO_PUBLIC_DEMO_MODE === 'false' ? it : it.skip;

runInProd('accepting a quote the server already accepted adopts its job — no second one', async () => {
  await AsyncStorage.clear();
  fake.seed('business_settings', [{ user_id: UID, business_name: 'Idraulica Rossi', country: 'IT', trade: 'plumbing' }]);
  fake.seed('documents', [{ user_id: UID, doc_type: 'quote', status: 'sent', document_number: 'Q0001', total_amount: 1325.75, title: 'Sostituzione miscelatore' }]);

  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 12, language: 'it' });
  expect(r.error).toBeNull();
  expect(app.quotes.find((q) => q.id === 'Q0001')?.status).toBe('sent');

  // Meanwhile the customer accepted in the portal: the RPC made the job.
  fake.seed('jobs', [{ user_id: UID, title: 'Sostituzione miscelatore', status: 'scheduled', quote_id: 'Q0001' }]);
  const serverJobId = fake.rows('jobs')[0].id;

  // The contractor, on a stale screen, taps Accept.
  let jobId = '';
  await act(async () => { jobId = await app.convertQuoteToJob('Q0001'); });
  await settle(20);

  expect(fake.rows('jobs').filter((j) => j.quote_id === 'Q0001')).toHaveLength(1);
  expect(app.jobs.filter((j) => j.quoteId === 'Q0001' || j.id === serverJobId)).toHaveLength(1);
  expect(app.jobs.some((j) => j.id === serverJobId)).toBe(true);
  expect(typeof jobId).toBe('string');
  teardown(r);
});
