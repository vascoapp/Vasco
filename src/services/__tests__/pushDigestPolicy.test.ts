/**
 * @jest-environment node
 */

import { pickDailyPush, __internal } from '../pushDigestPolicy';

const zero = {
  overdueInvoiceCount: 0,
  overdueInvoiceAmount: 0,
  queuePendingCount: 0,
  stalingQuoteCount: 0,
  jobsTomorrowCount: 0,
};

describe('pushDigestPolicy.pickDailyPush', () => {
  test('no signal → null (no spam)', () => {
    expect(pickDailyPush(zero)).toBeNull();
  });

  test('overdue wins over everything else (priority 1)', () => {
    const r = pickDailyPush({
      ...zero,
      overdueInvoiceCount: 2,
      overdueInvoiceAmount: 3500,
      queuePendingCount: 10,
      stalingQuoteCount: 5,
      jobsTomorrowCount: 3,
    });
    expect(r?.type).toBe('overdue_invoices');
    expect(r?.title).toContain('3,500');
    expect(r?.body).toMatch(/2 invoices/);
  });

  test('overdue below minimum amount falls through to queue', () => {
    const r = pickDailyPush({
      ...zero,
      overdueInvoiceCount: 1,
      overdueInvoiceAmount: 50, // < MIN_OVERDUE_AMOUNT
      queuePendingCount: 3,
    });
    expect(r?.type).toBe('queue_waiting');
  });

  test('queue wins over staling when overdue absent', () => {
    const r = pickDailyPush({
      ...zero,
      queuePendingCount: 4,
      stalingQuoteCount: 2,
      jobsTomorrowCount: 1,
    });
    expect(r?.type).toBe('queue_waiting');
  });

  test('staling wins when overdue + queue are below thresholds', () => {
    const r = pickDailyPush({
      ...zero,
      queuePendingCount: 1, // below MIN_QUEUE
      stalingQuoteCount: 2,
      jobsTomorrowCount: 1,
    });
    expect(r?.type).toBe('staling_quotes');
    expect(r?.body.toLowerCase()).toContain('cohort');
  });

  test('jobs_tomorrow is the last-resort bucket', () => {
    const r = pickDailyPush({ ...zero, jobsTomorrowCount: 2 });
    expect(r?.type).toBe('jobs_tomorrow');
    expect(r?.title).toContain('2 jobs');
  });

  test('entityKey varies with the count (so dedupe refreshes on change)', () => {
    const a = pickDailyPush({ ...zero, overdueInvoiceCount: 1, overdueInvoiceAmount: 500 });
    const b = pickDailyPush({ ...zero, overdueInvoiceCount: 2, overdueInvoiceAmount: 900 });
    expect(a?.entityKey).not.toBe(b?.entityKey);
  });

  test('singular/plural body text switches on count', () => {
    const one = pickDailyPush({ ...zero, overdueInvoiceCount: 1, overdueInvoiceAmount: 500 });
    const many = pickDailyPush({ ...zero, overdueInvoiceCount: 3, overdueInvoiceAmount: 2000 });
    expect(one?.body).toMatch(/1 invoice /);
    expect(many?.body).toMatch(/3 invoices/);
  });

  test('thresholds are coherent', () => {
    expect(__internal.MIN_OVERDUE_AMOUNT).toBeGreaterThan(0);
    expect(__internal.MIN_QUEUE).toBeGreaterThan(__internal.MIN_STALING);
  });
});
