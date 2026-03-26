// =============================================================================
// CUSTOMER PAYMENT PREFERENCE SERVICE
// =============================================================================
// Retrieves customer payment preferences from decision tracker submissions.
// Used to pre-select the customer's preferred payment method when creating
// payment links for invoices.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_customer_payment_preferences';

export interface CustomerPaymentPreference {
  customerId: string;
  preferredMethod: string; // e.g. 'ideal', 'paypal', 'credit_card'
  updatedAt: string;
}

/**
 * Save a customer's payment preference (called when they submit a payment_method decision)
 */
export async function saveCustomerPaymentPreference(
  customerId: string,
  preferredMethod: string,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const prefs: Record<string, CustomerPaymentPreference> = raw ? JSON.parse(raw) : {};
    prefs[customerId] = {
      customerId,
      preferredMethod,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Fail silently — preference is non-critical
  }
}

/**
 * Get a customer's preferred payment method
 * Returns the method string (e.g. 'ideal', 'paypal') or null if no preference
 */
export async function getCustomerPaymentPreference(
  customerId: string,
): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const prefs: Record<string, CustomerPaymentPreference> = JSON.parse(raw);
    return prefs[customerId]?.preferredMethod ?? null;
  } catch {
    return null;
  }
}

/**
 * Get display-friendly label for a payment method value
 */
export function getPaymentMethodLabel(methodValue: string): string {
  const labels: Record<string, string> = {
    ideal: 'iDEAL',
    paypal: 'PayPal',
    credit_card: 'Credit Card',
    creditcard: 'Credit Card',
    klarna: 'Klarna',
    sofort: 'Sofort',
    giropay: 'giropay',
    sepadirectdebit: 'SEPA',
    sepa: 'SEPA',
    applepay: 'Apple Pay',
    apple_pay: 'Apple Pay',
    googlepay: 'Google Pay',
    cartebancaire: 'Carte Bancaire',
    mybank: 'MyBank',
    bacs_debit: 'Bacs Direct Debit',
    card: 'Card',
    bancontact: 'Bancontact',
  };
  return labels[methodValue.toLowerCase()] ?? methodValue;
}
