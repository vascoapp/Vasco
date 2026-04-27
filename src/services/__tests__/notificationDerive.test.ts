/**
 * @jest-environment node
 *
 * R272 — live notifications derived from AppState.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn() },
}));

import { deriveLiveNotifications } from '../notificationService';

const todayStr = new Date().toISOString().split('T')[0];

describe('deriveLiveNotifications (R272)', () => {
  test('overdue invoice → urgent notification with correct route', () => {
    const out = deriveLiveNotifications({
      invoices: [{ id: 'I-42', status: 'overdue', dueInDays: -20, amount: 1500, customer: 'Acme' }],
      jobs: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('overdue_invoice');
    expect(out[0].priority).toBe('urgent');
    expect(out[0].actionRoute).toBe('/invoices/I-42');
    expect(out[0].body).toContain('Acme');
    expect(out[0].body).toContain('20');
  });

  test('overdue invoice <14d → high (not urgent)', () => {
    const out = deriveLiveNotifications({
      invoices: [{ id: 'I-1', status: 'overdue', dueInDays: -7, amount: 500 }],
      jobs: [],
    });
    expect(out[0].priority).toBe('high');
  });

  test('today scheduled job → schedule notification', () => {
    const out = deriveLiveNotifications({
      invoices: [],
      jobs: [{ id: 'J-1', title: 'Boiler check', status: 'scheduled', scheduledDate: todayStr }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('schedule_change');
    expect(out[0].body).toContain('Boiler check');
  });

  test('multiple today-jobs → single rolled-up notification', () => {
    const out = deriveLiveNotifications({
      invoices: [],
      jobs: [
        { id: 'J-1', title: 'A', status: 'scheduled', scheduledDate: todayStr },
        { id: 'J-2', title: 'B', status: 'in-progress', scheduledDate: todayStr },
        { id: 'J-3', title: 'C', status: 'scheduled', scheduledDate: todayStr },
      ],
    });
    const sched = out.filter((n) => n.type === 'schedule_change');
    expect(sched).toHaveLength(1);
    expect(sched[0].title).toContain('3');
  });

  test('cert expiring ≤7d → urgent', () => {
    const in5d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const out = deriveLiveNotifications({
      invoices: [],
      jobs: [],
      certifications: [{ id: 'cert-1', name: 'KOMO', expiresAt: in5d }],
    });
    expect(out[0].type).toBe('credential_expiry');
    expect(out[0].priority).toBe('urgent');
  });

  test('cert expiring 8-30d → high', () => {
    const in20d = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    const out = deriveLiveNotifications({
      invoices: [],
      jobs: [],
      certifications: [{ id: 'cert-1', name: 'KOMO', expiresAt: in20d }],
    });
    expect(out[0].priority).toBe('high');
  });

  test('cert >30d out → not surfaced', () => {
    const in60d = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const out = deriveLiveNotifications({
      invoices: [],
      jobs: [],
      certifications: [{ id: 'cert-1', name: 'X', expiresAt: in60d }],
    });
    expect(out).toHaveLength(0);
  });

  test('empty state → no notifications', () => {
    const out = deriveLiveNotifications({ invoices: [], jobs: [] });
    expect(out).toEqual([]);
  });

  test('paid invoice does NOT generate overdue notification', () => {
    const out = deriveLiveNotifications({
      invoices: [{ id: 'I-1', status: 'paid', dueInDays: -10 }],
      jobs: [],
    });
    expect(out).toHaveLength(0);
  });

  test('combined: invoice + jobs + cert all surface', () => {
    const in5d = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const out = deriveLiveNotifications({
      invoices: [{ id: 'I-1', status: 'overdue', dueInDays: -3 }],
      jobs: [{ id: 'J-1', title: 'X', status: 'scheduled', scheduledDate: todayStr }],
      certifications: [{ id: 'cert-1', name: 'C', expiresAt: in5d }],
    });
    expect(out.map((n) => n.type)).toEqual(
      expect.arrayContaining(['overdue_invoice', 'schedule_change', 'credential_expiry']),
    );
  });
});
