/**
 * An Italian 0 % line says WHY before it reaches SDI (2026-10-03).
 *
 * Until then the FatturaPA wrote N2.2 ("non soggette – altri casi") on every
 * 0 % line. For an ordinary-regime plumber subcontracting to a building firm
 * the line is REVERSE CHARGE (N6.3) — SDI accepted the N2.2, and the invoice
 * stated the wrong legal basis. Now the export refuses a 0 % line without a
 * nature, NAMING the line, offers the line editor, and the nature picked
 * there (a DKMenu per line) is what the file carries.
 *
 * Presses the real buttons through the real mapper, generator and value rules
 * — only the share sheet and the plan gate are stubbed.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';
import { IT_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const mockXml: string[] = [];
const mockShare = jest.fn(async (..._a: any[]) => undefined);

jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...a: any[]) => mockShare(...a) }));
jest.mock('../src/services/complianceGatingService', () => ({
  ...jest.requireActual('../src/services/complianceGatingService'),
  canUseEInvoiceFormat: () => ({ allowed: true }),
}));
// The REAL generator, observed: the file's bytes are what this test is about.
jest.mock('../src/integrations/einvoice-it', () => {
  const actual = jest.requireActual('../src/integrations/einvoice-it');
  return { ...actual, generateFatturaPAXml: (d: any) => { const x = actual.generateFatturaPAXml(d); mockXml.push(x); return x; } };
});

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const N = nl as any;

/** Outermost pressables containing a text node equal to `label`. */
const byText = (root: any, label: string) => {
  const all = root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === label, { deep: true }).length > 0, { deep: true });
  return all.filter((n: any) => !all.some((o: any) => o !== n && o.findAll((c: any) => c === n, { deep: true }).length > 0));
};

run('FatturaPA asks for the VAT nature of a 0 % line', () => {
  it('refuses naming the line, opens the editor, and exports the nature picked there', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...IT_BUSINESS_PROFILE, country: 'IT', language: 'nl' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{
      id: 'c-it', name: 'Edilizia Bruno S.r.l.', email: 'amm@bruno.it', vatId: 'IT09876543217',
      address: 'Corso Italia 5', city: 'Torino', postcode: '10121', province: 'TO', country: 'IT', einvoiceRouting: 'ABCDEF1',
    }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'FT-9', customerId: 'c-it', customer: 'Edilizia Bruno S.r.l.', job: 'Cantiere Via Po', amount: 1046.4, status: 'draft', dueInDays: 30 },
    ]));
    await AsyncStorage.setItem('@vasco_line_items', JSON.stringify({
      'FT-9': [
        { id: 'l1', description: 'Noleggio attrezzatura', quantity: 1, unitPrice: 120, vatRate: 22 },
        { id: 'l2', description: 'Subappalto impianto', quantity: 1, unitPrice: 900, vatRate: 0 },
      ],
    }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rnShare = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'sharedAction' } as any));
    const shared = () => mockShare.mock.calls.length + rnShare.mock.calls.length;

    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'FT-9' } });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const exportBtn = () => { const b = byText(root, N.invoices.exportFatturaPA); expect(b.length).toBeGreaterThan(0); return b[b.length - 1]; };

    // 1. Export: refused — no file built, nothing shared — and the line NAMED.
    await act(async () => { await exportBtn().props.onPress(); });
    await settle();
    expect(mockXml).toHaveLength(0);
    expect(shared()).toBe(0);
    const refusal = alert.mock.calls.find((c) => c[0] === N.invoices.einvoiceMissingTitle);
    expect(refusal).toBeDefined();
    expect(String(refusal![1])).toContain(N.invoices.vatNatureMissing.replace('{{line}}', '2').replace('{{description}}', 'Subappalto impianto'));
    const buttons = refusal![2] as Array<{ text: string; onPress?: () => void }>;
    expect(buttons.length).toBeLessThanOrEqual(3);

    // 2. "Edit lines" opens the line editor, where each line has its IVA menu.
    const editLines = buttons.find((b) => b.text === N.invoices.einvoiceFixLines);
    expect(editLines).toBeDefined();
    await act(async () => { editLines!.onPress!(); });
    await settle();
    const anchors = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(`${N.vatNature.menuLabel}:`), { deep: true });
    expect(anchors.length).toBe(2);
    // The unexplained line shows that it needs a choice.
    expect(anchors[1].props.accessibilityLabel).toContain(N.vatNature.choose);

    // 3. Pick N6.3 for line 2 in its menu.
    await act(async () => { anchors[1].props.onPress(); });
    await settle();
    // The INNERMOST pressable with the label is the menu row; the outermost is
    // the menu's backdrop, whose onPress only closes it.
    const label = `N6.3 · ${N.vatNature.N6_3}`;
    const rows = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === label, { deep: true }).length > 0, { deep: true });
    const row = rows.filter((n: any) => !rows.some((o: any) => o !== n && n.findAll((c: any) => c === o, { deep: true }).length > 0));
    expect(row.length).toBeGreaterThan(0);
    await act(async () => { row[0].props.onPress(); });
    await settle();
    const after = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(`${N.vatNature.menuLabel}:`), { deep: true });
    // The anchor now states the reason.
    expect(after[1].props.accessibilityLabel).toContain(label);

    // 4. Save the lines (the checkmark on the lines card).
    const save = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => c.props?.name === 'checkmark', { deep: true }).length > 0, { deep: true });
    expect(save.length).toBeGreaterThan(0);
    await act(async () => { await save[0].props.onPress(); });
    await settle();
    // Stored, not only on screen: the lines a reopen / the records archive read.
    const stored = JSON.parse((await AsyncStorage.getItem('@vasco_line_items')) ?? '{}')['FT-9'];
    expect(stored.map((l: any) => [l.description, l.vatRate, l.vatNature ?? null])).toEqual([
      ['Noleggio attrezzatura', 22, null],
      ['Subappalto impianto', 0, 'N6.3'],
    ]);

    // 5. Export again: the file carries N6.3 with its legal basis, and is handed over.
    alert.mockClear();
    await act(async () => { await exportBtn().props.onPress(); });
    await settle();
    // A contractor-actionable warning, if any, is answered "Export anyway".
    const warn = alert.mock.calls.find((c) => c[0] === N.einvoiceRules.warningTitle);
    if (warn) {
      const exportAnyway = (warn[2] as Array<{ text: string; onPress?: () => void }>).find((b) => b.text === N.einvoiceRules.exportAnyway);
      await act(async () => { exportAnyway!.onPress!(); });
      await settle();
    }
    expect(alert.mock.calls.filter((c) => c[0] === N.invoices.einvoiceMissingTitle || c[0] === N.einvoiceRules.title).map((c) => String(c[1]))).toEqual([]);
    expect(mockXml).toHaveLength(1);
    expect(mockXml[0]).toMatch(/<AliquotaIVA>0\.00<\/AliquotaIVA>\s*<Natura>N6\.3<\/Natura>/);
    expect(mockXml[0]).toContain('<RiferimentoNormativo>Inversione contabile ex art. 17, c. 6, lett. a), DPR 633/72</RiferimentoNormativo>');
    expect(mockXml[0]).not.toContain('N2.2');
    // Totals unchanged by the nature: 120 + 26,40 + 900.
    expect(mockXml[0]).toContain('<ImportoTotaleDocumento>1046.40</ImportoTotaleDocumento>');
    expect(shared()).toBe(1);

    alert.mockRestore();
    rnShare.mockRestore();
    teardown(r);
  });
});
