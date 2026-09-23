/**
 * A DATANORM import says how many articles actually LANDED, and attributes
 * price rows to the signed-in contractor.
 *
 * It defaulted observed_by to the string 'datanorm-import' — which the uuid FK
 * rejects — and counted every article "imported" whatever the writes did, so
 * the Inkoop screen reported success over zero rows. A failed article was also
 * added to the local dedupe set, so a retry skipped it forever (#363).
 */
const mockInserts: Array<{ table: string; payload: any }> = [];
let mockCatalogError: any = null;
const mockMoatInsert = jest.fn(async (..._a: any[]) => true);

jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: '11111111-1111-1111-1111-111111111111' } } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      insert: async (payload: any) => {
        mockInserts.push({ table, payload });
        return table === 'material_catalog' ? { error: mockCatalogError } : { error: null };
      },
    }),
  },
}));
jest.mock('../lib/currentUser', () => ({
  getAuthedUserId: () => '11111111-1111-1111-1111-111111111111',
  getCurrentUserId: () => '11111111-1111-1111-1111-111111111111',
  getCurrentCountry: () => 'DE',
}));
jest.mock('../intelligence/dataCollector', () => ({
  emitMaterialPurchased: (...a: any[]) => (mockMoatInsert as any)(...a),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { importDatanormToMoat } from '../integrations/datanorm';

const article = (n: string) => ({
  articleNumber: n, description: `Kupferrohr ${n}`, unitPrice: 12.5, unit: 'm', packageSize: 1,
} as any);

describe('DATANORM import reports what landed', () => {
  beforeEach(async () => {
    mockInserts.length = 0;
    mockCatalogError = null;
    mockMoatInsert.mockClear();
    await AsyncStorage.clear();
  });

  it('attributes price rows to the signed-in contractor, never a placeholder string', async () => {
    await importDatanormToMoat([article('A1')], 'richter');
    expect(mockMoatInsert).toHaveBeenCalledTimes(1);
    expect((mockMoatInsert.mock.calls[0] as any[])[0]).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('counts a failed catalogue write as failed, not imported', async () => {
    mockCatalogError = { message: 'network' };
    const r = await importDatanormToMoat([article('B1'), article('B2')], 'richter');
    expect(r).toEqual({ imported: 0, skipped: 0, failed: 2 });
    // ...and writes NO price row: the old order wrote it first, so every
    // "import again to retry" duplicated it in material_price_history.
    expect(mockMoatInsert).not.toHaveBeenCalled();
  });

  it('retries only the price row when that is what failed', async () => {
    mockMoatInsert.mockResolvedValueOnce(false);
    const first = await importDatanormToMoat([article('D1')], 'richter');
    // Its price row did not land: failed, not imported (review #366).
    expect(first).toMatchObject({ imported: 0, failed: 1 });
    const again = await importDatanormToMoat([article('D1')], 'richter');
    // Not skipped as a duplicate: its price row never landed.
    expect(again.skipped).toBe(0);
    expect(mockMoatInsert).toHaveBeenCalledTimes(2);
  });

  it("next year's list at a new price is recorded, not skipped as a duplicate", async () => {
    await importDatanormToMoat([article('E1')], 'richter');
    const nextYear = await importDatanormToMoat([{ ...article('E1'), unitPrice: 13.5 }], 'richter');
    expect(nextYear).toEqual({ imported: 1, skipped: 0, failed: 0 });
    const sameAgain = await importDatanormToMoat([{ ...article('E1'), unitPrice: 13.5 }], 'richter');
    expect(sameAgain.skipped).toBe(1);
  });

  it('retries a failed article next time instead of skipping it as a duplicate', async () => {
    mockCatalogError = { message: 'network' };
    await importDatanormToMoat([article('C1')], 'richter');
    mockCatalogError = null;
    const r = await importDatanormToMoat([article('C1')], 'richter');
    expect(r).toEqual({ imported: 1, skipped: 0, failed: 0 });
  });
});

// Sweep 2026-09-23, C4.
describe('DATANORM import state', () => {
  beforeEach(async () => {
    mockInserts.length = 0;
    mockCatalogError = null;
    mockMoatInsert.mockClear();
    await AsyncStorage.clear();
  });

  it('a price that goes back to an earlier value is recorded (A → B → A)', async () => {
    await importDatanormToMoat([article('F1')], 'richter');                          // 12.50
    await importDatanormToMoat([{ ...article('F1'), unitPrice: 13.5 }], 'richter'); // 13.50
    const back = await importDatanormToMoat([article('F1')], 'richter');             // 12.50 again
    expect(back).toEqual({ imported: 1, skipped: 0, failed: 0 });
    expect(mockMoatInsert).toHaveBeenCalledTimes(3);
  });

  it('a 100k-article list never stores one value past ~1 MB (Android reads fail near 2 MB)', async () => {
    const many = Array.from({ length: 100_000 }, (_, i) => ({ ...article(`ART-${String(i).padStart(8, '0')}`), unitPrice: 1234.56 }));
    await importDatanormToMoat(many, 'gc_gruppe_grosshandel');
    const keys = await AsyncStorage.getAllKeys();
    const values = await AsyncStorage.multiGet(keys);
    const biggest = Math.max(...values.map(([, v]) => (v ?? '').length));
    expect(biggest).toBeLessThan(1_000_000);
    // ...and the whole list reads back: the same file again skips everything.
    mockMoatInsert.mockClear();
    const again = await importDatanormToMoat(many, 'gc_gruppe_grosshandel');
    expect(again.skipped).toBe(100_000);
    expect(mockMoatInsert).not.toHaveBeenCalled();
  }, 60_000);

  it('carries the old flat set over, so an upgrade does not re-import everything', async () => {
    await AsyncStorage.setItem('@vasco_datanorm_imported:11111111-1111-1111-1111-111111111111',
      JSON.stringify(['richter:G1:12.5', 'richter:G2', 'other:G1:9']));
    const r = await importDatanormToMoat([article('G1'), article('G2')], 'richter');
    // G1 at 12.50 was imported before; G2 had no recorded price, so it is written.
    expect(r).toEqual({ imported: 1, skipped: 1, failed: 0 });
    expect(await AsyncStorage.getItem('@vasco_datanorm_imported:11111111-1111-1111-1111-111111111111')).toBeNull();
    // The other supplier's entry survived the migration.
    const other = await importDatanormToMoat([{ ...article('G1'), unitPrice: 9 }], 'other');
    expect(other.skipped).toBe(1);
  });
});

describe('an unreadable legacy set', () => {
  it('is deleted, not kept holding storage forever', async () => {
    await AsyncStorage.clear();
    const KEY = '@vasco_datanorm_imported:11111111-1111-1111-1111-111111111111';
    await AsyncStorage.setItem(KEY, '["x"]');
    // The legacy read is the first getItem of the import; only it fails.
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(async () => { throw new Error('Row too big to fit into CursorWindow'); });
    const r = await importDatanormToMoat([article('H1')], 'richter');
    expect(r.imported).toBe(1);
    expect(await AsyncStorage.getAllKeys()).not.toContain(KEY);
  });
});
