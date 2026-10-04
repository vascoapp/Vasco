/**
 * The payment-reminder push fires ON the due day and says so.
 *
 * It is scheduled `daysUntilDue` ahead (AppState.markInvoiceSent) and its body
 * read "overdue by {{days}} days" with that same number — a 30-day invoice was
 * "30 days overdue" the day it fell due (review 2026-10-04).
 */
import * as fs from 'fs';
import * as path from 'path';

const mockSchedule = jest.fn(async (_req: any) => 'id-1');
jest.mock('expo-notifications', () => ({
  ...jest.requireActual('expo-notifications'),
  scheduleNotificationAsync: (req: any) => mockSchedule(req),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
}));

import { schedulePaymentReminder } from '../pushNotificationService';

const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'];
const body = (l: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `../../i18n/locales/${l}.json`), 'utf8')).notifications.push.paymentReminderBody as string;

describe('payment reminder push', () => {
  it('is scheduled for the due day', async () => {
    await schedulePaymentReminder({ invoiceId: 'RE-1', customerName: 'Fam. Jansen', amount: 121, daysUntilDue: 28 });
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0][0].trigger.seconds).toBe(28 * 86400);
  });

  it.each(LOCALES)('%s: says nothing about days overdue', (l) => {
    expect(body(l)).not.toMatch(/\{\{\s*days\s*\}\}/);
    expect(body(l)).toMatch(/\{\{customer\}\}/);
  });
});
