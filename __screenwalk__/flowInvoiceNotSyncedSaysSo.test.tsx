/**
 * An invoice created offline cannot be emailed until its insert reaches the
 * server — send-invoice would answer 404 and the contractor read "please try
 * again later", with no reason and no way to act on it (review, 2026-09-30).
 * The send now says it is not synced yet, and sends nothing.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const mockSend = jest.fn(async (_input: any) => ({ ok: true }));
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

run('sending an invoice that is still queued', () => {
  it('says it is not synced yet and sends nothing', async () => {
    const alerts = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-mail', name: 'Familie Schneider', email: 'schneider@example.de' }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'OF-2026-0007', customerId: 'c-mail', customer: 'Familie Schneider', job: 'Wartung', amount: 121, status: 'draft', dueInDays: 14 },
    ]));
    await AsyncStorage.setItem('@vasco_offline_writes', JSON.stringify([
      { id: 'w1', table: 'documents', op: 'insert', payload: { document_number: 'OF-2026-0007' }, createdAt: Date.now(), attempts: 0 },
    ]));

    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'OF-2026-0007' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const all = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && SEND.test(c.props.children), { deep: true }).length > 0,
      { deep: true },
    );
    const btn = all.filter((n: any) => !all.some((o: any) => o !== n && o.findAll((c: any) => c === n, { deep: true }).length > 0))[0];
    await act(async () => { await btn.props.onPress(); });
    await settle();

    expect(mockSend).not.toHaveBeenCalled();
    expect(alerts.mock.calls.map((c) => c[0])).toContain('Nog niet gesynchroniseerd');
    const saved = JSON.parse((await AsyncStorage.getItem('@vasco_invoices')) ?? '[]').find((i: any) => i.id === 'OF-2026-0007');
    expect(saved.status).toBe('draft');
    teardown(r);
    alerts.mockRestore();
  });
});
