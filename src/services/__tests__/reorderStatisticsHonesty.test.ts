/**
 * @jest-environment node
 *
 * INKOOP HERO STATS — no invented performance, and no 0% standing in for "unknown"
 *
 * The Inkoop screen headlines three numbers about the contractor's own buying
 * performance. They used to be five hardcoded constants returned to everybody,
 * which put "12 stockouts avoided · EUR 1.245 saved · 87% accurate" directly
 * above "Nog geen voorraad bijgehouden" and beside a real "EUR 2 saved this
 * month". A screen that contradicts itself in two places is worse than a screen
 * showing zeros.
 *
 * Two properties are pinned here:
 *
 * 1. With no reorder history, nothing is invented — including in DEMO_MODE,
 *    where the showcase values are only justified once demo stock exists.
 * 2. `accuracyRate` is null, NOT 0. Those are different claims: 0% says our
 *    forecasts are never right; null says we have never measured. The service
 *    keeps no prediction-vs-actual history, so only the second is true, and
 *    the UI omits the tile rather than rendering "0%".
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));
jest.mock('../../config/demo', () => ({ DEMO_MODE: true }));

import { reorderService } from '../reorderService';

describe('with no reorder history', () => {
  it('reports null accuracy rather than 0%', () => {
    // 0 and null are different claims. This is the assertion that stops
    // someone "tidying" null away to a number.
    expect(reorderService.getStatistics().accuracyRate).toBeNull();
  });

  it('invents no savings, orders or avoided stockouts — even in demo', () => {
    const s = reorderService.getStatistics();
    expect(s.totalSavings).toBe(0);
    expect(s.stockoutsAvoided).toBe(0);
    expect(s.ordersPlaced).toBe(0);
    expect(s.suggestionsGenerated).toBe(0);
  });

  it('specifically does not return the old showcase constants', () => {
    const s = reorderService.getStatistics();
    expect([s.totalSavings, s.stockoutsAvoided, s.accuracyRate])
      .not.toEqual([1245, 12, 87]);
  });
});
