/**
 * Editing a draft invoice's lines keeps what was typed, and SAVES the lines.
 *
 * Three defects on one card (German device walk, 2026-09-15):
 *   - the price field was `value={String(unitPrice)}` re-parsed per keystroke,
 *     so "85," snapped back to "85" — no line could carry cents;
 *   - Save wrote only the new total; the lines were never stored, so the
 *     invoice reopened with its old lines under its new amount;
 *   - the pencil was offered on sent (and paid) invoices.
 *
 * ONE test per file — the harness keeps a module-scoped AppState (see
 * flowTemplateApply.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const InvoiceScreen = () => require('../app/invoices/[id]').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

const settle = async () => {
  for (let i = 0; i < 8; i++) {
    await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
  }
};

run('invoice line editing', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('types a decimal comma, stores the lines, and is offered on drafts only', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'RE-T-1', customer: 'Bäckerei Lindner', job: 'Wartung', amount: 121, status: 'draft', dueInDays: 14 },
      { id: 'RE-T-2', customer: 'Bäckerei Lindner', job: 'Wartung', amount: 121, status: 'sent', dueInDays: 14 },
    ]));
    await AsyncStorage.setItem('@vasco_line_items', JSON.stringify({
      'RE-T-1': [{ id: 'l1', description: 'Wartung', quantity: 1, unitPrice: 100 }],
      'RE-T-2': [{ id: 'l2', description: 'Wartung', quantity: 1, unitPrice: 100 }],
    }));

    // Pressables whose icon is a pencil; outermost match only (a Pressable and
    // the element it renders can both carry onPress).
    const editButtons = (root: any) => {
      const all = root.findAll(
        (n: any) => typeof n.props?.onPress === 'function'
          && n.findAll((c: any) => c.props?.name === 'pencil', { deep: true }).length > 0,
        { deep: true },
      );
      return all.filter((n: any) => !all.some((o: any) => o !== n && o.findAll((c: any) => c === n, { deep: true }).length > 0));
    };

    // --- the SENT invoice first: how many pencils without the lines one?
    const sent = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-T-2' } });
    expect(sent.error).toBeNull();
    const sentPencils = editButtons((sent.tree as any).root).length;
    teardown(sent);

    // --- the DRAFT invoice
    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'RE-T-1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const draftPencils = editButtons(root);
    expect(draftPencils.length).toBe(sentPencils + 1); // the lines pencil is draft-only

    const decimalInputs = () => root.findAll((n: any) => typeof n.props?.onChangeValue === 'function', { deep: true });
    // Open the lines editor: whichever pencil makes number fields appear.
    let lineSave: any = null;
    for (const p of draftPencils) {
      await act(async () => { await p.props.onPress(); });
      if (decimalInputs().length > 0) { lineSave = p; break; }
    }
    expect(lineSave).not.toBeNull();

    const priceField = decimalInputs().find((n: any) => n.props.value === 100);
    expect(priceField).toBeDefined();
    const text = () => priceField.findAll((n: any) => typeof n.props?.onChangeText === 'function', { deep: true })[0];

    await act(async () => { text().props.onFocus?.({}); });
    await act(async () => { text().props.onChangeText('85,'); });
    expect(text().props.value).toBe('85,'); // the separator survives the keystroke
    await act(async () => { text().props.onChangeText('85,5'); });
    expect(text().props.value).toBe('85,5');

    // Save through the same button (now a tick).
    const saveBtn = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function' && n.findAll((c: any) => c.props?.name === 'checkmark', { deep: true }).length > 0,
      { deep: true },
    );
    expect(saveBtn.length).toBeGreaterThan(0);
    await act(async () => { await saveBtn[saveBtn.length - 1].props.onPress(); });
    await settle();

    const lines = JSON.parse((await AsyncStorage.getItem('@vasco_line_items')) ?? '{}');
    expect(lines['RE-T-1']).toHaveLength(1);
    expect(lines['RE-T-1'][0].unitPrice).toBe(85.5);   // the LINE is stored, with its cents
    expect(lines['RE-T-2'][0].unitPrice).toBe(100);    // and only on that invoice

    const invoices = JSON.parse((await AsyncStorage.getItem('@vasco_invoices')) ?? '[]');
    const saved = invoices.find((i: any) => i.id === 'RE-T-1');
    const grossFactor = saved.amount / 85.5;
    expect(grossFactor).toBeGreaterThanOrEqual(1);     // total follows the lines
    expect(grossFactor).toBeLessThanOrEqual(1.25);
    teardown(r);
  });
});
