/**
 * The 14-day trial the signup screen promises must actually start — and must
 * actually END.
 *
 * Until 2026-09-12 `startTrial()` had **zero call sites** and `trialEndsAt`,
 * `isTrialActive` and `daysLeftInTrial` had **zero readers**, while the signup
 * subtitle promised the trial in all six languages. Every contractor who signed
 * up landed on Free, where `hasAutomationPacks`, `hasEveAI` and `hasEInvoicing`
 * are all false — so in Germany they were sold the e-invoice obligation and
 * handed a build that cannot issue one.
 *
 * The dangerous half is the other direction. `startTrial` sets `tier = 'pro'`
 * and nothing downgraded it, so wiring it up naively would have granted Pro
 * permanently — a revenue leak worse than the missing trial. Expiry is enforced
 * in `loadSubscription`, the one choke point every consumer already passes
 * through, and that is what these tests mostly cover.
 */
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

// startTrial and upgradeTo now publish to the account, so the client is stubbed
// here to keep this suite hermetic. The sync behaviour itself is covered by
// trialFollowsTheAccount.test.ts.
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn(async () => ({ data: { user: null } })) },
    from: jest.fn(() => ({ upsert: jest.fn(async () => ({ error: null })) })),
  },
}));

import fs from 'fs';
import path from 'path';
import {
  startTrial,
  loadSubscription,
  saveSubscription,
  upgradeTo,
  isTrialActive,
  isTrialExpired,
  daysLeftInTrial,
  getTierLimits,
  TRIAL_DAYS,
  type SubscriptionState,
} from '../subscriptionService';

const STORAGE_KEY = '@vasco_subscription';

function baseState(over: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    tier: 'free',
    billingCycle: 'monthly',
    startedAt: new Date().toISOString(),
    expiresAt: null,
    seatsUsed: 1,
    seatsPurchased: 0,
    aiInsightsUsedThisMonth: 0,
    quotesUsedThisMonth: 0,
    invoicesUsedThisMonth: 0,
    activeJobCount: 0,
    clientCount: 0,
    trialEndsAt: null,
    ...over,
  } as SubscriptionState;
}

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

beforeEach(() => mockStorage.clear());

describe('the trial starts', () => {
  it('grants Pro and dates the end TRIAL_DAYS out', async () => {
    const out = await startTrial(baseState());
    expect(out.tier).toBe('pro');
    expect(isTrialActive(out)).toBe(true);
    expect(daysLeftInTrial(out)).toBe(TRIAL_DAYS);
  });

  it('unlocks what the German pitch is actually about', async () => {
    // Free has hasEInvoicing false. Being sold the e-invoice obligation and
    // handed a build that cannot issue one is the whole defect.
    expect(getTierLimits('free').hasEInvoicing).toBe(false);
    const out = await startTrial(baseState());
    const limits = getTierLimits(out.tier);
    expect(limits.hasEInvoicing).toBe(true);
    expect(limits.hasAutomationPacks).toBe(true);
    expect(limits.hasEveAI).toBe(true);
  });

  it('does not mutate the state it was handed', async () => {
    const before = baseState();
    await startTrial(before);
    expect(before.tier).toBe('free');
    expect(before.trialEndsAt).toBeNull();
  });
});

describe('the trial ends', () => {
  it('downgrades to Free once expired, on the next load', async () => {
    await saveSubscription(baseState({ tier: 'pro', trialEndsAt: daysFromNow(-1) }));
    const loaded = await loadSubscription();
    expect(loaded.tier).toBe('free');
    expect(loaded.trialEndsAt).toBeNull();
    expect(getTierLimits(loaded.tier).hasEInvoicing).toBe(false);
  });

  it('persists the downgrade rather than recomputing it forever', async () => {
    await saveSubscription(baseState({ tier: 'pro', trialEndsAt: daysFromNow(-1) }));
    await loadSubscription();
    expect(JSON.parse(mockStorage.get(STORAGE_KEY)!).tier).toBe('free');
  });

  it('leaves an ACTIVE trial alone', async () => {
    await saveSubscription(baseState({ tier: 'pro', trialEndsAt: daysFromNow(5) }));
    const loaded = await loadSubscription();
    expect(loaded.tier).toBe('pro');
    expect(isTrialActive(loaded)).toBe(true);
    expect(daysLeftInTrial(loaded)).toBe(5);
  });

  it('never downgrades a PAYING customer', async () => {
    // upgradeTo clears trialEndsAt, which is what stops `loadSubscription`
    // reading a subscriber as a lapsed trial and dropping them to Free two
    // weeks after they paid.
    const paid = await upgradeTo(baseState({ trialEndsAt: daysFromNow(3) }), 'pro', 'monthly');
    expect(paid.trialEndsAt).toBeNull();
    await saveSubscription(paid);
    // Even long after the trial would have lapsed.
    const loaded = await loadSubscription();
    expect(loaded.tier).toBe('pro');
    expect(isTrialExpired(loaded)).toBe(false);
  });
});

describe('the promise is wired to something', () => {
  /**
   * The original defect was not a wrong value — it was a function nobody
   * called. A unit test of `startTrial` would have passed throughout. This is
   * the assertion that would have failed.
   */
  it('startTrial has at least one caller outside the service and its tests', () => {
    const repo = path.join(__dirname, '..', '..', '..');
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          walk(p);
        } else if (/\.tsx?$/.test(entry.name) && !p.endsWith('subscriptionService.ts')) {
          if (/\bstartTrial\s*\(/.test(fs.readFileSync(p, 'utf8'))) {
            callers.push(path.relative(repo, p));
          }
        }
      }
    };
    for (const r of ['app', 'src']) walk(path.join(repo, r));
    expect(callers).not.toEqual([]);
  });

  it('the signup copy still says the number TRIAL_DAYS grants, in every locale', () => {
    // Copy and constant have to move together: the subtitle names "14" in six
    // languages, and nothing else ties them to TRIAL_DAYS.
    const repo = path.join(__dirname, '..', '..', '..');
    for (const loc of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
      const json = JSON.parse(
        fs.readFileSync(path.join(repo, `src/i18n/locales/${loc}.json`), 'utf8'),
      );
      const subtitle: string = json?.signup?.subtitle ?? '';
      expect(subtitle).not.toBe('');
      expect(subtitle).toContain(String(TRIAL_DAYS));
    }
  });
});
