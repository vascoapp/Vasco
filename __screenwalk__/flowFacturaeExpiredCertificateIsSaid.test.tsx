/**
 * A B2B Facturae with an EXPIRED certificate stored: the file may go out
 * unsigned (an expired certificate never blocks a business invoice) — but the
 * contractor is TOLD, with a button to the certificate screen, instead of
 * finding out at the next invoice to a public body (review 2026-10-02).
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

const mockCert = makeTestCertificate({ person: '12345678Z', entity: 'B12345674', notBefore: new Date(Date.now() - 90 * 86_400_000), notAfter: new Date(Date.now() - 86_400_000) });
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
const ES = es as any;

run('Facturae to a business with an expired certificate', () => {
  it('says the file is not signed and why, offers the certificate screen, and still exports on request', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...ES_BUSINESS_PROFILE, country: 'ES', language: 'es' }));
    await AsyncStorage.setItem('@vasco_customers', JSON.stringify([{
      id: 'c-b2b', name: 'Panadería Navarro S.L.', vatId: 'ESB87654323', address: 'Calle Sol 3', city: 'Sevilla', postcode: '41001', province: 'Sevilla', country: 'ES',
    }]));
    await AsyncStorage.setItem('@vasco_invoices', JSON.stringify([
      { id: 'FA-2', customerId: 'c-b2b', customer: 'Panadería Navarro S.L.', job: 'Reparación', amount: 121, status: 'sent', dueInDays: 30 },
    ]));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const rnShare = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: 'sharedAction' } as any));

    const r = await walkScreen(InvoiceScreen(), { settlePasses: 14, params: { id: 'FA-2' }, as: 'fontanero' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const btn = root.findAll((n: any) => typeof n.props?.onPress === 'function'
      && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === ES.invoices.exportFacturae, { deep: true }).length > 0, { deep: true });
    let pressing: Promise<void> | undefined;
    await act(async () => { pressing = btn[btn.length - 1].props.onPress(); });
    await settle();

    const call = alert.mock.calls.find((c) => c[0] === ES.einvoiceRules.warningTitle);
    expect(call).toBeDefined();
    expect(String(call![1])).toContain(ES.facturaeSign.unsignedBecause.split('{{')[0].trim());
    const buttons = call![2] as Array<{ text: string; onPress?: () => void }>;
    expect(buttons.map((b) => b.text)).toContain(ES.facturaeSign.openCertificate);
    expect(rnShare).not.toHaveBeenCalled();
    await act(async () => { buttons.find((b) => b.text === ES.einvoiceRules.exportAnyway)!.onPress!(); });
    await settle();
    await act(async () => { await pressing; });
    expect(rnShare).toHaveBeenCalledTimes(1);
    expect((rnShare.mock.calls[0][0] as any).title).toMatch(/-facturae\.xml$/);
    alert.mockRestore();
    rnShare.mockRestore();
    teardown(r);
  });
});
