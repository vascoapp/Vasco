/**
 * @jest-environment node
 *
 * Every list read returns ALL of the contractor's rows, not the first 1000.
 *
 * Prod PostgREST caps an unranged select at `max_rows = 1000` and says nothing.
 * `loadLineItems` read line items that way, so the 1001st line of the account
 * vanished from its document: the PDF total, the Moneybird export and the next
 * line edit (which REPLACES the lines) all worked on the truncated set (C1).
 * The same cap dropped job materials from billing (C2) and rows from the GDPR
 * export (C3). The mock below enforces the cap exactly as prod does.
 */

const MOCK_CAP = 1000;
let mockRows: Record<string, any[]> = {};
let mockFailAtOffset: number | null = null;
const mockRanges: Array<[number, number]> = [];

jest.mock('../supabase', () => {
  const table = (name: string) => {
    let range: [number, number] | null = null;
    const q: any = {
      select: jest.fn(() => q),
      order: jest.fn(() => q),
      eq: jest.fn(() => q),
      range: jest.fn((a: number, b: number) => { range = [a, b]; mockRanges.push([a, b]); return q; }),
      then: (res: any, rej: any) => {
        const all = mockRows[name] ?? [];
        const [from, to] = range ?? [0, all.length - 1];
        if (mockFailAtOffset !== null && from >= mockFailAtOffset) {
          return Promise.resolve({ data: null, error: new Error('boom') }).then(res, rej);
        }
        // The server cap: never more than MOCK_CAP rows per response.
        const data = all.slice(from, Math.min(to + 1, from + MOCK_CAP));
        return Promise.resolve({ data, error: null }).then(res, rej);
      },
    };
    return q;
  };
  return {
    supabase: {
      from: jest.fn((name: string) => table(name)),
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: { access_token: 't' } } })),
        getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'u1' } } })),
      },
    },
    isSupabaseConfigured: true,
  };
});

import { loadLineItems, listJobMaterials, selectAllPages } from '../dataProvider';
import { supabase } from '../supabase';

const line = (i: number, doc: string) => ({
  id: `li-${i}`, document_id: doc, position: i, description: `L${i}`,
  quantity: 1, unit_price: 10, vat_rate: 21, documents: { document_number: doc },
});

beforeEach(() => { mockRows = {}; mockFailAtOffset = null; mockRanges.length = 0; });

describe('reads past the 1000-row cap', () => {
  it('selectAllPages returns every row across pages and stops on a short page', async () => {
    mockRows.t = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const rows = await selectAllPages<any>(() => (supabase.from('t') as any).select('*').order('id'));
    expect(rows).toHaveLength(2500);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2500);
    expect(mockRanges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('an exact multiple of the page size still ends (one empty page)', async () => {
    mockRows.t = Array.from({ length: 2000 }, (_, i) => ({ id: i }));
    const rows = await selectAllPages<any>(() => (supabase.from('t') as any).select('*'));
    expect(rows).toHaveLength(2000);
    expect(mockRanges).toHaveLength(3);
  });

  it('a failed page THROWS — a partial list is never passed off as the whole', async () => {
    mockRows.t = Array.from({ length: 1500 }, (_, i) => ({ id: i }));
    mockFailAtOffset = 1000;
    await expect(selectAllPages<any>(() => (supabase.from('t') as any).select('*'))).rejects.toThrow('boom');
  });

  it("loadLineItems keeps the 1001st line on its document", async () => {
    // 1200 lines: DOC-A has 999, DOC-B has 201 — B's lines straddle the cap.
    mockRows.line_items = [
      ...Array.from({ length: 999 }, (_, i) => line(i, 'DOC-A')),
      ...Array.from({ length: 201 }, (_, i) => line(999 + i, 'DOC-B')),
    ];
    const grouped = (await loadLineItems())!;
    expect(grouped['DOC-A']).toHaveLength(999);
    expect(grouped['DOC-B']).toHaveLength(201);
    expect(grouped['DOC-B'][200].id).toBe('li-1199');
  });

  it('a failed read is null, never {} — {} made refreshData re-insert every line', async () => {
    mockRows.line_items = Array.from({ length: 1500 }, (_, i) => line(i, 'DOC-A'));
    mockFailAtOffset = 1000;
    expect(await loadLineItems()).toBeNull();
  });

  it('a row repeated across pages (insert mid-read) is returned once', async () => {
    // Page 2 starts one row early — what an insert before the cursor does.
    mockRows.t = Array.from({ length: 1500 }, (_, i) => ({ id: i }));
    const real = mockRows.t;
    let call = 0;
    const rows = await selectAllPages<any>(() => {
      const q = (supabase.from('t') as any).select('*');
      const orig = q.range;
      q.range = (a: number, b: number) => orig(call++ === 0 ? a : a - 1, b);
      return q;
    });
    expect(rows).toHaveLength(real.length);
    expect(new Set(rows.map((r: any) => r.id)).size).toBe(real.length);
  });

  it('listJobMaterials returns materials past the cap', async () => {
    mockRows.job_materials = Array.from({ length: 1300 }, (_, i) => ({ id: `m-${i}` }));
    expect(await listJobMaterials()).toHaveLength(1300);
  });
});

describe('refreshData on an unreadable line-item load', () => {
  // AppState's refresh cannot be driven headlessly here; this pins the one
  // branch that matters: no server answer → no merge, and so no heal.
  it('merges (and heals orphans) only when the load answered', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const { stripComments } = require('../../utils/stripComments');
    const src = stripComments(readFileSync(join(__dirname, '../../state/AppState.tsx'), 'utf8'));
    expect(src).toMatch(/if \(li\) setLineItems\(\(prev\) => \{\s*const merged = \{ \.\.\.li \};/);
  });
});
