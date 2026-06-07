// =============================================================================
// MOLLIE INTEGRATION — European payment provider
// =============================================================================
// API docs: https://docs.mollie.com/
// Supports: iDEAL, Bancontact, Credit Card, SEPA, Klarna, Apple/Google Pay
// Primary payment method for Dutch contractors
// =============================================================================

import { getSecureItem, setSecureItem, deleteSecureItem, migrateToSecure } from '../lib/secureStorage';
import { fetchWithRetry } from '../utils/retry';
import { getCurrentCountry } from '../lib/currentUser';

const STORAGE_KEY = 'vasco_mollie';
const LEGACY_KEY = '@vasco_mollie'; // Old AsyncStorage key for migration
const API_BASE = 'https://api.mollie.com/v2';

// R66r50: country-aware payment-success redirects.
// R191: was hard-coded `app.vascobuild.com` for every country — that host
// was never deployed, so every customer who paid via Mollie landed on a
// DNS error. Universal-link landing lives at admin.vascobuild.com; the
// per-country map is preserved so country-specific TLDs (e.g. vasco.de)
// can override via env once they exist. Override via
// EXPO_PUBLIC_PAYMENT_SUCCESS_URL when a country domain is provisioned.
const PAYMENT_REDIRECT_BASE_BY_COUNTRY: Record<string, string> = {
  NL: 'https://admin.vascobuild.com',
  DE: 'https://admin.vascobuild.com',
  FR: 'https://admin.vascobuild.com',
  ES: 'https://admin.vascobuild.com',
  IT: 'https://admin.vascobuild.com',
  UK: 'https://admin.vascobuild.com',
};

export function defaultPaymentSuccessUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_PAYMENT_SUCCESS_URL;
  if (fromEnv) return fromEnv;
  const country = getCurrentCountry();
  const base = (country && PAYMENT_REDIRECT_BASE_BY_COUNTRY[country]) || 'https://admin.vascobuild.com';
  return `${base}/payment/success`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MollieConfig {
  apiKey: string; // live or test key
  profileId?: string;
}

export type MolliePaymentStatus =
  | 'open'
  | 'canceled'
  | 'pending'
  | 'authorized'
  | 'expired'
  | 'failed'
  | 'paid';

export interface MolliePayment {
  id: string;
  status: MolliePaymentStatus;
  amount: { value: string; currency: string };
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata?: Record<string, string>;
  _links: {
    checkout?: { href: string };
    dashboard?: { href: string };
  };
  createdAt: string;
  paidAt?: string;
  method?: string;
}

export type MolliePaymentResult = {
  success: boolean;
  paymentId: string;
  checkoutUrl: string;
  error?: string;
};

export interface MolliePaymentRequest {
  invoiceId: string;
  amount: number;
  currency?: string;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  customerEmail?: string;
  locale?: 'nl_NL' | 'nl_BE' | 'en_US' | 'en_GB' | 'de_DE' | 'fr_FR' | 'fr_BE' | 'es_ES' | 'it_IT';
  method?: string[]; // ['ideal', 'bancontact', 'creditcard', etc.]
}

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

let migrated = false;

// R66r55: on userChange (login/logout) wipe SecureStore + reset the
// migration latch — mirrors stripe.ts. Stops a previous contractor's
// Mollie API key from leaking into the next signed-in user's session.
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

async function getConfig(): Promise<MollieConfig | null> {
  try {
    // One-time migration from AsyncStorage to SecureStore
    if (!migrated) { migrated = true; await migrateToSecure(LEGACY_KEY, STORAGE_KEY); }
    const raw = await getSecureItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveMollieConfig(config: MollieConfig): Promise<void> {
  await setSecureItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearMollieConfig(): Promise<void> {
  await deleteSecureItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.apiKey.length > 0;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiCall<T>(path: string, options?: RequestInit): Promise<T | null> {
  const config = await getConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetchWithRetry(`${API_BASE}/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
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
// Payments — core integration
// ---------------------------------------------------------------------------

export async function createPayment(req: MolliePaymentRequest): Promise<MolliePaymentResult> {
  const connected = await isConnected();
  if (!connected) {
    // In demo/dev mode, return a simulated payment. In production builds, surface an explicit error.
    if (__DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        success: true,
        paymentId: `pay_demo_${req.invoiceId}`,
        checkoutUrl: 'https://www.mollie.com/demo/checkout',
      };
    }
    return { success: false, paymentId: '', checkoutUrl: '', error: 'Mollie not connected — configure the integration before accepting payments.' };
  }

  // R66r49 #14: paymentMarginService.VASCO_PLATFORM_FEE_PERCENT (1%) wires
  // here when Mollie Partner / Connect is set up. Add to the body below:
  //   applicationFee: {
  //     amount: { currency: 'EUR', value: (req.amount * 0.01).toFixed(2) },
  //     description: 'Vasco platform fee',
  //   },
  // For now: contractor receives full amount, Vasco collects no fee.
  // Operator action: apply for Mollie Partner programme → contractor
  // onboards under Vasco's partner account → app reads partnerAccessToken
  // and threads it through. Disclosure already shipped in mollie.tsx
  // connect modal (R66r49 #14) so this is non-surprising.
  const result = await apiCall<MolliePayment>('payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: {
        currency: req.currency ?? 'EUR',
        value: req.amount.toFixed(2),
      },
      description: req.description,
      redirectUrl: req.redirectUrl,
      webhookUrl: req.webhookUrl,
      metadata: { invoiceId: req.invoiceId },
      locale: req.locale ?? 'nl_NL',
      method: req.method,
    }),
  });

  if (result?.id) {
    return {
      success: true,
      paymentId: result.id,
      checkoutUrl: result._links.checkout?.href ?? '',
    };
  }
  return { success: false, paymentId: '', checkoutUrl: '', error: 'Payment creation failed' };
}

export async function getPayment(paymentId: string): Promise<MolliePayment | null> {
  return apiCall<MolliePayment>(`payments/${paymentId}`);
}

export async function listPayments(limit = 25): Promise<MolliePayment[]> {
  const result = await apiCall<{ _embedded: { payments: MolliePayment[] } }>(`payments?limit=${limit}`);
  return result?._embedded?.payments ?? [];
}

// ---------------------------------------------------------------------------
// Payment link — shareable link for customers
// ---------------------------------------------------------------------------

// R250: country-aware default payment methods. Pass `customerCountry`
// instead of `method` and the right local methods get picked automatically.
// NL → iDEAL+SEPA dominate; DE → Sofort+SEPA-Direct-Debit+Klarna.
export function defaultPaymentMethodsForCountry(country: string | undefined): string[] | undefined {
  const c = (country ?? '').toUpperCase();
  if (c === 'NL') return ['ideal', 'sepadirectdebit', 'creditcard', 'paypal'];
  if (c === 'BE') return ['bancontact', 'sepadirectdebit', 'creditcard'];
  if (c === 'DE') return ['sofort', 'sepadirectdebit', 'klarnapaylater', 'creditcard'];
  if (c === 'AT') return ['eps', 'sepadirectdebit', 'creditcard'];
  if (c === 'FR') return ['creditcard', 'sepadirectdebit', 'paypal'];
  if (c === 'ES') return ['creditcard', 'sepadirectdebit', 'paypal'];
  if (c === 'IT') return ['creditcard', 'sepadirectdebit', 'paypal'];
  if (c === 'UK') return ['creditcard', 'paypal'];
  if (c === 'SE' || c === 'NO' || c === 'DK' || c === 'FI') return ['klarnapaylater', 'creditcard', 'paypal'];
  return undefined;
}

export async function createPaymentLink(req: {
  invoiceId: string;
  amount: number;
  description: string;
  expiresAt?: string;
  method?: string[]; // Country-specific Mollie methods (e.g. ['ideal', 'creditcard', 'paypal'])
  customerCountry?: string; // R250: when set, default methods auto-pick if `method` omitted
  // R311: arbitrary metadata copied onto the payment link → Mollie copies it
  // onto every payment created from the link, so the webhook can route it
  // (e.g. { trackerAccessCode } for decision-tracker deposits).
  metadata?: Record<string, string>;
}): Promise<{ url: string; id: string } | null> {
  const connected = await isConnected();
  if (!connected) {
    if (__DEV__ || process.env.EXPO_PUBLIC_DEMO_MODE === 'true') {
      return { url: `https://pay.vascobuild.com/demo/${req.invoiceId}`, id: `pl_demo_${req.invoiceId}` };
    }
    return null;
  }

  const resolvedMethods = req.method
    ?? (req.customerCountry ? defaultPaymentMethodsForCountry(req.customerCountry) : undefined);
  // Always carry invoiceId in metadata; merge any caller-supplied keys on top.
  const metadata = { invoiceId: req.invoiceId, ...(req.metadata ?? {}) };
  const result = await apiCall<{ id: string; _links: { paymentLink: { href: string } } }>('payment-links', {
    method: 'POST',
    body: JSON.stringify({
      amount: { currency: 'EUR', value: req.amount.toFixed(2) },
      description: req.description,
      expiresAt: req.expiresAt,
      metadata,
      ...(resolvedMethods ? { method: resolvedMethods } : {}),
    }),
  });

  if (result?.id) {
    return { url: result._links.paymentLink.href, id: result.id };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Legacy stub (backwards compatible)
// ---------------------------------------------------------------------------

export async function createMolliePayment(
  invoiceId: string,
  amount: number
): Promise<MolliePaymentResult> {
  return createPayment({
    invoiceId,
    amount,
    description: `Factuur ${invoiceId}`,
    redirectUrl: defaultPaymentSuccessUrl(),
  });
}
