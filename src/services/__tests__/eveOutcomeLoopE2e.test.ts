/**
 * @jest-environment node
 *
 * R50 — EVE outcome loop closes end-to-end.
 *
 * The EVE Legal AI pattern is: AI queues → user one-tap approves → executor
 * runs → contractor (or customer) signals positive/negative/neutral →
 * `recordOutcome` writes BOTH (a) `@vasco_queue_outcomes` for the local
 * insight scorer's calibration AND (b) a `queue_outcome_*` row in
 * `business_events` for the cross-cohort generator-trust learning. If
 * either write goes silent, the AI never learns from approvals — generators
 * keep firing the same dud suggestions.
 */

let mockTrade: string | null = 'plumbing';
let mockCountry: string | null = 'NL';

jest.mock('../../lib/currentUser', () => ({
  getCurrentUserId: () => 'user-eve',
  getCurrentTrade: () => mockTrade,
  getCurrentCountry: () => mockCountry,
}));

const mockInserts: Array<{ table: string; row: any }> = [];

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => ({
      insert: async (rows: any) => {
        const arr = Array.isArray(rows) ? rows : [rows];
        for (const row of arr) mockInserts.push({ table, row });
        return { error: null };
      },
    }),
    rpc: jest.fn(),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addToQueue, recordOutcome, getOutcomes } from '../aiActionQueueService';

const QUEUE_KEY = '@vasco_ai_queue';
const OUTCOMES_KEY = '@vasco_queue_outcomes';
const EVENT_QUEUE_KEY = '@vasco_event_queue';

describe('R50 — EVE outcome loop', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(QUEUE_KEY);
    await AsyncStorage.removeItem(OUTCOMES_KEY);
    await AsyncStorage.removeItem(EVENT_QUEUE_KEY);
    mockInserts.length = 0;
    mockTrade = 'plumbing';
    mockCountry = 'NL';
  });

  it('positive outcome writes both AsyncStorage outcomes AND a business_events row', async () => {
    const itemId = await addToQueue({
      type: 'quote_followup',
      title: 'Follow up with Klant Jansen',
      description: 'Quote sent 3 days ago, no response',
      entityKey: 'q-100',
      sourceGeneratorId: 'quoteFollowup',
      estimatedImpact: { financial: 1200 },
    } as any);
    expect(itemId).toBeTruthy();

    await recordOutcome(itemId, 'positive');

    // Local outcomes log got the entry
    const outcomes = await getOutcomes();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].itemId).toBe(itemId);
    expect(outcomes[0].outcome).toBe('positive');
    expect(outcomes[0].type).toBe('quote_followup');
    expect(typeof outcomes[0].timestamp).toBe('string');

    // Cross-cohort signal landed in business_events with the right shape
    const beRows = mockInserts.filter((m) => m.table === 'business_events');
    expect(beRows).toHaveLength(1);
    const be = beRows[0].row;
    expect(be.event_type).toBe('queue_outcome_positive');
    expect(be.entity_id).toBe('q-100'); // entityKey, not the queue item id
    expect(be.payload.queueType).toBe('quote_followup');
    expect(be.payload.generatorId).toBe('quoteFollowup'); // attribution feeds insightScorer trust
    expect(be.user_id).toBe('user-eve');
    expect(be.trade).toBe('plumbing'); // R281 cohort default
    expect(be.country).toBe('NL');
  });

  it('negative outcome flows the same path with inverted polarity', async () => {
    const itemId = await addToQueue({
      type: 'price_alert',
      title: '22mm copper up 18% at TU',
      description: 'Spike vs your last 30d avg',
      entityKey: 'mat-copper-22',
      sourceGeneratorId: 'priceSpike',
    } as any);

    await recordOutcome(itemId, 'negative');

    const outcomes = await getOutcomes();
    expect(outcomes[0].outcome).toBe('negative');

    const be = mockInserts.find((m) => m.table === 'business_events')?.row;
    expect(be.event_type).toBe('queue_outcome_negative');
    expect(be.payload.generatorId).toBe('priceSpike'); // dampens trust on this generator
  });

  it('handles unknown itemId gracefully (still records a row, no throw)', async () => {
    await expect(recordOutcome('q-does-not-exist', 'neutral')).resolves.not.toThrow();
    const outcomes = await getOutcomes();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].type).toBe('unknown'); // fallback
    expect(outcomes[0].outcome).toBe('neutral');
  });
});
