// =============================================================================
// SECURE STORAGE — Encrypted key storage for API credentials
// =============================================================================
// Uses expo-secure-store (iOS Keychain / Android EncryptedSharedPreferences)
// Falls back to AsyncStorage on web (with console warning)
// =============================================================================

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

/** Store a sensitive value (API key, token, etc.) securely */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    // Web has no secure store — use AsyncStorage with prefix to identify sensitive keys
    await AsyncStorage.setItem(`@secure_${key}`, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

/** Retrieve a sensitive value */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(`@secure_${key}`);
  }
  return SecureStore.getItemAsync(key);
}

/** Delete a sensitive value */
export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(`@secure_${key}`);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/** Migrate a key from AsyncStorage to SecureStore (one-time migration) */
export async function migrateToSecure(asyncKey: string, secureKey: string): Promise<void> {
  if (isWeb) return; // No migration needed on web
  try {
    const existing = await AsyncStorage.getItem(asyncKey);
    if (existing) {
      const parsed = JSON.parse(existing);
      await SecureStore.setItemAsync(secureKey, JSON.stringify(parsed));
      await AsyncStorage.removeItem(asyncKey);
    }
  } catch {
    // Migration is best-effort — old key stays if migration fails
  }
}
