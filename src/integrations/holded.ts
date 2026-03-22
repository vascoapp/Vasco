// =============================================================================
// HOLDED INTEGRATION — Spanish accounting platform
// =============================================================================
// API docs: https://developers.holded.com/reference
// API key auth (Bearer token from Holded settings)
// Popular with Spanish autónomos and PYMEs in construction
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_holded';
const API_BASE = 'https://api.holded.com/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HoldedConfig {
  apiKey: string; // API key from Holded settings
}

export interface HoldedContact {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  type: 'client' | 'supplier' | 'debtor' | 'creditor';
  nif?: string; // NIF/CIF — Spanish tax ID
  iae?: string; // IAE — Impuesto de Actividades Económicas code
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
  };
  tradeName?: string;
}

export interface HoldedInvoice {
  id?: string;
  contactId: string;
  contactName?: string;
  desc?: string;
  date: number; // Unix timestamp
  dueDate?: number;
  currency: string;
  items: HoldedLineItem[];
  status?: number; // 0=draft, 1=sent, 2=overdue, 3=paid, 4=cancelled
  total?: number;
  subtotal?: number;
  tax?: number;
  irpfTotal?: number;
  invoiceNum?: string;
  paidAt?: string;
}

export interface HoldedLineItem {
  name: string;
  desc?: string;
  units: number;
  subtotal: number; // Unit price excl. tax
  tax: number; // IVA percentage (e.g. 21)
  retention?: number; // IRPF withholding percentage (e.g. 15)
  discount?: number;
}

export type HoldedExportResult = {
  success: boolean;
  exportedAt: string;
  holdedId?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// IVA rates (Spain)
// ---------------------------------------------------------------------------

export const IVA_RATES = {
  GENERAL: 21, // Tipo general
  REDUCED: 10, // Tipo reducido (reformas vivienda)
  SUPER_REDUCED: 4, // Tipo superreducido
  EXEMPT: 0, // Exento
} as const;

export function getIvaRate(ratePercent: number): number {
  const rates = [0, 4, 10, 21];
  return rates.reduce((prev, curr) =>
    Math.abs(curr - ratePercent) < Math.abs(prev - ratePercent) ? curr : prev,
  );
}

// ---------------------------------------------------------------------------
// IRPF withholding rates (Spain — common for autónomos)
// ---------------------------------------------------------------------------

export const IRPF_RATES = {
  STANDARD: 15, // Standard professional withholding
  NEW_AUTONOMO: 7, // First 3 years as autónomo
  NONE: 0,
} as const;

export function getIrpfRate(ratePercent: number): number {
  const rates = [0, 7, 15];
  return rates.reduce((prev, curr) =>
    Math.abs(curr - ratePercent) < Math.abs(prev - ratePercent) ? curr : prev,
  );
}

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

async function getConfig(): Promise<HoldedConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveHoldedConfig(config: HoldedConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearHoldedConfig(): Promise<void> {
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
        key: config.apiKey,
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

export async function getContacts(): Promise<HoldedContact[]> {
  return (await apiCall<HoldedContact[]>('invoicing/v1/contacts')) ?? [];
}

export async function createContact(contact: Partial<HoldedContact>): Promise<HoldedContact | null> {
  return apiCall<HoldedContact>('invoicing/v1/contacts', {
    method: 'POST',
    body: JSON.stringify(contact),
  });
}

export async function findContactByNif(nif: string): Promise<HoldedContact | null> {
  const contacts = await getContacts();
  return contacts.find(c => c.nif === nif) ?? null;
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function createInvoice(invoice: {
  contactId: string;
  reference?: string;
  lineItems: { description: string; price: number; quantity: number; vatRate: number; irpfRate?: number }[];
  dueDate?: string;
}): Promise<HoldedExportResult> {
  const items = invoice.lineItems.map(item => ({
    name: item.description,
    units: item.quantity,
    subtotal: item.price,
    tax: getIvaRate(item.vatRate),
    retention: item.irpfRate != null ? getIrpfRate(item.irpfRate) : 0,
  }));

  const result = await apiCall<{ id: string }>('invoicing/v1/documents/invoice', {
    method: 'POST',
    body: JSON.stringify({
      contactId: invoice.contactId,
      desc: invoice.reference,
      date: Math.floor(Date.now() / 1000),
      dueDate: invoice.dueDate
        ? Math.floor(new Date(invoice.dueDate).getTime() / 1000)
        : Math.floor((Date.now() + 30 * 86400000) / 1000),
      currency: 'EUR',
      items,
    }),
  });

  if (result?.id) {
    return { success: true, exportedAt: new Date().toISOString(), holdedId: result.id };
  }
  return { success: false, exportedAt: new Date().toISOString(), error: 'Failed to create invoice' };
}

export async function getInvoices(status?: number): Promise<HoldedInvoice[]> {
  const path = status != null
    ? `invoicing/v1/documents/invoice?status=${status}`
    : 'invoicing/v1/documents/invoice';
  return (await apiCall<HoldedInvoice[]>(path)) ?? [];
}

// ---------------------------------------------------------------------------
// Payment sync — detect payments from Holded
// ---------------------------------------------------------------------------

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: string[] }> {
  const paidInvoices = await getInvoices(3); // status 3 = paid
  return { paidInvoiceIds: paidInvoices.filter(inv => inv.id).map(inv => inv.id!) };
}

// ---------------------------------------------------------------------------
// Convert Vasco invoice to Holded format
// ---------------------------------------------------------------------------

export function vascoToHoldedInvoice(invoice: {
  customerName: string;
  contactId: string;
  lineItems: { description: string; quantity: number; unitPrice: number; vatRate: number; irpfRate?: number; unit: string }[];
  date: string;
  dueDate?: string;
}): Partial<HoldedInvoice> {
  return {
    contactId: invoice.contactId,
    date: Math.floor(new Date(invoice.date).getTime() / 1000),
    dueDate: invoice.dueDate ? Math.floor(new Date(invoice.dueDate).getTime() / 1000) : undefined,
    currency: 'EUR',
    items: invoice.lineItems.map(li => ({
      name: li.description,
      units: li.quantity,
      subtotal: li.unitPrice,
      tax: getIvaRate(li.vatRate),
      retention: li.irpfRate != null ? getIrpfRate(li.irpfRate) : 0,
    })),
  };
}
