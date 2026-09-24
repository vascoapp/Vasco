/**
 * The permit-check pack stays silent when the contractor's country is
 * unknown. `getCurrentCountry() ?? 'NL'` handed a German plumber the DUTCH
 * permit list (CLAUDE.md: a country-dependent nudge skips, never defaults;
 * sweep 2026-09-23, D3).
 */
let mockCountry: string | undefined;
jest.mock('../../lib/currentUser', () => ({
  ...jest.requireActual('../../lib/currentUser'),
  getCurrentCountry: () => mockCountry,
}));
const mockAddToQueue = jest.fn((..._a: any[]) => Promise.resolve('q1'));
const mockPermits = jest.fn((_trade: string, _country: string) => [{ id: 'p1' }]);
jest.mock('../aiActionQueueService', () => ({
  dropStaleLanguageCards: jest.fn(() => Promise.resolve(0)),
  addToQueue: (...a: any[]) => mockAddToQueue(...a),
  getQueueHistory: jest.fn(() => Promise.resolve([])),
  getRequiredPermits: (t: string, c: string) => mockPermits(t, c),
}));
jest.mock('../subscriptionService', () => ({
  loadSubscription: jest.fn(() => Promise.resolve({ tier: 'pro', billingCycle: 'monthly' })),
  getTierLimits: jest.fn(() => ({ hasAutomationPacks: true })),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PACKS, evaluateTriggers, saveWorkflowPacks } from '../workflowPackService';

async function run() {
  const pack = DEFAULT_PACKS.find((p) => p.id === 'vergunning_check')!;
  await saveWorkflowPacks([{ ...pack, enabled: true }]);
  await evaluateTriggers({
    invoices: [], quotes: [], customers: [],
    jobs: [{ id: 'j1', title: 'Gasleitung', status: 'scheduled', trade: 'gas', createdAt: new Date().toISOString() }],
  } as any);
}

beforeEach(async () => { await AsyncStorage.clear(); mockAddToQueue.mockClear(); mockPermits.mockClear(); });

it('known country → the permit card, for THAT country', async () => {
  mockCountry = 'DE';
  await run();
  expect(mockPermits).toHaveBeenCalledWith('gas', 'DE');
  expect(mockAddToQueue).toHaveBeenCalled();
});

it('unknown country → no permit lookup, no card', async () => {
  mockCountry = undefined;
  await run();
  expect(mockPermits).not.toHaveBeenCalled();
  expect(mockAddToQueue).not.toHaveBeenCalled();
});
