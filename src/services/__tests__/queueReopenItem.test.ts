// reopenItem puts an approved card back when its send did not happen (review
// 2026-09-29): approveItem retires it before the share, and an approved chase
// suppresses a new one for 3 days.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reopenItem } from '../aiActionQueueService';

const KEY = '@vasco_ai_queue';
const item = (status: string) => ({
  id: 'q1', type: 'draft_reminder', status, title: 't', description: 'd',
  preparedData: {}, actionLabel: 'a', estimatedImpact: '', createdAt: new Date().toISOString(),
  ...(status === 'approved' ? { resolvedAt: new Date().toISOString() } : {}),
});

beforeEach(async () => { await AsyncStorage.clear(); });

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
