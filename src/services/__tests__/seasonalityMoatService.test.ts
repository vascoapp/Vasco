/**
 * @jest-environment node
 */

const mockStorage = new Map<string, string>();
let mockRpcResponses: Record<string, unknown> = {};
let mockRpcCalls: Array<{ fn: string }> = [];

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: jest.fn(async (fn: string) => {
      mockRpcCalls.push({ fn });
      return { data: mockRpcResponses[fn] ?? null, error: null };
    }),
  },
}));

import {
  seasonOfMonth,
  currentSeason,
  getQuoteSeasonalPattern,
  getMaterialSeasonalPattern,
  acceptanceDeltaVsBest,
  materialPriceVsCheapestSeason,
  type QuoteSeasonalBundle,
  type MaterialSeasonalBundle,
} from '../seasonalityMoatService';

beforeEach(() => {
  mockStorage.clear();
  mockRpcResponses = {};
  mockRpcCalls = [];
});

describe('seasonalityMoatService — season helpers', () => {
  test('seasonOfMonth buckets months correctly', () => {
    expect(seasonOfMonth(1)).toBe('winter');
    expect(seasonOfMonth(2)).toBe('winter');
    expect(seasonOfMonth(12)).toBe('winter');
    expect(seasonOfMonth(3)).toBe('spring');
    expect(seasonOfMonth(5)).toBe('spring');
    expect(seasonOfMonth(6)).toBe('summer');
    expect(seasonOfMonth(8)).toBe('summer');
    expect(seasonOfMonth(9)).toBe('autumn');
    expect(seasonOfMonth(11)).toBe('autumn');
  });

  test('currentSeason derives from Date', () => {
    expect(currentSeason(new Date(2026, 0, 15))).toBe('winter'); // Jan
    expect(currentSeason(new Date(2026, 6, 15))).toBe('summer'); // Jul
  });
});

describe('getQuoteSeasonalPattern', () => {
  test('parses, caches 24h, returns typed rows', async () => {
    mockRpcResponses['get_seasonal_pattern'] = [
      { season: 'winter', median_price: 50, acceptance_rate: 0.48, sample_size: 100, contractor_count: 8 },
      { season: 'summer', median_price: 55, acceptance_rate: 0.68, sample_size: 140, contractor_count: 12 },
    ];
    const a = await getQuoteSeasonalPattern('plumbing', 'NL');
    const b = await getQuoteSeasonalPattern('plumbing', 'NL');
    expect(a?.rows).toHaveLength(2);
    expect(a?.rows[0].season).toBe('winter');
    expect(a?.rows[1].acceptanceRate).toBeCloseTo(0.68, 5);
    expect(mockRpcCalls.filter(c => c.fn === 'get_seasonal_pattern')).toHaveLength(1); // cached
    expect(b?.rows).toHaveLength(2);
  });

  test('empty array from server returns empty bundle (not null)', async () => {
    mockRpcResponses['get_seasonal_pattern'] = [];
    const r = await getQuoteSeasonalPattern('plumbing', 'NL');
    expect(r?.rows).toEqual([]);
  });
});

describe('getMaterialSeasonalPattern', () => {
  test('parses rows + per-material caching independence', async () => {
    mockRpcResponses['get_material_seasonal_pattern'] = [
      { season: 'winter', material_name: 'copper pipe 15mm', unit: 'meter', median_price: 4.2, sample_size: 40, observer_count: 7 },
      { season: 'summer', material_name: 'copper pipe 15mm', unit: 'meter', median_price: 3.9, sample_size: 30, observer_count: 6 },
    ];
    await getMaterialSeasonalPattern('plumbing', 'NL');
    await getMaterialSeasonalPattern('plumbing', 'NL', 'pvc 40mm');
    const calls = mockRpcCalls.filter(c => c.fn === 'get_material_seasonal_pattern');
    expect(calls).toHaveLength(2); // different cache keys
  });
});

describe('acceptanceDeltaVsBest', () => {
  const bundle: QuoteSeasonalBundle = {
    fetchedAt: new Date().toISOString(),
    rows: [
      { season: 'winter', medianPrice: 50, acceptanceRate: 0.48, sampleSize: 100, contractorCount: 8 },
      { season: 'summer', medianPrice: 55, acceptanceRate: 0.68, sampleSize: 140, contractorCount: 12 },
    ],
  };

  test('returns delta vs best when current season row exists', () => {
    const winter = new Date(2026, 0, 15);
    const r = acceptanceDeltaVsBest(bundle, winter);
    expect(r?.current.season).toBe('winter');
    expect(r?.best.season).toBe('summer');
    expect(r?.deltaPp).toBeCloseTo(20, 5);
  });

  test('returns null when current season has no row', () => {
    const autumn = new Date(2026, 9, 15);
    expect(acceptanceDeltaVsBest(bundle, autumn)).toBeNull();
  });

  test('returns null for thin bundles (<2 rows)', () => {
    expect(acceptanceDeltaVsBest({ fetchedAt: '', rows: [] })).toBeNull();
  });
});

describe('materialPriceVsCheapestSeason', () => {
  const bundle: MaterialSeasonalBundle = {
    fetchedAt: new Date().toISOString(),
    rows: [
      { season: 'winter', materialName: 'copper pipe 15mm', unit: 'meter', medianPrice: 4.2, sampleSize: 40, observerCount: 7 },
      { season: 'summer', materialName: 'copper pipe 15mm', unit: 'meter', medianPrice: 3.5, sampleSize: 30, observerCount: 6 },
    ],
  };

  test('computes current-season pct above cheapest season', () => {
    const winter = new Date(2026, 0, 15);
    const r = materialPriceVsCheapestSeason(bundle, 'copper pipe 15mm', winter);
    expect(r?.current.season).toBe('winter');
    expect(r?.cheapest.season).toBe('summer');
    expect(r?.pctAboveCheapest).toBeCloseTo(20, 1);
  });

  test('returns null when material has <2 seasons of data', () => {
    const thin = {
      fetchedAt: '',
      rows: [bundle.rows[0]],
    };
    expect(materialPriceVsCheapestSeason(thin, 'copper pipe 15mm')).toBeNull();
  });
});
