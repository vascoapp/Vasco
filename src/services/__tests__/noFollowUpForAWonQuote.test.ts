/**
 * No follow-up for a quote the customer already said yes to; no reminder for a
 * paid invoice (UK walk, 2026-10-08: Today offered "Send follow-up" to a
 * customer who had accepted in the portal and paid).
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import { queueTargetStillOpen } from '../aiActionQueueService';

const followUp = { type: 'draft_followup', preparedData: { quoteId: 'Q0001' } } as any;
const reminder = { type: 'draft_reminder', preparedData: { invoiceId: 'INV0001' } } as any;

it('hides a follow-up once the quote is accepted or declined', () => {
  expect(queueTargetStillOpen(followUp, { quotes: [{ id: 'Q0001', status: 'sent' }] })).toBe(true);
  expect(queueTargetStillOpen(followUp, { quotes: [{ id: 'Q0001', status: 'accepted' }] })).toBe(false);
  expect(queueTargetStillOpen(followUp, { quotes: [{ id: 'Q0001', status: 'rejected' }] })).toBe(false);
});

it('hides a follow-up once the quote became a job, even if its status lags on this device', () => {
  expect(queueTargetStillOpen(followUp, {
    quotes: [{ id: 'Q0001', status: 'sent' }],
    jobs: [{ id: 'j1', quoteId: 'Q0001' }],
  })).toBe(false);
});

it('hides a reminder for a paid invoice', () => {
  expect(queueTargetStillOpen(reminder, { invoices: [{ id: 'INV0001', status: 'sent' }] })).toBe(true);
  expect(queueTargetStillOpen(reminder, { invoices: [{ id: 'INV0001', status: 'paid' }] })).toBe(false);
});

it('an accounting-export card is never shown — its action exports nothing (UK walk W149)', () => {
  expect(queueTargetStillOpen({ type: 'accounting_export', preparedData: {} } as any, {})).toBe(false);
});
