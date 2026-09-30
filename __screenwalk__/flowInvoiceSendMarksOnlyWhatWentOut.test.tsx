/**
 * A draft becomes SENT only when the email reached the customer. It used to be
 * marked sent before the email was attempted — with no address at all, or when
 * delivery failed ("Marked as sent locally, but…"), the invoice said sent and
 * the dunning clock ran on a document nobody had (emulator walk, 2026-09-30;
 * CLAUDE.md: a status write needs the artefact).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const mockSend = jest.fn(async (_input: any): Promise<any> => ({ ok: true }));
jest.mock('../src/services/sendInvoiceService', () => ({ sendInvoice: (i: any) => mockSend(i) }));
jest.mock('../src/utils/businessProfileValidation', () => ({
  ...jest.requireActual('../src/utils/businessProfileValidation'),
  checkInvoiceReadiness: () => ({ ready: true, missingLabels: [], invalidLabels: [] }),
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

const settle = async () => {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
};
const SEND = /^(Factuur versturen|Send invoice)$/i;
const pressSend = async (root: any) => {
  const all = root.findAll(
    (n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && SEND.test(c.props.children), { deep: true }).length > 0,
    { deep: true },
  );
  const outer = all.filter((n: any) => !all.some((o: any) => o !== n && o.findAll((c: any) => c === n, { deep: true }).length > 0));
  expect(outer).toHaveLength(1);
  await act(async () => { await outer[0].props.onPress(); });
  await settle();
};
const stored = async (id: string) =>
  JSON.parse((await AsyncStorage.getItem('@vasco_invoices')) ?? '[]').find((i: any) => i.id === id);

run('sending a draft invoice', () => {
  beforeEach(async () => { await AsyncStorage.clear(); mockSend.mockClear(); });

  it('stays a draft when nothing went out, becomes sent when it did', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c-mail', name: 'Familie Schneider', email: 'schneider@example.de' },
      { id: 'c-nomail', name: 'Familie Ohnemail' },
    ]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      // Created weeks ago: its due date is already 30 days past.
      { id: 'RE-D-1', customerId: 'c-mail', customer: 'Familie Schneider', job: 'Wartung', amount: 121, status: 'draft', dueInDays: 14,
        dueDate: new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10) },
      { id: 'RE-D-2', customerId: 'c-nomail', customer: 'Familie Ohnemail', job: 'Wartung', amount: 121, status: 'draft', dueInDays: 14 },
      { id: 'RE-D-3', customerId: 'c-mail', customer: 'Familie Schneider', job: 'Wartung', amount: 121, status: 'draft', dueInDays: 14 },
    ]));

    // No address: nothing sent, nothing marked.
    const noMail = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-D-2' } });
    expect(noMail.error).toBeNull();
    await pressSend((noMail.tree as any).root);
    expect(mockSend).not.toHaveBeenCalled();
    expect((await stored('RE-D-2')).status).toBe('draft');
    teardown(noMail);

    // Delivery failed: still a draft.
    mockSend.mockResolvedValueOnce({ ok: false, error: 'Email send failed' });
    const failed = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-D-1' } });
    await pressSend((failed.tree as any).root);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect((await stored('RE-D-1')).status).toBe('draft');
    teardown(failed);

    // Delivered: sent.
    const ok = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-D-1' } });
    await pressSend((ok.tree as any).root);
    expect(mockSend).toHaveBeenCalledTimes(2);
    // Its FIRST send is the invoice, not a dunning letter with late fees.
    expect(mockSend.mock.calls[1][0].bodyOverride).toBeUndefined();
    expect(mockSend.mock.calls[1][0].subject).toBeUndefined();
    expect((await stored('RE-D-1')).status).toBe('sent');
    // The customer HAS it: no queued "invoice sent" message to send it again.
    await settle();
    const queue = JSON.parse((await AsyncStorage.getItem('@vasco_ai_queue')) ?? '[]');
    expect(queue.filter((q: any) => q.entityKey === 'invoice_sent:RE-D-1')).toEqual([]);
    teardown(ok);

    // Two taps while the PDF builds: ONE email.
    const twice = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-D-3' } });
    const root = (twice.tree as any).root;
    const all = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && SEND.test(c.props.children), { deep: true }).length > 0,
      { deep: true },
    );
    const btn = all.filter((n: any) => !all.some((o: any) => o !== n && o.findAll((c: any) => c === n, { deep: true }).length > 0))[0];
    await act(async () => { await Promise.all([btn.props.onPress(), btn.props.onPress()]); });
    await settle();
    expect(mockSend).toHaveBeenCalledTimes(3);
    teardown(twice);
  });
});
