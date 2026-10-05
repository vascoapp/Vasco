/**
 * A business-profile edit made OFFLINE reaches the server, and survives the
 * refreshes before it does.
 *
 * Two defects (review 2026-10-05):
 *  - the queued edit replayed as a bare `upsert(payload)` — no user_id, no
 *    conflict column — so PostgREST made it an INSERT that NOT NULL + RLS
 *    reject. It was dropped after five flushes: no offline profile edit ever
 *    reached the server.
 *  - every refresh laid the old server row over it (screen, cache, user ref)
 *    until then. The overlay takes only entries stamped with THIS user: the
 *    queue outlives a logout until the next sign-in's wipe finishes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FakeSupabase } from '../../test-utils/fakeSupabase';

const UID = '11111111-1111-4111-8111-11111111abcd';
const OTHER = '22222222-2222-4222-8222-22222222abcd';
jest.mock('../supabase', () => require('../../test-utils/fakeSupabase').fakeSupabaseModule({ userId: '11111111-1111-4111-8111-11111111abcd' }));
const fake = require('../supabase').__fake as FakeSupabase;

import { loadBusinessProfile, upsertBusinessSettings } from '../dataProvider';
import { setCurrentUser } from '../currentUser';
import { businessSettingsFallback, queueWrite, flushQueue, queueSize, supersedeQueuedFields, persistOrQueue } from '../../services/offlineWriteQueue';

const queued = (payload: Record<string, unknown>, at: number) => ({
  id: `w-${at}`, table: 'business_settings', op: 'upsert', createdAt: at, attempts: 1,
  ...businessSettingsFallback(payload, UID),
});

beforeEach(async () => {
  await AsyncStorage.clear();
  setCurrentUser({ id: UID });
  fake.reset();
  fake.seed('business_settings', [{ user_id: UID, business_name: 'Weber Alt', country: 'NL', iban: 'NL91ABNA0417164300' }]);
});
afterEach(() => setCurrentUser(null));

describe('the refresh keeps an edit that is still queued', () => {
  it('queued edits are laid over the server row, newest last', async () => {
    await AsyncStorage.setItem('@vasco_offline_writes', JSON.stringify([
      queued({ business_name: 'Weber Zwischen', country: 'DE' }, 1),
      queued({ business_name: 'Sanitär Weber' }, 2),
    ]));
    const bp = await loadBusinessProfile();
    expect(bp.businessName).toBe('Sanitär Weber');
    expect(bp.country).toBe('DE');
    expect(bp.iban).toBe('NL91ABNA0417164300'); // untouched server field kept
  });

  it('with nothing queued the server row is the profile (control)', async () => {
    const bp = await loadBusinessProfile();
    expect(bp.businessName).toBe('Weber Alt');
    expect(bp.country).toBe('NL');
  });

  it("another table's queued write does not leak into the profile", async () => {
    await AsyncStorage.setItem('@vasco_offline_writes', JSON.stringify([
      { id: 'w-c', table: 'customers', op: 'upsert', payload: { business_name: 'Kunde GmbH', user_id: UID }, createdAt: 1, attempts: 1 },
    ]));
    expect((await loadBusinessProfile()).businessName).toBe('Weber Alt');
  });

  it("the previous contractor's queued edit is never laid onto this profile", async () => {
    await AsyncStorage.setItem('@vasco_offline_writes', JSON.stringify([
      { id: 'w-o', table: 'business_settings', op: 'upsert', createdAt: 1, attempts: 1, ...businessSettingsFallback({ business_name: 'Fremde Firma', iban: 'DE89370400440532013000' }, OTHER) },
      // Legacy shape (no owner): could never land, never overlaid.
      { id: 'w-l', table: 'business_settings', op: 'upsert', payload: { business_name: 'Alt-Format' }, createdAt: 2, attempts: 1 },
    ]));
    const bp = await loadBusinessProfile();
    expect(bp.businessName).toBe('Weber Alt');
    expect(bp.iban).toBe('NL91ABNA0417164300');
  });
});

describe('the queued edit reaches the server', () => {
  it('updates the existing row on flush', async () => {
    await queueWrite({ table: 'business_settings', op: 'upsert', ...businessSettingsFallback({ business_name: 'Sanitär Weber', country: 'DE' }, UID) });
    const r = await flushQueue();
    expect(r.processed).toBe(1);
    expect(await queueSize()).toBe(0);
    const rows = fake.rows('business_settings');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: UID, business_name: 'Sanitär Weber', country: 'DE', iban: 'NL91ABNA0417164300' });
    expect(fake.calls.filter((c) => c.error)).toEqual([]);
  });

  it('creates the row when the contractor had none yet', async () => {
    fake.reset();
    await queueWrite({ table: 'business_settings', op: 'upsert', ...businessSettingsFallback({ business_name: 'Neu GmbH' }, UID) });
    expect((await flushQueue()).processed).toBe(1);
    expect(fake.rows('business_settings')).toEqual([expect.objectContaining({ user_id: UID, business_name: 'Neu GmbH' })]);
  });
});

it('the profile writer queues through businessSettingsFallback (the shape tested above)', () => {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const { stripComments } = require('../../utils/stripComments');
  const src: string = stripComments(readFileSync(join(__dirname, '../../state/AppState.tsx'), 'utf8'));
  const calls = src.match(/persistOrQueue\(\s*'business_settings'[^;]*/g) ?? [];
  expect(calls.length).toBeGreaterThan(0);
  for (const c of calls) expect(c).toMatch(/businessSettingsFallback\(dbUpdates, getAuthedUserId\(\)\)/);
});

describe('a newer write is not undone by an older queued one', () => {
  it('IBAN X queued offline, IBAN Y saved online → the server keeps Y', async () => {
    await queueWrite({ table: 'business_settings', op: 'upsert', ...businessSettingsFallback({ iban: 'DE02120300000000202051', business_name: 'Weber Offline' }, UID) });
    await upsertBusinessSettings({ iban: 'DE89370400440532013000' });
    await supersedeQueuedFields('business_settings', UID, ['iban']);
    // The refresh before the flush must not lay X back over Y either.
    expect((await loadBusinessProfile()).iban).toBe('DE89370400440532013000');
    await flushQueue();
    expect(fake.rows('business_settings')[0]).toMatchObject({ iban: 'DE89370400440532013000', business_name: 'Weber Offline' });
  });

  it('an entry whose every column was superseded leaves the queue', async () => {
    await queueWrite({ table: 'business_settings', op: 'upsert', ...businessSettingsFallback({ iban: 'DE02120300000000202051' }, UID) });
    await supersedeQueuedFields('business_settings', UID, ['iban']);
    expect(await queueSize()).toBe(0);
  });

  it("another owner's entry is not touched", async () => {
    await queueWrite({ table: 'business_settings', op: 'upsert', ...businessSettingsFallback({ iban: 'DE02120300000000202051' }, OTHER) });
    await supersedeQueuedFields('business_settings', UID, ['iban']);
    expect(await queueSize()).toBe(1);
  });

  it('the profile writer supersedes the queue once its direct write landed', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const { stripComments } = require('../../utils/stripComments');
    const src: string = stripComments(readFileSync(join(__dirname, '../../state/AppState.tsx'), 'utf8'));
    expect(src).toMatch(/businessSettingsFallback\(dbUpdates, getAuthedUserId\(\)\)\)\s*\.then\(\(landed\) => \(landed \? supersedeQueuedFields\('business_settings', getAuthedUserId\(\), Object\.keys\(dbUpdates\)\)/);
  });
});

it('an upsert with nothing to send is not queued', async () => {
  const ok = await persistOrQueue('business_settings', 'upsert', async () => { throw new Error('Network request failed'); }, businessSettingsFallback({ iban: 'X' }, null));
  expect(ok).toBe(false);
  expect(await queueSize()).toBe(0);
});
