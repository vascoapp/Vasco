/**
 * A Facturae to a Spanish PUBLIC BODY with the contractor's certificate
 * stored: pressing "Export Facturae" hands over a file that is SIGNED
 * (XAdES-EPES, Facturae policy v3.1, by this certificate), carries the
 * customer's three DIR3 centres, verifies, and passes the FACe value rules —
 * named .xsig — and only then asks "did you file it?".
 *
 * Real path end to end: stored customer → toFacturae → generator →
 * signFacturaeForExport → checkFacturae → share. Only the keychain-backed
 * store is replaced by a throwaway in-process test certificate.
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Share } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import es from '../src/i18n/locales/es.json';
import { ES_BUSINESS_PROFILE } from '../src/data/mockBusiness';
import { makeTestCertificate } from '../src/test-utils/testCertificates';
import { verifyFacturaeSignature, facturaeSignatureStructure } from '../src/integrations/facturaeSignature';
import { checkFacturae } from '../src/integrations/einvoiceValueRules';

const mockCert = makeTestCertificate({ person: '12345678Z', entity: 'B12345674' });
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => false, shareAsync: async () => undefined }));
jest.mock('../src/services/complianceGatingService', () => ({
  ...jest.requireActual('../src/services/complianceGatingService'),
  canUseEInvoiceFormat: () => ({ allowed: true }),
}));
jest.mock('../src/services/signingCertificateStore', () => ({
  loadSigningCertificate: async (owner: string) => (owner ? { owner, material: mockCert.material, info: {}, importedAt: '' } : null),
}));

const InvoiceScreen = () => require('../app/invoices/[id]').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 0)); }); };
const LABEL = (es as any).invoices.exportFacturae as string;
const FILED = (es as any).einvoice.filedTitle as string;

run('Facturae to a public body with a certificate', () => {
  it('shares a signed .xsig with the DIR3 centres, which verifies and passes the FACe rules', async () => {
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

    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'FA-1' }, as: 'fontanero' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const buttons = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === LABEL, { deep: true }).length > 0, { deep: true });
    expect(buttons.length).toBeGreaterThan(0);
    await act(async () => { await buttons[buttons.length - 1].props.onPress(); });
    await settle();

    expect(rnShare).toHaveBeenCalledTimes(1);
    const { message, title } = rnShare.mock.calls[0][0] as any;
    expect(title).toMatch(/-facturae\.xsig$/);
    expect(verifyFacturaeSignature(message)).toMatchObject({ valid: true });
    expect(facturaeSignatureStructure(message).problems).toEqual([]);
    expect(message).toContain('<CentreCode>LA0002878</CentreCode>');
    expect(checkFacturae(message).filter((f) => f.severity === 'error')).toEqual([]);
    // Status follows the artefact: the contractor is ASKED whether it was filed.
    expect(alert.mock.calls.some((c) => c[0] === FILED)).toBe(true);
    alert.mockRestore();
    rnShare.mockRestore();
    teardown(r);
  });
});
