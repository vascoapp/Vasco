/**
 * @jest-environment node
 *
 * The offline write queue keeps every write that merely could not reach the
 * server (sweep 2026-09-23, A2). Three ways it lost data:
 *   - offline foregrounds counted as attempts → 5 app switches discarded it;
 *   - survivors were saved OVER the queue → writes queued mid-flush erased;
 *   - a child edit of a not-yet-landed parent was dropped as "no parent".
 */
const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => store[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
}));

// The queues upload only for the contractor who owns them (sweep A4): sign
// one in. Everything else in currentUser stays real.
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getAuthedUserId: () => '11111111-1111-1111-1111-111111111111',
}));

type Mode = 'offline' | 'reject' | 'ok';
let mockMode: Mode = 'offline';
let mockGate: Promise<void> | null = null;

function mockResult() {
  if (mockMode === 'offline') throw new TypeError('Network request failed');
  if (mockMode === 'reject') return { error: { code: '23505', message: 'duplicate key' } };
  return { error: null };
}

jest.mock('../../lib/supabase', () => {
  const chain = () => {
    const q: any = {
      eq: () => q,
      then: (res: any, rej: any) => Promise.resolve().then(() => mockResult()).then(res, rej),
    };
    return q;
  };
  return {
    isSupabaseConfigured: true,
    supabase: {
      from: () => ({
        // Lazy, like the real client: nothing runs until awaited, so the
        // .select().single() path does not leave an unobserved rejection.
        insert: (_p: any) => ({
          then: (res: any, rej: any) =>
            Promise.resolve().then(async () => { if (mockGate) await mockGate; return mockResult(); }).then(res, rej),
          select: () => ({
            single: async () => {
              if (mockGate) await mockGate;
              const r = mockResult();
              return r.error ? r : { data: { id: 'real-1' }, error: null };
            },
          }),
        }),
        upsert: async () => mockResult(),
        update: () => chain(),
        delete: () => chain(),
      }),
      rpc: async () => ({ data: null, error: null }),
    },
  };
});

import { queueWrite, flushQueue, queueSize } from '../offlineWriteQueue';

describe('the offline queue keeps what could not reach the server', () => {
  beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; mockMode = 'offline'; mockGate = null; });

  it('ten offline flushes lose nothing', async () => {
    await queueWrite({ table: 'invoices', op: 'update', rowId: 'inv-real-uuid', payload: { status: 'paid' } });
    for (let i = 0; i < 10; i++) await flushQueue();
    expect(await queueSize()).toBe(1);
  });

  it('five server REJECTIONS still give up', async () => {
    mockMode = 'reject';
    await queueWrite({ table: 'invoices', op: 'update', rowId: 'inv-real-uuid', payload: { status: 'paid' } });
    for (let i = 0; i < 5; i++) await flushQueue();
    expect(await queueSize()).toBe(0);
  });

  it('a write queued DURING a flush survives it', async () => {
    mockMode = 'ok';
    let release!: () => void;
    mockGate = new Promise<void>((r) => { release = r; });
    await queueWrite({ table: 'jobs', op: 'insert', payload: { id: 'real-job' } });
    const running = flushQueue();
    await new Promise((r) => setTimeout(r, 0));
    await queueWrite({ table: 'invoices', op: 'update', rowId: 'inv-real-uuid', payload: { status: 'paid' } });
    release();
    await running;
    const left = JSON.parse(store['@vasco_offline_writes'] ?? '[]');
    expect(left.map((e: any) => e.table)).toEqual(['invoices']);
  });

  it("keeps a child edit while its parent insert is still waiting", async () => {
    await queueWrite({ table: 'jobs', op: 'insert', payload: { id: 'j-123' } });
    await queueWrite({ table: 'jobs', op: 'update', rowId: 'j-123', payload: { title: 'Badkamer' } });
    await flushQueue(); // offline: the parent cannot land
    expect(await queueSize()).toBe(2);
  });
});
