/**
 * An invoice the contractor sends THEMSELVES — PDF over WhatsApp, mail, print
 * — must be recordable as sent. With "Mark as sent" gone (it marked without an
 * artefact), nothing could: such an invoice stayed a draft, never outstanding,
 * never overdue (review, 2026-09-30). Sharing the PDF of a draft now asks.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const mockAsk = jest.fn(async () => true);
jest.mock('../src/utils/shareOutcome', () => ({
  ...jest.requireActual('../src/utils/shareOutcome'),
  askWasSent: () => mockAsk(),
}));
jest.mock('../src/services/invoicePdfService', () => ({
  ...jest.requireActual('../src/services/invoicePdfService'),
  generateInvoicePdf: jest.fn(async () => {}),
}));
jest.mock('../src/utils/businessProfileValidation', () => ({
  ...jest.requireActual('../src/utils/businessProfileValidation'),
  checkInvoiceReadiness: () => ({ ready: true, missingLabels: [], invalidLabels: [] }),
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => {
  for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
};
const PDF = /^(PDF bekijken & delen|View & share PDF|PDF bekijken en delen)$/i;
const pressPdf = async (root: any) => {
  const all = root.findAll(
    (n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && PDF.test(c.props.children), { deep: true }).length > 0,
    { deep: true },
  );
  const outer = all.filter((n: any) => !all.some((o: any) => o !== n && o.findAll((c: any) => c === n, { deep: true }).length > 0));
  expect(outer).toHaveLength(1);
  await act(async () => { await outer[0].props.onPress(); });
  await settle();
};
const stored = async (id: string) =>
  JSON.parse((await AsyncStorage.getItem('@vasco_invoices')) ?? '[]').find((i: any) => i.id === id);

run('sharing a draft invoice PDF', () => {
  beforeEach(async () => { await AsyncStorage.clear(); mockAsk.mockClear(); });

  it('asks, and records sent only on yes', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-P-1', customer: 'Familie Ohnemail', job: 'Wartung', amount: 121, status: 'draft', dueInDays: 14 },
    ]));

    mockAsk.mockResolvedValueOnce(false);
    const notYet = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-P-1' } });
    expect(notYet.error).toBeNull();
    await pressPdf((notYet.tree as any).root);
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect((await stored('RE-P-1')).status).toBe('draft');
    teardown(notYet);

    const yes = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-P-1' } });
    await pressPdf((yes.tree as any).root);
    expect(mockAsk).toHaveBeenCalledTimes(2);
    const saved = await stored('RE-P-1');
    expect(saved.status).toBe('sent');
    expect(saved.sentAt).toBeTruthy();
    teardown(yes);
  });
});
