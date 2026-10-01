// =============================================================================
// Where the contractor's signing certificate lives on the phone
// =============================================================================
// DECISION (2026-10-01): the private key is stored ENCRYPTED IN A FILE, under
// a random 256-bit key that lives in the device keychain (expo-secure-store:
// iOS Keychain, Android Keystore-backed storage), WHEN_UNLOCKED_THIS_DEVICE_ONLY
// — never synced to iCloud/Google backup, never readable while locked.
//
// Why not the .p12 + its password in SecureStore directly: a .p12 is 3–7 KB
// and expo-secure-store documents a 2048-byte value limit on Android ("may be
// rejected"). And storing the PASSWORD would keep a secret the contractor
// uses elsewhere (their FNMT certificate is also their AEAT login). So the
// password is used once, at import, to unwrap the key; what is kept is the key
// itself, re-encrypted with AES-256-GCM (node-forge) under the keychain key.
// Both halves are needed: the file alone is ciphertext, the keychain entry
// alone is a random number.
//
// Bound to ONE contractor: the blob records the account that imported it; a
// different account signing in on the phone (claimDeviceData) removes it, and
// a load for another account returns nothing — the next person must never
// sign as the previous one.
//
// Nothing here logs key material, the password, or the decrypted blob.
// All OTA-safe: expo-secure-store, expo-file-system and expo-crypto are in
// package.json and app.json already (in the shipped binary); node-forge is JS.
// =============================================================================

import { Platform } from 'react-native';
import * as forge from 'node-forge';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { getRandomBytes } from 'expo-crypto';
import type { SigningMaterial } from '../integrations/facturaeSignature';
import type { CertificateInfo } from '../integrations/signingCertificate';
import { logWarn } from '../utils/errorHandler';

const KEYCHAIN_KEY = 'vasco_facturae_signing_key_v1';
const FILE_NAME = 'facturae-signing-certificate.v1.bin';

export interface StoredCertificate {
  owner: string;
  material: SigningMaterial;
  info: CertificateInfo;
  importedAt: string;
}

export interface SealedBlob { v: 1; iv: string; tag: string; ct: string }

const bytesToBinary = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};

/** AES-256-GCM, 96-bit IV, 128-bit tag. `key` and `iv` are binary strings. */
export function sealJson(value: unknown, key: string, iv: string): SealedBlob {
  if (key.length !== 32 || iv.length !== 12) throw new Error('bad key/iv length');
  const cipher = forge.cipher.createCipher('AES-GCM', key);
  cipher.start({ iv, tagLength: 128 });
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(JSON.stringify(value))));
  if (!cipher.finish()) throw new Error('encryption failed');
  return {
    v: 1,
    iv: forge.util.encode64(iv),
    tag: forge.util.encode64(cipher.mode.tag.getBytes()),
    ct: forge.util.encode64(cipher.output.getBytes()),
  };
}

/** The value, or null when the key is wrong or a byte was altered (GCM tag). */
export function openJson<T>(blob: SealedBlob, key: string): T | null {
  try {
    if (blob?.v !== 1) return null;
    const decipher = forge.cipher.createDecipher('AES-GCM', key);
    decipher.start({ iv: forge.util.decode64(blob.iv), tagLength: 128, tag: forge.util.createBuffer(forge.util.decode64(blob.tag)) });
    decipher.update(forge.util.createBuffer(forge.util.decode64(blob.ct)));
    if (!decipher.finish()) return null;
    return JSON.parse(forge.util.decodeUtf8(decipher.output.getBytes())) as T;
  } catch {
    return null;
  }
}

// --- Device plumbing ---------------------------------------------------------

async function deps() {
  return { SecureStore, file: new File(Paths.document, FILE_NAME), getRandomBytes };
}

export const certificateStorageSupported = (): boolean => Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Stores the certificate for `owner`. Returns true only once it has been
 * written AND read back intact — the screen says "imported" on that alone.
 */
export async function saveSigningCertificate(owner: string, material: SigningMaterial, info: CertificateInfo): Promise<boolean> {
  if (!owner || !certificateStorageSupported()) return false;
  const { SecureStore, file, getRandomBytes } = await deps();
  const opts = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  // A REPLACE must not destroy the certificate that works: the key used to be
  // overwritten first, so a failed file write left the old file unreadable
  // (security review, 2026-10-02). Keep both old halves (the file is
  // ciphertext) and put them back if any step — or the read-back — fails.
  let prevKey: string | null = null;
  let prevBlob: string | null = null;
  try {
    prevKey = await SecureStore.getItemAsync(KEYCHAIN_KEY);
    prevBlob = file.exists ? await file.text() : null;
  } catch { /* unreadable old state: nothing worth restoring */ }
  const restore = async () => {
    try {
      if (prevKey && prevBlob !== null) {
        await SecureStore.setItemAsync(KEYCHAIN_KEY, prevKey, opts);
        if (file.exists) file.delete();
        file.create();
        file.write(prevBlob);
      } else {
        await SecureStore.deleteItemAsync(KEYCHAIN_KEY);
        if (file.exists) file.delete();
      }
    } catch { /* best effort */ }
  };
  try {
    const key = bytesToBinary(getRandomBytes(32));
    const iv = bytesToBinary(getRandomBytes(12));
    const record: StoredCertificate = { owner, material, info, importedAt: new Date().toISOString() };
    const blob = sealJson(record, key, iv);
    await SecureStore.setItemAsync(KEYCHAIN_KEY, forge.util.encode64(key), opts);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(blob));
    const back = await loadSigningCertificate(owner);
    const ok = !!back && back.info.serialNumber === info.serialNumber;
    if (!ok) await restore();
    return ok;
  } catch (err) {
    logWarn('SigningCertificate', `save failed: ${(err as Error)?.name ?? 'error'}`);
    await restore();
    return false;
  }
}

/** The stored certificate of `owner`, or null (none, another account's, or unreadable). */
export async function loadSigningCertificate(owner: string | null | undefined): Promise<StoredCertificate | null> {
  if (!owner || !certificateStorageSupported()) return null;
  try {
    const { SecureStore, file } = await deps();
    if (!file.exists) return null;
    const keyB64 = await SecureStore.getItemAsync(KEYCHAIN_KEY);
    if (!keyB64) return null;
    const rec = openJson<StoredCertificate>(JSON.parse(await file.text()) as SealedBlob, forge.util.decode64(keyB64));
    if (!rec || rec.owner !== owner) return null;
    return rec;
  } catch (err) {
    logWarn('SigningCertificate', `load failed: ${(err as Error)?.name ?? 'error'}`);
    return null;
  }
}

/** Removes both halves. True when nothing is left behind. */
export async function removeSigningCertificate(): Promise<boolean> {
  if (!certificateStorageSupported()) return true;
  try {
    const { SecureStore, file } = await deps();
    await SecureStore.deleteItemAsync(KEYCHAIN_KEY);
    if (file.exists) file.delete();
    return !file.exists;
  } catch (err) {
    logWarn('SigningCertificate', `remove failed: ${(err as Error)?.name ?? 'error'}`);
    return false;
  }
}
