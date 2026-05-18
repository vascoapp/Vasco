// =============================================================================
// STRIPE INTEGRATION — Global payment provider (primary for UK)
// =============================================================================
// API docs: https://docs.stripe.com/api
// Supports: Card, SEPA Direct Debit, Bacs Debit (UK), iDEAL (NL),
//           Bancontact (BE), Klarna, Apple/Google Pay
// Primary payment method for UK contractors, available in all 6 EU countries
// =============================================================================
// NOTE: Stripe uses application/x-www-form-urlencoded for all API requests
// =============================================================================

import { getSecureItem, setSecureItem, deleteSecureItem, migrateToSecure } from '../lib/secureStorage';
import { fetchWithRetry } from '../utils/retry';

const STORAGE_KEY = 'vasco_stripe';
const LEGACY_KEY = '@vasco_stripe'; // Old AsyncStorage key for migration
const API_BASE = 'https://api.stripe.com/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StripeConfig {
  apiKey: string; // sk_live_xxx or sk_test_xxx
  accountId?: string; // Stripe Connect account ID (acct_xxx)
}

export type StripePaymentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export type StripeCurrency = 'GBP' | 'EUR' | 'USD';

export type StripePaymentMethod =
  | 'card'
  | 'sepa_debit'
  | 'bacs_debit'
  | 'ideal'
  | 'bancontact'
  | 'klarna';

export interface StripePayment {
  id: string;
  object: 'payment_intent';
  status: StripePaymentStatus;
  amount: number; // in cents
  currency: string;
  description: string | null;
  metadata: Record<string, string>;
  payment_method_types: string[];
  client_secret: string;
  created: number; // unix timestamp
  livemode: boolean;
}

export interface StripePaymentLink {
  id: string;
  object: 'payment_link';
  url: string;
  active: boolean;
  metadata: Record<string, string>;
}

export type StripePaymentResult = {
  success: boolean;
  paymentId: string;
  checkoutUrl: string;
  clientSecret?: string;
  error?: string;
};

export interface StripePaymentRequest {
  invoiceId: string;
  amount: number; // in major currency unit (e.g. 12.50)
  currency?: StripeCurrency;
  description: string;
  customerEmail?: string;
  paymentMethods?: StripePaymentMethod[];
  metadata?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

let migrated = false;

// R66r55: on userChange (login/logout) wipe SecureStore + reset the
// one-time-migration latch so a new user's first read can't accidentally
// inherit the previous user's stripe key. Fire-and-forget — failures
// can't break the parent sign-out flow.
import { registerSingletonReset } from '../services/singletonReset';
let resetRegistered = false;
function ensureResetRegistered(): void {
  if (resetRegistered) return;
  resetRegistered = true;
  registerSingletonReset(() => {
    migrated = false;
    void deleteSecureItem(STORAGE_KEY).catch(() => {});
  });
}
ensureResetRegistered();

async function getConfig(): Promise<StripeConfig | null> {
  try {
    // One-time migration from AsyncStorage to SecureStore
    if (!migrated) { migrated = true; await migrateToSecure(LEGACY_KEY, STORAGE_KEY); }
    const raw = await getSecureItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveStripeConfig(config: StripeConfig): Promise<void> {
  await setSecureItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearStripeConfig(): Promise<void> {
  await deleteSecureItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.apiKey.length > 0;
}

/**
 * R66r57: roundtrip the stored key against Stripe to verify it actually
 * works. `isConnected()` only checks SecureStore — a contractor pasting an
 * invalid `sk_live_typo` would otherwise see "Connected ✓" and fail at
 * first payment-link mint. `/v1/balance` is the canonical zero-cost auth
 * probe: returns 200 with the connected account's balance for any valid
 * key, 401 for an invalid one.
 */
export async function validateConnection(): Promise<boolean> {
  const config = await getConfig();
  if (!config?.apiKey) return false;
  try {
    const res = await fetch(`${API_BASE}/balance`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers — form encoding (Stripe requires x-www-form-urlencoded)
// ---------------------------------------------------------------------------

/**
 * Encode a nested object into Stripe-style form params.
 * e.g. { metadata: { invoiceId: '123' } } → 'metadata[invoiceId]=123'
 */
function encodeFormData(data: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    const fullKey = prefix ? `${prefix}[${key}]` : key;

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          parts.push(encodeFormData(item as Record<string, unknown>, `${fullKey}[${index}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${index}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === 'object') {
      parts.push(encodeFormData(value as Record<string, unknown>, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }

  return parts.filter(Boolean).join('&');
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiCall<T>(path: string, options?: RequestInit & { formData?: Record<string, unknown> }): Promise<T | null> {
  const config = await getConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  // Add Stripe-Account header for Connect platforms
  if (config.accountId) {
    headers['Stripe-Account'] = config.accountId;
  }

  let body: string | undefined;
  if (options?.formData) {
    body = encodeFormData(options.formData);
  }

  try {
    const res = await fetchWithRetry(`${API_BASE}/${path}`, {
      ...options,
      method: options?.method ?? 'GET',
      signal: controller.signal,
      headers: {
        ...headers,
        ...(options?.headers as Record<string, string> ?? {}),
      },
      body: body ?? options?.body,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Payment Links — shareable checkout link for customers
// ---------------------------------------------------------------------------

export async function createPaymentLink(request: StripePaymentRequest): Promise<{ url: string; id: string } | null> {
  const connected = await isConnected();
  if (!connected) {
    if (__DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
      return {
        url: `https://pay.vascobuild.com/demo/${request.invoiceId}`,
        id: `plink_demo_${request.invoiceId}`,
      };
    }
    return null;
  }

  const currency = (request.currency ?? 'GBP').toLowerCase();
  const amountInCents = Math.round(request.amount * 100);

  // R66r49 #14: paymentMarginService.VASCO_PLATFORM_FEE_PERCENT (1%) wires
  // here when Stripe Connect is set up. Add to the formData below:
  //   'application_fee_amount': Math.round(amountInCents * 0.01),
  //   'on_behalf_of': connectedAccountId,
  // For now: contractor receives full amount, Vasco collects no fee.
  // Operator action: enroll Vasco as Stripe Connect platform → contractor
  // onboards their Stripe account → app reads connectedAccountId from
  // stripeConfig and threads it through. Disclosure already shipped in
  // mollie.tsx connect modal (R66r49 #14) so this is non-surprising.

  // Stripe Payment Links require a Price object inline via line_items
  const result = await apiCall<StripePaymentLink>('payment_links', {
    method: 'POST',
    formData: {
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]': request.description,
      'line_items[0][price_data][unit_amount]': amountInCents,
      'line_items[0][quantity]': 1,
      metadata: {
        invoiceId: request.invoiceId,
        ...(request.customerEmail ? { customerEmail: request.customerEmail } : {}),
        ...(request.metadata ?? {}),
      },
      payment_method_types: request.paymentMethods ?? SUPPORTED_METHODS.UK,
    },
  });

  if (result?.id) {
    return { url: result.url, id: result.id };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Payments — PaymentIntent creation
// ---------------------------------------------------------------------------

export async function createPayment(req: StripePaymentRequest): Promise<StripePaymentResult> {
  const connected = await isConnected();
  if (!connected) {
    if (__DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        success: true,
        paymentId: `pi_demo_${req.invoiceId}`,
        checkoutUrl: 'https://checkout.stripe.com/demo',
        clientSecret: `pi_demo_${req.invoiceId}_secret_demo`,
      };
    }
    return { success: false, paymentId: '', checkoutUrl: '', error: 'Stripe not connected — add your API key before accepting payments.' };
  }

  const currency = (req.currency ?? 'GBP').toLowerCase();
  const amountInCents = Math.round(req.amount * 100);

  const formData: Record<string, unknown> = {
    amount: amountInCents,
    currency,
    description: req.description,
    'metadata[invoiceId]': req.invoiceId,
    payment_method_types: req.paymentMethods ?? SUPPORTED_METHODS.UK,
  };

  if (req.customerEmail) {
    formData['metadata[customerEmail]'] = req.customerEmail;
    formData['receipt_email'] = req.customerEmail;
  }

  if (req.metadata) {
    for (const [key, value] of Object.entries(req.metadata)) {
      formData[`metadata[${key}]`] = value;
    }
  }

  const result = await apiCall<StripePayment>('payment_intents', {
    method: 'POST',
    formData,
  });

  if (result?.id) {
    return {
      success: true,
      paymentId: result.id,
      checkoutUrl: '', // PaymentIntents don't have a checkout URL — use client_secret with Stripe.js
      clientSecret: result.client_secret,
    };
  }
  return { success: false, paymentId: '', checkoutUrl: '', error: 'Payment creation failed' };
}

// ---------------------------------------------------------------------------
// Payment status — fetch PaymentIntent by ID
// ---------------------------------------------------------------------------

export async function getPayment(paymentId: string): Promise<StripePayment | null> {
  return apiCall<StripePayment>(`payment_intents/${paymentId}`);
}

// ---------------------------------------------------------------------------
// Supported payment methods per country
// ---------------------------------------------------------------------------

export const SUPPORTED_METHODS: Record<string, StripePaymentMethod[]> = {
  UK: ['card', 'bacs_debit', 'klarna'],
  NL: ['card', 'ideal', 'sepa_debit', 'klarna'],
  DE: ['card', 'sepa_debit', 'klarna'],
  FR: ['card', 'sepa_debit', 'klarna'],
  ES: ['card', 'sepa_debit', 'klarna'],
  IT: ['card', 'sepa_debit', 'klarna'],
  BE: ['card', 'bancontact', 'sepa_debit', 'klarna'],
};

export const SUPPORTED_CURRENCIES: StripeCurrency[] = ['GBP', 'EUR', 'USD'];

// ---------------------------------------------------------------------------
// Legacy stub (backwards compatible)
// ---------------------------------------------------------------------------

export async function createStripePayment(
  invoiceId: string,
  amount: number,
  country: string = 'UK'
): Promise<StripePaymentResult> {
  return createPayment({
    invoiceId,
    amount,
    description: `Invoice ${invoiceId}`,
    currency: 'GBP',
    paymentMethods: SUPPORTED_METHODS[country] ?? SUPPORTED_METHODS.UK,
  });
}
