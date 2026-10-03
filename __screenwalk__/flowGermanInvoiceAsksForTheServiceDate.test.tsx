/**
 * A German invoice states the date of the work (§ 14 Abs. 4 Nr. 6 UStG). The
 * PDF printed none (everyday matrix, 2026-10-03), then — briefly — "entspricht
 * dem Rechnungsdatum", which is false for work done earlier (review). Now the
 * screen ASKS before the first document: Cancel makes nothing; "Heute" stores
 * the day on the invoice and the PDF prints it.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import de from '../src/i18n/locales/de.json';
import { DE_BUSINESS_PROFILE } from '../src/data/mockBusiness';
import { localDateKey } from '../src/utils/dateKey';

const mockHtml: string[] = [];
jest.mock('expo-print', () => ({ printToFileAsync: async ({ html }: { html: string }) => { mockHtml.push(html); return { uri: 'file:///x.pdf' }; } }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: async () => undefined }));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const L = (de as any).invoices;

run('German invoice: the date of the work is asked, not assumed', () => {
  it('Cancel makes no PDF; Heute stores the day and the PDF prints it', async () => {
    Object.defineProperty(require('react-native').AppState, 'currentState', { configurable: true, get: () => 'active' });
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...DE_BUSINESS_PROFILE, country: 'DE', language: 'de' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-de', name: 'Müller Bau GmbH', address: 'Friedrichstraße 50', postcode: '10117', city: 'Berlin', email: 'r@m.de' }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-1', customerId: 'c-de', customer: 'Müller Bau GmbH', job: 'Bad', amount: 119, status: 'draft', dueInDays: 14, createdAt: '2026-10-03T08:00:00.000Z' },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(InvoiceScreen(), { as: 'handwerker', settlePasses: 14, params: { id: 'RE-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const pdfButton = () => {
      const all = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => c.props?.children === L.viewSharePdf, { deep: true }).length > 0, { deep: true });
      return all[all.length - 1];
    };
    expect(root.findAll((n: any) => n.props?.testID === 'service-date-value', { deep: true })[0]?.props.children).toBe(L.serviceDateNotSet);

    const ask = () => alert.mock.calls.find((c) => c[0] === L.serviceDateAskTitle);
    // 1. Cancel: no document.
    let pressing = act(async () => { await pdfButton().props.onPress(); });
    await settle();
    expect(ask()).toBeDefined();
    const cancel = (ask()![2] as any[]).find((b) => b.style === 'cancel');
    await act(async () => { cancel.onPress(); });
    await pressing;
    expect(mockHtml).toHaveLength(0);

    // 2. Heute: stored on the invoice, printed on the PDF.
    alert.mockClear();
    pressing = act(async () => { await pdfButton().props.onPress(); });
    await settle();
    const today = (ask()![2] as any[]).find((b) => b.text === L.serviceDateToday);
    await act(async () => { today.onPress(); });
    // After the PDF: "Wurde es gesendet?" — not yet (askWasSent waits ~600 ms).
    const shareTitle = (de as any).share.sentTitle;
    for (let i = 0; i < 40 && !alert.mock.calls.some((c) => c[0] === shareTitle); i++) {
      await act(async () => { await new Promise((res) => setTimeout(res, 50)); });
    }
    const sent = alert.mock.calls.find((c) => c[0] === shareTitle);
    expect(sent).toBeDefined();
    await act(async () => { (sent![2] as any[]).find((b) => b.text === (de as any).share.sentNo).onPress(); });
    await pressing;
    await settle();
    expect(mockHtml.length).toBeGreaterThan(0);
    const html = mockHtml[mockHtml.length - 1];
    expect(html).toContain('Leistungsdatum');
    expect(html).not.toContain('entspricht dem Rechnungsdatum');
    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_invoices')) ?? '[]');
    expect(stored.find((i: any) => i.id === 'RE-1')?.deliveryDate).toBe(localDateKey(new Date()));
    alert.mockRestore();
    teardown(r);
  });
});
