/**
 * The GDPR export (Art. 15/20) holds EVERY row, and names any table it could
 * not read. Each table was one unranged select, which prod PostgREST caps at
 * 1000 rows without an error — a contractor with a few years of line items got
 * a truncated export that reported success (sweep 2026-09-23, C3).
 */
let mockRows: Record<string, any[]> = {};
let mockFailing = new Set<string>();
let mockSignedIn = true;

jest.mock('../../lib/supabase', () => {
  const table = (name: string) => {
    let range: [number, number] = [0, 1e9];
    let only: [string, string[]] | null = null;
    const q: any = {
      select: () => q, eq: () => q, order: () => q,
      in: (col: string, ids: string[]) => { only = [col, ids]; return q; },
      range: (a: number, b: number) => { range = [a, b]; return q; },
      then: (res: any, rej: any) => {
        if (mockFailing.has(name)) return Promise.resolve({ data: null, error: new Error('rls') }).then(res, rej);
        const all = (mockRows[name] ?? []).filter((r) => !only || only[1].includes(r[only[0]]));
        const [from, to] = range;
        return Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + 1000)), error: null }).then(res, rej);
      },
    };
    return q;
  };
  return {
    isSupabaseConfigured: true,
    supabase: { from: (n: string) => table(n), auth: { getUser: async () => ({ data: { user: mockSignedIn ? { id: 'u1' } : null } }) } },
  };
});

// The export is written to a FILE and shared as one (review 2026-09-24).
let mockShared = '';
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'cache://' },
  File: class { uri = 'cache://export'; exists = false; write(c: string) { mockShared = c; } delete() {} },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: async () => undefined }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, Share: { share: async () => ({ action: 'sharedAction' }) } }));

import { exportAllData } from '../dataExportService';

beforeEach(() => { mockRows = {}; mockFailing = new Set(); mockShared = ''; mockSignedIn = true; });

it('exports all 2,500 line items, not the first 1,000', async () => {
  mockRows.line_items = Array.from({ length: 2500 }, (_, i) => ({ id: `li-${i}` }));
  const r = await exportAllData('json');
  expect(r.success).toBe(true);
  const out = JSON.parse(mockShared);
  expect(out.data.backend.line_items).toHaveLength(2500);
  expect(out.data.backend.incomplete_tables).toEqual([]);
  expect(r.complete).toBe(true);
});

it('a table that could not be read is NAMED, not silently empty', async () => {
  mockRows.customers = [{ id: 'c1' }];
  mockFailing.add('expenses');
  const r = await exportAllData('json');
  const out = JSON.parse(mockShared);
  expect(out.data.backend.customers).toHaveLength(1);
  expect(out.data.backend.incomplete_tables).toEqual(['expenses']);
  // …and it is NOT offered as a complete record set before deletion.
  expect(r.complete).toBe(false);
});

it('the records a business must keep are in it — supplier invoices, audit chain, projects, filings', async () => {
  mockRows.scanned_invoices = [{ id: 's1' }];
  mockRows.gobd_audit_log = [{ id: 'g1' }];
  mockRows.projects = [{ id: 'p1' }];
  mockRows.regulated_submissions = [{ id: 'r1' }];
  await exportAllData('json');
  const b = JSON.parse(mockShared).data.backend;
  for (const k of ['scanned_invoices', 'gobd_audit_log', 'projects', 'regulated_submissions', 'purchase_orders', 'accountant_handovers', 'customer_questions']) {
    expect(Array.isArray(b[k])).toBe(true);
  }
  expect(b.scanned_invoices).toHaveLength(1);
  expect(b.gobd_audit_log).toHaveLength(1);
});

it("the customer's decisions come with the trackers they belong to — and only those", async () => {
  mockRows.decision_trackers = [{ id: 't1' }, { id: 't2' }];
  mockRows.decision_items = [{ id: 'i1', tracker_id: 't1' }, { id: 'i9', tracker_id: 'someone-else' }];
  mockRows.decision_submissions = [{ id: 's1', tracker_id: 't2' }];
  mockRows.extracted_documents = [{ id: 'd1' }];
  mockRows.extracted_line_items = [{ id: 'l1', document_id: 'd1' }, { id: 'l2', document_id: 'd2' }];
  const r = await exportAllData('json');
  const b = JSON.parse(mockShared).data.backend;
  expect(b.decision_items.map((x: any) => x.id)).toEqual(['i1']);
  expect(b.decision_submissions.map((x: any) => x.id)).toEqual(['s1']);
  expect(b.extracted_line_items.map((x: any) => x.id)).toEqual(['l1']);
  expect(r.complete).toBe(true);
});

it('a parent that could not be read makes its children incomplete, not empty', async () => {
  mockFailing.add('decision_trackers');
  const r = await exportAllData('json');
  const b = JSON.parse(mockShared).data.backend;
  expect(b.incomplete_tables).toEqual(expect.arrayContaining(['decision_trackers', 'decision_items', 'decision_submissions', 'decision_activities']));
  expect(r.complete).toBe(false);
});

it('offline (no session) the export is the device only — never called complete', async () => {
  mockSignedIn = false;
  const r = await exportAllData('json');
  expect(r.success).toBe(true);
  expect(r.complete).toBe(false);
});
