/**
 * Two queue writes at once both land (sweep A5).
 *
 * Every writer read the whole queue, changed it and wrote it back, unlocked.
 * The scheduler adding a card while the contractor approves one meant the
 * later write undid the earlier: the approved card came back as pending, or
 * the new card vanished.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addToQueue, approveItem, rejectItem, snoozeQueueItem } from '../aiActionQueueService';

const KEY = '@vasco_ai_queue';
const card = (id: string) => ({
  id, type: 'draft_reminder', status: 'pending', title: id, description: '', preparedData: {},
  actionLabel: 'a', estimatedImpact: '', createdAt: new Date().toISOString(), sourceGeneratorId: `event_${id}`,
});
const fresh = (key: string) => ({
  type: 'draft_reminder', title: key, description: '', preparedData: {}, actionLabel: 'a',
  estimatedImpact: '', entityKey: key, sourceGeneratorId: `event_${key}`,
}) as any;
const stored = async () => JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');

beforeEach(async () => { await AsyncStorage.clear(); });

it('approve + add at the same moment: the approval AND the new card survive', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify([card('q1')]));
  await Promise.all([approveItem('q1'), addToQueue(fresh('new-1')), addToQueue(fresh('new-2'))]);
  const q = await stored();
  expect(q.find((i: any) => i.id === 'q1')?.status).toBe('approved');
  expect(q.filter((i: any) => i.entityKey === 'new-1' || i.entityKey === 'new-2')).toHaveLength(2);
});

it('reject + snooze of different cards at once: both land', async () => {
  await AsyncStorage.setItem(KEY, JSON.stringify([card('a'), card('b')]));
  await Promise.all([rejectItem('a'), snoozeQueueItem('b', 24)]);
  const q = await stored();
  expect(q.find((i: any) => i.id === 'a')?.status).toBe('rejected');
  expect(q.find((i: any) => i.id === 'b')?.snoozedUntil).toBeTruthy();
});
