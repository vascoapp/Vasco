/**
 * The new-project sheet's pickers say they are EMPTY: "Klant" and "Begin met
 * een werkvolgorde" were white — read as chosen values — while every empty
 * field is in the placeholder colour (CLAUDE.md; aannemer walk 2026-10-03).
 * Once something is chosen it is white again.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { SemanticColors } from '../src/theme/colors';
import nl from '../src/i18n/locales/nl.json';

const Screen = () => require('../app/contractor/projects').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const PICK_CUSTOMER = (nl as any).contractor.projects.pickCustomer as string;
const PICK_TEMPLATE = (nl as any).projectTemplate.pick as string;

run('new project pickers', () => {
  it('are in the placeholder colour while empty, white once chosen', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c1', name: 'Fam. de Vries' }]));
    const r = await walkScreen(Screen(), { as: 'aannemer', settlePasses: 10 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const add = root.findAll((n: any) => typeof n.props?.onPress === 'function' && n.props.accessibilityLabel === (nl as any).common.add, { deep: true });
    await act(async () => { add[0].props.onPress(); });
    await settle();
    const colorOf = (label: string) => {
      const n = root.findAll((x: any) => x.props?.children === label && x.props?.style, { deep: true })[0];
      return StyleSheet.flatten(n.props.style).color;
    };
    expect(colorOf(PICK_CUSTOMER)).toBe(SemanticColors.placeholder);
    expect(colorOf(PICK_TEMPLATE)).toBe(SemanticColors.placeholder);

    const menu = root.findAll((n: any) => Array.isArray(n.props?.items) && n.props.items.some((i: any) => i.key === 'c1'), { deep: true })[0];
    await act(async () => { menu.props.items.find((i: any) => i.key === 'c1').onPress(); });
    expect(colorOf('Fam. de Vries')).toBe(SemanticColors.textPrimary);
    teardown(r);
  });
});
