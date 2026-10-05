/**
 * Offline, the CACHED business profile — not the account — supplies the
 * country every non-hook service reads (getCurrentCountry: formatCurrency's
 * fallback, cohort price writes, decimal input).
 *
 * The cache hydrate set the businessProfile STATE but never the ref; only the
 * server's profile did. With no network, an account created as NL kept tagging
 * a German profile's prices NL (review of the profile layer, 2026-10-05).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

process.env.WALK_REAL_AUTH = '1';

jest.mock('../src/lib/supabase', () => {
  const m = require('../src/test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-0000000c0de0' });
  const user = { id: 'aaaaaaaa-1111-4111-8111-0000000c0de0', email: 'walk@vascobuild.test', user_metadata: { role: 'contractor', country: 'NL', language: 'nl' } };
  m.supabase.auth.signInWithPassword = async () => ({ data: { user, session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getSession = async () => ({ data: { session: { access_token: 't', user } }, error: null });
  m.supabase.auth.getUser = async () => ({ data: { user }, error: null });
  // OFFLINE: the session is cached on the phone, every table read fails.
  m.supabase.from = () => { throw new Error('Network request failed'); };
  return m;
});

import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { getCurrentCountry, getCurrentVatScheme } from '../src/lib/currentUser';

function Probe() { return null; }

// The cache hydrate only runs in PRODUCTION posture (demo mode seeds instead).
const runInProd = process.env.EXPO_PUBLIC_DEMO_MODE === 'false' ? it : it.skip;

runInProd('offline, the cached profile country outranks the account country', async () => {
  await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({
    businessName: 'Sanitär Weber', country: 'DE', vatScheme: 'kleinunternehmer',
  }));
  const r = await walkScreen(Probe, { as: 'contractor', settlePasses: 14, language: 'de' });
  expect(r.error).toBeNull();
  expect(getCurrentCountry()).toBe('DE');
  expect(getCurrentVatScheme()).toBe('kleinunternehmer');
  teardown(r);
});
