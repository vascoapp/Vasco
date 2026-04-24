/**
 * @jest-environment node
 */

let mockConsumedRows: Array<{
  consumedId: string;
  monthsFree: number;
  sourceType: string;
  sourceId: string | null;
}> = [];
let mockLastMaxMonths: number | undefined;

jest.mock('../subscriptionCreditsService', () => ({
  consumeSubscriptionCredits: jest.fn(async (_userId: string, max: number) => {
    mockLastMaxMonths = max;
    return mockConsumedRows;
  }),
}));

import { applyCreditsToRenewal, __internal } from '../billingCreditRedemption';

beforeEach(() => {
  mockConsumedRows = [];
  mockLastMaxMonths = undefined;
});

describe('addMonths', () => {
  test('adds whole months', () => {
    const d = __internal.addMonths(new Date('2026-01-15T00:00:00Z'), 2);
    expect(d.toISOString().slice(0, 10)).toBe('2026-03-15');
  });

  test('zero / negative months is a no-op', () => {
    const src = new Date('2026-01-15T00:00:00Z');
    expect(__internal.addMonths(src, 0).getTime()).toBe(src.getTime());
    expect(__internal.addMonths(src, -3).getTime()).toBe(src.getTime());
  });

  test('Jan 31 + 1 month → last day of Feb (no rollover into March)', () => {
    const d = __internal.addMonths(new Date('2026-01-31T12:00:00Z'), 1);
    // 2026 is not a leap year → Feb 28
    const iso = d.toISOString().slice(0, 10);
    expect(['2026-02-28', '2026-02-29']).toContain(iso);
    expect(iso.startsWith('2026-02')).toBe(true);
  });

  test('Mar 31 + 1 month → Apr 30 (30-day month)', () => {
    const d = __internal.addMonths(new Date('2026-03-31T00:00:00Z'), 1);
    expect(d.toISOString().slice(0, 10)).toBe('2026-04-30');
  });

  test('crosses year boundary', () => {
    const d = __internal.addMonths(new Date('2026-11-15T00:00:00Z'), 3);
    expect(d.toISOString().slice(0, 10)).toBe('2027-02-15');
  });
});

describe('applyCreditsToRenewal', () => {
  const now = new Date('2026-05-01T00:00:00Z');

  test('no credits → newRenewalAt equals input, months=0', async () => {
    mockConsumedRows = [];
    const r = await applyCreditsToRenewal('user-1', now);
    expect(r.monthsApplied).toBe(0);
    expect(r.newRenewalAt.toISOString()).toBe(now.toISOString());
    expect(r.consumed).toEqual([]);
  });

  test('two 1-month credits → newRenewalAt +2 months', async () => {
    mockConsumedRows = [
      { consumedId: 'c1', monthsFree: 1, sourceType: 'referral', sourceId: 'a' },
      { consumedId: 'c2', monthsFree: 1, sourceType: 'referral', sourceId: 'b' },
    ];
    const r = await applyCreditsToRenewal('user-1', now);
    expect(r.monthsApplied).toBe(2);
    expect(r.newRenewalAt.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  test('sums monthsFree even when rows are multi-month', async () => {
    mockConsumedRows = [
      { consumedId: 'c1', monthsFree: 3, sourceType: 'promo', sourceId: null },
      { consumedId: 'c2', monthsFree: 1, sourceType: 'referral', sourceId: 'a' },
    ];
    const r = await applyCreditsToRenewal('user-1', now);
    expect(r.monthsApplied).toBe(4);
    expect(r.newRenewalAt.toISOString().slice(0, 10)).toBe('2026-09-01');
  });

  test('caps maxMonths at 12 to prevent absurd jumps', async () => {
    await applyCreditsToRenewal('user-1', now, { maxMonths: 99 });
    expect(mockLastMaxMonths).toBe(12);
  });

  test('clamps maxMonths to at least 1', async () => {
    await applyCreditsToRenewal('user-1', now, { maxMonths: 0 });
    expect(mockLastMaxMonths).toBe(1);
  });

  test('default maxMonths is 12', async () => {
    await applyCreditsToRenewal('user-1', now);
    expect(mockLastMaxMonths).toBe(12);
  });
});
