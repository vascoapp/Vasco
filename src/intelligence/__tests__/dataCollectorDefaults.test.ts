/**
 * @jest-environment node
 *
 * R281 — emitBusinessEvent auto-defaults trade + country from currentUser
 * when callers don't pass them. Verifies that cohort attribution can never
 * silently land as undefined for users who have a known specialty + country
 * in their profile.
 *
 * AsyncStorage is mocked globally in jest.setup.ts with an in-memory store,
 * so we read the queue back via AsyncStorage.getItem after each emit.
 */

let mockTrade: string | null = 'painting';
let mockCountry: string | null = 'DE';

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-abc',
  getCurrentTrade: () => mockTrade,
  getCurrentCountry: () => mockCountry,
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: jest.fn(), rpc: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitBusinessEvent } from '../dataCollector';

const QUEUE_KEY = '@vasco_event_queue';

async function lastQueuedRow(): Promise<any> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return null;
  const arr = JSON.parse(raw);
  return arr[arr.length - 1] ?? null;
}

describe('emitBusinessEvent — R281 trade/country defaults', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
    mockTrade = 'painting';
    mockCountry = 'DE';
  });

  it('defaults trade + country from currentUser when caller omits both', async () => {
    await emitBusinessEvent('user-abc', {
      eventType: 'quote_accepted',
      entityType: 'quote',
      entityId: 'q-1',
      payload: {},
    });
    const row = await lastQueuedRow();
    expect(row?.trade).toBe('painting');
    expect(row?.country).toBe('DE');
  });

  it('respects caller-provided trade + country over defaults', async () => {
    await emitBusinessEvent('user-abc', {
      eventType: 'quote_accepted',
      entityType: 'quote',
      entityId: 'q-2',
      payload: {},
      trade: 'electrical',
      country: 'FR',
    });
    const row = await lastQueuedRow();
    expect(row?.trade).toBe('electrical');
    expect(row?.country).toBe('FR');
  });

  it('partial override: caller passes trade only, country still defaults', async () => {
    await emitBusinessEvent('user-abc', {
      eventType: 'job_completed',
      entityType: 'job',
      entityId: 'j-1',
      payload: {},
      trade: 'plumbing',
    });
    const row = await lastQueuedRow();
    expect(row?.trade).toBe('plumbing');
    expect(row?.country).toBe('DE');
  });

  it('leaves both undefined when currentUser has neither set', async () => {
    mockTrade = null;
    mockCountry = null;
    await emitBusinessEvent('user-abc', {
      eventType: 'signup_completed',
      entityType: 'user',
      entityId: 'user-abc',
      payload: {},
    });
    const row = await lastQueuedRow();
    expect(row?.trade).toBeUndefined();
    expect(row?.country).toBeUndefined();
  });
});
