// =============================================================================
// SEVDESK INTEGRATION — German cloud accounting (150K+ companies)
// =============================================================================
// REST API, strong e-invoicing (XRechnung, ZUGFeRD)
// Docs: https://api.sevdesk.de/
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_sevdesk';
const API_BASE = 'https://my.sevdesk.de/api/v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SevDeskConfig {
  apiToken: string;
}

export interface SevDeskInvoice {
  id?: number;
  invoiceNumber: string;
  contact: { id: number };
  invoiceDate: string;
  deliveryDate: string;
  status: number; // 100=draft, 200=open, 1000=paid
  taxRate: number;
  taxText: string;
  invoiceType: 'RE'; // Rechnung
  currency: 'EUR';
  showNet: boolean;
  invoicePositions: SevDeskPosition[];
}

export interface SevDeskPosition {
  name: string;
  quantity: number;
  price: number;
  taxRate: number;
  unity: { id: number }; // 1=Stück, 2=Stunde, etc.
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

async function getConfig(): Promise<SevDeskConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function saveSevDeskConfig(config: SevDeskConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.apiToken.length > 0;
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
        Authorization: config.apiToken,
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
// Invoices
// ---------------------------------------------------------------------------

export async function createInvoice(invoice: Partial<SevDeskInvoice>): Promise<number | null> {
  const result = await apiCall<{ objects: { id: number } }>('Invoice', {
    method: 'POST',
    body: JSON.stringify(invoice),
  });
  return result?.objects?.id ?? null;
}

export async function sendInvoice(invoiceId: number, email: string): Promise<boolean> {
  const result = await apiCall(`Invoice/${invoiceId}/sendViaEmail`, {
    method: 'POST',
    body: JSON.stringify({ toEmail: email, subject: 'Ihre Rechnung', text: 'Anbei erhalten Sie Ihre Rechnung.' }),
  });
  return result !== null;
}

// ---------------------------------------------------------------------------
// E-Invoice export (XRechnung / ZUGFeRD)
// ---------------------------------------------------------------------------

export async function exportAsXRechnung(invoiceId: number): Promise<string | null> {
  const result = await apiCall<{ objects: string }>(`Invoice/${invoiceId}/getXml?xmlType=XRechnung`);
  return result?.objects ?? null;
}

export async function exportAsZUGFeRD(invoiceId: number): Promise<Blob | null> {
  const config = await getConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}/Invoice/${invoiceId}/getPdf?download=true&preventSendBy=true`, {
      signal: controller.signal,
      headers: { Authorization: config.apiToken },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.blob();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}
