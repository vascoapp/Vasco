/**
 * Re-sharing the PDF of a quote whose validity has passed (review 2026-10-14):
 * it went out "issued 35 days ago, valid until 5 days ago". Now it is re-issued
 * from today and asks whether it went out; a yes re-dates the quote — the same
 * rule as re-sending the link.
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { formatDate } from '../src/i18n/formatting';
import nl from '../src/i18n/locales/nl.json';

const printed: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async ({ html }: { html: string }) => { printed.push(html); return { uri: 'file:///tmp/q.pdf' }; }),
}));

const QuoteScreen = () => require('../app/quotes/[id]').default;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };

describe('quote PDF of a lapsed quote', () => {
  beforeEach(async () => { await AsyncStorage.clear(); printed.length = 0; });

  it('is re-issued from today and re-dated once it went out', async () => {
    const sent = new Date(); sent.setDate(sent.getDate() - 35); sent.setHours(12, 0, 0, 0);
    const oldUntil = new Date(sent); oldUntil.setDate(oldUntil.getDate() + 30);
    const newUntil = new Date(); newUntil.setDate(newUntil.getDate() + 30);
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_quotes', JSON.stringify([
      { id: 'Q-L-1', customer: 'c1', job: 'Dakgoot', amount: 800, status: 'sent', lastUpdated: sent.toISOString(), sentAt: sent.toISOString() },
    ]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Bakkerij Smit' }]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const r = await walkScreen(QuoteScreen(), { settlePasses: 14, params: { id: 'Q-L-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const pdf = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && /^PDF$/i.test(c.props.children), { deep: true }).length > 0, { deep: true });
    expect(pdf.length).toBeGreaterThan(0);
    await act(async () => { await pdf[pdf.length - 1].props.onPress(); });
    await settle();

    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain(formatDate(newUntil, 'NL'));
    expect(printed[0]).not.toContain(formatDate(oldUntil, 'NL'));

    const q = (nl as any).quotes;
    const ask = alert.mock.calls.find((c) => c[0] === q.pdfSentTitle);
    expect(ask).toBeDefined();
    await act(async () => { (ask![2] as any[]).find((b) => b.text === q.pdfSentYes).onPress(); });
    await settle();
    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_quotes')) ?? '[]')[0];
    expect(Math.abs(Date.now() - new Date(stored.sentAt).getTime())).toBeLessThan(60_000);
    alert.mockRestore();
    teardown(r);
  });
});
