/**
 * Sharing a quote PDF asks before it marks the quote sent.
 *
 * expo-sharing resolves the same whether the PDF went out or the contractor
 * backed out of the sheet, and the PDF path marked every share "sent" — a
 * quote the customer never had, with the follow-up clock running (emulator
 * walk 2026-09-28; the link path already checked wasShareDismissed, #339).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

jest.mock('../src/services/quotePdfService', () => ({
  ...jest.requireActual('../src/services/quotePdfService'),
  generateQuotePdf: jest.fn(async () => undefined),
}));

const QuoteScreen = () => require('../app/quotes/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const stored = async () => JSON.parse((await AsyncStorage.getItem('@vasco_quotes')) ?? '[]')[0].status;

run('quote PDF share', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('keeps a draft a draft until the contractor says it went out', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_quotes', JSON.stringify([
      { id: 'Q-P-1', customer: 'c1', job: 'Lekkage', amount: 500, status: 'draft', lastUpdated: 'today' },
    ]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Bakkerij Smit' }]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const r = await walkScreen(QuoteScreen(), { settlePasses: 14, params: { id: 'Q-P-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const pdf = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && /^PDF$/i.test(c.props.children), { deep: true }).length > 0, { deep: true });
    expect(pdf.length).toBeGreaterThan(0);

    await act(async () => { await pdf[pdf.length - 1].props.onPress(); });
    await settle();
    expect(await stored()).toBe('draft'); // the sheet closing is not a send

    const q = (nl as any).quotes;
    const ask = alert.mock.calls.find((c) => c[0] === q.pdfSentTitle);
    expect(ask).toBeDefined();
    const buttons = ask![2] as Array<{ text: string; onPress?: () => void }>;
    expect(buttons.map((b) => b.text)).toEqual([q.pdfSentNo, q.pdfSentYes]);

    await act(async () => { buttons.find((b) => b.text === q.pdfSentYes)!.onPress!(); });
    await settle();
    expect(await stored()).toBe('sent');
    alert.mockRestore();
    teardown(r);
  });
});
