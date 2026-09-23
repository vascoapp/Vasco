/**
 * The quarter-end VAT card waits for the contractor's REAL profile.
 *
 * #366 added `vatExempt = !bp || …` so a scheduler run before hydrate would
 * skip the card. It never fired: AppState always hands the snapshot a profile
 * OBJECT — the empty placeholder before hydrate — so `!bp` was false and a
 * Kleinunternehmer (who files no return) was told one was due on every
 * pre-hydrate run. The test that shipped with it matched the SOURCE text, so
 * it passed. This one runs populateQueue and looks at the queue (D1).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { populateQueue, getQueue } from '../aiActionQueueService';
import { setAppStateSnapshot } from '../../state/appStateSnapshot';

const EMPTY = { completedJobs: [], overdueInvoices: [], sentQuotes: [], expiringCerts: [], country: 'DE' };
const PLACEHOLDER = {}; // what AppState passes before hydrate: an object, all fields undefined

const snapshot = (businessProfile: Record<string, unknown>, profileLoaded: boolean) =>
  setAppStateSnapshot({ jobs: [], quotes: [], invoices: [], customers: [], businessProfile, profileLoaded });

const taxCards = async () => (await getQueue()).filter((c) => c.type === 'tax_prep');

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers({ now: new Date('2026-09-25T10:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
});
afterEach(() => jest.useRealTimers());

describe('the VAT card and the profile', () => {
  it('before hydrate (placeholder profile) — no card', async () => {
    snapshot(PLACEHOLDER, false);
    await populateQueue(EMPTY);
    expect(await taxCards()).toHaveLength(0);
  });

  it('loaded, standard VAT filer in DE at quarter end — the card appears', async () => {
    snapshot({ country: 'DE', vatScheme: 'standard', filingPeriod: 'quarterly' }, true);
    await populateQueue(EMPTY);
    expect(await taxCards()).toHaveLength(1);
  });

  it('loaded Kleinunternehmer — no card', async () => {
    snapshot({ country: 'DE', vatScheme: 'small_business_DE_kleinunternehmer' }, true);
    await populateQueue(EMPTY);
    expect(await taxCards()).toHaveLength(0);
  });

  it('loaded yearly filer — no card', async () => {
    snapshot({ country: 'DE', vatScheme: 'standard', filingPeriod: 'yearly' }, true);
    await populateQueue(EMPTY);
    expect(await taxCards()).toHaveLength(0);
  });
});

// Review 2026-09-24: the persist effect cached the empty placeholder, and the
// next cold start hydrated it as "loaded" — D1/D2 by another door.
describe('a cached placeholder is not a loaded profile', () => {
  const { isOwnProfile } = require('../../state/AppState');
  it('placeholder → not the contractor\'s profile', () => {
    expect(isOwnProfile({ isComplete: false, completenessPercent: 0 })).toBe(false);
  });
  it('any real field → theirs', () => {
    expect(isOwnProfile({ isComplete: false, completenessPercent: 0, vatScheme: 'standard' })).toBe(true);
  });
  it('only the loaded profile is ever cached, and both hydrate paths check it', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const { stripComments } = require('../../utils/stripComments');
    const src = stripComments(readFileSync(join(__dirname, '../../state/AppState.tsx'), 'utf8'));
    expect(src).toMatch(/if \(persistReady && profileLoaded\) \{\s*AsyncStorage\.setItem\('@vasco_business_profile'/);
    expect(src.match(/if \(isOwnProfile\(bpParsed\)\) setProfileLoaded\(true\)/g)).toHaveLength(2);
    expect(src).not.toMatch(/bpParsed \}\)\); setProfileLoaded\(true\)/);
  });
});
