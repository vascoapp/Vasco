/**
 * @jest-environment node
 *
 * R59 — When offlineWriteQueue captures a temp→real id mapping, the
 * dataCollector's local event queue must rewrite any queued business_events
 * that reference the temp id. Without this, an offline-created job that
 * gets `emitJobStarted` fired before queue flush leaves
 * business_events.entity_id pinned to the temp id forever.
 *
 * The R54 idRemapBus already covers ontology + semanticSearch +
 * customer_embeddings. This test covers the parallel rewrite for the
 * dataCollector's separate `@vasco_event_queue`.
 */

let mockTrade: string | null = 'plumbing';
let mockCountry: string | null = 'NL';

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-r59',
  getAuthedUserId: () => 'user-r59',
  getCurrentTrade: () => mockTrade,
  getCurrentCountry: () => mockCountry,
}));

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: false, // keep flushToCloud a no-op so we can read the queue
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitBusinessEvent } from '../dataCollector';
import { emitIdRemap } from '../../services/idRemapBus';

const QUEUE_KEY = '@vasco_event_queue';

async function readQueue(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('R59 — event queue id-remap on flush', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
  });

  it('rewrites entity_id in queued events when matching temp→real mapping arrives', async () => {
    // Simulate the offline flow: contractor offline-creates a job (temp id),
    // marks it in-progress while still offline → emitJobStarted fires with
    // the temp id as entity_id.
    await emitBusinessEvent('user-r59', {
      eventType: 'job_started',
      entityType: 'job',
      entityId: 'j-1700000001',
      payload: { trade: 'plumbing' },
    });

    let queue = await readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].entityId).toBe('j-1700000001');

    // Flush captures temp→real mapping for the parent job insert.
    emitIdRemap({
      table: 'jobs',
      tempId: 'j-1700000001',
      realId: 'real-job-uuid-abc',
    });

    // Listener is async via void; let microtasks drain.
    await new Promise((resolve) => setTimeout(resolve, 0));

    queue = await readQueue();
    expect(queue[0].entityId).toBe('real-job-uuid-abc');
  });

  it('rewrites payload string fields recursively too', async () => {
    await emitBusinessEvent('user-r59', {
      eventType: 'job_completed',
      entityType: 'job',
      entityId: 'j-1700000002',
      payload: {
        trade: 'plumbing',
        relatedJobId: 'j-1700000002',
        nested: { fromJob: 'j-1700000002', other: 'unchanged' },
      },
    });

    emitIdRemap({
      table: 'jobs',
      tempId: 'j-1700000002',
      realId: 'real-job-uuid-def',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const queue = await readQueue();
    expect(queue[0].entityId).toBe('real-job-uuid-def');
    expect(queue[0].payload.relatedJobId).toBe('real-job-uuid-def');
    expect(queue[0].payload.nested.fromJob).toBe('real-job-uuid-def');
    expect(queue[0].payload.nested.other).toBe('unchanged');
  });

  it('rewrites material entity_id which is `${supplierId}_${materialName}`', async () => {
    // emitMaterialPurchased uses entityId = `${supplierId}_${materialName}`.
    // If supplierId is a temp id, we should rewrite the prefix portion only.
    await emitBusinessEvent('user-r59', {
      eventType: 'material_purchased',
      entityType: 'material',
      entityId: 'sup-1700000003_22mm copper pipe',
      payload: { supplierId: 'sup-1700000003' },
      trade: 'plumbing',
    });

    emitIdRemap({
      table: 'suppliers',
      tempId: 'sup-1700000003',
      realId: 'real-sup-uuid',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const queue = await readQueue();
    expect(queue[0].entityId).toBe('real-sup-uuid_22mm copper pipe');
    expect(queue[0].payload.supplierId).toBe('real-sup-uuid');
  });

  it('ignores unrelated remaps (different tempId)', async () => {
    await emitBusinessEvent('user-r59', {
      eventType: 'quote_created',
      entityType: 'quote',
      entityId: 'Q-260001',
      payload: {},
    });

    emitIdRemap({
      table: 'jobs',
      tempId: 'j-1700000099', // unrelated
      realId: 'real-uuid-xyz',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const queue = await readQueue();
    expect(queue[0].entityId).toBe('Q-260001'); // unchanged
  });
});
