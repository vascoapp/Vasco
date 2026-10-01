/**
 * The ONE customer form asks a Spanish PUBLIC BODY (NIF P/Q/S) for its three
 * DIR3 codes — and only it: a business customer never sees them. A mistyped
 * code is refused on save (FACe looks the code up, the database refuses the
 * shape, and a refused write would sit in the offline queue for ever); a
 * pasted one is normalized and saved onto the same row.
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
const L = (es as any).customer;
const INVALID = ((es as any).customersModal.dir3Invalid as string).replace('{{example}}', 'L01280796');

run('DIR3 codes in the customer form', () => {
  it('appear for a public-body NIF, refuse a bad code, save a pasted one normalized', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...ES_BUSINESS_PROFILE, country: 'ES', language: 'es' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c1', name: 'Panadería Navarro S.L.', vatId: 'ESB87654323', city: 'Sevilla' },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(CustomersModal(), { settlePasses: 14, params: { id: 'c1' }, as: 'fontanero' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const texts = () => root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children);
    const inputs = () => root.findAll((n: any) => typeof n.props?.onChangeText === 'function', { deep: true });
    // The DIR3 inputs are the sheet's last three TextInputs, in label order
    // (Oficina contable, Órgano gestor, Unidad tramitadora) — asserted below
    // through what each one saves.
    const fieldFor = (label: string) => {
      const order = [L.dir3OficinaContable, L.dir3OrganoGestor, L.dir3UnidadTramitadora];
      const all = root.findAllByType(TextInput);
      return all[all.length - 3 + order.indexOf(label)];
    };

    // A business customer: no DIR3 fields.
    expect(texts()).not.toContain(L.dir3OficinaContable);

    // Turn it into a public body: the three appear.
    const vat = inputs().find((n: any) => n.props.value === 'ESB87654323');
    await act(async () => { vat.props.onChangeText('ESP2807900B'); });
    for (const k of ['dir3OficinaContable', 'dir3OrganoGestor', 'dir3UnidadTramitadora']) expect(texts()).toContain(L[k]);

    await act(async () => { fieldFor(L.dir3OficinaContable).props.onChangeText(' l01 280 796 '); });
    await act(async () => { fieldFor(L.dir3OrganoGestor).props.onChangeText('L01280796'); });
    await act(async () => { fieldFor(L.dir3UnidadTramitadora).props.onChangeText('LA00'); });

    const saveLabel = /guardar/i;
    const save = () => {
      const s = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && saveLabel.test(c.props.children), { deep: true }).length > 0, { deep: true });
      return s[s.length - 1];
    };
    await act(async () => { await save().props.onPress(); });
    await settle();
    expect(alert.mock.calls.map((c) => c[1])).toEqual([INVALID]);
    let stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored[0].dir3UnidadTramitadora).toBeUndefined(); // nothing saved

    await act(async () => { fieldFor(L.dir3UnidadTramitadora).props.onChangeText('LA0002878'); });
    await act(async () => { await save().props.onPress(); });
    await settle();
    stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 'c1', vatId: 'ESP2807900B', dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878' });
    alert.mockRestore();
    teardown(r);
  });
});
