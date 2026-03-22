// =============================================================================
// LEXOFFICE INTEGRATION — Popular German SME accounting
// =============================================================================
// REST API, 50K+ users, 120+ add-ons
// Docs: https://developers.lexoffice.io/docs/
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_lexoffice';
const API_BASE = 'https://api.lexoffice.io/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LexofficeConfig {
  apiKey: string; // API key from lexoffice settings
}

export interface LexofficeContact {
  id?: string;
  version?: number;
  roles: { customer?: { number?: number } };
  company?: { name: string; taxNumber?: string; vatRegistrationId?: string };
  person?: { firstName: string; lastName: string };
  addresses?: { billing?: Array<{ street?: string; zip?: string; city?: string; countryCode?: string }> };
  emailAddresses?: { business?: string[] };
  phoneNumbers?: { business?: string[] };
}

export interface LexofficeInvoice {
  id?: string;
  voucherDate: string;
  address: { name: string; street?: string; zip?: string; city?: string; countryCode?: string };
  lineItems: LexofficeLineItem[];
  totalPrice: { totalNetAmount: number; totalGrossAmount: number; totalTaxAmount: number; currency: string };
  taxConditions: { taxType: 'net' | 'gross' };
  paymentConditions?: { paymentTermLabel: string; paymentTermDuration: number };
  shippingConditions?: { shippingDate: string; shippingType: 'delivery' | 'service' };
}

export interface LexofficeLineItem {
  type: 'custom' | 'text';
  name: string;
  description?: string;
  quantity: number;
  unitName: string;
  unitPrice: { currency: string; netAmount: number; taxRatePercentage: number };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

async function getConfig(): Promise<LexofficeConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveLexofficeConfig(config: LexofficeConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearLexofficeConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
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
    const res = await fetch(`${API_BASE}/${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
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

export async function getContacts(page = 0): Promise<LexofficeContact[]> {
  const result = await apiCall<{ content: LexofficeContact[] }>(`contacts?page=${page}&size=100`);
  return result?.content ?? [];
}

export async function createContact(contact: LexofficeContact): Promise<string | null> {
  const result = await apiCall<{ id: string }>('contacts', {
    method: 'POST',
    body: JSON.stringify(contact),
  });
  return result?.id ?? null;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function createInvoice(invoice: LexofficeInvoice): Promise<string | null> {
  const result = await apiCall<{ id: string }>('invoices', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });
  return result?.id ?? null;
}

export async function finalizeInvoice(invoiceId: string): Promise<boolean> {
  const result = await apiCall(`invoices/${invoiceId}/document`, { method: 'GET' });
  return result !== null;
}

// ---------------------------------------------------------------------------
// Convert Vasco invoice to Lexoffice format
// ---------------------------------------------------------------------------

export function vascoToLexofficeInvoice(invoice: {
  customerName: string;
  lineItems: { description: string; quantity: number; unitPrice: number; vatRate: number; unit: string }[];
  date: string;
  dueDate?: string;
}): LexofficeInvoice {
  return {
    voucherDate: invoice.date,
    address: { name: invoice.customerName, countryCode: 'DE' },
    lineItems: invoice.lineItems.map(li => ({
      type: 'custom' as const,
      name: li.description,
      quantity: li.quantity,
      unitName: li.unit,
      unitPrice: {
        currency: 'EUR',
        netAmount: li.unitPrice,
        taxRatePercentage: li.vatRate,
      },
    })),
    totalPrice: {
      totalNetAmount: invoice.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0),
      totalGrossAmount: invoice.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity * (1 + li.vatRate / 100), 0),
      totalTaxAmount: invoice.lineItems.reduce((s, li) => s + li.unitPrice * li.quantity * (li.vatRate / 100), 0),
      currency: 'EUR',
    },
    taxConditions: { taxType: 'net' },
    paymentConditions: {
      paymentTermLabel: 'Zahlbar innerhalb von 14 Tagen',
      paymentTermDuration: 14,
    },
  };
}
