// An account switch wipes the previous contractor's storage — and the wipe
// lists the keys, then removes them. A write for the NEW contractor that
// lands in between (their profile, stamped in the same commit) was deleted
// with the previous one's. Writers wait for `handoverSettled()` (review,
// 2026-09-30).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { handOverFrom, handoverSettled } from '../services/sessionCleanup';

beforeEach(async () => { await AsyncStorage.clear(); });

it('a write that waits for the handover survives it', async () => {
  await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ userId: 'A', country: 'IT' }));
  await AsyncStorage.setItem('@vasco_ai_queue', '[]');
  void handOverFrom('A');
  await handoverSettled()?.catch(() => {});
  await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ userId: 'B', country: 'NL' }));
  expect(JSON.parse((await AsyncStorage.getItem('@vasco_user_profile'))!).userId).toBe('B');
  expect(await AsyncStorage.getItem('@vasco_ai_queue')).toBeNull();
});

it('the previous contractor\'s keys are gone and the barrier clears', async () => {
  await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ userId: 'A' }));
  const wipe = handOverFrom('A');
  expect(handoverSettled()).toBe(wipe);
  await wipe;
  expect(await AsyncStorage.getItem('@vasco_user_profile')).toBeNull();
  expect(handoverSettled()).toBeNull();
});
