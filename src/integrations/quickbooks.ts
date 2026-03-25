// =============================================================================
// QUICKBOOKS ONLINE INTEGRATION — UK/US cloud accounting platform
// =============================================================================
// API docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities
// OAuth2 flow: authorization_code grant → access_token + refresh_token
// Primary accounting provider for UK sole traders and US contractors
// =============================================================================

import { getSecureItem, setSecureItem, deleteSecureItem, migrateToSecure } from '../lib/secureStorage';
import { fetchWithRetry } from '../utils/retry';

const STORAGE_KEY = 'vasco_quickbooks';
const LEGACY_KEY = '@vasco_quickbooks';
const API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickBooksConfig {
  accessToken: string;
  refreshToken: string;
  realmId: string; // QBO company ID
  expiresAt: number; // epoch ms
}

export interface QBCustomer {
  Id?: string;
  DisplayName: string;
  GivenName?: string;
  FamilyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  CompanyName?: string;
  BillAddr?: {
    Line1?: string;
    City?: string;
    PostalCode?: string;
    Country?: string;
    CountrySubDivisionCode?: string;
  };
  Active?: boolean;
  Balance?: number;
}

export interface QBLineItem {
  Amount: number;
  Description?: string;
  DetailType: 'SalesItemLineDetail';
  SalesItemLineDetail: {
    Qty?: number;
    UnitPrice?: number;
    TaxCodeRef?: { value: string };
    ItemRef?: { value: string; name?: string };
  };
}

export interface QBInvoice {
  Id?: string;
  DocNumber?: string;
  TxnDate?: string; // YYYY-MM-DD
  DueDate?: string;
  CurrencyRef?: { value: string; name?: string };
  CustomerRef: { value: string; name?: string };
  Line: QBLineItem[];
  TxnTaxDetail?: {
    TotalTax?: number;
    TaxLine?: { Amount: number; DetailType: string; TaxLineDetail: { TaxRateRef: { value: string }; PercentBased: boolean; TaxPercent: number; NetAmountTaxable: number } }[];
  };
  TotalAmt?: number;
  Balance?: number;
  EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent';
  PrintStatus?: 'NotSet' | 'NeedToPrint' | 'PrintComplete';
  MetaData?: { CreateTime: string; LastUpdatedTime: string };
}

export interface QBPayment {
  Id?: string;
  TotalAmt: number;
  TxnDate?: string;
  CustomerRef: { value: string };
  Line?: { Amount: number; LinkedTxn: { TxnId: string; TxnType: string }[] }[];
}

export type QBExportResult = {
  success: boolean;
  exportedAt: string;
  quickbooksId?: string;
  error?: string;
};

export type QBSyncResult = {
  invoicesSynced: number;
  customersSynced: number;
  paymentsDetected: number;
  errors: string[];
};

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

let migrated = false;
async function getConfig(): Promise<QuickBooksConfig | null> {
  try {
    if (!migrated) { migrated = true; await migrateToSecure(LEGACY_KEY, STORAGE_KEY); }
    const raw = await getSecureItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveConfig(config: QuickBooksConfig): Promise<void> {
  await setSecureItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearQuickBooksConfig(): Promise<void> {
  await deleteSecureItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.accessToken.length > 0;
}

// ---------------------------------------------------------------------------
// OAuth2 helpers
// ---------------------------------------------------------------------------

export function getQuickBooksAuthUrl(clientId: string, redirectUri: string): string {
  const scope = 'com.intuit.quickbooks.accounting';
  return `https://appcenter.intuit.com/connect/oauth2?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=vasco`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  realmId: string,
  tokenExchangeUrl?: string,
): Promise<QuickBooksConfig | null> {
  try {
    // Prefer server-side token exchange (edge function) to keep client_secret off the client
    const endpoint = tokenExchangeUrl || 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

    // QuickBooks requires Basic auth header with client_id:client_secret
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const config: QuickBooksConfig = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      realmId,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
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

async function refreshAccessToken(config?: QuickBooksConfig | null): Promise<QuickBooksConfig | null> {
  try {
    const current = config ?? await getConfig();
    if (!current) return null;

    const res = await fetchWithRetry('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const newConfig: QuickBooksConfig = {
      ...current,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? current.refreshToken,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    await saveConfig(newConfig);
    return newConfig;
  } catch {
    return null;
  }
}

export { refreshAccessToken as refreshQuickBooksToken };

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

  // QBO API: https://quickbooks.api.intuit.com/v3/company/{realmId}/{resource}
  const url = `${API_BASE}/${config.realmId}/${path}`;

  try {
    const res = await fetchWithRetry(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
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
// Customers
// ---------------------------------------------------------------------------

export async function getCustomers(): Promise<QBCustomer[]> {
  const result = await apiCall<{ QueryResponse: { Customer?: QBCustomer[] } }>(
    'query?query=' + encodeURIComponent("SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000"),
  );
  return result?.QueryResponse?.Customer ?? [];
}

export async function createCustomer(customer: Partial<QBCustomer>): Promise<QBCustomer | null> {
  const result = await apiCall<{ Customer: QBCustomer }>('customer', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
  return result?.Customer ?? null;
}

export async function findCustomerByName(name: string): Promise<QBCustomer | null> {
  const result = await apiCall<{ QueryResponse: { Customer?: QBCustomer[] } }>(
    'query?query=' + encodeURIComponent(`SELECT * FROM Customer WHERE DisplayName = '${name.replace(/'/g, "\\'")}'`),
  );
  return result?.QueryResponse?.Customer?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Tax — UK VAT via TaxCodeRef
// ---------------------------------------------------------------------------

/**
 * Map a numeric VAT rate to QuickBooks TaxCodeRef value.
 * QBO UK uses tax codes: 20 = Standard (20%), 5 = Reduced (5%), 0 = Zero-rated, NON = Non-taxable
 * These are the default QBO UK tax code IDs — may vary per company.
 */
export function getUkVatTaxCode(rate: number): string {
  if (rate >= 19.5) return '20'; // UK Standard 20%
  if (rate >= 4.5) return '5';   // UK Reduced 5%
  if (rate > 0) return '5';      // Reduced fallback
  return 'NON';                   // Zero-rated / exempt
}

/**
 * Map a numeric US sales tax rate to TaxCodeRef.
 * US QuickBooks uses TAX / NON for taxable / non-taxable.
 */
export function getUsTaxCode(rate: number): string {
  return rate > 0 ? 'TAX' : 'NON';
}

// ---------------------------------------------------------------------------
// Invoices — core integration
// ---------------------------------------------------------------------------

export async function createInvoice(invoice: {
  customerId: string;
  reference?: string;
  lineItems: { description: string; price: number; quantity: number; vatRate: number }[];
  dueDate?: string;
  currency?: string;
}): Promise<QBExportResult> {
  const lines: QBLineItem[] = invoice.lineItems.map(item => ({
    Amount: item.price * item.quantity,
    Description: item.description,
    DetailType: 'SalesItemLineDetail' as const,
    SalesItemLineDetail: {
      Qty: item.quantity,
      UnitPrice: item.price,
      TaxCodeRef: { value: getUkVatTaxCode(item.vatRate) },
    },
  }));

  const qbInvoice: Partial<QBInvoice> = {
    CustomerRef: { value: invoice.customerId },
    DocNumber: invoice.reference,
    DueDate: invoice.dueDate,
    TxnDate: new Date().toISOString().split('T')[0],
    Line: lines,
    CurrencyRef: { value: invoice.currency ?? 'GBP' },
  };

  const result = await apiCall<{ Invoice: QBInvoice }>('invoice', {
    method: 'POST',
    body: JSON.stringify(qbInvoice),
  });

  const created = result?.Invoice;
  if (created?.Id) {
    return { success: true, exportedAt: new Date().toISOString(), quickbooksId: created.Id };
  }
  return { success: false, exportedAt: new Date().toISOString(), error: 'Failed to create invoice in QuickBooks' };
}

export async function getInvoices(status?: string): Promise<QBInvoice[]> {
  let query = 'SELECT * FROM Invoice';
  if (status) {
    // QBO doesn't have a direct Status field like Xero — filter by Balance
    // Paid = Balance = 0, Unpaid = Balance > 0
    if (status === 'PAID') {
      query += ' WHERE Balance = \'0\'';
    } else if (status === 'UNPAID') {
      query += ' WHERE Balance > \'0\'';
    }
  }
  query += ' MAXRESULTS 1000';

  const result = await apiCall<{ QueryResponse: { Invoice?: QBInvoice[] } }>(
    'query?query=' + encodeURIComponent(query),
  );
  return result?.QueryResponse?.Invoice ?? [];
}

export async function getInvoice(id: string): Promise<QBInvoice | null> {
  const result = await apiCall<{ Invoice: QBInvoice }>(`invoice/${id}`);
  return result?.Invoice ?? null;
}

export async function sendInvoice(invoiceId: string, email: string): Promise<boolean> {
  const result = await apiCall(`invoice/${invoiceId}/send?sendTo=${encodeURIComponent(email)}`, {
    method: 'POST',
  });
  return result !== null;
}

// ---------------------------------------------------------------------------
// Payment sync — detect payments linked to invoices
// ---------------------------------------------------------------------------

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: string[] }> {
  // Query payments and extract linked invoice IDs
  const result = await apiCall<{ QueryResponse: { Payment?: QBPayment[] } }>(
    'query?query=' + encodeURIComponent('SELECT * FROM Payment MAXRESULTS 1000'),
  );

  const payments = result?.QueryResponse?.Payment ?? [];
  const paidInvoiceIds: string[] = [];

  for (const payment of payments) {
    if (payment.Line) {
      for (const line of payment.Line) {
        if (line.LinkedTxn) {
          for (const txn of line.LinkedTxn) {
            if (txn.TxnType === 'Invoice' && txn.TxnId) {
              paidInvoiceIds.push(txn.TxnId);
            }
          }
        }
      }
    }
  }

  return { paidInvoiceIds: [...new Set(paidInvoiceIds)] };
}

// ---------------------------------------------------------------------------
// Legacy stub (backwards compatible)
// ---------------------------------------------------------------------------

export async function exportInvoiceToQuickBooks(invoiceId: string): Promise<QBExportResult> {
  const connected = await isConnected();
  if (!connected) {
    // Fallback to mock for demo mode
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { success: true, exportedAt: new Date().toISOString() };
  }
  // Real export would need invoice data from AppState — this is the bridge point
  return { success: true, exportedAt: new Date().toISOString() };
}
