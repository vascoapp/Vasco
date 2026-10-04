/**
 * An invoice marked sent speaks of ITS OWN payment term.
 *
 * `markInvoiceSent` queued the customer notice with "Payment terms: 14 days"
 * and scheduled the reminder push for day 14 — a flat constant — while the
 * invoice the customer holds was due on the contractor's own terms (here 30).
 * Now both come from the invoice's due date: the notice states today → due
 * (the PDF sent with it is dated the send day), the push fires on that day.
 *
 * Marked WITHOUT `delivered` — the path after a share the contractor confirmed,
 * which is the one that queues the notice. ONE test per file.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';

const mockSchedule = jest.fn(async (_a: any) => {});
jest.mock('../src/services/pushNotificationService', () => ({
  ...jest.requireActual('../src/services/pushNotificationService'),
  schedulePaymentReminder: (a: any) => mockSchedule(a),
}));

import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { useAppState } from '../src/state/AppState';
import { localDateKey } from '../src/utils/dateKey';

let app: ReturnType<typeof useAppState>;
function Probe() { app = useAppState(); return null; }
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d; };

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('marking an invoice sent', () => {
  it('states the days to its due date and reminds on that day', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-t', name: 'Familie Termijn', email: 't@example.nl' }]));
    // Issued 2 days ago on 30-day terms: due in 28 days.
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-T-1', customerId: 'c-t', customer: 'Familie Termijn', job: 'Onderhoud', amount: 121, status: 'draft', dueInDays: 14,
        createdAt: day(-2).toISOString(), dueDate: localDateKey(day(28)) },
    ]));

    const r = await walkScreen(Probe, { settlePasses: 12 });
    expect(r.error).toBeNull();
    await act(async () => { app.markInvoiceSent('RE-T-1'); });
    await settle();

    const queue = JSON.parse((await AsyncStorage.getItem('@vasco_ai_queue')) ?? '[]');
    const notice = queue.find((q: any) => q.entityKey === 'invoice_sent:RE-T-1');
    expect(notice).toBeDefined();
    // The PDF sent with it is dated TODAY (sentAt), due in 28: that is the
    // term the customer can check — not 30 counted from the draft, not 14.
    const text = JSON.stringify(notice.preparedData);
    expect(text).toMatch(/\b28\b/);
    expect(text).not.toMatch(/\b(14|30)\b/);

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule.mock.calls[0][0].daysUntilDue).toBe(28);

    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_invoices')) ?? '[]').find((i: any) => i.id === 'RE-T-1');
    expect(stored.status).toBe('sent');
    expect(stored.dueInDays).toBe(28);
    teardown(r);
  });
});
