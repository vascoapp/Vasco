/**
 * The trial belongs to the ACCOUNT, not the handset.
 *
 * Subscription state lived only in AsyncStorage, so entitlement was
 * device-local in both directions that matter commercially:
 *
 *   - **reinstall granted a fresh 14 days**, indefinitely, for free;
 *   - a contractor who started the trial on their phone opened it on a tablet
 *     and was back on Free.
 *
 * `public.subscriptions` has existed since `20260415000010_subscriptions.sql`
 * with `trial_ends_at` and per-user RLS. The client simply never declared it in
 * `database.types.ts` and never read it.
 *
 * The rule these tests pin: **a server row wins; the absence of one means push,
 * never wipe; and any failure leaves the local copy in charge** — nobody gets
 * locked out of what they paid for because a request timed out.
 */
const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

let mockServerRow: Record<string, unknown> | null = null;
let mockServerError: unknown = null;
let mockSignedInUser: string | null = 'user-1';
const mockUpserts: Array<Record<string, unknown>> = [];

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: mockSignedInUser ? { id: mockSignedInUser } : null },
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          maybeSingle: jest.fn(async () => ({ data: mockServerRow, error: mockServerError })),
        })),
      })),
      upsert: jest.fn(async (row: Record<string, unknown>) => {
        mockUpserts.push(row);
        return { error: null };
      }),
    })),
  },
}));

import {
  syncSubscriptionFromServer,
  saveSubscription,
  loadSubscription,
  startTrial,
  type SubscriptionState,
} from '../subscriptionService';

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

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

beforeEach(() => {
  mockStorage.clear();
  mockUpserts.length = 0;
  mockServerRow = null;
  mockServerError = null;
  mockSignedInUser = 'user-1';
});

describe('a reinstall does not buy another free fortnight', () => {
  // ⚠️ Every test here seeds LOCAL state that disagrees with the server, on
  // purpose. Jest runs with __DEV__ true, so DEMO_MODE is on and `defaultState`
  // returns **pro** — a "clean install" therefore already looks Pro, and an
  // assertion that the server won would pass without the server being read at
  // all. A decoy replacing `tierFromServer(data.tier)` with `local.tier` passed
  // against the first version of these tests. Same posture trap as #172.
  it('a device claiming a LIVE trial is overruled by an account that used it', async () => {
    await saveSubscription(baseState({ tier: 'pro', trialEndsAt: daysFromNow(9) }));
    mockServerRow = { tier: 'free', billing_cycle: 'monthly', status: 'expired', trial_ends_at: daysFromNow(-3) };
    const synced = await syncSubscriptionFromServer();
    expect(synced?.tier).toBe('free');
    expect(synced?.trialEndsAt).toBeNull();
  });

  it('a device on Free picks up the trial still running on the account', async () => {
    await saveSubscription(baseState({ tier: 'free', trialEndsAt: null }));
    mockServerRow = { tier: 'pro', billing_cycle: 'monthly', status: 'trialing', trial_ends_at: daysFromNow(6) };
    const synced = await syncSubscriptionFromServer();
    expect(synced?.tier).toBe('pro');
    expect(synced?.trialEndsAt).toBe(mockServerRow.trial_ends_at);
  });
});

describe('the server row wins, but absence of one never wipes', () => {
  it('pushes local state up when the account has no row yet', async () => {
    await saveSubscription(baseState({ tier: 'pro', trialEndsAt: daysFromNow(4) }));
    mockServerRow = null;
    const synced = await syncSubscriptionFromServer();
    // An app upgrade must not reset an existing contractor to Free.
    expect(synced?.tier).toBe('pro');
    expect(mockUpserts).toHaveLength(1);
    expect(mockUpserts[0]).toMatchObject({ user_id: 'user-1', tier: 'pro', status: 'trialing' });
  });

  it("maps the server's 'advanced' tier to pro rather than stripping a payer", async () => {
    await saveSubscription(baseState({ tier: 'free', billingCycle: 'monthly' }));
    mockServerRow = { tier: 'advanced', billing_cycle: 'yearly', status: 'active', trial_ends_at: null };
    const synced = await syncSubscriptionFromServer();
    expect(synced?.tier).toBe('pro');
    expect(synced?.billingCycle).toBe('annual');
  });

  it('tells the server when the pull is what expired the trial', async () => {
    await saveSubscription(baseState({ tier: 'pro', trialEndsAt: daysFromNow(2) }));
    mockServerRow = { tier: 'pro', billing_cycle: 'monthly', status: 'trialing', trial_ends_at: daysFromNow(-1) };
    const synced = await syncSubscriptionFromServer();
    expect(synced?.tier).toBe('free');
    // Otherwise the next device reads a lapsed trial as live.
    expect(mockUpserts.some((u) => u.tier === 'free' && u.trial_ends_at === null)).toBe(true);
  });
});

describe('a failure never locks anyone out', () => {
  it('leaves local state alone when the query errors', async () => {
    await saveSubscription(baseState({ tier: 'pro', trialEndsAt: daysFromNow(9) }));
    mockServerError = { message: 'offline' };
    expect(await syncSubscriptionFromServer()).toBeNull();
    const local = await loadSubscription();
    expect(local.tier).toBe('pro');
  });

  it('does nothing before there is a session', async () => {
    mockSignedInUser = null;
    expect(await syncSubscriptionFromServer()).toBeNull();
    expect(mockUpserts).toHaveLength(0);
  });

  it('still starts the trial locally when the upsert fails', async () => {
    mockSignedInUser = null; // push cannot identify the user
    const out = await startTrial(baseState());
    expect(out.tier).toBe('pro');
    expect(out.trialEndsAt).not.toBeNull();
  });
});

describe('granting the trial publishes it to the account', () => {
  it('startTrial upserts trialing + the end date', async () => {
    await startTrial(baseState());
    expect(mockUpserts).toHaveLength(1);
    expect(mockUpserts[0]).toMatchObject({ user_id: 'user-1', tier: 'pro', status: 'trialing' });
    expect(mockUpserts[0].trial_ends_at).toEqual(expect.any(String));
  });
});
