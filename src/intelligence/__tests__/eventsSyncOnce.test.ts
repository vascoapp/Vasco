/**
 * @jest-environment node
 *
 * Business events reach the server once each, and none are lost.
 * UK walk, 2026-10-08: sending an invoice wrote TWO identical invoice_sent rows
 * at the same millisecond — two overlapping flushes inserted the same queue —
 * and a flush rewrote the queue from a stale read, dropping events enqueued
 * while its insert was in flight.
 */
const mockInserted: any[] = [];
let mockStall: Promise<void> | null = null;
jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => '11111111-1111-1111-1111-111111111111',
  getAuthedUserId: () => '11111111-1111-1111-1111-111111111111',
  getCurrentTrade: () => 'plumbing',
  getCurrentCountry: () => 'UK',
}));
jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => ({
      insert: async (rows: any[]) => {
        if (mockStall) await mockStall;
        await new Promise((r) => setTimeout(r, 20)); // a real round trip
        mockInserted.push(...rows);
        return { error: null };
      },
    }),
    rpc: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { emitBusinessEvent } from '../dataCollector';

const U = '11111111-1111-1111-1111-111111111111';

it('overlapping emits insert each event exactly once and leave nothing behind', async () => {
  await AsyncStorage.clear();
  await Promise.all([
    emitBusinessEvent(U, { eventType: 'invoice_sent', entityType: 'invoice', entityId: 'INV0001', payload: {} } as any),
    emitBusinessEvent(U, { eventType: 'quote_created', entityType: 'quote', entityId: 'Q0002', payload: {} } as any),
    emitBusinessEvent(U, { eventType: 'invoice_paid', entityType: 'invoice', entityId: 'INV0001', payload: {} } as any),
  ]);
  const ids = mockInserted.map((r) => `${r.event_type}:${r.entity_id}`).sort();
  expect(ids).toEqual(['invoice_paid:INV0001', 'invoice_sent:INV0001', 'quote_created:Q0002']);
  expect(JSON.parse((await AsyncStorage.getItem('@vasco_event_queue')) ?? '[]')).toEqual([]);
});

it('a stalled insert does not block writing new events to the device queue', async () => {
  // Review 2026-10-08: the lock was held across the network insert, so a hung
  // request kept every new event out of storage (and onboarding awaits one).
  await AsyncStorage.clear();
  let release!: () => void;
  mockStall = new Promise<void>((r) => { release = r; });
  const first = emitBusinessEvent(U, { eventType: 'job_created', entityType: 'job', entityId: 'J1', payload: {} } as any);
  await new Promise((r) => setTimeout(r, 30)); // first flush is now stuck in insert
  void emitBusinessEvent(U, { eventType: 'job_created', entityType: 'job', entityId: 'J2', payload: {} } as any);
  await new Promise((r) => setTimeout(r, 30));
  const queued = JSON.parse((await AsyncStorage.getItem('@vasco_event_queue')) ?? '[]').map((e: any) => e.entityId);
  expect(queued).toContain('J2');
  mockStall = null; release();
  await first;
});
