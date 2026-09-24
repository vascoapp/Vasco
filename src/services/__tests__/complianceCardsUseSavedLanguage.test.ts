/**
 * Compliance-agent alerts and queue cards are written in the contractor's
 * SAVED language. They were English literals on every market — "Gas Safe
 * expires in under 7 days / Renew", "workers_comp insurance" — and stored
 * that way (sweep 2026-09-23, E2).
 *
 * REAL i18next: jest.setup.ts stubs src/i18n/i18n with a `t` that ignores the
 * language, under which this would pass vacuously (#367).
 */
jest.unmock('../../i18n/i18n');
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-GB', languageCode: 'en' }] }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
      removeItem: jest.fn(async (k: string) => { store.delete(k); }),
      multiSet: jest.fn(async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => store.set(k, v)); }),
      clear: jest.fn(async () => { store.clear(); }),
    },
  };
});
const mockAddToQueue = jest.fn((..._a: any[]) => Promise.resolve('q1'));
jest.mock('../aiActionQueueService', () => ({ addToQueue: (...a: any[]) => mockAddToQueue(...a) }));
const mockAlerts: any[] = [];
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
jest.mock('../complianceService', () => ({
  complianceService: {
    getLicenses: () => [{ id: 'l1', name: 'Meisterbrief', expiryDate: inDays(5) }],
    getCertifications: () => [],
    getInsurancePolicies: () => [{ id: 'p1', type: 'workers_comp', endDate: inDays(5) }],
    getAllAlertIds: () => [],
    addAlert: (a: any) => mockAlerts.push(a),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../../i18n/i18n';
import { setAccountLanguage } from '../../i18n/savedLanguage';
import { scan } from '../complianceAgentService';

const de = require('../../i18n/locales/de.json');

beforeEach(async () => {
  await AsyncStorage.clear();
  setAccountLanguage(undefined);
  await i18n.changeLanguage('en');
  mockAddToQueue.mockClear();
  mockAlerts.length = 0;
});
afterAll(async () => { await i18n.changeLanguage('en'); });

it('a German contractor on an English phone gets German cards and alerts', async () => {
  await AsyncStorage.setItem('@vasco_user_profile', JSON.stringify({ language: 'de' }));
  await scan({ force: true });
  const cards = mockAddToQueue.mock.calls.map((c: any[]) => c[0]);
  expect(cards).toHaveLength(2);
  expect(cards[0].title).toBe('Meisterbrief läuft in weniger als 7 Tagen ab');
  expect(cards[0].actionLabel).toBe(de.complianceAgent.renew);
  expect(cards[0].estimatedImpact).toBe(de.complianceAgent.impactD7);
  expect(cards[1].title).toContain('Unfallversicherung');
  for (const c of [...cards, ...mockAlerts]) {
    expect(`${c.title} ${c.description}`).not.toMatch(/expires|insurance|workers_comp|Renew/);
  }
});
