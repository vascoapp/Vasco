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
