/**
 * The "due today" reminder lives exactly as long as the invoice is owed.
 *
 * - "Send invoice again" scheduled a SECOND reminder for the same invoice;
 * - an invoice paid early still pinged "due today";
 * - another contractor signing in on the phone, or an erased account, left
 *   reminders naming the previous contractor's customers (2026-10-04).
 */
const mockScheduled: any[] = [];
const mockCancel = jest.fn(async (id: string) => {
  const i = mockScheduled.findIndex((r) => r.identifier === id);
  if (i >= 0) mockScheduled.splice(i, 1);
});
const mockCancelAll = jest.fn(async () => { mockScheduled.length = 0; });
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  scheduleNotificationAsync: jest.fn(async (req: any) => {
    const identifier = req.identifier ?? `auto-${mockScheduled.length}`;
    mockScheduled.push({ identifier, content: req.content });
    return identifier;
  }),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  getAllScheduledNotificationsAsync: jest.fn(async () => [...mockScheduled]),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { schedulePaymentReminder, cancelRemindersForPaidInvoices } from '../pushNotificationService';
import { claimDeviceData, DEVICE_DATA_OWNER_KEY } from '../sessionCleanup';
import { clearAllLocalData } from '../accountDeletionService';

const remind = (invoiceId: string) =>
  schedulePaymentReminder({ invoiceId, customerName: 'Fam. Jansen', amount: 121, daysUntilDue: 20 });
const reminders = () => mockScheduled.filter((r) => r.content?.data?.type === 'payment_reminder');

beforeEach(async () => {
  mockScheduled.length = 0;
  mockCancel.mockClear();
  mockCancelAll.mockClear();
  await AsyncStorage.clear();
});

it('a resend REPLACES the reminder instead of stacking a second one', async () => {
  await remind('RE-1');
  await remind('RE-1');
  await remind('RE-2');
  expect(reminders().map((r) => r.content.data.invoiceId).sort()).toEqual(['RE-1', 'RE-2']);
});

it('a paid invoice loses its reminder; an open one keeps it', async () => {
  await remind('RE-1');
  await remind('RE-2');
  // A reminder from before the fixed id existed (no identifier of ours).
  mockScheduled.push({ identifier: 'legacy-x', content: { data: { type: 'payment_reminder', invoiceId: 'RE-3' } } });
  const n = await cancelRemindersForPaidInvoices([
    { id: 'RE-1', status: 'paid' },
    { id: 'RE-2', status: 'sent' },
    { id: 'RE-3', status: 'paid' },
  ]);
  expect(n).toBe(2);
  expect(reminders().map((r) => r.content.data.invoiceId)).toEqual(['RE-2']);
});

it('an invoice it cannot see (list not loaded yet) is never a reason to cancel', async () => {
  await remind('RE-1');
  expect(await cancelRemindersForPaidInvoices([])).toBe(0);
  expect(reminders()).toHaveLength(1);
});

it('another contractor signing in clears the previous one\'s reminders; the same one keeps them', async () => {
  await AsyncStorage.setItem(DEVICE_DATA_OWNER_KEY, 'user-a');
  await remind('RE-1');
  await claimDeviceData('user-a');
  expect(reminders()).toHaveLength(1);
  await claimDeviceData('user-b');
  expect(reminders()).toHaveLength(0);
});

it('erasing the account cancels its reminders', async () => {
  await remind('RE-1');
  await clearAllLocalData();
  expect(reminders()).toHaveLength(0);
});
