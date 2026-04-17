/**
 * @jest-environment node
 */

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { from: () => ({ insert: async () => ({ error: new Error('not configured') }) }) },
}));

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-abc',
}));

import {
  trackClick,
  getRevenueSummary,
  generateBacklink,
  flushPendingAffiliateClicks,
  SUPPLIERS,
} from '../supplierBacklinkService';

beforeEach(() => {
  mockStorage.clear();
});

describe('generateBacklink', () => {
  it('mints a URL with the supplier affiliate param + user_id', () => {
    const result = generateBacklink('technische-unie', 'user-abc');
    expect(result).not.toBeNull();
    expect(result!.trackedUrl).toContain('ref=vasco');
    expect(result!.trackedUrl).toContain('user-abc');
    expect(result!.supplier.id).toBe('technische-unie');
    expect(result!.estimatedCommission).toBeGreaterThan(0);
  });

  it('returns null for an unknown supplier', () => {
    expect(generateBacklink('not-a-supplier', 'user-abc')).toBeNull();
  });
});

describe('trackClick', () => {
  it('persists a click to AsyncStorage with estimatedCommission', async () => {
    await trackClick('technische-unie');
    const saved = JSON.parse(mockStorage.get('@vasco_affiliate_clicks') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].supplierId).toBe('technische-unie');
    expect(saved[0].converted).toBe(false);
    expect(saved[0].estimatedCommission).toBeCloseTo(
      Math.round(280 * (3.5 / 100) * 100) / 100,
      2,
    );
  });

  it('silently no-ops for unknown supplier ids', async () => {
    await trackClick('ghost-supplier');
    const saved = JSON.parse(mockStorage.get('@vasco_affiliate_clicks') ?? '[]');
    expect(saved).toHaveLength(0);
  });

  it('queues the click id to the pending-sync list when Supabase is not configured', async () => {
    await trackClick('rexel');
    const pending = JSON.parse(mockStorage.get('@vasco_affiliate_clicks_pending') ?? '[]');
    expect(pending).toHaveLength(1);
  });
});

describe('getRevenueSummary', () => {
  it('aggregates clicks + converted commission + estimated commission', async () => {
    await trackClick('technische-unie');
    await trackClick('technische-unie');
    await trackClick('rexel');

    // Simulate one conversion by mutating the stored log.
    const stored = JSON.parse(mockStorage.get('@vasco_affiliate_clicks') ?? '[]');
    stored[0].converted = true;
    stored[0].orderValue = 400;
    stored[0].commission = 14;
    mockStorage.set('@vasco_affiliate_clicks', JSON.stringify(stored));

    const summary = await getRevenueSummary();
    expect(summary.totalClicks).toBe(3);
    expect(summary.totalConversions).toBe(1);
    expect(summary.conversionRate).toBeCloseTo(1 / 3, 3);
    expect(summary.totalCommission).toBe(14);
    expect(summary.topSuppliers.length).toBeGreaterThan(0);
    // Technische Unie ranks first (two clicks + the conversion)
    expect(summary.topSuppliers[0].supplierId).toBe('technische-unie');
  });

  it('returns zero-valued summary when there are no clicks', async () => {
    const summary = await getRevenueSummary();
    expect(summary.totalClicks).toBe(0);
    expect(summary.conversionRate).toBe(0);
    expect(summary.topSuppliers).toEqual([]);
  });
});

describe('flushPendingAffiliateClicks', () => {
  it('no-ops when Supabase is not configured', async () => {
    await trackClick('technische-unie');
    const { sent, remaining } = await flushPendingAffiliateClicks();
    expect(sent).toBe(0);
    expect(remaining).toBe(0);
  });
});

describe('SUPPLIERS catalog integrity', () => {
  it('every supplier has a non-empty affiliate param + >0 commission + >0 avg order value', () => {
    for (const s of SUPPLIERS) {
      expect(s.affiliateParam).toMatch(/=/);
      expect(s.commissionRate).toBeGreaterThan(0);
      expect(s.avgOrderValue).toBeGreaterThan(0);
      expect(s.countries.length).toBeGreaterThan(0);
      expect(s.trades.length).toBeGreaterThan(0);
    }
  });
});
