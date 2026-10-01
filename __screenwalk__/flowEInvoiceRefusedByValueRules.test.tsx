/**
 * A FatturaPA that SDI would reject is never handed over (value rules,
 * src/integrations/einvoiceValueRules.ts — 2026-10-01). The guard that came
 * with the rules only read the screen's source for the call ORDER; a gate that
 * refused nothing passed it (decoy, 2026-10-01). This presses the button.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';
import { IT_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const mockFindings: { current: any[] } = { current: [] };
const mockShare = jest.fn(async (..._a: any[]) => undefined);

jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...a: any[]) => mockShare(...a) }));
jest.mock('../src/services/complianceGatingService', () => ({
  ...jest.requireActual('../src/services/complianceGatingService'),
  canUseEInvoiceFormat: () => ({ allowed: true }),
}));
jest.mock('../src/integrations/einvoiceMapping', () => ({
  ...jest.requireActual('../src/integrations/einvoiceMapping'),
  toFatturaPA: () => ({ ok: true, document: {} }),
}));
jest.mock('../src/integrations/einvoice-it', () => ({
  ...jest.requireActual('../src/integrations/einvoice-it'),
  generateFatturaPAXml: () => '<FatturaElettronica/>',
  fatturaTransmitterId: () => '01234567890',
}));
jest.mock('../src/integrations/einvoiceValueRules', () => ({
  ...jest.requireActual('../src/integrations/einvoiceValueRules'),
  checkFatturaPA: () => mockFindings.current,
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const LABEL = (nl as any).invoices.exportFatturaPA as string;
const TITLE = (nl as any).einvoiceRules.title as string;

const press = async (root: any) => {
  const all = root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === LABEL, { deep: true }).length > 0, { deep: true });
  expect(all.length).toBeGreaterThan(0);
  await act(async () => { await all[all.length - 1].props.onPress(); });
  await settle();
};

run('FatturaPA export behind the SDI value rules', () => {
  it('refuses a file SDI would reject, asks about a warning, shares one it would accept', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...IT_BUSINESS_PROFILE, country: 'IT', language: 'nl' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-it', name: 'Rossi Srl', email: 'r@example.it' }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'FT-1', customerId: 'c-it', customer: 'Rossi Srl', job: 'Impianto', amount: 122, status: 'sent', dueInDays: 30 },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // The file write can fail under jest and fall back to the text share:
    // either path handing the XML over counts.
    const rnShare = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'sharedAction' } as any));
    const shared = () => mockShare.mock.calls.length + rnShare.mock.calls.length;

    mockFindings.current = [{ code: '00305', severity: 'error', key: 'einvoiceRules.vatIdInvalid', params: {}, where: 'customer', message: 'x' }];
    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'FT-1' } });
    expect(r.error).toBeNull();
    await press((r.tree as any).root);
    expect(shared()).toBe(0);
    expect(alert.mock.calls.some((c) => c[0] === TITLE)).toBe(true);

    // A warning the contractor can act on is SHOWN first (user decision
    // 2026-10-01): Cancel shares nothing, "Export anyway" shares.
    const er = (nl as any).einvoiceRules;
    const answer = async (label: string) => {
      const pressing = press((r.tree as any).root);
      await settle();
      const call = alert.mock.calls.find((c) => c[0] === er.warningTitle);
      expect(call).toBeDefined();
      const buttons = call![2] as Array<{ text: string; onPress?: () => void }>;
      expect(buttons.length).toBeLessThanOrEqual(3);
      await act(async () => { buttons.find((b) => b.text === label)!.onPress!(); });
      await pressing;
      alert.mockClear();
    };
    mockFindings.current = [{ code: 'CF-SELLER', severity: 'warning', key: 'sellerCodiceFiscale', params: {}, where: 'profile', message: 'x' }];
    alert.mockClear();
    await answer((nl as any).common.cancel);
    expect(shared()).toBe(0);
    await answer(er.exportAnyway);
    expect(shared()).toBe(1);

    // What only Vasco can fix is not put to the contractor: straight through.
    mockFindings.current = [{ code: '00422', severity: 'warning', key: 'internal', params: {}, where: 'vasco', message: 'x' }];
    await press((r.tree as any).root);
    expect(shared()).toBe(2);
    expect(alert.mock.calls.some((c) => c[0] === TITLE || c[0] === er.warningTitle)).toBe(false);
    alert.mockRestore();
    rnShare.mockRestore();
    teardown(r);
  });
});
