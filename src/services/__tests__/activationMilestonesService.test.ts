/**
 * @jest-environment node
 */

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (mockStorage.has(k) ? mockStorage.get(k) : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStorage.set(k, v); }),
  removeItem: jest.fn(async (k: string) => { mockStorage.delete(k); }),
}));

import {
  evaluateMilestones,
  completedCount,
  allComplete,
  isDismissed,
  markDismissed,
  resetDismissed,
  __internal,
} from '../activationMilestonesService';

beforeEach(() => {
  mockStorage.clear();
});

const empty = {
  businessProfile: null,
  customers: [],
  quotes: [],
  jobs: [],
  invoices: [],
};

describe('evaluateMilestones', () => {
  test('all five steps start undone on an empty profile', () => {
    const m = evaluateMilestones(empty);
    expect(m).toHaveLength(5);
    expect(m.every((s) => !s.done)).toBe(true);
    expect(completedCount(m)).toBe(0);
    expect(allComplete(m)).toBe(false);
  });

  test('profile_complete flips when isComplete is true', () => {
    const m = evaluateMilestones({ ...empty, businessProfile: { isComplete: true } });
    expect(m.find((s) => s.id === 'profile_complete')!.done).toBe(true);
    expect(completedCount(m)).toBe(1);
  });

  test('profile_complete also flips when businessName + country + kvkNumber filled', () => {
    const m = evaluateMilestones({
      ...empty,
      businessProfile: { businessName: 'Acme', country: 'NL', kvkNumber: '12345678' },
    });
    expect(m.find((s) => s.id === 'profile_complete')!.done).toBe(true);
  });

  test('first_customer flips on any customer', () => {
    const m = evaluateMilestones({ ...empty, customers: [{ id: 'c1' }] });
    expect(m.find((s) => s.id === 'first_customer')!.done).toBe(true);
  });

  test('first_quote_sent counts sent / accepted / rejected / expired', () => {
    for (const status of ['sent', 'accepted', 'rejected', 'expired']) {
      const m = evaluateMilestones({ ...empty, quotes: [{ id: 'q', status }] });
      expect(m.find((s) => s.id === 'first_quote_sent')!.done).toBe(true);
    }
  });

  test('first_quote_sent stays undone for draft quotes', () => {
    const m = evaluateMilestones({ ...empty, quotes: [{ id: 'q', status: 'draft' }] });
    expect(m.find((s) => s.id === 'first_quote_sent')!.done).toBe(false);
  });

  test('first_job_scheduled excludes lead + draft', () => {
    expect(
      evaluateMilestones({ ...empty, jobs: [{ id: 'j', status: 'lead' }] })
        .find((s) => s.id === 'first_job_scheduled')!.done,
    ).toBe(false);
    expect(
      evaluateMilestones({ ...empty, jobs: [{ id: 'j', status: 'scheduled' }] })
        .find((s) => s.id === 'first_job_scheduled')!.done,
    ).toBe(true);
  });

  test('first_payment_received requires status=paid', () => {
    expect(
      evaluateMilestones({ ...empty, invoices: [{ id: 'i', status: 'sent' }] })
        .find((s) => s.id === 'first_payment_received')!.done,
    ).toBe(false);
    expect(
      evaluateMilestones({ ...empty, invoices: [{ id: 'i', status: 'paid' }] })
        .find((s) => s.id === 'first_payment_received')!.done,
    ).toBe(true);
  });

  test('allComplete when all 5 gates are satisfied', () => {
    const m = evaluateMilestones({
      businessProfile: { isComplete: true },
      customers: [{ id: 'c' }],
      quotes: [{ id: 'q', status: 'sent' }],
      jobs: [{ id: 'j', status: 'scheduled' }],
      invoices: [{ id: 'i', status: 'paid' }],
    });
    expect(completedCount(m)).toBe(5);
    expect(allComplete(m)).toBe(true);
  });
});

describe('dismissal persistence', () => {
  test('isDismissed is false by default', async () => {
    expect(await isDismissed()).toBe(false);
  });
  test('markDismissed → isDismissed true; reset → false', async () => {
    await markDismissed();
    expect(await isDismissed()).toBe(true);
    await resetDismissed();
    expect(await isDismissed()).toBe(false);
  });
  test('stores under the expected key', async () => {
    await markDismissed();
    expect(mockStorage.get(__internal.DISMISSED_KEY)).toBe('1');
  });
});
