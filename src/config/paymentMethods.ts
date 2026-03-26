// =============================================================================
// PAYMENT METHODS PER COUNTRY — EU6 payment provider configuration
// =============================================================================
// Maps each target country to its dominant local payment methods.
// Mollie: NL, DE, FR, ES, IT (EUR countries)
// Stripe: UK (GBP)
// =============================================================================

import type { Country } from '../context/AuthContext';

// ---------------------------------------------------------------------------
// Payment brand colors — official brand colors for each method
// ---------------------------------------------------------------------------

export const PAYMENT_BRAND_COLORS: Record<string, string> = {
  'iDEAL': '#CC0066',
  'PayPal': '#003087',
  'Klarna': '#FFB3C7',
  'giropay': '#003A7D',
  'Carte Bancaire': '#1A1F71',
  'Apple Pay': '#000000',
  'SEPA': '#004990',
  'Bacs Direct Debit': '#00BFFF',
  'MyBank': '#1A3263',
  'Credit Card': '#1A1A1A',
  'Card': '#1A1A1A',
  'Sofort/Klarna': '#FFB3C7',
};

/** Get the brand color for a payment method name, with fallback */
export function getPaymentBrandColor(methodName: string): string {
  return PAYMENT_BRAND_COLORS[methodName] ?? '#666660';
}

// ---------------------------------------------------------------------------
// Mollie method types
// ---------------------------------------------------------------------------

export type MollieMethod =
  | 'ideal'
  | 'bancontact'
  | 'creditcard'
  | 'paypal'
  | 'sofort'
  | 'giropay'
  | 'eps'
  | 'przelewy24'
  | 'kbc'
  | 'belfius'
  | 'mybank'
  | 'cartebancaire'
  | 'applepay'
  | 'googlepay'
  | 'sepadirectdebit'
  | 'klarna';

export interface PaymentMethodDisplay {
  name: string;
  icon: string; // Ionicons name
}

export interface CountryPaymentConfig {
  methods: MollieMethod[];
  display: PaymentMethodDisplay[];
}

// ---------------------------------------------------------------------------
// Mollie — country-specific payment methods (EUR countries)
// ---------------------------------------------------------------------------

export const MOLLIE_METHODS_PER_COUNTRY: Record<string, CountryPaymentConfig> = {
  NL: {
    methods: ['ideal', 'bancontact', 'creditcard', 'paypal', 'klarna', 'applepay'],
    display: [
      { name: 'iDEAL', icon: 'card-outline' },
      { name: 'PayPal', icon: 'logo-paypal' },
      { name: 'Credit Card', icon: 'card-outline' },
      { name: 'Klarna', icon: 'pricetag-outline' },
      { name: 'Apple Pay', icon: 'logo-apple' },
    ],
  },
  DE: {
    methods: ['paypal', 'giropay', 'sofort', 'creditcard', 'klarna', 'sepadirectdebit', 'applepay'],
    display: [
      { name: 'PayPal', icon: 'logo-paypal' },
      { name: 'giropay', icon: 'card-outline' },
      { name: 'Sofort/Klarna', icon: 'pricetag-outline' },
      { name: 'SEPA', icon: 'swap-horizontal-outline' },
      { name: 'Credit Card', icon: 'card-outline' },
      { name: 'Apple Pay', icon: 'logo-apple' },
    ],
  },
  FR: {
    methods: ['cartebancaire', 'paypal', 'creditcard', 'klarna', 'sepadirectdebit', 'applepay'],
    display: [
      { name: 'Carte Bancaire', icon: 'card-outline' },
      { name: 'PayPal', icon: 'logo-paypal' },
      { name: 'Credit Card', icon: 'card-outline' },
      { name: 'SEPA', icon: 'swap-horizontal-outline' },
      { name: 'Apple Pay', icon: 'logo-apple' },
    ],
  },
  ES: {
    methods: ['paypal', 'creditcard', 'klarna', 'sepadirectdebit', 'applepay'],
    display: [
      { name: 'PayPal', icon: 'logo-paypal' },
      { name: 'Credit Card', icon: 'card-outline' },
      { name: 'Klarna', icon: 'pricetag-outline' },
      { name: 'SEPA', icon: 'swap-horizontal-outline' },
      { name: 'Apple Pay', icon: 'logo-apple' },
    ],
  },
  IT: {
    methods: ['paypal', 'mybank', 'creditcard', 'klarna', 'sepadirectdebit', 'applepay'],
    display: [
      { name: 'PayPal', icon: 'logo-paypal' },
      { name: 'MyBank', icon: 'business-outline' },
      { name: 'Credit Card', icon: 'card-outline' },
      { name: 'Klarna', icon: 'pricetag-outline' },
      { name: 'SEPA', icon: 'swap-horizontal-outline' },
      { name: 'Apple Pay', icon: 'logo-apple' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Stripe — UK payment methods
// ---------------------------------------------------------------------------

export const STRIPE_METHODS_UK = ['card', 'bacs_debit', 'klarna', 'paypal'] as const;

export const STRIPE_DISPLAY_UK: PaymentMethodDisplay[] = [
  { name: 'Card', icon: 'card-outline' },
  { name: 'Bacs Direct Debit', icon: 'swap-horizontal-outline' },
  { name: 'Klarna', icon: 'pricetag-outline' },
  { name: 'PayPal', icon: 'logo-paypal' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get Mollie payment methods for a country, falls back to NL */
export function getMollieMethodsForCountry(country?: string): CountryPaymentConfig {
  return MOLLIE_METHODS_PER_COUNTRY[country ?? 'NL'] ?? MOLLIE_METHODS_PER_COUNTRY.NL;
}

/** Get display-friendly payment methods for any country (Mollie or Stripe) */
export function getPaymentDisplayForCountry(country?: Country): PaymentMethodDisplay[] {
  if (country === 'UK') return STRIPE_DISPLAY_UK;
  return getMollieMethodsForCountry(country).display;
}
