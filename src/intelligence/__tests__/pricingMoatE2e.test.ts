/**
 * @jest-environment node
 *
 * R50 — Pricing-moat loop closes end-to-end.
 *
 * `emitMaterialPurchased` is the single entry point that has to feed two
 * tables in one breath:
 *   1. `business_events` — for cohort-wide event analytics + the spike
 *      detection generator
 *   2. `material_price_history` — direct training signal for the price-spike
 *      and supplier-lead-time predictors (the cohort price moat)
 *
 * Past regressions (R241 wrote columns that didn't exist on the table; R275
 * realigned to schema; R283 fixed the `source` mis-attribution where
 * manual-add rows were tagged `invoice_scan`) prove this contract is
 * fragile. This e2e locks the full payload shape and the cross-table
 * attribution invariants.
 */

let mockTrade: string | null = 'plumbing';
let mockCountry: string | null = 'NL';

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-moat',
  getCurrentTrade: () => mockTrade,
  getCurrentCountry: () => mockCountry,
}));

const mockInserts: Array<{ table: string; row: any }> = [];

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      insert: async (rows: any) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        for (const row of arr) mockInserts.push({ table, row });
        return { error: null };
      },
    }),
    rpc: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitMaterialPurchased } from '../dataCollector';

const QUEUE_KEY = '@vasco_event_queue';

describe('R50 — pricing-moat dual-write closes', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
    mockInserts.length = 0;
    mockTrade = 'plumbing';
    mockCountry = 'NL';
  });

  it('manual addJobMaterial path writes business_events + material_price_history with consistent attribution', async () => {
    await emitMaterialPurchased('user-moat', {
      materialName: '22mm copper pipe (3m)',
      supplierId: 'sup-tu',
      supplierName: 'Technische Unie',
      price: 18.5,
      quantity: 4,
      unit: 'piece',
      trade: 'plumbing',
      jobId: 'job-1',
      // Defaults exercised: country, source.
    });

    // Both writes happened.
    const beRows = mockInserts.filter((m) => m.table === 'business_events');
    const mphRows = mockInserts.filter((m) => m.table === 'material_price_history');
    expect(beRows).toHaveLength(1);
    expect(mphRows).toHaveLength(1);

    // business_events shape — entityId is the cohort key (supplierId_materialName).
    const be = beRows[0].row;
    expect(be.event_type).toBe('material_purchased');
    expect(be.entity_type).toBe('material');
    expect(be.entity_id).toBe('sup-tu_22mm copper pipe (3m)');
    expect(be.user_id).toBe('user-moat');
    expect(be.trade).toBe('plumbing');
    expect(be.country).toBe('NL');

    // material_price_history shape — schema-aligned per R275.
    const mph = mphRows[0].row;
    expect(mph.observed_by).toBe('user-moat');
    expect(mph.supplier_id).toBe('sup-tu');
    expect(mph.supplier_name).toBe('Technische Unie');
    expect(mph.material_name).toBe('22mm copper pipe (3m)');
    expect(mph.unit).toBe('piece');
    expect(mph.price_excl_vat).toBe(18.5);
    expect(mph.currency).toBe('EUR'); // default
    expect(mph.trade).toBe('plumbing');
    expect(mph.country).toBe('NL'); // R282 — defaults from currentUser, not hardcoded
    expect(mph.source).toBe('manual'); // R283 — default for non-OCR callers
    expect(typeof mph.observed_at).toBe('string');

    // Cross-table attribution must agree — predictors join on these keys.
    expect(mph.observed_by).toBe(be.user_id);
    expect(mph.trade).toBe(be.trade);
    expect(mph.country).toBe(be.country);
  });

  it('OCR receipt-scan path tags source=invoice_scan and threads enrichment', async () => {
    await emitMaterialPurchased('user-moat', {
      materialName: 'Knauf Diamant',
      supplierId: 'sup-bauhaus',
      supplierName: 'Bauhaus',
      price: 12.99,
      quantity: 10,
      unit: 'sack',
      trade: 'plastering',
      country: 'DE',
      brand: 'Knauf',
      eanCode: '4006379012345',
      currency: 'EUR',
      vatRate: 0.19,
      source: 'invoice_scan',
      observedAt: '2026-05-04T08:00:00.000Z',
    });

    const mph = mockInserts.find((m) => m.table === 'material_price_history')?.row;
    expect(mph).toBeTruthy();
    expect(mph.brand).toBe('Knauf');
    expect(mph.ean_code).toBe('4006379012345');
    expect(mph.vat_rate).toBe(0.19);
    expect(mph.country).toBe('DE'); // explicit, not currentUser default
    expect(mph.trade).toBe('plastering');
    expect(mph.source).toBe('invoice_scan'); // R283: not mis-tagged as manual
    expect(mph.observed_at).toBe('2026-05-04T08:00:00.000Z'); // OCR-supplied timestamp preserved
  });

  it('country defaults from currentUser when caller omits it (R282 fix)', async () => {
    mockCountry = 'FR';
    await emitMaterialPurchased('user-moat', {
      materialName: 'Pipe',
      supplierId: 'sup-x',
      supplierName: 'X',
      price: 10,
      quantity: 1,
      unit: 'piece',
      trade: 'plumbing',
      // country deliberately omitted
    });

    const mph = mockInserts.find((m) => m.table === 'material_price_history')?.row;
    expect(mph.country).toBe('FR'); // not hardcoded 'NL'
  });
});
