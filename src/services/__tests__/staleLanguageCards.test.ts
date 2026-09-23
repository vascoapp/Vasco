/**
 * Stored cards follow the contractor's CURRENT language (#365).
 *
 * A card persists resolved copy. Jan's Dutch home still showed English
 * "Reminder for F-2026-0038 / SEND REMINDER" made while the app ran in
 * English. Pending cards in another language (or unstamped legacy ones) are
 * dropped so their producers write them again; acted-on cards and one-off
 * event cards (which nothing would regenerate) are kept.
 *
 * jest.setup.ts pins i18n.language to 'en'.
 */
jest.mock('../../intelligence/backgroundJobScheduler', () => ({ requestQueueRebuild: jest.fn(() => Promise.resolve()) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addToQueue, dropStaleLanguageCards } from '../aiActionQueueService';

const QUEUE_KEY = '@vasco_ai_queue';
const card = (over: any) => ({
  id: over.id, type: 'draft_reminder', status: 'pending', title: over.id, description: '',
  preparedData: {}, actionLabel: '', estimatedImpact: '', createdAt: new Date().toISOString(), ...over,
});

describe('stored cards follow the current language', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('stamps a new card with the language it was written in', async () => {
    await addToQueue({ type: 'draft_reminder', title: 'x', description: '', preparedData: {}, actionLabel: '', estimatedImpact: '' } as any);
    const stored = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) as string);
    expect(stored[0].locale).toBe('en');
  });

  it('drops pending other-language and legacy cards, keeps the rest', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([
      card({ id: 'same', locale: 'en' }),
      card({ id: 'dutch', locale: 'nl' }),
      card({ id: 'legacy' }),
      card({ id: 'event', locale: 'nl', sourceGeneratorId: 'event_invoice_sent' }),
      card({ id: 'done', locale: 'nl', status: 'approved' }),
    ]));
    await AsyncStorage.setItem('@vasco_pack_daily_17_last_fired', '2026-09-23');
    await expect(dropStaleLanguageCards()).resolves.toBe(2);
    const ids = JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) as string).map((c: any) => c.id);
    expect(ids).toEqual(['same', 'event', 'done']);
    // The end-of-day gate is cleared so its card can be written again today.
    expect(await AsyncStorage.getItem('@vasco_pack_daily_17_last_fired')).toBeNull();
  });

  it('does nothing when every pending card is already in the current language', async () => {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([card({ id: 'same', locale: 'en' })]));
    await AsyncStorage.setItem('@vasco_pack_daily_17_last_fired', '2026-09-23');
    await expect(dropStaleLanguageCards()).resolves.toBe(0);
    expect(await AsyncStorage.getItem('@vasco_pack_daily_17_last_fired')).toBe('2026-09-23');
  });
});
