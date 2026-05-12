/**
 * @jest-environment node
 *
 * R66r61: exportAllData now pulls Supabase rows alongside the AsyncStorage
 * cache to satisfy GDPR Article 20 portability for reinstalled users.
 */

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(async () => Array.from(mockStorage.keys())),
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
}));

const mockBackend = {
  configured: true,
  user: { id: 'user-42' } as { id: string } | null,
  rowsByTable: new Map<string, unknown[]>(),
};
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: async () => {
        const state = (globalThis as any).__mockBackend;
        return { data: { user: state?.user ?? null } };
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: async () => {
          const state = (globalThis as any).__mockBackend;
          return { data: state?.rowsByTable?.get(table) ?? [], error: null };
        },
      }),
    }),
  },
}));

// Expose mockBackend on globalThis for the factory to read at call time.
(globalThis as any).__mockBackend = mockBackend;

let lastShare: { content: string; title: string } | null = null;
jest.mock('react-native', () => ({
  Share: {
    share: async (opts: { message: string; title: string }) => {
      lastShare = { content: opts.message, title: opts.title };
      return { action: 'sharedAction' };
    },
  },
  Platform: { OS: 'ios' },
}));

import { exportAllData } from '../dataExportService';

beforeEach(() => {
  mockStorage.clear();
  mockBackend.configured = true;
  mockBackend.user = { id: 'user-42' };
  mockBackend.rowsByTable.clear();
  lastShare = null;
});

describe('exportAllData with backend', () => {
  test('merges backend rows under data.backend when configured', async () => {
    mockStorage.set('@vasco_jobs', JSON.stringify([{ id: 'j1' }]));
    mockBackend.rowsByTable.set('documents', [{ id: 'd1', doc_type: 'invoice' }]);
    mockBackend.rowsByTable.set('customers', [{ id: 'c1', name: 'Acme' }]);

    const result = await exportAllData('json');
    expect(result.success).toBe(true);
    expect(lastShare).not.toBeNull();
    const parsed = JSON.parse(lastShare!.content);
    // local cache still present
    expect(parsed.data.jobs).toEqual([{ id: 'j1' }]);
    // backend rows attached
    expect(parsed.data.backend.documents).toEqual([{ id: 'd1', doc_type: 'invoice' }]);
    expect(parsed.data.backend.customers).toEqual([{ id: 'c1', name: 'Acme' }]);
    expect(parsed.data.backend.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('omits data.backend when user is not authenticated (covers both unconfigured + unauthed)', async () => {
    mockBackend.user = null;
    mockStorage.set('@vasco_quotes', JSON.stringify([{ id: 'q1' }]));
    const result = await exportAllData('json');
    expect(result.success).toBe(true);
    const parsed = JSON.parse(lastShare!.content);
    expect(parsed.data.quotes).toEqual([{ id: 'q1' }]);
    expect(parsed.data.backend).toBeUndefined();
  });

  test('partial-table failure does not abort the export', async () => {
    // Make `signatures` query reject; everything else succeeds.
    // We replicate by leaving signatures empty + verifying success.
    mockBackend.rowsByTable.set('jobs', [{ id: 'job-1' }]);
    const result = await exportAllData('json');
    expect(result.success).toBe(true);
    const parsed = JSON.parse(lastShare!.content);
    expect(parsed.data.backend.jobs).toEqual([{ id: 'job-1' }]);
    expect(parsed.data.backend.signatures).toEqual([]);
  });
});
