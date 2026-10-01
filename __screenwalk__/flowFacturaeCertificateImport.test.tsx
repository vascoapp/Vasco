/**
 * The signing-certificate screen (Spain), pressed through: pick a .p12, type
 * its password, Import → the certificate is stored for THIS account and the
 * screen shows holder, NIF and expiry. A wrong password is refused by name
 * and nothing is stored. Remove asks first (2 buttons) and removes.
 *
 * Real: the screen, readSigningCertificate on a real PKCS#12 (minted in
 * process, test-only). Replaced: the document picker, the picked file's
 * bytes, and the keychain-backed store (in memory).
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

const mockP12 = makeTestCertificate({ person: '12345678Z', entity: 'B12345674', cn: '12345678Z PEDRO RUIZ (R: B12345674)', password: 'correcta' });
const mockSaved: { current: any } = { current: null };
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => ({ canceled: false, assets: [{ uri: 'file:///cache/cert.p12', name: 'cert.p12' }] }),
}));
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(uri: string) { this.uri = uri; }
    get exists() { return false; }
    delete() {}
    async bytes() { return Uint8Array.from(Buffer.from(mockP12.p12Binary, 'binary')); }
  },
  Paths: { document: 'doc', cache: 'cache' },
}));
jest.mock('../src/services/signingCertificateStore', () => ({
  loadSigningCertificate: async (owner: string) => (mockSaved.current && mockSaved.current.owner === owner ? mockSaved.current : null),
  saveSigningCertificate: async (owner: string, material: any, info: any) => { mockSaved.current = { owner, material, info, importedAt: 'now' }; return true; },
  removeSigningCertificate: async () => { mockSaved.current = null; return true; },
}));

const Screen = () => require('../app/contractor/facturae-certificate').default;
const run = process.env.WALK_POSTURE === 'fresh' ? describe.skip : describe;
const settle = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((res) => setTimeout(res, 40)); }); };
const T = (es as any).facturaeCertificate;

run('signing certificate screen', () => {
  it('imports with the right password, refuses a wrong one, and removes after asking', async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('@vasco_seed_version', '2026-03-25-v4');
    await AsyncStorage.setItem('@vasco_business_profile', JSON.stringify({ ...ES_BUSINESS_PROFILE, country: 'ES', language: 'es' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const r = await walkScreen(Screen(), { settlePasses: 10, as: 'fontanero' });
    expect(r.error).toBeNull();
    const root = (r.tree as any).root;
    const texts = () => root.findAll((n: any) => typeof n.props?.children === 'string', { deep: true }).map((n: any) => n.props.children);
    const press = async (label: string) => {
      const b = root.findAll((n: any) => typeof n.props?.onPress === 'function'
        && n.findAll((c: any) => typeof c.props?.children === 'string' && c.props.children === label, { deep: true }).length > 0, { deep: true });
      expect([label, b.length > 0]).toEqual([label, true]);
      await act(async () => { await b[b.length - 1].props.onPress(); });
      await settle();
    };
    const typePassword = async (pw: string) => {
      const input = root.findAllByType(TextInput).find((n: any) => n.props.secureTextEntry);
      expect(input).toBeDefined();
      await act(async () => { input.props.onChangeText(pw); });
    };

    expect(texts()).toContain(T.none);
    // Wrong password: refused by name, nothing stored.
    await press(T.import);
    await typePassword('mal');
    await press(T.confirmImport);
    expect(alert.mock.calls.map((c) => [c[0], c[1]])).toEqual([[T.problemTitle, T.problem.unreadable]]);
    expect(mockSaved.current).toBeNull();

    // Right password: stored for this account; holder, NIF and expiry shown.
    alert.mockClear();
    await typePassword('correcta');
    await press(T.confirmImport);
    expect(alert.mock.calls.map((c) => c[0])).toEqual([T.imported]);
    expect(mockSaved.current?.owner).toBeTruthy();
    expect(mockSaved.current?.info.nif).toBe('B12345674');
    const shown = texts().join(' | ');
    expect(shown).toContain('12345678Z PEDRO RUIZ (R: B12345674)');
    expect(shown).toContain('B12345674');
    expect(shown).toContain(T.expires);
    // The password is not kept anywhere on screen state after import.
    expect(root.findAllByType(TextInput).filter((n: any) => n.props.secureTextEntry)).toHaveLength(0);

    // Remove: asks first (two buttons), then removes.
    alert.mockClear();
    await press(T.remove);
    const ask = alert.mock.calls.find((c) => c[0] === T.removeTitle)!;
    expect((ask[2] as any[]).length).toBe(2);
    await act(async () => { await (ask[2] as any[])[1].onPress(); });
    await settle();
    expect(mockSaved.current).toBeNull();
    expect(texts()).toContain(T.none);
    alert.mockRestore();
    teardown(r);
  });
});
