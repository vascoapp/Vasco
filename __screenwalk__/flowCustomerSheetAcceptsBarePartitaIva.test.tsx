/**
 * An Italian contractor types their customer's partita IVA the way Italy
 * writes it — 11 digits, no "IT". The one customer form refused it ("Formato
 * N° IVA non valido", device 2026-10-03), so a reverse-charge (N6.3) invoice,
 * which needs the buyer's partita IVA, could not be exported at all. A bare
 * id with the right check digit is now saved as "IT" + 11 digits (the form the
 * FatturaPA mapper, the PDF and Peppol read); a wrong check digit is refused,
 * and so is a condominio's 11-digit codice fiscale (8/9 first), with its reason.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import it_ from '../src/i18n/locales/it.json';
import { IT_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const CustomersModal = () => require('../app/(modals)/customers').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };

run('a bare Italian partita IVA in the customer form', () => {
  it('refuses a wrong check digit, saves a right one with its IT prefix', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...IT_BUSINESS_PROFILE, country: 'IT', language: 'it' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c1', name: 'Edilizia Greco Srl', vatId: 'IT12345678903', city: 'Milano' },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(CustomersModal(), { settlePasses: 14, params: { id: 'c1' }, as: 'idraulico' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const inputs = () => root.findAll((n: any) => typeof n.props?.onChangeText === 'function', { deep: true });
    const save = () => {
      const s = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && /salva/i.test(c.props.children), { deep: true }).length > 0, { deep: true });
      return s[s.length - 1];
    };
    const vatInput = () => inputs().find((n: any) => /^(IT)?\d{11}$/.test(n.props.value ?? ''));
    const vatInvalid = (it_ as any).profile.vatFormatInvalid as string;

    // Wrong check digit (…896 instead of …897): refused, nothing written.
    await act(async () => { vatInput().props.onChangeText('01234567896'); });
    await act(async () => { await save().props.onPress(); });
    await settle();
    expect(alert.mock.calls.map((c) => String(c[1]))).toEqual([expect.stringContaining(vatInvalid.split('{{')[0].trim().slice(0, 20))]);
    let stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored[0].vatId).toBe('IT12345678903');

    // A condominio's codice fiscale (11 digits, 9 first, same check digit) is
    // not a partita IVA: refused with its own reason, nothing written.
    alert.mockClear();
    await act(async () => { vatInput().props.onChangeText('93012345679'); });
    await act(async () => { await save().props.onPress(); });
    await settle();
    expect(alert.mock.calls.map((c) => String(c[1]))).toEqual([(it_ as any).customersModal.vatIsCodiceFiscale]);
    stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored[0].vatId).toBe('IT12345678903');

    // The real one, as Italy writes it.
    alert.mockClear();
    await act(async () => { vatInput().props.onChangeText('01234567897'); });
    await act(async () => { await save().props.onPress(); });
    await settle();
    expect(alert).not.toHaveBeenCalled();
    stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 'c1', vatId: 'IT01234567897' });
    alert.mockRestore();
    teardown(r);
  });
});
