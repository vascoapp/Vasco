/**
 * @jest-environment node
 *
 * Replacing a document's lines in the backend.
 *
 * `upsertLineItems` sends rows without ids, so calling it again on an edit
 * INSERTS a second set. The invoice line editor had never written lines at all
 * (only the total); now that it does, the order of operations is the whole
 * correctness argument: delete, then insert — a failure in between leaves no
 * lines, which the healer re-sends, never two sets, which nothing heals.
 */

// jest.mock factories may only reference variables prefixed `mock`.
const mockCalls: string[] = [];
let mockSession: unknown = { access_token: 't' };
let mockDocRow: { id: string } | null = { id: 'doc-uuid' };
let mockDeleteError: Error | null = null;

jest.mock('../supabase', () => {
  const table = (name: string) => {
    const q: any = {
      _op: 'select',
      select: jest.fn(() => { if (q._op === 'select') mockCalls.push(`${name}.select`); return q; }),
      delete: jest.fn(() => { q._op = 'delete'; return q; }),
      upsert: jest.fn(() => { q._op = 'upsert'; mockCalls.push(`${name}.upsert`); return q; }),
      eq: jest.fn(() => q),
      maybeSingle: jest.fn(() => Promise.resolve({ data: mockDocRow, error: null })),
      then: (res: any, rej: any) => {
        if (q._op === 'delete') {
          mockCalls.push(`${name}.delete`);
          return Promise.resolve({ error: mockDeleteError }).then(res, rej);
        }
        return Promise.resolve({ data: [], error: null }).then(res, rej);
      },
    };
    return q;
  };
  return {
    supabase: {
      from: jest.fn((name: string) => table(name)),
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: mockSession } })),
        getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'u1' } } })),
      },
    },
    isSupabaseConfigured: true,
  };
});

import { replaceLineItems } from '../dataProvider';

const LINES = [{ description: 'Wartung', quantity: 1, unit_price: 85.5, total_price: 85.5, position: 0, vat_rate: 19 }];

beforeEach(() => {
  mockCalls.length = 0;
  mockSession = { access_token: 't' };
  mockDocRow = { id: 'doc-uuid' };
  mockDeleteError = null;
});

it('deletes the old lines BEFORE inserting the new ones', async () => {
  await expect(replaceLineItems('RE-2026-0087', 'invoice', LINES)).resolves.toBe('replaced');
  expect(mockCalls).toEqual(['documents.select', 'line_items.delete', 'line_items.upsert']);
});

it('throws on a failed delete and inserts nothing (no second set)', async () => {
  mockDeleteError = new Error('network');
  await expect(replaceLineItems('RE-2026-0087', 'invoice', LINES)).rejects.toThrow('network');
  expect(mockCalls).not.toContain('line_items.upsert');
});

it('touches nothing when the document is not in the backend yet', async () => {
  mockDocRow = null;
  await expect(replaceLineItems('RE-2026-0087', 'invoice', LINES)).resolves.toBe('no-document');
  expect(mockCalls).toEqual(['documents.select']);
});

it('touches nothing without a session (a demo account)', async () => {
  mockSession = null;
  await expect(replaceLineItems('RE-2026-0087', 'invoice', LINES)).resolves.toBe('no-session');
  expect(mockCalls).toEqual([]);
});
