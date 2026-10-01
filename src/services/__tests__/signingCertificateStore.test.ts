// Where the signing certificate lives (src/services/signingCertificateStore.ts):
// AES-256-GCM in a file, key in the keychain, bound to one contractor. Device
// modules are replaced by in-memory fakes; what is asserted is the contract —
// nothing in clear on disk, a tampered blob or a wrong key reads as NOTHING,
// another account gets nothing, remove leaves nothing, and a different
// contractor signing in on the phone removes it (claimDeviceData).
import * as forge from 'node-forge';
import { makeTestCertificate } from '../../test-utils/testCertificates';

const mockDisk = new Map<string, string>();
const mockKeychain = new Map<string, string>();
let mockFailNextWrite = false;
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'wutdo',
  setItemAsync: jest.fn(async (k: string, v: string) => { mockKeychain.set(k, v); }),
  getItemAsync: jest.fn(async (k: string) => mockKeychain.get(k) ?? null),
  deleteItemAsync: jest.fn(async (k: string) => { mockKeychain.delete(k); }),
}));
jest.mock('expo-file-system', () => {
  class File {
    path: string;
    constructor(dir: string, name: string) { this.path = `${dir}/${name}`; }
    get exists() { return mockDisk.has(this.path); }
    create() { mockDisk.set(this.path, ''); }
    write(s: string) { if (mockFailNextWrite) { mockFailNextWrite = false; throw new Error('disk full'); } mockDisk.set(this.path, s); }
    async text() { return mockDisk.get(this.path) ?? ''; }
    delete() { mockDisk.delete(this.path); }
  }
  return { File, Paths: { document: 'doc' } };
});
jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => Uint8Array.from(require('crypto').randomBytes(n)),
}));

// eslint-disable-next-line import/first
import { sealJson, openJson, saveSigningCertificate, loadSigningCertificate, removeSigningCertificate } from '../signingCertificateStore';

const C = makeTestCertificate({ person: '12345678Z', entity: 'B12345674' });
const INFO = { holder: 'TEST', nifs: ['B12345674'], notBefore: '', notAfter: '', issuer: '', serialNumber: C.cert.serialNumber };

beforeEach(() => { mockDisk.clear(); mockKeychain.clear(); });

describe('sealJson / openJson', () => {
  const key = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(12);
  it('round trip', () => {
    expect(openJson(sealJson({ a: 'ñ€' }, key, iv), key)).toEqual({ a: 'ñ€' });
  });
  it('a wrong key or one altered byte reads as nothing (GCM tag)', () => {
    const blob = sealJson({ a: 1 }, key, iv);
    expect(openJson(blob, forge.random.getBytesSync(32))).toBeNull();
    const ct = forge.util.decode64(blob.ct);
    const flipped = String.fromCharCode(ct.charCodeAt(0) ^ 1) + ct.slice(1);
    expect(openJson({ ...blob, ct: forge.util.encode64(flipped) }, key)).toBeNull();
  });
});

it('save → load for the owner; the file holds no key in clear; the keychain entry is device-only', async () => {
  expect(await saveSigningCertificate('user-a', C.material, INFO)).toBe(true);
  const onDisk = [...mockDisk.values()].join('');
  expect(onDisk).not.toMatch(/PRIVATE KEY|BEGIN/);
  expect(onDisk).not.toContain(C.material.privateKeyPem.slice(40, 80));
  const SecureStore = require('expo-secure-store');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(expect.any(String), expect.any(String), { keychainAccessible: 'wutdo' });
  const back = await loadSigningCertificate('user-a');
  expect(back?.material.privateKeyPem).toBe(C.material.privateKeyPem);
  expect(back?.owner).toBe('user-a');
});

it('another account gets nothing; no owner gets nothing', async () => {
  await saveSigningCertificate('user-a', C.material, INFO);
  expect(await loadSigningCertificate('user-b')).toBeNull();
  expect(await loadSigningCertificate(undefined)).toBeNull();
});

it('half of it is nothing: the file without the keychain key, or the key without the file', async () => {
  await saveSigningCertificate('user-a', C.material, INFO);
  const key = [...mockKeychain.entries()][0];
  mockKeychain.clear();
  expect(await loadSigningCertificate('user-a')).toBeNull();
  mockKeychain.set(key[0], key[1]);
  mockDisk.clear();
  expect(await loadSigningCertificate('user-a')).toBeNull();
});

it('remove leaves nothing behind', async () => {
  await saveSigningCertificate('user-a', C.material, INFO);
  expect(await removeSigningCertificate()).toBe(true);
  expect(mockDisk.size).toBe(0);
  expect(mockKeychain.size).toBe(0);
  expect(await loadSigningCertificate('user-a')).toBeNull();
});

it('a DIFFERENT contractor signing in on the phone removes it (claimDeviceData); the same one keeps it', async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const { claimDeviceData, DEVICE_DATA_OWNER_KEY } = require('../sessionCleanup');
  await AsyncStorage.setItem(DEVICE_DATA_OWNER_KEY, 'user-a');
  await saveSigningCertificate('user-a', C.material, INFO);
  await claimDeviceData('user-a');
  expect(await loadSigningCertificate('user-a')).not.toBeNull();
  await claimDeviceData('user-b');
  expect(mockDisk.size).toBe(0);
  expect(mockKeychain.size).toBe(0);
});

it('a replace that fails keeps the certificate that worked (security review 2026-10-02)', async () => {
  expect(await saveSigningCertificate('user-a', C.material, INFO)).toBe(true);
  const D = makeTestCertificate({ person: '87654321X', entity: 'B12345674' });
  mockFailNextWrite = true;
  expect(await saveSigningCertificate('user-a', D.material, { ...INFO, serialNumber: D.cert.serialNumber })).toBe(false);
  const back = await loadSigningCertificate('user-a');
  expect(back?.info.serialNumber).toBe(C.cert.serialNumber);
  expect(back?.material.privateKeyPem).toBe(C.material.privateKeyPem);
});
