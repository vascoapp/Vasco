/**
 * An existing customer can be edited, and the edit is saved — not added.
 *
 * `updateCustomer` had zero callers: no screen could change a customer after
 * creation. On a Spanish device the Facturae export refused with "Provincia,
 * NIF/CIF, Dirección, Ciudad, Código postal" missing for the customer, and there
 * was nowhere in the app to enter them. `(modals)/customers?id=` is now that
 * place. This proves the wiring: prefilled from the stored customer, Save
 * UPDATES that row (a second row would be a silent duplicate), blanks included.
 *
 * ONE test per file — the harness keeps a module-scoped AppState (see
 * flowTemplateApply.test.tsx).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';

const CustomersModal = () => require('../app/(modals)/customers').default;

const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;

run('customer edit flow', () => {
  beforeEach(async () => { await AsyncStorage.clear(); });

  it('opens on the stored customer and saves the change onto the same row', async () => {
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([
      // A stored phone today's validator would reject: editing the post code
      // must not be blocked by an old field nobody touched (review #366).
      { id: 'c1', name: 'Bakkerij Smit', email: 'info@bakkerijsmit.nl', phone: '020 (kantoor)', city: 'Utrecht' },
    ]));

    const r = await walkScreen(CustomersModal(), { settlePasses: 14, params: { id: 'c1' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const inputs = () => root.findAll((n: any) => typeof n.props?.onChangeText === 'function', { deep: true });

    // Prefilled from the stored row, not an empty "new customer" form.
    const values = inputs().map((n: any) => n.props.value);
    expect(values).toContain('Bakkerij Smit');
    expect(values).toContain('Utrecht');
    expect(r.texts.join(' | ')).not.toMatch(/Nieuwe klant/);

    // Give it a post code, clear the city, save.
    const byValue = (v: string) => inputs().find((n: any) => n.props.value === v);
    const postcodeInput = inputs().find((n: any) => n.props.placeholder === '1012 AB');
    expect(postcodeInput).toBeDefined();
    await act(async () => { postcodeInput.props.onChangeText('3511 AB'); });
    await act(async () => { byValue('Utrecht').props.onChangeText(''); });

    // The form is the shared AddCustomerSheet since #365: its save button is a
    // Pressable around the (uppercased) label text, not PrimaryButton's `label`.
    const save = root.findAll(
      (n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && /opslaan/i.test(c.props.children), { deep: true }).length > 0,
      { deep: true },
    );
    expect(save.length).toBeGreaterThan(0);
    // Innermost match: the sheet's backdrop Pressable also CONTAINS the label,
    // and pressing it closes the sheet instead of saving.
    await act(async () => { await save[save.length - 1].props.onPress(); });
    for (let i = 0; i < 6; i++) {
      await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
    }

    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_customers')) ?? '[]');
    expect(stored).toHaveLength(1);                 // updated, not duplicated
    expect(stored[0].id).toBe('c1');
    expect(stored[0].postcode).toBe('3511 AB');
    expect(stored[0].city).toBe('');                // clearing a field clears it
    expect(stored[0].name).toBe('Bakkerij Smit');
    teardown(r);
  });
});
