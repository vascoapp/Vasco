/**
 * Finanze names a quote's customer — never their id (IT walk 2026-10-06).
 *
 * The read mapper puts `customer_id` into `Quote.customer` for every document
 * loaded from the server, and the quote list printed that slot raw: the first
 * row an Italian plumber saw after a customer accepted read
 * "d4c3e5c1-42fa-48d7-a082-67389…" where "Edilizia Bianchi S.r.l." belongs.
 * The same tab's market card was headed "MARKT & PRESTATIE" in Dutch.
 *
 * The real AppState on the live-schema fake, the real refresh, in Italian.
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-0000000000f2';
const CUSTOMER = 'd4c3e5c1-42fa-48d7-a082-673898576058';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-0000000000f2' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-0000000000f2', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'IT', language: 'it' } };
  m.supabase.auth.signInWithPassword = async () => ({ data: { user, session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getSession = async () => ({ data: { session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getUser = async () => ({ data: { user }, error: null });
  return m;
});

import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const fake = require('../src/lib/supabase').__fake as FakeSupabase;
const Geld = () => require('../app/(contractor)/geld').default;

// The shipping build: a demo account's seeded jobs/queue would take the card.
const runInProd = process.env.EXPO_PUBLIC_DEMO_MODE === 'false' ? it : it.skip;

runInProd('the quote row reads the customer’s name, in Italian, never a uuid', async () => {
  await AsyncStorage.clear();
  fake.seed('business_settings', [{ user_id: UID, business_name: 'Idraulica Rossi', country: 'IT', trade: 'plumbing' }]);
  fake.seed('customers', [{ id: CUSTOMER, user_id: UID, name: 'Edilizia Bianchi S.r.l.' }]);
  fake.seed('documents', [
    { user_id: UID, doc_type: 'quote', status: 'accepted', document_number: 'Q0001', customer_id: CUSTOMER, total_amount: 1325.75, title: 'Sostituzione miscelatore bagno' },
  ]);

  const r = await walkScreen(Geld(), { as: 'contractor', settlePasses: 16, language: 'it' });
  expect(r.error).toBeNull();
  const all = r.texts.join(' | ');
  expect(all).toContain('Edilizia Bianchi S.r.l.');
  expect(all).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  expect(all).not.toMatch(/MARKT/);
  teardown(r);
});
