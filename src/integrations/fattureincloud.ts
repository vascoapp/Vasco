// =============================================================================
// FATTURE IN CLOUD INTEGRATION — Italian accounting platform
// =============================================================================
// API docs: https://developers.fattureincloud.it/
// OAuth2 flow: authorization_code grant → access_token + refresh_token
// #1 e-invoicing platform in Italy, mandatory SDI integration
// =============================================================================

import { todayKey } from '../utils/dateKey';
import { getSecureItem, setSecureItem, deleteSecureItem, migrateToSecure } from '../lib/secureStorage';

const STORAGE_KEY = 'vasco_fattureincloud';
const LEGACY_KEY = '@vasco_fattureincloud';
const API_BASE = 'https://api-v2.fattureincloud.it';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FattureInCloudConfig {
  accessToken: string;
  refreshToken: string;
  companyId: string;
  expiresAt: number; // epoch ms
}

export interface FattureInCloudClient {
  id?: number;
  code?: string;
  name: string;
  type: 'company' | 'person';
  first_name?: string;
  last_name?: string;
  contact_person?: string;
  vat_number?: string; // Partita IVA (11 digits)
  tax_code?: string; // Codice fiscale (16 chars)
  email?: string;
  phone?: string;
  certified_email?: string; // PEC — Posta Elettronica Certificata
  ei_code?: string; // Codice destinatario SDI (7 chars)
  address_street?: string;
  address_postal_code?: string;
  address_city?: string;
  address_province?: string;
  address_country?: string;
}

export interface FattureInCloudIssuedDocument {
  id?: number;
  type: FattureInCloudDocumentType;
  entity: { id: number; name: string };
  date: string; // YYYY-MM-DD
  number?: number;
  numeration?: string;
  currency: { id: string; exchange_rate?: string };
  items_list: FattureInCloudLineItem[];
  payment_method?: { id: number; name?: string };
  ei_data?: FattureInCloudEiData; // SDI e-invoicing data
  stamp_duty?: number; // Marca da bollo (€2.00 when applicable)
  amount_net?: number;
  amount_vat?: number;
  amount_gross?: number;
  status?: 'not_sent' | 'sent' | 'accepted' | 'rejected' | 'paid';
  paid_at?: string;
  url?: string;
}

export type FattureInCloudDocumentType =
  | 'invoice' // Fattura
  | 'credit_note' // Nota di credito
  | 'receipt' // Ricevuta
  | 'proforma' // Proforma
  | 'delivery_note'; // DDT

export interface FattureInCloudLineItem {
  product_id?: number;
  code?: string;
  name: string;
  description?: string;
  qty: number;
  measure?: string;
  net_price: number; // Unit price excl. IVA
  vat: { id: number; value: number; description?: string };
  discount?: number;
  not_taxable?: boolean;
}

export interface FattureInCloudEiData {
  vat_kind?: 'N1' | 'N2' | 'N2.1' | 'N2.2' | 'N3' | 'N4' | 'N5' | 'N6' | 'N7';
  original_document_type?: 'FPA12' | 'FPR12'; // FPA12 = PA, FPR12 = private
  od_number?: string;
  od_date?: string;
  cig?: string; // Codice Identificativo Gara
  cup?: string; // Codice Unico di Progetto
  payment_method?: string;
}

export type FattureInCloudExportResult = {
  success: boolean;
  exportedAt: string;
  fattureInCloudId?: number;
  error?: string;
};

// ---------------------------------------------------------------------------
// IVA rates (Italy)
// ---------------------------------------------------------------------------

export const IVA_RATES = {
  STANDARD: 22, // Aliquota ordinaria
  REDUCED: 10, // Aliquota ridotta (ristrutturazioni)
  SUPER_REDUCED: 5, // Aliquota super ridotta
  MINIMUM: 4, // Aliquota minima (prima casa)
  EXEMPT: 0, // Esente
} as const;

export function getIvaRate(ratePercent: number): number {
  const rates = [0, 4, 5, 10, 22];
  return rates.reduce((prev, curr) =>
    Math.abs(curr - ratePercent) < Math.abs(prev - ratePercent) ? curr : prev,
  );
}

// ---------------------------------------------------------------------------
// SDI document type helper
// ---------------------------------------------------------------------------

export function getSdiDocumentType(isPublicAdministration: boolean): 'FPA12' | 'FPR12' {
  return isPublicAdministration ? 'FPA12' : 'FPR12';
}

// ---------------------------------------------------------------------------
// Marca da bollo — required for invoices > €77.47 with IVA-exempt items
// ---------------------------------------------------------------------------

export function requiresMarcaDaBollo(items: { netPrice: number; vatRate: number }[]): boolean {
  const exemptTotal = items
    .filter(i => i.vatRate === 0)
    .reduce((sum, i) => sum + i.netPrice, 0);
  return exemptTotal > 77.47;
}

export const MARCA_DA_BOLLO_AMOUNT = 2.0;

// ---------------------------------------------------------------------------
// Config persistence
// ---------------------------------------------------------------------------

async function getConfig(): Promise<FattureInCloudConfig | null> {
  try {
    await migrateToSecure(LEGACY_KEY, STORAGE_KEY);
    const raw = await getSecureItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function saveConfig(config: FattureInCloudConfig): Promise<void> {
  await setSecureItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearFattureInCloudConfig(): Promise<void> {
  await deleteSecureItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return config !== null && config.accessToken.length > 0;
}

// ---------------------------------------------------------------------------
// OAuth2 helpers
// ---------------------------------------------------------------------------

export function getFattureInCloudAuthUrl(clientId: string, redirectUri: string): string {
  return `https://api-v2.fattureincloud.it/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=entity.clients:r+entity.clients:a+issued_documents.invoices:r+issued_documents.invoices:a`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  tokenExchangeUrl?: string,
): Promise<FattureInCloudConfig | null> {
  try {
    // Prefer server-side token exchange (edge function) to keep client_secret off the client
    const endpoint = tokenExchangeUrl || 'https://api-v2.fattureincloud.it/oauth/token';
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

    // Fetch companies to get the default one
    const companiesRes = await fetch(`${API_BASE}/user/companies`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const companiesData = await companiesRes.json();
    const companyId = companiesData?.data?.companies?.[0]?.id?.toString() ?? '';

    const config: FattureInCloudConfig = {
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

async function refreshAccessToken(config: FattureInCloudConfig): Promise<FattureInCloudConfig | null> {
  try {
    const res = await fetch('https://api-v2.fattureincloud.it/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const newConfig: FattureInCloudConfig = {
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
    const res = await fetch(`${API_BASE}/c/${config.companyId}/${path}`, {
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
// Clients (Anagrafica clienti)
// ---------------------------------------------------------------------------

export async function getClients(): Promise<FattureInCloudClient[]> {
  const result = await apiCall<{ data: FattureInCloudClient[] }>('entities/clients');
  return result?.data ?? [];
}

export async function createClient(client: Partial<FattureInCloudClient>): Promise<FattureInCloudClient | null> {
  const result = await apiCall<{ data: FattureInCloudClient }>('entities/clients', {
    method: 'POST',
    body: JSON.stringify({ data: client }),
  });
  return result?.data ?? null;
}

export async function findClientByVatNumber(vatNumber: string): Promise<FattureInCloudClient | null> {
  const clients = await getClients();
  return clients.find(c => c.vat_number === vatNumber) ?? null;
}

// ---------------------------------------------------------------------------
// Issued documents (Documenti emessi — fatture)
// ---------------------------------------------------------------------------

export async function createIssuedDocument(invoice: {
  clientId: number;
  reference?: string;
  lineItems: { description: string; price: number; quantity: number; vatRate: number; measure?: string }[];
  dueDate?: string;
  isPublicAdministration?: boolean;
  eiCode?: string;
  pec?: string;
}): Promise<FattureInCloudExportResult> {
  const items_list: FattureInCloudLineItem[] = invoice.lineItems.map(item => ({
    name: item.description,
    qty: item.quantity,
    measure: item.measure ?? 'pz',
    net_price: item.price,
    vat: { id: 0, value: getIvaRate(item.vatRate) },
  }));

  // Check marca da bollo
  const needsBollo = requiresMarcaDaBollo(
    invoice.lineItems.map(li => ({ netPrice: li.price * li.quantity, vatRate: li.vatRate })),
  );

  const eiData: FattureInCloudEiData | undefined = invoice.isPublicAdministration != null
    ? { original_document_type: getSdiDocumentType(invoice.isPublicAdministration ?? false) }
    : undefined;

  const result = await apiCall<{ data: FattureInCloudIssuedDocument }>('issued_documents', {
    method: 'POST',
    body: JSON.stringify({
      data: {
        type: 'invoice',
        entity: { id: invoice.clientId },
        date: todayKey(),
        currency: { id: 'EUR' },
        items_list,
        stamp_duty: needsBollo ? MARCA_DA_BOLLO_AMOUNT : undefined,
        ei_data: eiData,
      },
    }),
  });

  if (result?.data?.id) {
    return { success: true, exportedAt: new Date().toISOString(), fattureInCloudId: result.data.id };
  }
  return { success: false, exportedAt: new Date().toISOString(), error: 'Failed to create invoice' };
}

export async function getIssuedDocuments(type: FattureInCloudDocumentType = 'invoice'): Promise<FattureInCloudIssuedDocument[]> {
  const result = await apiCall<{ data: FattureInCloudIssuedDocument[] }>(`issued_documents?type=${type}`);
  return result?.data ?? [];
}

// ---------------------------------------------------------------------------
// Payment sync — detect payments from Fatture in Cloud
// ---------------------------------------------------------------------------

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: number[] }> {
  const invoices = await getIssuedDocuments('invoice');
  return {
    paidInvoiceIds: invoices
      .filter(inv => inv.status === 'paid' && inv.id != null)
      .map(inv => inv.id!),
  };
}

// ---------------------------------------------------------------------------
// Convert Vasco invoice to Fatture in Cloud format
// ---------------------------------------------------------------------------

export function vascoToFattureInCloudDocument(invoice: {
  customerName: string;
  clientId: number;
  lineItems: { description: string; quantity: number; unitPrice: number; vatRate: number; unit: string }[];
  date: string;
  dueDate?: string;
  isPublicAdministration?: boolean;
}): Partial<FattureInCloudIssuedDocument> {
  const items_list: FattureInCloudLineItem[] = invoice.lineItems.map(li => ({
    name: li.description,
    qty: li.quantity,
    measure: li.unit,
    net_price: li.unitPrice,
    vat: { id: 0, value: getIvaRate(li.vatRate) },
  }));

  const needsBollo = requiresMarcaDaBollo(
    invoice.lineItems.map(li => ({ netPrice: li.unitPrice * li.quantity, vatRate: li.vatRate })),
  );

  return {
    type: 'invoice',
    entity: { id: invoice.clientId, name: invoice.customerName },
    date: invoice.date,
    currency: { id: 'EUR' },
    items_list,
    stamp_duty: needsBollo ? MARCA_DA_BOLLO_AMOUNT : undefined,
    ei_data: invoice.isPublicAdministration != null
      ? { original_document_type: getSdiDocumentType(invoice.isPublicAdministration) }
      : undefined,
  };
}
