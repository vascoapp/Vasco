// =============================================================================
// PENNYLANE INTEGRATION — French accounting platform
// =============================================================================
// API docs: https://pennylane.readme.io/reference
// OAuth2 flow: authorization_code grant → access_token + refresh_token
// Popular with French artisans / auto-entrepreneurs / TPE-PME
// =============================================================================

import { localDateKey, todayKey } from '../utils/dateKey';
import { getSecureItem, setSecureItem, deleteSecureItem, migrateToSecure } from '../lib/secureStorage';
import { MS_PER_DAY } from '../utils/timeConstants';

const STORAGE_KEY = 'vasco_pennylane';
const LEGACY_KEY = '@vasco_pennylane';
const API_BASE = 'https://app.pennylane.com/api/external/v2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PennylaneConfig {
  accessToken: string;
  refreshToken: string;
  companyId: string;
  expiresAt: number; // epoch ms
}

export interface PennylaneContact {
  id?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  emails?: string[];
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  siret?: string; // 14-digit SIRET
  vat_number?: string; // TVA intracommunautaire (FR + 11 digits)
  customer_type: 'company' | 'individual';
}

export interface PennylaneInvoice {
  id?: string;
  invoice_number?: string;
  date: string; // YYYY-MM-DD
  deadline: string; // YYYY-MM-DD
  currency: string;
  customer_id: string;
  line_items: PennylaneLineItem[];
  status?: 'draft' | 'sent' | 'accepted' | 'paid' | 'cancelled';
  total_amount?: number;
  total_tax?: number;
  paid_at?: string;
  pdf_url?: string;
}

export interface PennylaneLineItem {
  label: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number; // HT (excl. tax)
  vat_rate: number; // e.g. 20.0
  discount?: number;
}

export type PennylaneExportResult = {
  success: boolean;
  exportedAt: string;
  pennylaneId?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// TVA rates (France)
// ---------------------------------------------------------------------------

export const TVA_RATES = {
  STANDARD: 20.0, // Taux normal
  INTERMEDIATE: 10.0, // Taux intermédiaire (rénovation)
  REDUCED: 5.5, // Taux réduit (travaux amélioration énergétique)
  SUPER_REDUCED: 2.1, // Taux super réduit
  EXEMPT: 0.0, // Exonéré
} as const;

export function getTvaRate(ratePercent: number): number {
  const rates = [0, 2.1, 5.5, 10, 20];
  return rates.reduce((prev, curr) =>
    Math.abs(curr - ratePercent) < Math.abs(prev - ratePercent) ? curr : prev,
  );
}

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

async function getConfig(): Promise<PennylaneConfig | null> {
  try {
    await migrateToSecure(LEGACY_KEY, STORAGE_KEY);
    const raw = await getSecureItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveConfig(config: PennylaneConfig): Promise<void> {
  await setSecureItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearPennylaneConfig(): Promise<void> {
  await deleteSecureItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.accessToken.length > 0;
}

// ---------------------------------------------------------------------------
// OAuth2 helpers
// ---------------------------------------------------------------------------

export function getPennylaneAuthUrl(clientId: string, redirectUri: string): string {
  return `https://app.pennylane.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=accounting`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tokenExchangeUrl?: string,
): Promise<PennylaneConfig | null> {
  try {
    // Prefer server-side token exchange (edge function) to keep client_secret off the client
    const endpoint = tokenExchangeUrl || 'https://app.pennylane.com/oauth/token';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Fetch company to get the default one
    const companyRes = await fetch(`${API_BASE}/companies`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const companies = await companyRes.json();
    const companyId = companies?.[0]?.id ?? '';

    const config: PennylaneConfig = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      companyId,
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

async function refreshAccessToken(config: PennylaneConfig): Promise<PennylaneConfig | null> {
  try {
    const res = await fetch('https://app.pennylane.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const newConfig: PennylaneConfig = {
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
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

export async function getContacts(): Promise<PennylaneContact[]> {
  const result = await apiCall<{ customers: PennylaneContact[] }>('customers');
  return result?.customers ?? [];
}

export async function createContact(contact: Partial<PennylaneContact>): Promise<PennylaneContact | null> {
  return apiCall<PennylaneContact>('customers', {
    method: 'POST',
    body: JSON.stringify({ customer: contact }),
  });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function createInvoice(invoice: {
  customerId: string;
  reference?: string;
  lineItems: { description: string; price: number; quantity: number; vatRate: number; unit?: string }[];
  dueDate?: string;
}): Promise<PennylaneExportResult> {
  const line_items = invoice.lineItems.map(item => ({
    label: item.description,
    quantity: item.quantity,
    unit: item.unit ?? 'unit',
    unit_price: item.price,
    vat_rate: getTvaRate(item.vatRate),
  }));

  const result = await apiCall<PennylaneInvoice>('customer_invoices', {
    method: 'POST',
    body: JSON.stringify({
      invoice: {
        customer_id: invoice.customerId,
        date: todayKey(),
        deadline: invoice.dueDate ?? localDateKey(new Date(Date.now() + 30 * MS_PER_DAY)),
        currency: 'EUR',
        line_items,
      },
    }),
  });

  if (result?.id) {
    return { success: true, exportedAt: new Date().toISOString(), pennylaneId: result.id };
  }
  return { success: false, exportedAt: new Date().toISOString(), error: 'Failed to create invoice' };
}

export async function getInvoices(status?: string): Promise<PennylaneInvoice[]> {
  const filter = status ? `?filter[status]=${status}` : '';
  const result = await apiCall<{ invoices: PennylaneInvoice[] }>(`customer_invoices${filter}`);
  return result?.invoices ?? [];
}

// ---------------------------------------------------------------------------
// Payment sync — detect payments from Pennylane
// ---------------------------------------------------------------------------

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: string[] }> {
  const paidInvoices = await getInvoices('paid');
  return { paidInvoiceIds: paidInvoices.filter(inv => inv.id).map(inv => inv.id!) };
}

// ---------------------------------------------------------------------------
// Convert Vasco invoice to Pennylane format
// ---------------------------------------------------------------------------

export function vascoToPennylaneInvoice(invoice: {
  customerName: string;
  customerId: string;
  lineItems: { description: string; quantity: number; unitPrice: number; vatRate: number; unit: string }[];
  date: string;
  dueDate?: string;
}): Partial<PennylaneInvoice> {
  return {
    date: invoice.date,
    deadline: invoice.dueDate ?? invoice.date,
    currency: 'EUR',
    customer_id: invoice.customerId,
    line_items: invoice.lineItems.map(li => ({
      label: li.description,
      quantity: li.quantity,
      unit: li.unit,
      unit_price: li.unitPrice,
      vat_rate: getTvaRate(li.vatRate),
    })),
  };
}
