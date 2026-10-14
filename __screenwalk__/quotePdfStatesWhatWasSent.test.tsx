/**
 * The quote PDF a customer receives, through the REAL screen (#389: test with
 * the shape the caller really passes, not the one the signature allows).
 *
 *  - Every quote PDF was English: the screen passed no language, so a German
 *    customer read "Quote / Valid Until / Prepared For" (the invoice PDF had
 *    the same bug until 2026-10-02; the quote path was never fixed).
 *  - Its German/French/Spanish/Italian labels had lost their accents
 *    ("Gultig bis", "Conditions generales", "Valido hasta").
 *  - "Valid until" was TODAY + 30 on every render: a quote sent 20 days ago
 *    showed — and re-shared — 30 more days that its first PDF and its portal
 *    link never promised. Now: sent date + 30, and the PDF is dated the send.
 *
 * Walked in GERMAN so the language and the accents are both visible.
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { formatDate } from '../src/i18n/formatting';
import de from '../src/i18n/locales/de.json';

const printed: string[] = [];
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(async ({ html }: { html: string }) => {
    printed.push(html);
    return { uri: 'file:///tmp/quote.pdf' };
  }),
}));

const QuoteScreen = () => require('../app/quotes/[id]').default;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };

describe('quote PDF', () => {
  beforeEach(async () => { await AsyncStorage.clear(); printed.length = 0; });

  it('is in the contractor\'s language and dated from the send', async () => {
    const sent = new Date(); sent.setDate(sent.getDate() - 20); sent.setHours(12, 0, 0, 0);
    const until = new Date(sent); until.setDate(until.getDate() + 30);
    const naive = new Date(); naive.setDate(naive.getDate() + 30);
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_quotes', JSON.stringify([
      { id: 'Q-V-1', customer: 'c1', job: 'Badsanierung', amount: 1000, status: 'sent', lastUpdated: sent.toISOString(), sentAt: sent.toISOString() },
    ]));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Bäckerei Lindner' }]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const r = await walkScreen(QuoteScreen(), { settlePasses: 14, params: { id: 'Q-V-1' }, as: 'handwerker' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const texts = (): string[] => root.findAll((n: any) => typeof n.type === 'string' && typeof n.props?.children === 'string', { deep: true })
      .map((n: any) => n.props.children);

    // The screen: valid until the SEND + 30, not today + 30.
    const heroLine = (de as any).quotes.heroValidUntil.replace('{{date}}', formatDate(until, 'DE'));
    expect(texts()).toContain(heroLine);
    expect(texts()).not.toContain((de as any).quotes.heroValidUntil.replace('{{date}}', formatDate(naive, 'DE')));

    // The PDF the customer gets.
    const pdf = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && /^PDF$/i.test(c.props.children), { deep: true }).length > 0, { deep: true });
    expect(pdf.length).toBeGreaterThan(0);
    await act(async () => { await pdf[pdf.length - 1].props.onPress(); });
    await settle();
    expect(printed).toHaveLength(1);
    const html = printed[0];
    expect(html).toContain('Gültig bis');
    expect(html).toContain('Erstellt für');
    expect(html).not.toContain('Valid Until');
    expect(html).not.toContain('Prepared For');
    expect(html).toContain(formatDate(until, 'DE'));
    expect(html).toContain(formatDate(sent, 'DE'));
    expect(html).not.toContain(formatDate(naive, 'DE'));

    alert.mockRestore();
    teardown(r);
  });
});
