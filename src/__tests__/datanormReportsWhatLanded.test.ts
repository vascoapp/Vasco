/**
 * A DATANORM import says how many articles actually LANDED — and the server,
 * not the phone, decides what is new (migration 20261001000002).
 *
 * History: it attributed price rows to the string 'datanorm-import' and counted
 * every article "imported" whatever the writes did (#363); then a local
 * "last price per article" map decided what was new (#366, C4) — 3 MB per
 * wholesaler list against Android's ~6 MB AsyncStorage TOTAL, where a full
 * store fails every setItem, the offline queue's included. The server's own
 * behaviour (dedupe, last occurrence wins, atomic batch) is proven live by
 * `npm run check:catalog-import`; this file pins the app's half.
 */
jest.mock('../lib/supabase', () =>
  require('../test-utils/fakeSupabase').fakeSupabaseModule({ userId: '11111111-1111-1111-1111-111111111111' }));
jest.mock('../lib/currentUser', () => ({
  getAuthedUserId: () => '11111111-1111-1111-1111-111111111111',
  getCurrentUserId: () => '11111111-1111-1111-1111-111111111111',
  getCurrentCountry: () => 'DE',
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { importDatanormToMoat, CATALOG_BATCH } from '../integrations/datanorm';
// The screen always passes the contractor's market (it asks first); no market = nothing imported (sweep D6).
const MARKET = { country: 'DE' };

const fake = (require('../lib/supabase') as any).__fake;

const article = (n: string, unitPrice = 12.5) => ({
  articleNumber: n, description: `Kupferrohr ${n}`, unitPrice, unit: 'm', packageSize: 1,
} as any);

// The server, as far as the app can tell: last price per canonical key.
let server: Map<string, number>;
let failBatch: number | null;
const batches = () => fake.calls.filter((c: any) => c.table === 'rpc:import_catalog_prices');

beforeEach(async () => {
  await AsyncStorage.clear();
  fake.reset();
  server = new Map();
  failBatch = null;
  let n = 0;
  fake.rpc('import_catalog_prices', (args: any) => {
    if (failBatch === n++) return { data: null, error: { code: '08006', message: 'connection lost' } };
    let imported = 0;
    for (const it of args.p_items) {
      if (server.get(it.k) !== it.p) { server.set(it.k, it.p); imported++; }
    }
    return { data: [{ imported, skipped: args.p_items.length - imported }], error: null };
  });
});

describe('DATANORM import, deduplicated on the server', () => {
  it('sends the list in bounded batches to the live function, with its real argument names', async () => {
    const list = Array.from({ length: 2 * CATALOG_BATCH + 500 }, (_, i) => article(`ART-${i}`));
    const r = await importDatanormToMoat(list, 'richter', { supplierName: 'Richter', trade: 'plumbing', country: 'DE' });
    expect(r).toEqual({ imported: list.length, skipped: 0, failed: 0 });
    // The fake answers PGRST202 to a misspelt argument, which would count as failed.
    expect(batches().map((c: any) => c.payload.p_items.length)).toEqual([CATALOG_BATCH, CATALOG_BATCH, 500]);
    expect(batches()[0].payload).toMatchObject({ p_supplier_id: 'richter', p_supplier_name: 'Richter', p_trade: 'plumbing', p_country: 'DE', p_currency: 'EUR' });
  });

  it('keys each article by supplier + article number, as every other price row', async () => {
    await importDatanormToMoat([{ ...article('AB-123'), extendedDescription: '15 mm' }], 'richter', MARKET);
    expect(batches()[0].payload.p_items[0]).toEqual({ a: 'AB-123', n: 'Kupferrohr AB-123 — 15 mm', u: 'm', p: 12.5, k: 'art:richter:ab-123' });
  });

  it("reports the server's verdict: the same list again is all skipped, next year's price is imported", async () => {
    await importDatanormToMoat([article('E1'), article('E2')], 'richter', MARKET);
    expect(await importDatanormToMoat([article('E1'), article('E2')], 'richter', MARKET)).toEqual({ imported: 0, skipped: 2, failed: 0 });
    expect(await importDatanormToMoat([article('E1', 13.5), article('E2')], 'richter', MARKET)).toEqual({ imported: 1, skipped: 1, failed: 0 });
  });

  it('counts a batch that did not land as failed — and only that batch', async () => {
    failBatch = 1;
    const list = Array.from({ length: CATALOG_BATCH + 10 }, (_, i) => article(`F-${i}`));
    const r = await importDatanormToMoat(list, 'richter', MARKET);
    expect(r).toEqual({ imported: CATALOG_BATCH, skipped: 0, failed: 10 });
    // Importing again writes exactly what is still missing.
    expect(await importDatanormToMoat(list, 'richter', MARKET)).toEqual({ imported: 10, skipped: CATALOG_BATCH, failed: 0 });
  });

  it('stops calling after two failed batches in a row (expired session, no network)', async () => {
    fake.rpc('import_catalog_prices', () => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    const list = Array.from({ length: 10 * CATALOG_BATCH }, (_, i) => article(`G-${i}`));
    const r = await importDatanormToMoat(list, 'richter', MARKET);
    expect(r).toEqual({ imported: 0, skipped: 0, failed: list.length });
    expect(batches()).toHaveLength(2);
  });

  it('skips rows without an article number or a price before sending them', async () => {
    const r = await importDatanormToMoat([article(''), article('Z0', 0), article('Z1', NaN), article('OK1')], 'richter', MARKET);
    expect(r).toEqual({ imported: 1, skipped: 3, failed: 0 });
    expect(batches()[0].payload.p_items.map((i: any) => i.a)).toEqual(['OK1']);
  });

  it('sends prices to four decimals — never in exponent form, which the server rejects', async () => {
    const r = await importDatanormToMoat([article('TINY', 0.00001234), article('PER100', 0.123456)], 'richter', MARKET);
    expect(r).toEqual({ imported: 1, skipped: 1, failed: 0 });
    expect(batches()[0].payload.p_items.map((i: any) => JSON.stringify(i.p))).toEqual(['0.1235']);
  });
});

describe('the phone keeps nothing', () => {
  it('a 100k-article list writes nothing to AsyncStorage', async () => {
    const many = Array.from({ length: 100_000 }, (_, i) => article(`ART-${String(i).padStart(8, '0')}`, 1234.56));
    const r = await importDatanormToMoat(many, 'gc_gruppe_grosshandel', MARKET);
    expect(r.imported).toBe(100_000);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
  }, 60_000);

  it("gives the old local map's space back", async () => {
    const U = '11111111-1111-1111-1111-111111111111';
    await AsyncStorage.multiSet([
      [`@vasco_datanorm_imported:${U}`, '["richter:A:1"]'],
      [`@vasco_datanorm_imported:${U}:s:richter`, '1'],
      [`@vasco_datanorm_imported:${U}:s:richter:0`, '{"A":1}'],
      ['@vasco_invoices', '[]'],
    ]);
    await importDatanormToMoat([article('A')], 'richter', MARKET);
    expect(await AsyncStorage.getAllKeys()).toEqual(['@vasco_invoices']);
  });
});
