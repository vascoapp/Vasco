/**
 * The GDPR export (Art. 15/20) holds EVERY row, and names any table it could
 * not read. Each table was one unranged select, which prod PostgREST caps at
 * 1000 rows without an error — a contractor with a few years of line items got
 * a truncated export that reported success (sweep 2026-09-23, C3).
 */
let mockRows: Record<string, any[]> = {};
let mockFailing = new Set<string>();

jest.mock('../../lib/supabase', () => {
  const table = (name: string) => {
    let range: [number, number] = [0, 1e9];
    const q: any = {
      select: () => q, eq: () => q, order: () => q,
      range: (a: number, b: number) => { range = [a, b]; return q; },
      then: (res: any, rej: any) => {
        if (mockFailing.has(name)) return Promise.resolve({ data: null, error: new Error('rls') }).then(res, rej);
        const all = mockRows[name] ?? [];
        const [from, to] = range;
        return Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + 1000)), error: null }).then(res, rej);
      },
    };
    return q;
  };
  return {
    isSupabaseConfigured: true,
    supabase: { from: (n: string) => table(n), auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } },
  };
});

let mockShared = '';
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Share: { share: async (c: any) => { mockShared = c.message; return { action: 'sharedAction' }; } },
}));

import { exportAllData } from '../dataExportService';

beforeEach(() => { mockRows = {}; mockFailing = new Set(); mockShared = ''; });

it('exports all 2,500 line items, not the first 1,000', async () => {
  mockRows.line_items = Array.from({ length: 2500 }, (_, i) => ({ id: `li-${i}` }));
  const r = await exportAllData('json');
  expect(r.success).toBe(true);
  const out = JSON.parse(mockShared);
  expect(out.data.backend.line_items).toHaveLength(2500);
  expect(out.data.backend.incomplete_tables).toEqual([]);
});

it('a table that could not be read is NAMED, not silently empty', async () => {
  mockRows.customers = [{ id: 'c1' }];
  mockFailing.add('expenses');
  await exportAllData('json');
  const out = JSON.parse(mockShared);
  expect(out.data.backend.customers).toHaveLength(1);
  expect(out.data.backend.incomplete_tables).toEqual(['expenses']);
});
