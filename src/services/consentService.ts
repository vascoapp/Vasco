// =============================================================================
// CONSENT MANAGEMENT — Third-party integration consent tracking
// =============================================================================
// Tracks user consent for data processing and third-party integrations.
// Must be checked before connecting to any external provider (Mollie, Moneybird, Xero, etc.)
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logWarn } from '../utils/errorHandler';

const CONSENT_KEY = '@vasco_consents';

export interface ConsentRecord {
  [provider: string]: boolean;
}

export const consentService = {
  /**
   * Check whether the user has granted consent for a specific provider.
   */
  async getConsent(provider: string): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(CONSENT_KEY);
      const consents: ConsentRecord = raw ? JSON.parse(raw) : {};
      return consents[provider] === true;
    } catch {
      logWarn('consentService', `Failed to read consent for ${provider}`);
      return false;
    }
  },

  /**
   * Record the user's consent decision for a specific provider.
   */
  async setConsent(provider: string, granted: boolean): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(CONSENT_KEY);
      const consents: ConsentRecord = raw ? JSON.parse(raw) : {};
      consents[provider] = granted;
      await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(consents));
    } catch {
      logWarn('consentService', `Failed to save consent for ${provider}`);
    }
  },

  /**
   * Check whether all required consents have been granted.
   * At minimum, dataProcessing consent is required before any integration.
   */
  async hasAllRequired(): Promise<boolean> {
    try {
      const raw = await AsyncStorage.getItem(CONSENT_KEY);
      const consents: ConsentRecord = raw ? JSON.parse(raw) : {};
      return consents.dataProcessing === true;
    } catch {
      logWarn('consentService', 'Failed to check required consents');
      return false;
    }
  },

  /**
   * Get all stored consents.
   */
  async getAllConsents(): Promise<ConsentRecord> {
    try {
      const raw = await AsyncStorage.getItem(CONSENT_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  /**
   * Revoke all consents (e.g., on account deletion / GDPR request).
   */
  async revokeAll(): Promise<void> {
    try {
      await AsyncStorage.removeItem(CONSENT_KEY);
    } catch {
      logWarn('consentService', 'Failed to revoke all consents');
    }
  },
};
