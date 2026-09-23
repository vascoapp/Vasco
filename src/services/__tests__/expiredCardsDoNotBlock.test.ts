/**
 * An expired card no longer blocks its successor (sweep 2026-09-23, A1).
 * Nothing marks a card expired, so an unseen expired card stayed "pending"
 * forever — hidden, yet counted by every dedupe check. An expired
 * maintenance-visit card swallowed every later visit.
 */
jest.mock('../../intelligence/backgroundJobScheduler', () => ({ requestQueueRebuild: jest.fn(() => Promise.resolve()) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addToQueue } from '../aiActionQueueService';

const QUEUE_KEY = '@vasco_ai_queue';
const past = new Date(Date.now() - 86400000).toISOString();
const future = new Date(Date.now() + 86400000).toISOString();
const base = { type: 'schedule_suggestion', title: 'Onderhoud: CV-ketel', description: '', preparedData: {}, actionLabel: '', estimatedImpact: '' };

async function seed(card: any) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([{ id: 'old', status: 'pending', createdAt: past, ...base, ...card }]));
}

describe('expired cards do not block their successors', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('by producer id (maintenance agreements have no entityKey)', async () => {
    await seed({ sourceGeneratorId: 'service_agreement_ag-1', expiresAt: past });
    const id = await addToQueue({ ...base, sourceGeneratorId: 'service_agreement_ag-1', expiresAt: future } as any);
    expect(id).not.toBe('');
  });

  it('by entityKey', async () => {
    await seed({ entityKey: 'invoice-for-job:j1', expiresAt: past });
    const id = await addToQueue({ ...base, entityKey: 'invoice-for-job:j1', expiresAt: future } as any);
    expect(id).not.toBe('');
  });

  it('a LIVE card still blocks its duplicate', async () => {
    await seed({ sourceGeneratorId: 'service_agreement_ag-1', expiresAt: future });
    const id = await addToQueue({ ...base, sourceGeneratorId: 'service_agreement_ag-1', expiresAt: future } as any);
    expect(id).toBe('');
  });
});
