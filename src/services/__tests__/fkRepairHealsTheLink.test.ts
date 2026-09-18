/**
 * @jest-environment node
 */
// `customer_id: isUuid(x) ? x : null` kept the document and threw away the
// link. Nothing backfilled it: `idRemapBus` rewrites in-memory caches, and the
// write queue's `idMap` only rewrites rows still IN the queue — a row already
// INSERTed with a null FK stayed detached for good. An invoice for a job whose
// customer was created minutes earlier belonged to nobody: not in the ledger,
// not on the PDF, not in the e-invoice (verified 2026-09-19, #349).
//
// `fkRepair` keeps both. These tests exercise the real thing end to end — a
// temp id in, a queued update out, the parent lands, the FK is filled — rather
// than asserting that some function is mentioned.
const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => store[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
  removeItem: jest.fn(async (k: string) => { delete store[k]; }),
}));

const QUEUE_KEY = '@vasco_offline_writes';
/** The queue as it sits on disk — `loadQueue` is private, and it should stay
 *  that way: what a caller can observe is what the flush will read. */
const queuedWrites = (): any[] => JSON.parse(store[QUEUE_KEY] ?? '[]');

const UUID = '4c18d977-df9b-43e6-a497-0b59db02cd77';
const REAL_CUSTOMER = 'b91f3a20-1c44-4f0e-9f1a-2d7c5e8a1b33';

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  jest.resetModules();
});

describe('fkOrNull answers with what can actually be written', () => {
  it('a real uuid passes through and needs no repair', async () => {
    const { fkOrNull } = require('../fkRepair');
    expect(await fkOrNull(UUID)).toEqual({ value: UUID, unresolvedTempId: null });
  });

  it('a temp id the device has already learned resolves to the real uuid', async () => {
    const { rememberIdRemap } = require('../offlineWriteQueue');
    await rememberIdRemap('c-1789738437000', REAL_CUSTOMER);
    const { fkOrNull } = require('../fkRepair');
    // This is the common case after an offline day: the parent flushed in an
    // earlier session, so the FK is simply correct and nothing is queued.
    expect(await fkOrNull('c-1789738437000'))
      .toEqual({ value: REAL_CUSTOMER, unresolvedTempId: null });
  });

  it('a temp id with no mapping yet is written as null and remembered for repair', async () => {
    const { fkOrNull } = require('../fkRepair');
    expect(await fkOrNull('c-1789738437000'))
      .toEqual({ value: null, unresolvedTempId: 'c-1789738437000' });
  });

  it('a display name is null and is NOT queued for repair', async () => {
    const { fkOrNull } = require('../fkRepair');
    // Nothing will ever map "Klant" — a repair for it could only fail.
    expect(await fkOrNull('Klant')).toEqual({ value: null, unresolvedTempId: null });
    expect(await fkOrNull(undefined)).toEqual({ value: null, unresolvedTempId: null });
    expect(await fkOrNull('j-seed-1')).toEqual({ value: null, unresolvedTempId: null });
  });
});

describe('the repair is queued only for what is actually pending', () => {
  it('queues one update carrying the unresolved columns', async () => {
    const { fkOrNull, queueFkRepairs } = require('../fkRepair');
    const customer = await fkOrNull('c-1789738437000');
    const job = await fkOrNull(UUID);
    await queueFkRepairs('F-260001', [['customer_id', customer], ['job_id', job]]);
    const queue = queuedWrites();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      table: 'documents',
      op: 'update',
      rowId: 'F-260001',
      // Only the pending one — the job FK was written correctly already.
      payload: { customer_id: 'c-1789738437000' },
    });
    expect(queue[0].payload.job_id).toBeUndefined();
  });

  it('queues nothing when everything resolved', async () => {
    const { fkOrNull, queueFkRepairs } = require('../fkRepair');
    await queueFkRepairs('F-260002', [['customer_id', await fkOrNull(UUID)]]);
    expect(queuedWrites()).toHaveLength(0);
  });
});

describe('the queued repair fills the FK in once the parent lands', () => {
  it('rewrites the temp id to the real uuid at flush', async () => {
    const updates: any[] = [];
    jest.doMock('../../lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: (table: string) => ({
          insert: (payload: any) => ({
            select: () => ({ single: async () => { updates.push({ table, op: 'insert', payload }); return { data: { id: REAL_CUSTOMER }, error: null }; } }),
          }),
          update: (payload: any) => ({
            eq: (col: string, val: any) => {
              updates.push({ table, op: 'update', payload, col, val });
              return { eq: () => ({ error: null }), error: null, then: (r: any) => r({ error: null }) };
            },
          }),
        }),
      },
    }));
    const { queueWrite, flushQueue } = require('../offlineWriteQueue');
    const { fkOrNull, queueFkRepairs } = require('../fkRepair');

    // The parent customer was created offline…
    await queueWrite({ table: 'customers', op: 'insert', payload: { id: 'c-1789738437000', name: 'Hotel NH' } });
    // …and the invoice for it went out with a null customer, plus a repair.
    const fk = await fkOrNull('c-1789738437000');
    expect(fk.value).toBeNull();
    await queueFkRepairs('F-260001', [['customer_id', fk]]);

    await flushQueue();

    const repair = updates.find((u) => u.op === 'update' && u.table === 'documents');
    expect(repair).toBeDefined();
    // THE POINT: the payload that was queued holding `c-1789…` is sent
    // carrying the uuid the backend assigned to the parent.
    expect(repair.payload).toEqual({ customer_id: REAL_CUSTOMER });
    // …matched on the document number, which is how the flush addresses a
    // document whose own id is the database's to make.
    expect(repair.col).toBe('document_number');
    expect(repair.val).toBe('F-260001');
  });
});
