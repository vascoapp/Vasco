/**
 * A named customer row on the Klanten tab opens THAT customer.
 *
 * Every row in the contacts list, and every "Top customers" row, pushed
 * `/contractor/customer-crm` — the whole contact list again — so on an Italian
 * device tapping "Panificio Bruno S.r.l." showed five customers instead of one.
 * The hero card's "Open customer" went to the decisions list. This proves the
 * contacts row navigates to the customer it names.
 *
 * ONE test per file — the harness keeps a module-scoped AppState (see
 * flowTemplateApply.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const Bedrijf = () => require('../app/(contractor)/bedrijf').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('customer row opens', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('pressing a contact row pushes that customer\'s screen', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      { id: 'c1', name: 'Bakkerij Smit', email: 'info@bakkerijsmit.nl' },
      { id: 'c2', name: 'Familie de Vries', email: 'devries@example.nl' },
    ]));

    const r = await walkScreen(Bedrijf(), { settlePasses: 14 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;

    const contactsTab = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && /^CONTACTEN$/.test(c.props.children), { deep: true }).length > 0,
      { deep: true },
    );
    expect(contactsTab.length).toBeGreaterThan(0);
    await act(async () => { contactsTab[contactsTab.length - 1].props.onPress(); });

    const row = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function' && n.props?.accessibilityLabel === 'Familie de Vries',
      { deep: true },
    );
    expect(row.length).toBeGreaterThan(0);

    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();
    await act(async () => { row[row.length - 1].props.onPress(); });
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(nav.push.mock.calls[0][0]).toBe('/contractor/customer/c2');
    teardown(r);
  });
});
