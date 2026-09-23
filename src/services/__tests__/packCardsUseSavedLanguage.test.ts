/**
 * A pack card is written in the contractor's SAVED language, not the device's.
 *
 * Vandaag calls `evaluateTriggers` on mount, before AuthContext has applied the
 * saved language, so i18next is still on the device locale. A Dutch contractor
 * on an English iPhone got "End of Day Routine: 17:00 / VIEW · Saves time" —
 * title, button and impact, all persisted — beside a Dutch home screen
 * (TestFlight, 2026-09-22). `populateQueue` has awaited `applySavedLanguage`
 * since #210; this path never did.
 *
 * Runs against REAL i18next: jest.setup.ts stubs `src/i18n/i18n` with a `t`
 * that ignores the language, under which this test would pass vacuously.
 */

jest.unmock('../../i18n/i18n');
jest.mock('expo-localization', () => ({
  // The device is English — the case that broke.
  getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }],
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { store.delete(k); }),
      clear: jest.fn(async () => { store.clear(); }),
    },
  };
});

const mockAddToQueue = jest.fn((..._args: any[]) => Promise.resolve('q-mock-id'));
jest.mock('../aiActionQueueService', () => ({
  dropStaleLanguageCards: jest.fn(() => Promise.resolve(0)),
  addToQueue: (...args: any[]) => mockAddToQueue(...args),
  getQueueHistory: jest.fn(() => Promise.resolve([])),
  getRequiredPermits: jest.fn(() => []),
}));
jest.mock('../subscriptionService', () => ({
  loadSubscription: jest.fn(() => Promise.resolve({ tier: 'pro', billingCycle: 'monthly' })),
  getTierLimits: jest.fn(() => ({ hasAutomationPacks: true })),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../i18n/i18n';
import { setAccountLanguage } from '../../i18n/savedLanguage';
import { DEFAULT_PACKS, evaluateTriggers, saveWorkflowPacks } from '../workflowPackService';

const nl = require('../../i18n/locales/nl.json');
const en = require('../../i18n/locales/en.json');

describe('pack cards use the saved language', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    setAccountLanguage(undefined);
    await i18n.changeLanguage('en');
    mockAddToQueue.mockClear();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date(2026, 4, 10, 18, 0, 0)); // local 18:00
  });

  afterEach(() => { jest.useRealTimers(); });
  afterAll(async () => { await i18n.changeLanguage('en'); });

  async function endOfDayCards() {
    const pack = DEFAULT_PACKS.find((p) => p.id === 'einde_dag')!;
    await saveWorkflowPacks([{ ...pack, enabled: true }]);
    await evaluateTriggers({
      invoices: [], quotes: [], customers: [],
      jobs: [{ id: 'j1', title: 'Badkamer', status: 'in-progress' }],
    } as any);
    return mockAddToQueue.mock.calls.map((c: any[]) => c[0]);
  }

  it('the English strings really differ from the Dutch ones', () => {
    // Otherwise the assertions below could not tell the two apart.
    expect(en.workflow.view).not.toBe(nl.workflow.view);
    expect(en.workflow.savesTime).not.toBe(nl.workflow.savesTime);
    expect(en.workflowPacks.endOfDay.name).not.toBe(nl.workflowPacks.endOfDay.name);
  });

  it('writes the card in Dutch when the profile says Dutch and the device says English', async () => {
    await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ language: 'nl' }));
    expect(i18n.language).toBe('en');
    const cards = await endOfDayCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.title.startsWith(`${nl.workflowPacks.endOfDay.name}:`)).toBe(true);
      expect(card.actionLabel).toBe(nl.workflow.view);
      expect(card.estimatedImpact).toBe(nl.workflow.savesTime);
      expect(card.preparedData.template).toMatch(/^Klussen niet afgerond vandaag: 1$/);
    }
  });

  it('keeps English when nothing says otherwise', async () => {
    const cards = await endOfDayCards();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.title.startsWith(`${en.workflowPacks.endOfDay.name}:`)).toBe(true);
      expect(card.actionLabel).toBe(en.workflow.view);
    }
  });
});
