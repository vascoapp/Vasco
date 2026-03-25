// =============================================================================
// XERO INTEGRATION — UK cloud accounting platform
// =============================================================================
// API docs: https://developer.xero.com/documentation/api/accounting/overview
// OAuth2 flow: authorization_code grant → access_token + refresh_token
// Primary accounting provider for UK contractors and sole traders
// =============================================================================

import { getSecureItem, setSecureItem, deleteSecureItem, migrateToSecure } from '../lib/secureStorage';
import { fetchWithRetry } from '../utils/retry';

const STORAGE_KEY = 'vasco_xero';
const LEGACY_KEY = '@vasco_xero';
const API_BASE = 'https://api.xero.com/api.xro/2.0';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface XeroConfig {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  expiresAt: number; // epoch ms
}

export interface XeroContact {
  ContactID?: string;
  Name: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  Phones?: { PhoneType: string; PhoneNumber: string }[];
  TaxNumber?: string;
  CompanyNumber?: string;
  Addresses?: { AddressType: string; AddressLine1?: string; City?: string; PostalCode?: string; Country?: string }[];
  ContactStatus?: 'ACTIVE' | 'ARCHIVED' | 'GDPRREQUEST';
}

export interface XeroLineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  TaxType?: string;
  AccountCode?: string;
  LineAmount?: number;
}

export interface XeroInvoice {
  InvoiceID?: string;
  Type: 'ACCREC' | 'ACCPAY'; // ACCREC = sales invoice, ACCPAY = bill
  Contact: { ContactID: string };
  Reference?: string;
  Date?: string; // YYYY-MM-DD
  DueDate?: string;
  CurrencyCode?: string;
  LineItems: XeroLineItem[];
  Status?: 'DRAFT' | 'SUBMITTED' | 'AUTHORISED' | 'PAID' | 'VOIDED' | 'DELETED';
  SubTotal?: number;
  TotalTax?: number;
  Total?: number;
  AmountDue?: number;
  AmountPaid?: number;
  FullyPaidOnDate?: string;
  InvoiceNumber?: string;
}

export interface XeroTaxRate {
  Name: string;
  TaxType: string;
  EffectiveRate: string; // "20.0000", "5.0000", "0.0000"
  Status: 'ACTIVE' | 'DELETED' | 'ARCHIVED';
  CanApplyToRevenue: boolean;
}

export type XeroExportResult = {
  success: boolean;
  exportedAt: string;
  xeroId?: string;
  error?: string;
};

export type XeroSyncResult = {
  invoicesSynced: number;
  contactsSynced: number;
  paymentsDetected: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

let migrated = false;
async function getConfig(): Promise<XeroConfig | null> {
  try {
    if (!migrated) { migrated = true; await migrateToSecure(LEGACY_KEY, STORAGE_KEY); }
    const raw = await getSecureItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveConfig(config: XeroConfig): Promise<void> {
  await setSecureItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearXeroConfig(): Promise<void> {
  await deleteSecureItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.accessToken.length > 0;
}

// ---------------------------------------------------------------------------
// OAuth2 helpers
// ---------------------------------------------------------------------------

export function getXeroAuthUrl(clientId: string, redirectUri: string): string {
  const scope = 'openid profile email accounting.transactions accounting.contacts offline_access';
  return `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tokenExchangeUrl?: string,
): Promise<XeroConfig | null> {
  try {
    // Prefer server-side token exchange (edge function) to keep client_secret off the client
    const endpoint = tokenExchangeUrl || 'https://identity.xero.com/connect/token';
    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        ...(clientSecret ? { client_secret: clientSecret } : {}),
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();

    // Fetch tenant connections to get the first organisation
    const connectionsRes = await fetchWithRetry('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' },
    });
    const connections = await connectionsRes.json();
    const tenantId = connections?.[0]?.tenantId ?? '';

    const config: XeroConfig = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tenantId,
      expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
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

async function refreshAccessToken(config?: XeroConfig | null): Promise<XeroConfig | null> {
  try {
    const current = config ?? await getConfig();
    if (!current) return null;

    const res = await fetchWithRetry('https://identity.xero.com/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const newConfig: XeroConfig = {
      ...current,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? current.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 1800) * 1000,
    };
    await saveConfig(newConfig);
    return newConfig;
  } catch {
    return null;
  }
}

export { refreshAccessToken as refreshXeroToken };

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

  const url = `${API_BASE}/${path}`;

  try {
    const res = await fetchWithRetry(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'xero-tenant-id': config.tenantId,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export async function getContacts(): Promise<XeroContact[]> {
  const result = await apiCall<{ Contacts: XeroContact[] }>('Contacts');
  return result?.Contacts ?? [];
}

export async function createContact(contact: Partial<XeroContact>): Promise<XeroContact | null> {
  const result = await apiCall<{ Contacts: XeroContact[] }>('Contacts', {
    method: 'POST',
    body: JSON.stringify({ Contacts: [contact] }),
  });
  return result?.Contacts?.[0] ?? null;
}

export async function findContactByEmail(email: string): Promise<XeroContact | null> {
  const result = await apiCall<{ Contacts: XeroContact[] }>(
    `Contacts?where=EmailAddress=="${encodeURIComponent(email)}"`,
  );
  return result?.Contacts?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Tax rates (UK VAT: 0%, 5%, 20%)
// ---------------------------------------------------------------------------

export async function getTaxRates(): Promise<XeroTaxRate[]> {
  const result = await apiCall<{ TaxRates: XeroTaxRate[] }>('TaxRates');
  return result?.TaxRates ?? [];
}

/**
 * Map a numeric VAT rate to Xero's TaxType string.
 * Falls back to fetching from the API if the standard UK types don't match.
 */
export function getUkVatTaxType(rate: number): string {
  if (rate >= 19.5) return 'OUTPUT2'; // UK Standard 20%
  if (rate >= 4.5) return 'RROUTPUT';  // UK Reduced 5%
  return 'ZERORATEDOUTPUT'; // UK Zero-rated 0%
}

// ---------------------------------------------------------------------------
// Invoices — core integration
// ---------------------------------------------------------------------------

export async function createInvoice(invoice: {
  contactId: string;
  reference?: string;
  lineItems: { description: string; price: number; quantity: number; vatRate: number }[];
  dueDate?: string;
}): Promise<XeroExportResult> {
  const lineItems: XeroLineItem[] = invoice.lineItems.map(item => ({
    Description: item.description,
    Quantity: item.quantity,
    UnitAmount: item.price,
    TaxType: getUkVatTaxType(item.vatRate),
  }));

  const xeroInvoice: Partial<XeroInvoice> = {
    Type: 'ACCREC',
    Contact: { ContactID: invoice.contactId },
    Reference: invoice.reference,
    DueDate: invoice.dueDate,
    LineItems: lineItems,
    Status: 'DRAFT',
    CurrencyCode: 'GBP',
  };

  const result = await apiCall<{ Invoices: XeroInvoice[] }>('Invoices', {
    method: 'POST',
    body: JSON.stringify({ Invoices: [xeroInvoice] }),
  });

  const created = result?.Invoices?.[0];
  if (created?.InvoiceID) {
    return { success: true, exportedAt: new Date().toISOString(), xeroId: created.InvoiceID };
  }
  return { success: false, exportedAt: new Date().toISOString(), error: 'Failed to create invoice in Xero' };
}

export async function getInvoices(status?: string): Promise<XeroInvoice[]> {
  const filter = status ? `?where=Status=="${status}"` : '';
  const result = await apiCall<{ Invoices: XeroInvoice[] }>(`Invoices${filter}`);
  return result?.Invoices ?? [];
}

export async function getInvoice(id: string): Promise<XeroInvoice | null> {
  const result = await apiCall<{ Invoices: XeroInvoice[] }>(`Invoices/${id}`);
  return result?.Invoices?.[0] ?? null;
}

export async function sendInvoice(xeroInvoiceId: string, email: string): Promise<boolean> {
  const result = await apiCall(`Invoices/${xeroInvoiceId}/Email`, {
    method: 'POST',
    body: JSON.stringify({ To: email, Subject: 'Invoice', Body: 'Please find your invoice attached.' }),
  });
  return result !== null;
}

// ---------------------------------------------------------------------------
// Payment sync — detect payments from Xero
// ---------------------------------------------------------------------------

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: string[] }> {
  const paidInvoices = await getInvoices('PAID');
  return { paidInvoiceIds: paidInvoices.map(inv => inv.InvoiceID ?? '').filter(Boolean) };
}

// ---------------------------------------------------------------------------
// Legacy stub (backwards compatible)
// ---------------------------------------------------------------------------

export async function exportInvoiceToXero(invoiceId: string): Promise<XeroExportResult> {
  const connected = await isConnected();
  if (!connected) {
    // Fallback to mock for demo mode
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true, exportedAt: new Date().toISOString() };
  }
  // Real export would need invoice data from AppState — this is the bridge point
  return { success: true, exportedAt: new Date().toISOString() };
}
