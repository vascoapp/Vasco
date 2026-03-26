// =============================================================================
// MONEYBIRD INTEGRATION — Dutch accounting platform
// =============================================================================
// API docs: https://developer.moneybird.com/
// OAuth2 flow: authorization_code grant → access_token + refresh_token
// Used by majority of Dutch ZZP/contractors
// =============================================================================

import { getSecureItem, setSecureItem, deleteSecureItem, migrateToSecure } from '../lib/secureStorage';
import * as Crypto from 'expo-crypto';

const STORAGE_KEY = 'vasco_moneybird';
const LEGACY_KEY = '@vasco_moneybird';
const API_BASE = 'https://moneybird.com/api/v2';
const PKCE_VERIFIER_KEY = 'vasco_moneybird_pkce_verifier';
const OAUTH_STATE_KEY = 'vasco_moneybird_oauth_state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoneybirdConfig {
  accessToken: string;
  refreshToken: string;
  administrationId: string;
  expiresAt: number; // epoch ms
}

export interface MoneybirdContact {
  id: string;
  company_name?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  tax_number?: string;
  chamber_of_commerce?: string;
}

export interface MoneybirdInvoice {
  id: string;
  contact_id: string;
  reference?: string;
  invoice_date: string;
  due_date?: string;
  currency: string;
  total_price_excl_tax: string;
  total_price_incl_tax: string;
  state: 'draft' | 'open' | 'scheduled' | 'pending_payment' | 'late' | 'reminded' | 'paid' | 'uncollectible';
  paid_at?: string;
  details_attributes: MoneybirdLineItem[];
}

export interface MoneybirdLineItem {
  description: string;
  price: string;
  quantity: string;
  tax_rate_id: string;
  ledger_account_id?: string;
}

export interface MoneybirdTaxRate {
  id: string;
  name: string;
  percentage: string; // "21.0", "9.0", "0.0"
  tax_rate_type: string;
  active: boolean;
}

export type MoneybirdExportResult = {
  success: boolean;
  exportedAt: string;
  moneybirdId?: string;
  error?: string;
};

export type MoneybirdSyncResult = {
  invoicesSynced: number;
  contactsSynced: number;
  paymentsDetected: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

let migrated = false;
async function getConfig(): Promise<MoneybirdConfig | null> {
  try {
    if (!migrated) { migrated = true; await migrateToSecure(LEGACY_KEY, STORAGE_KEY); }
    const raw = await getSecureItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveConfig(config: MoneybirdConfig): Promise<void> {
  await setSecureItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearMoneybirdConfig(): Promise<void> {
  await deleteSecureItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.accessToken.length > 0;
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeVerifier(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(randomBytes.buffer as ArrayBuffer);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  // Convert standard base64 to base64url
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomState(): string {
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// OAuth2 helpers
// ---------------------------------------------------------------------------

export async function getMoneybirdAuthUrl(clientId: string, redirectUri: string): Promise<string> {
  // Generate PKCE code_verifier and code_challenge
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomState();

  // Store verifier and state in SecureStore for the token exchange step
  await setSecureItem(PKCE_VERIFIER_KEY, codeVerifier);
  await setSecureItem(OAUTH_STATE_KEY, state);

  return `https://moneybird.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=sales_invoices+documents+contacts+settings+bank&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;
}

export async function verifyOAuthState(returnedState: string): Promise<boolean> {
  const storedState = await getSecureItem(OAUTH_STATE_KEY);
  if (!storedState || storedState !== returnedState) {
    return false;
  }
  // Clear state after verification (one-time use)
  await deleteSecureItem(OAUTH_STATE_KEY);
  return true;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tokenExchangeUrl?: string,
): Promise<MoneybirdConfig | null> {
  try {
    // Retrieve PKCE code_verifier from SecureStore
    const codeVerifier = await getSecureItem(PKCE_VERIFIER_KEY);

    // Prefer server-side token exchange (edge function) to keep client_secret off the client
    const endpoint = tokenExchangeUrl || 'https://moneybird.com/oauth/token';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        code,
        redirect_uri: redirectUri,
        ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
      }),
    });

    // Clean up stored PKCE verifier after use
    if (codeVerifier) {
      await deleteSecureItem(PKCE_VERIFIER_KEY);
    }
    if (!res.ok) return null;
    const data = await res.json();

    // Fetch administrations to get the default one
    const adminRes = await fetch(`${API_BASE}/administrations.json`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const admins = await adminRes.json();
    const adminId = admins?.[0]?.id ?? '';

    const config: MoneybirdConfig = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      administrationId: adminId,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    await saveConfig(config);
    return config;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(config: MoneybirdConfig): Promise<MoneybirdConfig | null> {
  try {
    const res = await fetch('https://moneybird.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const newConfig: MoneybirdConfig = {
      ...config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? config.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    await saveConfig(newConfig);
    return newConfig;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiCall<T>(path: string, options?: RequestInit): Promise<T | null> {
  let config = await getConfig();
  if (!config) return null;

  // Auto-refresh if token expires within 5 minutes
  if (Date.now() > config.expiresAt - 300_000) {
    const refreshed = await refreshAccessToken(config);
    if (!refreshed) return null;
    config = refreshed;
  }

  const url = `${API_BASE}/${config.administrationId}/${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
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
// Contacts
// ---------------------------------------------------------------------------

export async function getContacts(): Promise<MoneybirdContact[]> {
  return (await apiCall<MoneybirdContact[]>('contacts.json')) ?? [];
}

export async function createContact(contact: Partial<MoneybirdContact>): Promise<MoneybirdContact | null> {
  return apiCall<MoneybirdContact>('contacts.json', {
    method: 'POST',
    body: JSON.stringify({ contact }),
  });
}

export async function findContactByEmail(email: string): Promise<MoneybirdContact | null> {
  const contacts = await getContacts();
  return contacts.find(c => c.email === email) ?? null;
}

// ---------------------------------------------------------------------------
// Tax rates (NL: 0%, 9%, 21%)
// ---------------------------------------------------------------------------

export async function getTaxRates(): Promise<MoneybirdTaxRate[]> {
  return (await apiCall<MoneybirdTaxRate[]>('tax_rates.json')) ?? [];
}

// ---------------------------------------------------------------------------
// Invoices — core integration
// ---------------------------------------------------------------------------

export async function createInvoice(invoice: {
  contactId: string;
  reference?: string;
  lineItems: { description: string; price: number; quantity: number; vatRate: number }[];
  dueDate?: string;
}): Promise<MoneybirdExportResult> {
  const taxRates = await getTaxRates();

  const findTaxRateId = (rate: number): string => {
    const match = taxRates.find(t => Math.abs(parseFloat(t.percentage) - rate) < 0.5 && t.active);
    return match?.id ?? '';
  };

  const details_attributes = invoice.lineItems.map(item => ({
    description: item.description,
    price: String(item.price),
    quantity: String(item.quantity),
    tax_rate_id: findTaxRateId(item.vatRate),
  }));

  const result = await apiCall<MoneybirdInvoice>('sales_invoices.json', {
    method: 'POST',
    body: JSON.stringify({
      sales_invoice: {
        contact_id: invoice.contactId,
        reference: invoice.reference,
        due_date: invoice.dueDate,
        details_attributes,
      },
    }),
  });

  if (result?.id) {
    return { success: true, exportedAt: new Date().toISOString(), moneybirdId: result.id };
  }
  return { success: false, exportedAt: new Date().toISOString(), error: 'Failed to create invoice' };
}

export async function getInvoices(state?: string): Promise<MoneybirdInvoice[]> {
  const filter = state ? `?filter=state:${state}` : '';
  return (await apiCall<MoneybirdInvoice[]>(`sales_invoices.json${filter}`)) ?? [];
}

export async function sendInvoice(moneybirdInvoiceId: string, method: 'email' | 'post' = 'email'): Promise<boolean> {
  const result = await apiCall(`sales_invoices/${moneybirdInvoiceId}/send_invoice.json`, {
    method: 'PATCH',
    body: JSON.stringify({ sales_invoice_sending: { delivery_method: method } }),
  });
  return result !== null;
}

// ---------------------------------------------------------------------------
// Payment sync — detect payments from Moneybird
// ---------------------------------------------------------------------------

export async function syncPayments(): Promise<{ paidInvoiceIds: string[] }> {
  const paidInvoices = await getInvoices('paid');
  return { paidInvoiceIds: paidInvoices.map(inv => inv.id) };
}

// ---------------------------------------------------------------------------
// Legacy stub (backwards compatible)
// ---------------------------------------------------------------------------

export async function exportInvoiceToMoneybird(invoiceId: string): Promise<MoneybirdExportResult> {
  const connected = await isConnected();
  if (!connected) {
    // Fallback to mock for demo mode
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true, exportedAt: new Date().toISOString() };
  }
  // Real export would need invoice data from AppState — this is the bridge point
  return { success: true, exportedAt: new Date().toISOString() };
}
