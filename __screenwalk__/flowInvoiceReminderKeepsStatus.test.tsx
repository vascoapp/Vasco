/**
 * The invoice screen's send button EMAILS the customer. On an invoice already
 * out it sends a reminder and must leave the invoice alone; on a paid one it
 * is not offered at all.
 *
 * It was labelled "Mark as sent" and called `markInvoiceSent` before every
 * send: on an overdue invoice that reset sent_at and "due in 14 days" — the
 * overdue clock restarted — and a paid invoice could be flipped back to sent
 * (German emulator walk, 2026-09-30).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const mockSend = jest.fn(async (_input: any) => ({ ok: true }));
jest.mock('../src/services/sendInvoiceService', () => ({ sendInvoice: (i: any) => mockSend(i) }));
jest.mock('../src/services/reminderGate', () => ({ gateReminderSend: jest.fn(async () => true) }));
jest.mock('../src/utils/businessProfileValidation', () => ({
  ...jest.requireActual('../src/utils/businessProfileValidation'),
  checkInvoiceReadiness: () => ({ ready: true, missingLabels: [], invalidLabels: [] }),
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

const settle = async () => {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
};
/** The press handler of the row whose text matches — outermost only. */
const pressable = (root: any, label: RegExp) => {
  const all = root.findAll(
    (n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && label.test(c.props.children), { deep: true }).length > 0,
    { deep: true },
  );
  return all.filter((n: any) => !all.some((o: any) => o !== n && o.findAll((c: any) => c === n, { deep: true }).length > 0));
};
const SEND = /^(Herinnering versturen|Factuur versturen|Send reminder|Send invoice|Markeren als verzonden|Mark as sent)$/i;

run('invoice send button', () => {
  beforeEach(async () => { await AsyncStorage.clear(); mockSend.mockClear(); });

  it('reminds on an invoice already out without touching it, and is absent once paid', async () => {
    const sentAt = '2026-08-17T09:00:00.000Z';
    // 14 days past due, from the real date — the label follows daysUntilDue.
    const dueDate = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c-lindner', name: 'Bäckerei Lindner', email: 'buero@lindner.example' },
    ]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-R-1', customerId: 'c-lindner', customer: 'Bäckerei Lindner', job: 'Wartung', amount: 5200, status: 'sent', sentAt, dueDate, dueInDays: -14 },
      { id: 'RE-R-2', customerId: 'c-lindner', customer: 'Bäckerei Lindner', job: 'Wartung', amount: 121, status: 'paid', sentAt, dueInDays: 0 },
    ]));

    // Paid: nothing to send.
    const paid = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-R-2' } });
    expect(paid.error).toBeNull();
    // The paid invoice RENDERED — a not-found screen has no send button either.
    const paidTexts = (paid.tree as any).root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children as string);
    expect(paidTexts.some((x: string) => /121,00/.test(x))).toBe(true);
    expect(paidTexts.some((x: string) => /^(Betaald|Paid)$/i.test(x))).toBe(true);
    expect(pressable((paid.tree as any).root, SEND)).toHaveLength(0);
    teardown(paid);

    // Out and overdue: a reminder, labelled as one.
    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-R-1' } });
    expect(r.error).toBeNull();
    const buttons = pressable((r.tree as any).root, SEND);
    expect(buttons).toHaveLength(1);
    const label = buttons[0].findAll((c: any) => typeof c.props?.children === 'string' && SEND.test(c.props.children), { deep: true })[0].props.children;
    expect(label).toMatch(/Herinnering|reminder/i);

    await act(async () => { await buttons[0].props.onPress(); });
    await settle();

    // It went out (the positive half: a button that did nothing would also
    // leave the status alone) ...
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].to).toBe('buero@lindner.example');
    // ... and the invoice is exactly as it was.
    const saved = JSON.parse((await AsyncStorage.getItem('@vasco_invoices')) ?? '[]').find((i: any) => i.id === 'RE-R-1');
    expect(saved.status).toBe('sent');
    expect(saved.sentAt).toBe(sentAt);
    expect(saved.dueInDays).toBe(-14);
    teardown(r);
  });
});
