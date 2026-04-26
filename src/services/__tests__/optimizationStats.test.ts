/**
 * @jest-environment node
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const mockStore: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
      setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
      removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
      __mockStore: mockStore,
    },
  };
});

describe('optimizationStatsService', () => {
  beforeEach(() => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const store = AsyncStorage.__mockStore as Record<string, string>;
    for (const k of Object.keys(store)) delete store[k];
  });

  test('zero events → all stats zero', async () => {
    const svc = require('../optimizationStatsService');
    const stats = await svc.getWeeklyStats();
    expect(stats.weekKmSaved).toBe(0);
    expect(stats.weekOptimizationCount).toBe(0);
    expect(stats.totalLifetime).toBe(0);
  });

  test('applied optimization counts toward weekly savings', async () => {
    const svc = require('../optimizationStatsService');
    await svc.recordOptimization({
      date: '2026-04-28', jobCount: 4,
      driveKmBefore: 50, driveMinBefore: 60,
      driveKmAfter: 30, driveMinAfter: 36,
      warnings: 0, applied: true,
    });
    const stats = await svc.getWeeklyStats();
    expect(stats.weekKmSaved).toBe(20);
    expect(stats.weekMinSaved).toBe(24);
    expect(stats.weekOptimizationCount).toBe(1);
    expect(stats.weekJobsReordered).toBe(4);
  });

  test('unapplied optimization is recorded but not counted', async () => {
    const svc = require('../optimizationStatsService');
    await svc.recordOptimization({
      date: '2026-04-28', jobCount: 3,
      driveKmBefore: 40, driveMinBefore: 48,
      driveKmAfter: 20, driveMinAfter: 24,
      warnings: 0, applied: false,
    });
    const stats = await svc.getWeeklyStats();
    expect(stats.weekKmSaved).toBe(0);
    expect(stats.totalLifetime).toBe(0);
  });

  test('multiple events sum correctly', async () => {
    const svc = require('../optimizationStatsService');
    await svc.recordOptimization({ date: '2026-04-28', jobCount: 3, driveKmBefore: 30, driveMinBefore: 36, driveKmAfter: 20, driveMinAfter: 24, warnings: 0, applied: true });
    await svc.recordOptimization({ date: '2026-04-29', jobCount: 4, driveKmBefore: 50, driveMinBefore: 60, driveKmAfter: 30, driveMinAfter: 36, warnings: 0, applied: true });
    const stats = await svc.getWeeklyStats();
    expect(stats.weekKmSaved).toBe(30);
    expect(stats.weekMinSaved).toBe(36);
    expect(stats.weekOptimizationCount).toBe(2);
    expect(stats.weekJobsReordered).toBe(7);
  });

  test('negative savings clamped to 0', async () => {
    const svc = require('../optimizationStatsService');
    await svc.recordOptimization({
      date: '2026-04-28', jobCount: 3,
      driveKmBefore: 20, driveMinBefore: 24,
      driveKmAfter: 30, driveMinAfter: 36,           // worse afterward
      warnings: 0, applied: true,
    });
    const stats = await svc.getWeeklyStats();
    expect(stats.weekKmSaved).toBe(0);
    expect(stats.weekMinSaved).toBe(0);
  });
});
