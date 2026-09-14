/**
 * A draft or paid invoice row opens the invoice.
 *
 * Every row in the Facturen list only toggled an expansion, and only sent,
 * viewed and overdue rows have one — so tapping a draft or paid row did nothing.
 * On an Italian device the draft "Crea fattura" had just created could not be
 * opened from the list it landed on. This proves the press navigates.
 *
 * ONE test per file — the harness keeps a module-scoped AppState (see
 * flowTemplateApply.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const Facturen = () => require('../app/(contractor)/facturen').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('invoice row opens', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('pressing a row without quick actions pushes the invoice screen', async () => {
    const r = await walkScreen(Facturen(), { settlePasses: 14 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const settle = async () => {
      for (let i = 0; i < 6; i++) {
        await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
      }
    };

    // Switch to the invoices tab.
    const tab = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === 'Facturen', { deep: true }).length > 0,
      { deep: true },
    );
    expect(tab.length).toBeGreaterThan(0);
    await act(async () => { tab[tab.length - 1].props.onPress(); });
    await settle();

    const rows = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && typeof n.props?.accessibilityLabel === 'string'
        && /^Factuur openen voor /.test(n.props.accessibilityLabel)
        && n.props.style !== undefined,
      { deep: true },
    );
    expect(rows.length).toBeGreaterThan(0);

    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();
    await act(async () => { rows[0].props.onPress(); });
    expect(nav.push).toHaveBeenCalledTimes(1);
    expect(String(nav.push.mock.calls[0][0])).toMatch(/^\/invoices\/[^/]+$/);
    teardown(r);
  });
});
