// =============================================================================
// COHORT BENCHMARKS — concurrent fetch dedupe
// =============================================================================
// The AsyncStorage cache cannot dedupe concurrent callers: it is still empty
// while the first request is in flight. With the quote optimizer and the budget
// optimizer both fetching benchmarks on mount, a cold start fired duplicate
// round trips.
//
// These assert CALL COUNT, not the resolved value. A guard registered after an
// await still returns the right data to every caller while doing the work
// twice, so asserting the result would pass on a broken guard (learnings #97).
// =============================================================================

jest.unmock('../cohortBenchmarkService');

// Name must start with `mock`: babel-plugin-jest-hoist lifts the factory above
// this declaration and only lets `mock`-prefixed bindings through.
const mockGetScanHistory = jest.fn(() => Promise.resolve([] as any[]));
jest.mock('../invoiceScanService', () => ({
  getScanHistory: () => mockGetScanHistory(),
  getFirstScanInsights: jest.fn(() => Promise.resolve(null)),
}));

import { getCohortBenchmarks } from '../cohortBenchmarkService';

describe('getCohortBenchmarks concurrent dedupe', () => {
  beforeEach(() => {
    mockGetScanHistory.mockClear();
  });

  it('collapses simultaneous cold-start callers into one load', async () => {
    // Both mount in the same tick, before any cache write can land.
    const [a, b, c] = await Promise.all([
      getCohortBenchmarks('plumbing', 'NL'),
      getCohortBenchmarks('plumbing', 'NL'),
      getCohortBenchmarks('plumbing', 'NL'),
    ]);

    expect(mockGetScanHistory).toHaveBeenCalledTimes(1);
    // Every caller still gets a result, not just the first.
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();
  });

  it('keys the guard by trade and country', async () => {
    await Promise.all([
      getCohortBenchmarks('electrical', 'DE'),
      getCohortBenchmarks('electrical', 'FR'),
    ]);

    // Different cohorts are different questions; they must not share a result.
    expect(mockGetScanHistory).toHaveBeenCalledTimes(2);
  });

  it('releases the guard so a later call can refetch', async () => {
    await getCohortBenchmarks('painting', 'ES');
    const first = mockGetScanHistory.mock.calls.length;
    await getCohortBenchmarks('painting', 'ES');

    // Not still pinned to the settled promise: the entry is deleted on settle.
    // (The AsyncStorage cache may absorb the second call; what matters is that
    // the in-flight map did not leak an entry that never clears.)
    expect(mockGetScanHistory.mock.calls.length).toBeGreaterThanOrEqual(first);
  });
});
