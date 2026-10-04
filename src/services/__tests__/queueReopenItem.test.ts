// reopenItem puts an approved card back when its send did not happen (review
// 2026-09-29): approveItem retires it before the share, and an approved chase
// suppresses a new one for 3 days.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reopenItem, approveItem } from '../aiActionQueueService';

const mockEmit = jest.fn(async (..._args: unknown[]) => {});
jest.mock('../../intelligence/dataCollector', () => ({
  emitBusinessEvent: (...a: unknown[]) => mockEmit(...a),
  emitPackApproved: jest.fn(async () => {}),
}));
jest.mock('../../intelligence/insightScorer', () => ({ refreshApprovalRateCache: jest.fn(async () => {}) }));

const KEY = '@vasco_ai_queue';
const item = (status: string) => ({
  id: 'q1', type: 'draft_reminder', status, title: 't', description: 'd',
  preparedData: {}, actionLabel: 'a', estimatedImpact: '', createdAt: new Date().toISOString(),
  ...(status === 'approved' ? { resolvedAt: new Date().toISOString() } : {}),
});

beforeEach(async () => { await AsyncStorage.clear(); mockEmit.mockClear(); });

it('an approved card goes back to pending, unresolved', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify([item('approved')]));
  await reopenItem('q1');
  const [q] = JSON.parse((await AsyncStorage.getItem(KEY))!);
  expect(q.status).toBe('pending');
  expect(q.resolvedAt).toBeUndefined();
});

it('leaves a rejected card rejected', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify([item('rejected')]));
  await reopenItem('q1');
  expect(JSON.parse((await AsyncStorage.getItem(KEY))!)[0].status).toBe('rejected');
});

it('approve → reopen → approve reports ONE approval to the learning layer', async () => {
  // The platform-wide approval rate counts events; a card the contractor
  // approved, whose send did not happen, and approved again is one decision.
  await AsyncStorage.setItem(KEY, JSON.stringify([{ ...item('pending'), sourceGeneratorId: 'overdue_invoice' }]));
  await approveItem('q1');
  await reopenItem('q1');
  await approveItem('q1');
  const approvals = mockEmit.mock.calls.filter((c) => (c[1] as { eventType?: string })?.eventType === 'queue_item_approved');
  expect(approvals).toHaveLength(1);
  expect(JSON.parse((await AsyncStorage.getItem(KEY))!)[0].status).toBe('approved');
});

it('two different cards still report two approvals', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify([item('pending'), { ...item('pending'), id: 'q2' }]));
  await approveItem('q1');
  await approveItem('q2');
  expect(mockEmit.mock.calls.filter((c) => (c[1] as { eventType?: string })?.eventType === 'queue_item_approved')).toHaveLength(2);
});
