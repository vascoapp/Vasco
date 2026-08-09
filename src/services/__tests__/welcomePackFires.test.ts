/**
 * The "Nieuw Klant Welkom" pack has to actually fire.
 *
 * Its first step triggers on `quote_accepted`, which matches
 * `acceptedAt || lastUpdated` inside a 2-day window. Nothing on the acceptance
 * path wrote either: `markQuoteSent` and `addQuote` stored the literal string
 * `'Just now'`, and `acceptQuote` changed only `status`. `new Date('Just now')`
 * is Invalid, the trigger skips on `isNaN`, and the welcome message was never
 * queued for anyone — while the Automations screen listed the pack as active.
 *
 * Asserts the behaviour and the exact regression that caused it.
 */
import { evaluateTriggers, pickTemplateForLocale, resolveTemplate, DEFAULT_PACKS } from '../workflowPackService';
import { addToQueue } from '../aiActionQueueService';

jest.mock('../../lib/currentUser', () => ({
  getAuthedUserId: () => 'u1',
  getCurrentUserId: () => 'u1',
  getCurrentTrade: () => 'plumbing',
  getCurrentCountry: () => 'NL',
}));

// `evaluateTriggers` returns the count across ALL packs, so asserting on its
// total made both cases depend on the wall clock: the end-of-day pack fires on
// `daily_17:00`, so "queues nothing" was green every morning and red every
// evening, and "queues something" would have passed even if the welcome pack
// never fired. Assert on what was actually queued instead.
jest.mock('../aiActionQueueService', () => ({
  ...jest.requireActual('../aiActionQueueService'),
  addToQueue: jest.fn(() => Promise.resolve('queued-1')),
  getQueueHistory: () => Promise.resolve([]),
  getRequiredPermits: () => [],
}));

const addToQueueMock = addToQueue as unknown as jest.Mock;

/** Only the items the welcome pack queued, ignoring any clock-driven pack. */
function welcomeItems() {
  return addToQueueMock.mock.calls
    .map((c) => c[0])
    .filter((item) => item?.preparedData?.packId === 'nieuw_klant_welkom');
}

// evaluateTriggers returns 0 on its first line unless the tier runs packs.
jest.mock('../subscriptionService', () => ({
  loadSubscription: () => Promise.resolve({ tier: 'pro' }),
  getTierLimits: () => ({ hasAutomationPacks: true }),
}));

const quote = (over: Record<string, unknown> = {}) => ({
  id: 'q-1',
  customer: 'Fam. de Vries',
  customerId: 'cust-001',
  job: 'Badkamer renovatie',
  amount: 4500,
  status: 'accepted',
  lastUpdated: new Date().toISOString(),
  ...over,
});

const ctx = (quotes: any[]) => ({
  invoices: [],
  quotes,
  jobs: [],
  customers: [{ id: 'cust-001', name: 'Fam. de Vries' }],
});

describe('Nieuw Klant Welkom', () => {
  beforeEach(async () => {
    addToQueueMock.mockClear();
    await (globalThis as any).__asyncStorageMock &&
      Object.keys((globalThis as any).__asyncStorageMock ?? {}).forEach(
        (k) => delete (globalThis as any).__asyncStorageMock[k],
      );
  });

  it('queues the welcome message for a quote accepted just now', async () => {
    await evaluateTriggers(ctx([quote()]) as any);
    expect(welcomeItems().length).toBeGreaterThan(0);
  });

  it('queues no welcome when the timestamp is unparseable — the original defect', async () => {
    await evaluateTriggers(ctx([quote({ lastUpdated: 'Just now' })]) as any);
    expect(welcomeItems()).toHaveLength(0);
  });

  it('the message thanks the customer for the collaboration, in every locale', () => {
    const pack = DEFAULT_PACKS.find((p) => p.id === 'nieuw_klant_welkom');
    const step = pack!.steps[0];
    // "Warm and grateful" is the requirement, so assert on the words rather
    // than on an exact sentence that will be reworded.
    const THANKS: Record<string, RegExp> = {
      nl: /bedankt|dank/i,
      en: /thank/i,
      de: /dank/i,
      fr: /merci/i,
      es: /gracias/i,
      it: /grazie/i,
    };
    for (const [lng, re] of Object.entries(THANKS)) {
      const template = pickTemplateForLocale(step, lng as any);
      const text = resolveTemplate(template, { customer: 'Fam. de Vries', job: 'Badkamer renovatie' });
      expect(text).toMatch(re);
      expect(text).toContain('Fam. de Vries');
      // Nothing unbound may reach a customer.
      expect(text).not.toMatch(/\{\{\w+\}\}/);
    }
  });
});
