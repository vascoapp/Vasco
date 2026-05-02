/**
 * @jest-environment node
 *
 * R283 — emitMaterialPurchased extended with OCR enrichment fields
 * (brand, eanCode, currency, vatRate, observedAt, source). The single-
 * write path replaces the prior double-write in feedPricingMoat.
 *
 * Tests verify:
 *  - enrichment fields land on the material_price_history insert
 *  - source defaults to 'manual' when caller omits it (was hardcoded
 *    'invoice_scan' pre-R283, mis-tagging non-scan writes)
 *  - OCR callers can pass 'invoice_scan' explicitly
 *  - country falls back to currentUser when caller omits it
 */

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-abc',
  getCurrentTrade: () => 'painting',
  getCurrentCountry: () => 'DE',
}));

// Track inserts per table so we can isolate the material_price_history row
// from incidental business_events writes that flushToCloud also performs.
const mockInsertsByTable: Record<string, any[]> = {};
const mockFrom = jest.fn((table: string) => ({
  insert: jest.fn(async (row: any) => {
    (mockInsertsByTable[table] ||= []).push(row);
    return { error: null };
  }),
}));
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...a: any[]) => mockFrom(...(a as [string])), rpc: jest.fn() },
}));

import { emitMaterialPurchased } from '../dataCollector';

describe('emitMaterialPurchased — R283 enrichment', () => {
  beforeEach(() => {
    Object.keys(mockInsertsByTable).forEach((k) => delete mockInsertsByTable[k]);
    mockFrom.mockClear();
  });

  function lastMphRow() {
    const rows = mockInsertsByTable['material_price_history'] ?? [];
    return rows[rows.length - 1];
  }

  it('writes enrichment fields when caller provides them', async () => {
    await emitMaterialPurchased('user-abc', {
      materialName: 'matte white wall paint 5L',
      supplierId: 'hornbach',
      supplierName: 'Hornbach',
      price: 24.95,
      quantity: 1,
      unit: 'can',
      trade: 'painting',
      country: 'DE',
      brand: 'Caparol',
      eanCode: '4002392007234',
      currency: 'EUR',
      vatRate: 19,
      observedAt: '2026-04-30T10:00:00Z',
      source: 'invoice_scan',
    });
    expect(mockFrom).toHaveBeenCalledWith('material_price_history');
    const row = lastMphRow();
    expect(row.brand).toBe('Caparol');
    expect(row.ean_code).toBe('4002392007234');
    expect(row.currency).toBe('EUR');
    expect(row.vat_rate).toBe(19);
    expect(row.source).toBe('invoice_scan');
    expect(row.observed_at).toBe('2026-04-30T10:00:00Z');
    expect(row.country).toBe('DE');
  });

  it("source defaults to 'manual' when caller omits it (was hardcoded 'invoice_scan' pre-R283)", async () => {
    await emitMaterialPurchased('user-abc', {
      materialName: 'pipe coupling',
      supplierId: 'rexel',
      supplierName: 'Rexel',
      price: 4.5,
      quantity: 2,
      unit: 'piece',
      trade: 'plumbing',
    });
    const row = lastMphRow();
    expect(row.source).toBe('manual');
  });

  it("currency defaults to 'EUR' when omitted", async () => {
    await emitMaterialPurchased('user-abc', {
      materialName: 'cable 2.5mm',
      supplierId: 'rexel',
      supplierName: 'Rexel',
      price: 1.2,
      quantity: 50,
      unit: 'm',
      trade: 'electrical',
    });
    const row = lastMphRow();
    expect(row.currency).toBe('EUR');
  });

  it('country falls back to currentUser country when caller omits it', async () => {
    await emitMaterialPurchased('user-abc', {
      materialName: 'sealant',
      supplierId: 'bauhaus',
      supplierName: 'Bauhaus',
      price: 6.99,
      quantity: 1,
      unit: 'tube',
      trade: 'painting',
    });
    const row = lastMphRow();
    expect(row.country).toBe('DE');
  });

  it('observed_at defaults to current time ISO when caller omits it', async () => {
    const before = new Date().toISOString();
    await emitMaterialPurchased('user-abc', {
      materialName: 'plaster bag 25kg',
      supplierId: 'bouwmaat',
      supplierName: 'Bouwmaat',
      price: 11.5,
      quantity: 1,
      unit: 'bag',
      trade: 'plastering',
    });
    const row = lastMphRow();
    expect(typeof row.observed_at).toBe('string');
    // Generated ISO should sort >= the timestamp captured before the call
    expect(row.observed_at >= before).toBe(true);
  });

  it("DATANORM-style 'catalog' source attribution writes through correctly", async () => {
    await emitMaterialPurchased('datanorm-import', {
      materialName: 'mounting bracket M6',
      supplierId: 'richter_frenzel',
      supplierName: 'Richter Frenzel',
      price: 0.85,
      quantity: 1,
      unit: 'piece',
      trade: 'plumbing',
      country: 'DE',
      source: 'catalog',
    });
    const row = lastMphRow();
    expect(row.source).toBe('catalog');
    expect(row.observed_by).toBe('datanorm-import');
  });
});
