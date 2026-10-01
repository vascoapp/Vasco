/**
 * The send button says what will be sent. It said "Send reminder" whenever an
 * invoice was 3+ days overdue, but a customer's cadence override can delay
 * reminders — then the plain invoice email goes out (review, 2026-09-30). The
 * label now follows the same step the send uses.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const mockSend = jest.fn(async (_input: any) => ({ ok: true }));
const mockGate = jest.fn(async () => true);
jest.mock('../src/services/sendInvoiceService', () => ({ sendInvoice: (i: any) => mockSend(i) }));
jest.mock('../src/services/reminderGate', () => ({ gateReminderSend: (...a: any[]) => (mockGate as any)(...a) }));
jest.mock('../src/utils/businessProfileValidation', () => ({
  ...jest.requireActual('../src/utils/businessProfileValidation'),
  checkInvoiceReadiness: () => ({ ready: true, missingLabels: [], invalidLabels: [] }),
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
};
const labelOf = (root: any) => root.findAll(
  (n: any) => typeof n.props?.children === 'string' && /^(Herinnering versturen|Factuur opnieuw versturen|Factuur versturen)$/.test(n.props.children),
  { deep: true },
).map((n: any) => n.props.children)[0];

run('the send button label', () => {
  it('follows the customer\'s reminder cadence, not just the days overdue', async () => {
    const dueDate = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c-later', name: 'Familie Later', email: 'later@example.nl' },
      { id: 'c-now', name: 'Familie Nu', email: 'nu@example.nl' },
    ]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-L-1', customerId: 'c-later', customer: 'Familie Later', job: 'Onderhoud', amount: 121, status: 'sent', sentAt: '2026-09-01T09:00:00Z', dueDate, dueInDays: -5 },
      { id: 'RE-L-2', customerId: 'c-now', customer: 'Familie Nu', job: 'Onderhoud', amount: 121, status: 'sent', sentAt: '2026-09-01T09:00:00Z', dueDate, dueInDays: -5 },
    ]));
    // This customer gets reminders a week later: at 5 days overdue, none yet.
    await AsyncStorage.setItem('@vasco_reminder_cadence_override', JSON.stringify({ 'c-later': { customerId: 'c-later', delayDays: 7 } }));

    const later = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-L-1' } });
    await settle();
    expect(labelOf((later.tree as any).root)).toBe('Factuur opnieuw versturen');
    // A plain resend is not a reminder: no reminder gate ("Send reminder to VIP?").
    const btn = (later.tree as any).root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => c.props?.children === 'Factuur opnieuw versturen', { deep: true }).length > 0,
      { deep: true },
    ).pop();
    await act(async () => { await btn.props.onPress(); });
    await settle();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].bodyOverride).toBeUndefined();
    expect(mockGate).not.toHaveBeenCalled();
    teardown(later);

    const now = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-L-2' } });
    await settle();
    expect(labelOf((now.tree as any).root)).toBe('Herinnering versturen');
    teardown(now);
  });
});
