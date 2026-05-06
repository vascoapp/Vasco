/**
 * @jest-environment node
 */

const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => store[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
}));

// Fresh supabase mock per test via jest.resetModules
function mockSupabase(succeed: boolean) {
  jest.doMock('../../lib/supabase', () => ({
    isSupabaseConfigured: true,
    supabase: {
      from: () => ({
        insert: async () => ({ error: succeed ? null : new Error('fail') }),
        upsert: async () => ({ error: succeed ? null : new Error('fail') }),
        update: () => ({
          eq: () => ({ eq: () => ({ /* chainable */ }) }),
        }),
      }),
    },
  }));
}

describe('offlineWriteQueue', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    jest.resetModules();
  });

  test('queues a write and keeps it when Supabase is offline', async () => {
    mockSupabase(false);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { queueWrite, queueSize, flushQueue } = require('../offlineWriteQueue');
    await queueWrite({ table: 'jobs', op: 'insert', payload: { id: 'j1' } });
    expect(await queueSize()).toBe(1);
    const result = await flushQueue();
    expect(result.processed).toBe(0);
    expect(await queueSize()).toBe(1);
  });

  test('drains the queue once Supabase is reachable', async () => {
    mockSupabase(true);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { queueWrite, queueSize, flushQueue } = require('../offlineWriteQueue');
    await queueWrite({ table: 'jobs', op: 'insert', payload: { id: 'j1' } });
    await queueWrite({ table: 'jobs', op: 'upsert', payload: { id: 'j2' } });
    expect(await queueSize()).toBe(2);
    const result = await flushQueue();
    expect(result.processed).toBe(2);
    expect(await queueSize()).toBe(0);
  });

  // R277 — temp IDs must NEVER reach the BE.
  // R49 — temp-id inserts now go through `.select('id').single()` so the
  // BE-generated id can be captured for FK-rewriting child rows.
  test('strips temp ids from insert payloads on flush', async () => {
    let captured: any = null;
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: () => ({
          insert: (payload: any) => {
            captured = payload;
            return {
              select: () => ({
                single: async () => ({ data: { id: 'real-uuid-1' }, error: null }),
              }),
            };
          },
        }),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { queueWrite, flushQueue } = require('../offlineWriteQueue');
    await queueWrite({
      table: 'customers',
      op: 'insert',
      payload: { id: 'c-1234567890', name: 'Alice', email: 'a@test' },
    });
    await flushQueue();
    expect(captured).toBeTruthy();
    expect(captured.id).toBeUndefined(); // temp id stripped
    expect(captured.name).toBe('Alice');
    expect(captured.email).toBe('a@test');
  });

  test('drops update entries that target a temp rowId (no DB row to update)', async () => {
    const insertSpy = jest.fn(async () => ({ error: null }));
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: () => ({
          update: () => ({ eq: () => ({ eq: () => ({}) }) }),
          insert: insertSpy,
        }),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { queueWrite, queueSize, flushQueue } = require('../offlineWriteQueue');
    await queueWrite({
      table: 'jobs',
      op: 'update',
      rowId: 'j-1234567890',
      payload: { status: 'completed' },
    });
    const result = await flushQueue();
    // Treated as processed (dropped quietly), queue empties.
    expect(result.processed).toBe(1);
    expect(await queueSize()).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  // R49 — temp-id FK rewriting on flush.
  test('rewrites FK references in queued child rows after parent insert', async () => {
    const inserts: { table: string; payload: any }[] = [];
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: (table: string) => ({
          insert: (payload: any) => {
            inserts.push({ table, payload });
            return {
              select: () => ({
                single: async () => ({ data: { id: 'real-customer-uuid' }, error: null }),
              }),
            };
          },
        }),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { queueWrite, flushQueue } = require('../offlineWriteQueue');
    // Customer queued first with temp id, then a job referencing that temp id.
    await queueWrite({
      table: 'customers',
      op: 'insert',
      payload: { id: 'c-1234567890', name: 'Alice' },
    });
    await queueWrite({
      table: 'jobs',
      op: 'insert',
      payload: { id: 'j-1234567891', customer_id: 'c-1234567890', title: 'Boiler repair' },
    });
    const result = await flushQueue();
    expect(result.processed).toBe(2);
    expect(inserts).toHaveLength(2);
    // Customer inserted with temp id stripped
    expect(inserts[0].table).toBe('customers');
    expect(inserts[0].payload.id).toBeUndefined();
    expect(inserts[0].payload.name).toBe('Alice');
    // Job inserted with FK rewritten to the BE-generated customer id
    expect(inserts[1].table).toBe('jobs');
    expect(inserts[1].payload.id).toBeUndefined(); // own temp id stripped
    expect(inserts[1].payload.customer_id).toBe('real-customer-uuid');
    expect(inserts[1].payload.title).toBe('Boiler repair');
  });

  test('rewrites temp rowId on update entries when parent mapping is known', async () => {
    const updates: { rowId: string; payload: any }[] = [];
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: () => ({
          insert: () => ({
            select: () => ({
              single: async () => ({ data: { id: 'real-job-uuid' }, error: null }),
            }),
          }),
          update: (payload: any) => ({
            eq: (_k: string, v: any) => {
              updates.push({ rowId: v, payload });
              return { error: null };
            },
          }),
        }),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { queueWrite, flushQueue } = require('../offlineWriteQueue');
    // Insert job with temp id, then update that same job by temp rowId.
    await queueWrite({
      table: 'jobs',
      op: 'insert',
      payload: { id: 'j-1234567890', title: 'Initial' },
    });
    await queueWrite({
      table: 'jobs',
      op: 'update',
      rowId: 'j-1234567890',
      payload: { status: 'in-progress' },
    });
    const result = await flushQueue();
    expect(result.processed).toBe(2);
    expect(updates).toHaveLength(1);
    expect(updates[0].rowId).toBe('real-job-uuid'); // rewritten from temp id
    expect(updates[0].payload).toEqual({ status: 'in-progress' });
  });

  test('preserves real uuid ids in update rowId', async () => {
    let updateChain: any = null;
    let eqArgs: any[] = [];
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: () => ({
          update: (payload: any) => {
            updateChain = payload;
            return {
              eq: (k: string, v: any) => {
                eqArgs.push([k, v]);
                return { eq: () => ({ then: (cb: any) => cb({ error: null }) }) };
              },
            };
          },
        }),
      },
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { queueWrite, flushQueue } = require('../offlineWriteQueue');
    await queueWrite({
      table: 'jobs',
      op: 'update',
      rowId: '550e8400-e29b-41d4-a716-446655440000',
      payload: { status: 'in-progress' },
    });
    await flushQueue();
    expect(updateChain).toEqual({ status: 'in-progress' });
    expect(eqArgs[0]).toEqual(['id', '550e8400-e29b-41d4-a716-446655440000']);
  });
});
