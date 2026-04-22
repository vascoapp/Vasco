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
});
