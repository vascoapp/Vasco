/**
 * After an accepted quote, Oggi does not greet the contractor with "Start
 * with your FIRST quote" (IT walk 2026-10-06: Q0001 accepted, card still read
 * "Inizia con il tuo primo preventivo").
 *
 * The real AppState on the live-schema fake, in Italian. ONE test per file.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeSupabase } from '../src/test-utils/fakeSupabase';

const UID = 'aaaaaaaa-1111-4111-8111-0000000000f3';
const CUSTOMER = 'd4c3e5c1-42fa-48d7-a082-673898576058';
process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-0000000000f3' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-0000000000f3', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'IT', language: 'it' } };
  m.supabase.auth.signInWithPassword = async () => ({ data: { user, session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getSession = async () => ({ data: { session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getUser = async () => ({ data: { user }, error: null });
  return m;
});

import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const fake = require('../src/lib/supabase').__fake as FakeSupabase;
const Home = () => require('../app/(contractor)/index').default;
const it_ = require('../src/i18n/locales/it.json');

// The shipping build: a demo account's seeded jobs/queue would take the card.
const runInProd = process.env.EXPO_PUBLIC_DEMO_MODE === 'false' ? it : it.skip;

runInProd('after an accepted quote the card offers the NEXT quote, not the first — in Italian', async () => {
  await AsyncStorage.clear();
  fake.seed('business_settings', [{ user_id: UID, business_name: 'Idraulica Rossi', country: 'IT', trade: 'plumbing' }]);
  fake.seed('customers', [{ id: CUSTOMER, user_id: UID, name: 'Edilizia Bianchi S.r.l.' }]);
  fake.seed('documents', [
    { user_id: UID, doc_type: 'quote', status: 'accepted', document_number: 'Q0001', customer_id: CUSTOMER, total_amount: 1325.75, title: 'Sostituzione miscelatore bagno' },
  ]);

  const r = await walkScreen(Home(), { as: 'contractor', settlePasses: 16, language: 'it' });
  expect(r.error).toBeNull();
  const all = r.texts.join(' | ');
  expect(all).not.toContain(it_.dk.hero.guideStart);
  expect(all).toContain(it_.dk.hero.guideNext);
  teardown(r);
});
