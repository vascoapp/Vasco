/**
 * An Italian quote at 0 % for a building subcontract carries its reason —
 * reverse charge, N6.3 — onto every saved line (2026-10-03), so the invoice
 * made from it exports with the right Natura instead of being refused (or,
 * before, filed as N2.2 "non soggette – altri casi").
 *
 * The rate menu of the quote builder is the place: for Italy it lists the
 * rates AND the 0 % reasons the fiscal regime allows. Walked as the Italian
 * posture, through the real builder, the real tiered-quote screen and addQuote.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import { IT_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const Screen = () => require('../app/contractor/tiered-quote').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };

/** Innermost pressables containing a text node that satisfies `test`. */
const pressablesWithText = (root: any, test: (s: string) => boolean) => {
  const all = root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => typeof c.props?.children === 'string' && test(c.props.children), { deep: true }).length > 0, { deep: true });
  return all.filter((n: any) => !all.some((o: any) => o !== n && n.findAll((c: any) => c === o, { deep: true }).length > 0));
};
const texts = (root: any) => root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children as string);

run('quote builder → reverse charge on the lines (Italy)', () => {
  it('picking N6.3 in the rate menu stores it on every line of the saved quote', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...IT_BUSINESS_PROFILE, country: 'IT', language: 'it' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-it', name: 'Edilizia Bruno S.r.l.', vatId: 'IT09876543217', country: 'IT' }]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const r = await walkScreen(Screen(), { as: 'idraulico', settlePasses: 14, params: { customerId: 'c-it' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const itLocale = require('../src/i18n/locales/it.json');

    // 1. Add a service from the pricebook.
    const add = pressablesWithText(root, (s) => s === itLocale.quotes.pricebook);
    expect(add.length).toBeGreaterThan(0);
    await act(async () => { add[0].props.onPress(); });
    await settle();
    const item = pressablesWithText(root, (s) => s === 'Riparazione perdita');
    expect(item.length).toBeGreaterThan(0);
    await act(async () => { item[0].props.onPress(); });
    await settle();

    // 2. To the preview, where the package and the VAT rate are chosen.
    const review = pressablesWithText(root, (s) => s === itLocale.quotes.reviewQuote);
    expect(review.length).toBeGreaterThan(0);
    await act(async () => { review[0].props.onPress(); });
    await settle();

    // 3. The rate menu lists the 0 % reasons for Italy; pick reverse charge.
    const anchor = pressablesWithText(root, (s) => s === itLocale.quotes.vatRateLabel);
    expect(anchor.length).toBeGreaterThan(0);
    await act(async () => { anchor[0].props.onPress(); });
    await settle();
    const label = `N6.3 · ${itLocale.vatNature.N6_3}`;
    const row = pressablesWithText(root, (s) => s === label);
    expect(row.length).toBeGreaterThan(0);
    await act(async () => { row[0].props.onPress(); });
    await settle();
    // The anchor now states the reason, and no tier charges IVA.
    expect(texts(root)).toContain(label);

    // 4. Create the quote (the document-text button).
    const create = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => c.props?.name === 'document-text', { deep: true }).length > 0, { deep: true });
    expect(create.length).toBeGreaterThan(0);
    // The demo posture seeds line items: only the NEW document's are ours.
    const before = new Set(Object.keys(JSON.parse((await AsyncStorage.getItem('@vasco_line_items')) ?? '{}')));
    await act(async () => { await create[create.length - 1].props.onPress(); });
    await settle();
    await settle();

    // 5. Every line of the saved quote carries 0 % and N6.3.
    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_line_items')) ?? '{}');
    const created = Object.keys(stored).filter((k) => !before.has(k));
    expect(created).toHaveLength(1);
    const quoteLines = stored[created[0]] as any[];
    expect(quoteLines.length).toBeGreaterThan(0);
    expect(quoteLines.map((l) => [l.vatRate, l.vatNature])).toEqual(quoteLines.map(() => [0, 'N6.3']));
    alert.mockRestore();
    teardown(r);
  });
});
