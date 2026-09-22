/**
 * A quote asks WHO it is for before the builder opens.
 *
 * TestFlight, 2026-09-22, first-time account: Geld → "Nieuwe offerte" opened
 * the builder with no customer and no picker. The contractor filled in the
 * whole quote and was only then told "No customer attached", with Cancel or
 * Create anyway and no way to add one. About fifteen entry points open this
 * screen without a customer, so the question lives on the screen itself.
 *
 * Runs in BOTH postures: `walk` (seeded customers → the picker path) and
 * `walk:fresh` (zero customers → straight to the add-customer sheet).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { Modal } from 'react-native';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';

const TieredQuote = () => require('../app/contractor/tiered-quote').default;

const settle = async () => {
  for (let i = 0; i < 8; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
};
const texts = (root: any) =>
  root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children).join(' | ');
const pressableWithText = (root: any, text: string) =>
  root.findAll(
    (n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => c.props?.children === text, { deep: true }).length > 0,
    { deep: true },
  );

describe('new quote with no customer given', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('asks for the customer first, and a customer added there is the one the builder gets', async () => {
    const r = await walkScreen(TieredQuote(), { settlePasses: 10 });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const T = nl as any;
    const heading = T.tieredQuote.whoIsItFor.toUpperCase();
    const newCustomer = T.dk.actions.newCustomer.toUpperCase();
    const builderMarker = T.quotes.pickFromPricebook as string;

    // 1. The question, not the builder.
    expect(texts(root)).toContain(heading);
    expect(texts(root)).not.toContain(builderMarker);

    // 2. Reach the add-customer sheet. With no customers it is already open;
    //    with customers it is the last item of the picker menu.
    const sheetOpen = () => root.findAll((n: any) => n.type === Modal && n.props.visible === true
      && n.findAll((c: any) => c.props?.children === newCustomer, { deep: true }).length > 0, { deep: true }).length > 0;
    if (!sheetOpen()) {
      const anchor = pressableWithText(root, T.jobs.selectCustomer);
      expect(anchor.length).toBeGreaterThan(0);
      await act(async () => { anchor[anchor.length - 1].props.onPress(); });
      await settle();
      const item = pressableWithText(root, T.dk.actions.newCustomer);
      expect(item.length).toBeGreaterThan(0);
      await act(async () => { item[item.length - 1].props.onPress(); });
      await settle();
    }
    expect(sheetOpen()).toBe(true);

    // 3. Add one.
    const nameField = root.findAll(
      (n: any) => typeof n.props?.onChangeText === 'function' && n.props?.placeholder === T.customers.namePlaceholder,
      { deep: true },
    );
    expect(nameField.length).toBeGreaterThan(0);
    await act(async () => { nameField[0].props.onChangeText('Familie Jansen'); });
    await settle();
    const submit = pressableWithText(root, T.dk.actions.addCustomer.toUpperCase());
    expect(submit.length).toBeGreaterThan(0);
    await act(async () => { await submit[submit.length - 1].props.onPress(); });
    await settle();

    // 4. The builder, scoped to that customer — the question is gone.
    expect(texts(root)).not.toContain(heading);
    expect(texts(root)).toContain(builderMarker);
    const builder = root.findAll((n: any) => n.props?.customer !== undefined && typeof n.props?.onSend === 'function', { deep: true });
    expect(builder.length).toBeGreaterThan(0);
    expect(builder[0].props.customer?.name).toBe('Familie Jansen');
    teardown(r);
  });
});
