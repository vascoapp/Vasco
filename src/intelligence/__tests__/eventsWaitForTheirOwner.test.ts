/**
 * Business events are written only by the user they belong to.
 *
 * flushToCloud sent every queued event under whatever user id the caller
 * passed — signed out, or signed in as someone else, every row is refused
 * (anon has no grant; RLS owns user_id). They now stay queued for their owner.
 * Found by the fake backend's live-grant model (2026-09-24).
 */
import type { FakeSupabase } from '../../test-utils/fakeSupabase';

const ME = 'aaaaaaaa-1111-4111-8111-000000000001';
let mockAuthed: string | null = ME;
jest.mock('../../lib/supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: 'aaaaaaaa-1111-4111-8111-000000000001' }));
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getAuthedUserId: () => mockAuthed,
  getCurrentTrade: () => 'plumbing',
  getCurrentCountry: () => 'DE',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitBusinessEvent } from '../dataCollector';

const fake = require('../../lib/supabase').__fake as FakeSupabase;
beforeEach(async () => { await AsyncStorage.clear(); fake.reset(); mockAuthed = ME; });

it("the owner's events are written", async () => {
  await emitBusinessEvent(ME, { eventType: 'quote_created', entityType: 'quote', entityId: 'q1', payload: {} } as any);
  expect(fake.rows('business_events')).toHaveLength(1);
});

it('signed out: nothing is sent, the event waits', async () => {
  mockAuthed = null;
  await emitBusinessEvent(ME, { eventType: 'quote_created', entityType: 'quote', entityId: 'q1', payload: {} } as any);
  expect(fake.rows('business_events')).toHaveLength(0);
  expect(fake.calls.filter((c) => c.error)).toEqual([]);
});
