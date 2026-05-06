/**
 * @jest-environment node
 *
 * R50 — Funnel intelligence loop closes end-to-end.
 *
 * Verifies the contractor lifecycle signal (signup → onboarding → quote →
 * quote_accepted → invoice → payment) emits 6 distinct business_events
 * rows that all carry trade + country attribution, queue locally, then
 * drain to the cloud `business_events` table on flush. Without this
 * coverage every emit site could silently regress to "fires but never
 * lands" and we wouldn't notice until the funnel dashboard went flat.
 */

let mockTrade: string | null = 'plumbing';
let mockCountry: string | null = 'NL';

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-funnel',
  getCurrentTrade: () => mockTrade,
  getCurrentCountry: () => mockCountry,
}));

const mockInsertSpy = jest.fn(async () => ({ error: null }));

jest.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: jest.fn(() => ({ insert: mockInsertSpy })),
    rpc: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  emitSignupCompleted,
  emitOnboardingCompleted,
  emitQuoteCreated,
  emitQuoteAccepted,
  emitInvoiceSent,
  emitPaymentReceived,
} from '../dataCollector';

const QUEUE_KEY = '@vasco_event_queue';

async function readQueue(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('R50 — funnel signal closes end-to-end', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
    mockInsertSpy.mockClear();
    mockTrade = 'plumbing';
    mockCountry = 'NL';
  });

  it('all 6 lifecycle events flush to business_events with cohort attribution', async () => {
    const userId = 'user-funnel';

    await emitSignupCompleted(userId, {
      email: 'a@vasco.dev',
      method: 'email',
      source: 'landing_page',
    });
    await emitOnboardingCompleted(userId, {
      country: 'NL',
      trade: 'plumbing',
      teamSize: '1',
      tierSelected: 'pro',
      stepsCompleted: 14,
      durationSeconds: 240,
    });
    await emitQuoteCreated(userId, 'q-1', {
      customerId: 'cust-1',
      totalAmount: 1200,
      lineItemCount: 4,
      trade: 'plumbing',
    });
    await emitQuoteAccepted(userId, 'q-1', {
      customerId: 'cust-1',
      quotedAmount: 1200,
      acceptedAmount: 1200,
      daysToAccept: 1,
    });
    await emitInvoiceSent(userId, 'inv-1', {
      customerId: 'cust-1',
      amount: 1200,
      dueDate: '2026-05-18',
      paymentMethod: 'mollie',
    });
    await emitPaymentReceived(userId, 'inv-1', {
      customerId: 'cust-1',
      amount: 1200,
      daysToPayment: 9,
      paymentMethod: 'mollie',
      wasOverdue: false,
    });

    // Each emit triggers a flushToCloud, so insert ran 6 times.
    expect(mockInsertSpy).toHaveBeenCalledTimes(6);

    // Each flushed batch contains exactly 1 row with the right shape.
    const flushedRows = mockInsertSpy.mock.calls.map((call: any) => (call[0] as any[])[0]);
    const eventTypes = flushedRows.map((r: any) => r.event_type);
    expect(eventTypes).toEqual([
      'signup_completed',
      'onboarding_completed',
      'quote_created',
      'quote_accepted',
      'invoice_sent',
      'payment_received',
    ]);

    // Cohort attribution is uniform across the funnel — required for
    // per-trade per-country slicing of conversion rates downstream.
    for (const row of flushedRows) {
      expect(row.user_id).toBe(userId);
      expect(row.trade).toBe('plumbing');
      expect(row.country).toBe('NL');
      expect(typeof row.entity_id).toBe('string');
      expect(row.entity_id.length).toBeGreaterThan(0);
    }

    // Local queue is empty because every flush succeeded.
    const remaining = await readQueue();
    expect(remaining).toHaveLength(0);
  });

  it('survives an offline flush — events stay queued until the next online flush', async () => {
    mockInsertSpy.mockImplementationOnce(async () => ({ error: new Error('offline') as any }) as any);

    const userId = 'user-funnel';
    await emitSignupCompleted(userId, { email: 'b@vasco.dev', method: 'email' });
    // First flush failed, event still in the queue.
    expect(await readQueue()).toHaveLength(1);

    // Next emit retries the queue with the new event appended.
    await emitOnboardingCompleted(userId, {
      country: 'NL',
      trade: 'plumbing',
      teamSize: '1',
      tierSelected: 'free',
      stepsCompleted: 14,
      durationSeconds: 180,
    });

    // Both events flushed in one batch on the second emit.
    expect(mockInsertSpy).toHaveBeenCalledTimes(2);
    const lastBatch = (mockInsertSpy.mock.calls[1] as any)[0] as any[];
    const eventTypes = lastBatch.map((r: any) => r.event_type);
    expect(eventTypes).toEqual(['signup_completed', 'onboarding_completed']);

    // Queue drained.
    expect(await readQueue()).toHaveLength(0);
  });
});
