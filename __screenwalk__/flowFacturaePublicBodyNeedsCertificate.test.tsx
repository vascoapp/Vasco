/**
 * A Facturae to a Spanish PUBLIC BODY (NIF P…, FACe) with no signing
 * certificate stored: pressing "Export Facturae" shares NOTHING and says, in
 * the contractor's language, that a certificate is needed — with a button to
 * the certificate screen. FACe rejects an unsigned file (Orden HAP/1650/2015
 * Anexo II.2); handing one over would be a filing that never happened.
 *
 * Real path: the stored customer (with DIR3 codes) → toFacturae → generator →
 * signFacturaeForExport. Only the certificate store is replaced (empty).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import es from '../src/i18n/locales/es.json';
import { ES_BUSINESS_PROFILE } from '../src/data/mockBusiness';

const mockShare = jest.fn(async (..._a: any[]) => undefined);
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...a: any[]) => mockShare(...a) }));
jest.mock('../src/services/complianceGatingService', () => ({
  ...jest.requireActual('../src/services/complianceGatingService'),
  canUseEInvoiceFormat: () => ({ allowed: true }),
}));
jest.mock('../src/services/signingCertificateStore', () => ({
  loadSigningCertificate: async () => null,
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const LABEL = (es as any).invoices.exportFacturae as string;
const TITLE = (es as any).facturaeSign.certNeededTitle as string;
const OPEN = (es as any).facturaeSign.openCertificate as string;

run('Facturae to a public body without a certificate', () => {
  it('shares nothing and offers the certificate screen', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...ES_BUSINESS_PROFILE, country: 'ES', language: 'es' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{
      id: 'c-ayto', name: 'Ayuntamiento de Madrid', vatId: 'P2807900B', address: 'Calle Montalbán 1', city: 'Madrid', postcode: '28014', province: 'Madrid', country: 'ES',
      dir3OficinaContable: 'L01280796', dir3OrganoGestor: 'L01280796', dir3UnidadTramitadora: 'LA0002878',
    }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'FA-1', customerId: 'c-ayto', customer: 'Ayuntamiento de Madrid', job: 'Mantenimiento', amount: 605, status: 'sent', dueInDays: 30 },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rnShare = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'sharedAction' } as any));
    const nav = (globalThis as any).__navSpies;
    nav.push.mockClear();

    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'FA-1' }, as: 'fontanero' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const buttons = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === LABEL, { deep: true }).length > 0, { deep: true });
    expect(buttons.length).toBeGreaterThan(0);
    await act(async () => { await buttons[buttons.length - 1].props.onPress(); });
    await settle();

    const call = alert.mock.calls.find((c) => c[0] === TITLE);
    expect(call).toBeDefined();
    expect(mockShare).not.toHaveBeenCalled();
    expect(rnShare).not.toHaveBeenCalled();
    // The way out goes to the certificate screen.
    const open = (call![2] as any[]).find((b) => b.text === OPEN);
    expect(open).toBeDefined();
    open.onPress();
    expect(nav.push).toHaveBeenCalledWith('/contractor/facturae-certificate');
    alert.mockRestore();
    rnShare.mockRestore();
    teardown(r);
  });
});
