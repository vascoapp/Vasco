/**
 * A Spanish contractor types their customer's NIF the way Spain writes it —
 * without "ES". The one customer form refused a public body's "P2807900B"
 * (only "ESP2807900B" passed): the VAT check knew EU VAT ids only. A bare
 * NIF/CIF now passes when its control character is right (checkSpanishTaxId,
 * the same check the Facturae export uses) — and a wrong one is still refused.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, TextInput } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import es from '../src/i18n/locales/es.json';
import { ES_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const CustomersModal = () => require('../app/(modals)/customers').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };

run('a bare Spanish NIF in the customer form', () => {
  it('refuses a wrong control character, saves a right one as typed', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...ES_BUSINESS_PROFILE, country: 'ES', language: 'es' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c1', name: 'Ayuntamiento de Getafe', vatId: 'ESB87654323', city: 'Getafe' },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(CustomersModal(), { settlePasses: 14, params: { id: 'c1' }, as: 'fontanero' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const inputs = () => root.findAll((n: any) => typeof n.props?.onChangeText === 'function', { deep: true });
    const save = () => {
      const s = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && /guardar/i.test(c.props.children), { deep: true }).length > 0, { deep: true });
      return s[s.length - 1];
    };
    const vatInput = () => inputs().find((n: any) => n.props.value === 'ESB87654323' || /^P2807900/.test(n.props.value ?? ''));
    const vatInvalid = (es as any).profile.vatFormatInvalid as string;

    // Wrong control character: refused, nothing written.
    await act(async () => { vatInput().props.onChangeText('P2807900X'); });
    await act(async () => { await save().props.onPress(); });
    await settle();
    expect(alert.mock.calls.map((c) => String(c[1]))).toEqual([expect.stringContaining(vatInvalid.split('{{')[0].trim().slice(0, 20))]);
    let stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored[0].vatId).toBe('ESB87654323');

    // The real NIF of a public body, as Spain writes it. It is a public body,
    // so the DIR3 fields appear — fill them so the save is not refused for them.
    alert.mockClear();
    await act(async () => { vatInput().props.onChangeText('P2807900B'); });
    const all = root.findAllByType(TextInput);
    for (const f of all.slice(-3)) await act(async () => { f.props.onChangeText('L01280796'); });
    await act(async () => { await save().props.onPress(); });
    await settle();
    expect(alert).not.toHaveBeenCalled();
    stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 'c1', vatId: 'P2807900B' });
    alert.mockRestore();
    teardown(r);
  });
});
