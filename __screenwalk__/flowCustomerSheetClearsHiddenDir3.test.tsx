/**
 * DIR3 codes are only shown to a Spanish contractor. Saved while hidden, they
 * used to be left in place untouched (not sent); now they are cleared, so a
 * stale code cannot reappear on an invoice later (review 2026-10-02).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { DE_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const CustomersModal = () => require('../app/(modals)/customers').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };

run('DIR3 codes when the form does not show them', () => {
  it('are cleared on save', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...DE_BUSINESS_PROFILE, country: 'DE', language: 'de' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c1', name: 'Ayuntamiento', vatId: 'ESP2807900B', city: 'Madrid', dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878' },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(CustomersModal(), { settlePasses: 14, params: { id: 'c1' }, as: 'handwerker' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const s = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && /speichern/i.test(c.props.children), { deep: true }).length > 0, { deep: true });
    expect(s.length).toBeGreaterThan(0);
    await act(async () => { await s[s.length - 1].props.onPress(); });
    await settle();
    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored[0]).toMatchObject({ id: 'c1', dir3OficinaContable: '', dir3OrganoGestor: '', dir3UnidadTramitadora: '' });
    alert.mockRestore();
    teardown(r);
  });
});
