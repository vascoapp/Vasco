/**
 * A Facturae refused for a BUSINESS buyer names the recipient, not FACe —
 * FACe only receives what is sent to a public body (review 2026-10-01). A
 * public-body buyer's refusal does name FACe.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import nl from '../src/i18n/locales/nl.json';
import { ES_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const mockFindings: { current: any[] } = { current: [] };
const mockShare = jest.fn(async (..._a: any[]) => undefined);

jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...a: any[]) => mockShare(...a) }));
jest.mock('../src/services/complianceGatingService', () => ({
  ...jest.requireActual('../src/services/complianceGatingService'),
  canUseEInvoiceFormat: () => ({ allowed: true }),
}));
jest.mock('../src/integrations/einvoiceMapping', () => ({
  ...jest.requireActual('../src/integrations/einvoiceMapping'),
  toFacturae: () => ({ ok: true, document: {} }),
}));
jest.mock('../src/integrations/einvoice-es', () => ({
  ...jest.requireActual('../src/integrations/einvoice-es'),
  generateFacturaeXml: () => '<Facturae/>',
}));
jest.mock('../src/integrations/einvoiceValueRules', () => ({
  ...jest.requireActual('../src/integrations/einvoiceValueRules'),
  checkFacturae: () => mockFindings.current,
  blockingFindingLines: () => ['x'],
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const LABEL = (nl as any).invoices.exportFacturae as string;
const BODY = (nl as any).einvoiceRules.body as string;
const RECIPIENT = (nl as any).einvoiceRules.recipient as string;
const TITLE = (nl as any).einvoiceRules.title as string;

const press = async (root: any) => {
  const all = root.findAll((n: any) => typeof n.props?.onPress === 'function'
    && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === LABEL, { deep: true }).length > 0, { deep: true });
  expect(all.length).toBeGreaterThan(0);
  await act(async () => { await all[all.length - 1].props.onPress(); });
  await settle();
};

run('Facturae refusal names who would reject it', () => {
  it('the recipient for a business buyer, FACe for a public body', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...ES_BUSINESS_PROFILE, country: 'ES', language: 'nl' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{ id: 'c-es', name: 'Obras Ruiz S.L.', email: 'r@example.es' }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'FA-1', customerId: 'c-es', customer: 'Obras Ruiz S.L.', job: 'Fontanería', amount: 121, status: 'sent', dueInDays: 30 },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rnShare = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'sharedAction' } as any));
    const bodyOf = () => String(alert.mock.calls.find((c) => c[0] === TITLE)?.[1] ?? '');

    mockFindings.current = [{ code: 'HAP1650-II.5b', severity: 'error', key: 'nifInvalid', params: {}, where: 'customer', message: 'x' }];
    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'FA-1' } });
    expect(r.error).toBeNull();
    await press((r.tree as any).root);
    expect(bodyOf().startsWith(BODY.replace('{{authority}}', RECIPIENT))).toBe(true);

    mockFindings.current = [{ code: 'HAP1650-II.2/II.8', severity: 'error', key: 'publicBuyerES', params: {}, where: 'customer', message: 'x' }];
    alert.mockClear();
    await press((r.tree as any).root);
    expect(bodyOf().startsWith(BODY.replace('{{authority}}', 'FACe'))).toBe(true);
    expect(mockShare).not.toHaveBeenCalled();
    expect(rnShare).not.toHaveBeenCalled();
    alert.mockRestore();
    rnShare.mockRestore();
    teardown(r);
  });
});
