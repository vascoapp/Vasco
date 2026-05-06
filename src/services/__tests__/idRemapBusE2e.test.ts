/**
 * @jest-environment node
 *
 * R54 — id-remap bus closes the offline-flush side-effect loop end-to-end.
 *
 * Pre-R54: addCustomer offline → embedding written under tempId →
 * reconnect-flush rewrites customers.id to a real BE uuid → embedding
 * row stays keyed under the now-orphan tempId. Semantic search by real
 * id misses forever. Same class for ontology entities and the
 * `@vasco_embeddings` local cache.
 *
 * Post-R54: when offlineWriteQueue.flushQueue captures a temp→real
 * mapping, it emits on the idRemapBus. Listeners (ontology,
 * semanticSearch, embeddingService) re-key their stranded rows under the
 * real BE uuid. This test verifies all three listeners actually fire and
 * the rewrites land in the right places.
 */

const mockUserId = 'user-remap';

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => mockUserId,
  getAuthedUserId: () => mockUserId, // R58: real id, not placeholder
  getCurrentTrade: () => 'plumbing',
  getCurrentCountry: () => 'NL',
  subscribeUserChange: () => () => {},
}));

const mockInserts: Array<{ table: string; payload: any }> = [];
const mockUpdates: Array<{ table: string; payload: any; where: any }> = [];
const mockEmbedCalls: any[] = [];

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      insert: (payload: any) => {
        mockInserts.push({ table, payload });
        return {
          select: () => ({
            single: async () => ({ data: { id: `real-${table}-uuid` }, error: null }),
          }),
        };
      },
      update: (payload: any) => ({
        eq: (k: string, v: any) => {
          mockUpdates.push({ table, payload, where: { [k]: v } });
          return Promise.resolve({ error: null });
        },
      }),
    }),
    rpc: jest.fn(),
    functions: {
      invoke: async (_fn: string, opts: any) => {
        mockEmbedCalls.push(opts.body);
        return { data: { ok: true }, error: null };
      },
    },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { __resetForTests } from '../idRemapBus';

// Importing the listeners so their `init…RemapListener()` calls register
// against the bus before flushQueue runs.
import '../../intelligence/ontology';
import '../../intelligence/semanticSearch';
import '../embeddingService';
import { upsertEntity, addRelation, loadOntology } from '../../intelligence/ontology';
import { indexJobForSearch } from '../../intelligence/semanticSearch';
import { queueWrite, flushQueue } from '../offlineWriteQueue';

describe('R54 — id-remap bus side-effect re-fire', () => {
  beforeEach(async () => {
    await AsyncStorage.clear?.();
    mockInserts.length = 0;
    mockUpdates.length = 0;
    mockEmbedCalls.length = 0;
    // Bus listeners stay registered across tests (idempotent init at module
    // load) — we don't reset them, only the side-effect spies.
  });

  it('customer remap: offline embed under tempId is re-fired under real uuid', async () => {
    const tempId = 'c-1700000001';
    const customerPayload = {
      id: tempId,
      name: 'Alice',
      email: 'alice@test',
      phone: '0612345678',
    };
    await queueWrite({ table: 'customers', op: 'insert', payload: customerPayload });

    await flushQueue();

    // 1 embed call must have fired — under the real id, not the temp id.
    const customerEmbeds = mockEmbedCalls.filter((c) => c.table === 'customer');
    expect(customerEmbeds.length).toBeGreaterThanOrEqual(1);
    const reEmbed = customerEmbeds.find((c) => c.key === 'real-customers-uuid');
    expect(reEmbed).toBeDefined();
    // Embed text derived from the original payload, not from a BE re-fetch.
    expect(reEmbed.text).toContain('Alice');
    expect(reEmbed.text).toContain('alice@test');
  });

  it('ontology remap: entity + relations rekey from tempId to real uuid', async () => {
    const tempCustomerId = 'c-1700000002';
    const tempJobId = 'j-1700000003';

    // Simulate addCustomer / addJob writing under temp ids first.
    await upsertEntity({
      id: tempCustomerId,
      type: 'customer',
      name: 'Bob',
      attributes: { country: 'NL' },
      scores: { reliability: 50, quality: 50, value: 0, frequency: 0 },
      lastUpdated: new Date().toISOString(),
    });
    await upsertEntity({
      id: tempJobId,
      type: 'job',
      name: 'Boiler repair',
      attributes: { trade: 'plumbing' },
      scores: { reliability: 50, quality: 50, value: 1200, frequency: 0 },
      lastUpdated: new Date().toISOString(),
    });
    await addRelation({
      fromId: tempCustomerId,
      fromType: 'customer',
      toId: tempJobId,
      toType: 'job',
      relationType: 'owns',
      metadata: {},
    });

    // Queue customer + job inserts and flush — fresh BE uuids will be
    // emitted on the bus and the ontology listener should rekey both.
    await queueWrite({ table: 'customers', op: 'insert', payload: { id: tempCustomerId, name: 'Bob' } });
    await queueWrite({ table: 'jobs', op: 'insert', payload: { id: tempJobId, title: 'Boiler repair' } });
    await flushQueue();

    // Allow microtask drain — listener uses `void remapEntityId(...)`.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const graph = await loadOntology();
    expect(graph.entities.has('c-1700000002')).toBe(false);
    expect(graph.entities.has('j-1700000003')).toBe(false);
    expect(graph.entities.has('real-customers-uuid')).toBe(true);
    expect(graph.entities.has('real-jobs-uuid')).toBe(true);
    // Relation rewrites — both endpoints now reference real uuids.
    const owns = graph.relations.find((r) => r.relationType === 'owns');
    expect(owns?.fromId).toBe('real-customers-uuid');
    expect(owns?.toId).toBe('real-jobs-uuid');
  });

  it('semanticSearch remap: local cache + Supabase embeddings row both rekey', async () => {
    const tempJobId = 'j-1700000004';

    // Pre-seed local cache with a `job-${tempId}` entry, mimicking what
    // indexJobForSearch wrote during the original offline addJob.
    await indexJobForSearch({
      id: tempJobId,
      title: 'Roof leak',
      trade: 'roofing',
      description: 'small leak above garage',
    });

    // Verify the seed landed under the temp-prefixed key.
    const before = JSON.parse((await AsyncStorage.getItem('@vasco_embeddings')) ?? '[]');
    expect(before.some((e: any) => e.id === `job-${tempJobId}`)).toBe(true);

    // Queue + flush the job insert.
    await queueWrite({ table: 'jobs', op: 'insert', payload: { id: tempJobId, title: 'Roof leak' } });
    await flushQueue();

    // Microtask drain.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Local cache: id rekeyed to job-{realId}, metadata.jobId rekeyed too.
    const after = JSON.parse((await AsyncStorage.getItem('@vasco_embeddings')) ?? '[]');
    const newEntry = after.find((e: any) => e.id === 'job-real-jobs-uuid');
    expect(newEntry).toBeDefined();
    expect(newEntry.metadata.jobId).toBe('real-jobs-uuid');
    // Old temp-keyed entry is gone.
    expect(after.some((e: any) => e.id === `job-${tempJobId}`)).toBe(false);

    // Supabase embeddings row got an UPDATE that swaps id from old to new.
    const embedUpdate = mockUpdates.find(
      (u) => u.table === 'embeddings' && u.payload.id === 'job-real-jobs-uuid' && u.where.id === `job-${tempJobId}`,
    );
    expect(embedUpdate).toBeDefined();
  });

  it('listeners ignore tables they do not handle', async () => {
    // `documents` is handled by ontology (TABLE_TO_ENTITY_TYPE includes it
    // for invoice/quote rekey) but NOT by semanticSearch. Verify that
    // semanticSearch.remapIndexedItem does not fire for documents.
    const tempDocId = 'q-1700000005';
    await queueWrite({ table: 'documents', op: 'insert', payload: { id: tempDocId, doc_type: 'quote' } });
    await flushQueue();

    await new Promise((resolve) => setTimeout(resolve, 0));

    // No embeddings update for the document table.
    const embedUpdate = mockUpdates.find((u) => u.table === 'embeddings');
    expect(embedUpdate).toBeUndefined();
  });
});
