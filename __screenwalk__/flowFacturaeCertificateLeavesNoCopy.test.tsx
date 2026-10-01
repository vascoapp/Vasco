/**
 * The document picker copies the .p12 into the app's cache. It was deleted on
 * a successful import or Cancel only: a wrong password followed by Back left
 * the (password-protected) key file behind (security review, 2026-10-02).
 *
 * ONE test per file — the harness keeps a module-scoped AppState.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, TextInput } from 'react-native';
import { act } from 'react-test-renderer';
import { walkScreen, teardown } from '../src/test-utils/screenWalk';
import es from '../src/i18n/locales/es.json';
import { ES_BUSINESS_PROFILE } from '../src/data/mockBusiness';
import { makeTestCertificate } from '../src/test-utils/testCertificates';

const mockP12 = makeTestCertificate({ entity: 'B12345674', password: 'correcta' });
const mockOnDisk = new Set<string>();
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => { mockOnDisk.add('file:///cache/cert.p12'); return { canceled: false, assets: [{ uri: 'file:///cache/cert.p12', name: 'cert.p12' }] }; },
}));
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get exists() { return mockOnDisk.has(this.uri); }
    delete() { mockOnDisk.delete(this.uri); }
    async bytes() { return Uint8Array.from(Buffer.from(mockP12.p12Binary, 'binary')); }
  },
  Paths: { document: 'doc', cache: 'cache' },
}));
jest.mock('../src/services/signingCertificateStore', () => ({
  loadSigningCertificate: async () => null,
  saveSigningCertificate: async () => true,
  removeSigningCertificate: async () => true,
}));

const Screen = () => require('../app/contractor/facturae-certificate').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 40)); }); };
const T = (es as any).facturaeCertificate;

run('signing certificate screen', () => {
  it('a wrong password and then leaving the screen leaves no copy of the .p12', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...ES_BUSINESS_PROFILE, country: 'ES', language: 'es' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(Screen(), { settlePasses: 10, as: 'fontanero' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const press = async (label: string) => {
      const b = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === label, { deep: true }).length > 0, { deep: true });
      expect([label, b.length > 0]).toEqual([label, true]);
      await act(async () => { await b[b.length - 1].props.onPress(); });
      await settle();
    };
    await press(T.import);
    expect(mockOnDisk.has('file:///cache/cert.p12')).toBe(true);
    const pw = root.findAllByType(TextInput)[0];
    await act(async () => { pw.props.onChangeText('falsa'); });
    await press(T.confirmImport);
    expect(alert).toHaveBeenCalled();
    // Back, without Cancel. Unmount effect clean-ups are passive: flush them.
    teardown(r);
    await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
    expect(mockOnDisk.has('file:///cache/cert.p12')).toBe(false);
    alert.mockRestore();
  });
});
