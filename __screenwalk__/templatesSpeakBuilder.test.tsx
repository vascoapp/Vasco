/**
 * Message templates show words a builder reads — "[klant]" — never code
 * variables in braces ("{{customer}}"), and still SAVE the tokens that get
 * filled at send time (emulator walk 2026-09-28).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const Templates = () => require('../app/contractor/message-templates').default;
const texts = (root: any): string[] => root.findAll((n: any) => typeof n.type === 'string' && n.props?.children != null, { deep: true })
  .map((n: any) => [].concat(n.props.children).join(''));
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

describe('message templates', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('reads as words, saves as tokens', async () => {
    const r = await walkScreen(Templates(), { settlePasses: 8 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const tk = (nl as any).templates.token;
    expect(texts(root).join(' | ')).not.toMatch(/\{\{|\}\}/);
    expect(texts(root).join(' | ')).toContain(`[${tk.customer}]`);

    // New template: type a title, insert "klant", save.
    const add = root.findAll((n: any) => n.props?.accessibilityLabel === (nl as any).templates.new && typeof n.props?.onPress === 'function')[0];
    await act(async () => { add.props.onPress(); });
    await settle();
    const inputs = root.findAll((n: any) => typeof n.props?.onChangeText === 'function' && n.props?.placeholder != null);
    const title = inputs.find((n: any) => n.props.placeholder === (nl as any).templates.titlePlaceholder);
    await act(async () => { title.props.onChangeText('Test'); });
    const bodyInput = () => root.findAll((n: any) => typeof n.props?.onChangeText === 'function' && n.props?.placeholder === (nl as any).templates.bodyPlaceholder)[0];
    expect(bodyInput().props.placeholder).not.toMatch(/\{\{/);
    await act(async () => { bodyInput().props.onChangeText('Hoi '); });
    const ins = root.findAll((n: any) => n.props?.testID === 'template-insert-customer' && typeof n.props?.onPress === 'function')[0];
    await act(async () => { ins.props.onPress(); });
    expect(bodyInput().props.value).toBe(`Hoi [${tk.customer}]`);

    const save = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === (nl as any).common.save, { deep: true }).length > 0)[0];
    await act(async () => { await save.props.onPress(); });
    await settle();
    const stored = JSON.stringify(await AsyncStorage.getAllKeys().then((ks) => AsyncStorage.multiGet(ks)));
    expect(stored).toContain('Hoi {{customer}}');
    teardown(r);
  });
});
