/**
 * A work form can be for ONE trade (aannemer walk, 2026-10-03): the screen
 * promised "per vak je eigen lijst" and nothing could set the trade. The
 * point type is a menu now, not a chip row (CLAUDE.md: one of N → DKMenu).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, TextInput } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Screen = () => require('../app/contractor/job-forms').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const JF = (nl as any).jobForms;
const PLUMBING = (nl as any).onboarding.trades.plumbing as string;

run('work form trade', () => {
  it('sets a trade and a point type through menus, and the list shows the trade', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 10 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    // A row's Text can hold an array of pieces ("Loodgieterij", " · ", "1 punt").
    const texts = () => root.findAll((n: any) => typeof n.props?.children === 'string'
      || (Array.isArray(n.props?.children) && n.props.children.every((c: any) => typeof c === 'string' || typeof c === 'number')), { deep: true })
      .map((n: any) => (Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children) as string);
    const pressText = async (label: string) => {
      const b = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === label, { deep: true }).length > 0, { deep: true });
      await act(async () => { b[b.length - 1].props.onPress(); });
      await settle();
    };
    const menu = (label: string) => root.findAll((n: any) => Array.isArray(n.props?.items) && n.props.accessibilityLabel === label, { deep: true })[0];

    await pressText(JF.newForm);
    const nameInput = root.findAllByType(TextInput)[0];
    await act(async () => { nameInput.props.onChangeText('Oplevercheck leidingwerk'); });
    expect(menu(JF.trade)).toBeDefined();
    await act(async () => { menu(JF.trade).props.items.find((i: any) => i.key === 'plumbing').onPress(); });

    await pressText(JF.addField ?? '+');
    const inputs = root.findAllByType(TextInput);
    await act(async () => { inputs[inputs.length - 1].props.onChangeText('Waterdruk'); });
    const typeMenu = menu(JF.fieldType);
    expect(typeMenu).toBeDefined();
    expect(typeMenu.props.items.map((i: any) => i.key)).toEqual(['check', 'number', 'text']);
    await act(async () => { typeMenu.props.items.find((i: any) => i.key === 'number').onPress(); });

    await pressText(JF.save);
    expect(texts().some((s: string) => s.startsWith(PLUMBING))).toBe(true);
    alert.mockRestore();
    teardown(r);
  });
});
