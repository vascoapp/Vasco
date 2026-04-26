// =============================================================================
// EXACT ONLINE INTEGRATION (R244)
// =============================================================================
// Exact Online — large NL accounting platform (also DE/BE/UK/FR).
// OAuth 2.0 + REST API at start.exactonline.nl.
// Docs: https://start.exactonline.nl/docs/
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_exact_config';
const API_BASE = 'https://start.exactonline.nl/api/v1';
const AUTH_URL = 'https://start.exactonline.nl/api/oauth2/auth';
const TOKEN_URL = 'https://start.exactonline.nl/api/oauth2/token';

export interface ExactConfig {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  division: number;            // Exact "administration" id — required on every call
  connectedAt: string;
}

async function getConfig(): Promise<ExactConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveExactConfig(config: ExactConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearExactConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return !!config?.accessToken && !!config?.division;
}

export function getExactAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    force_login: '1',
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(opts: {
  code: string; clientId: string; clientSecret: string; redirectUri: string;
}): Promise<ExactConfig | null> {
  try {
    const body = new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    });
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.access_token) return null;
    // Exact returns the active division in the access_token's claims via a
    // separate /current/Me call — fetch it to seed config.
    const meRes = await fetch(`${API_BASE}/current/Me`, {
      headers: { Authorization: `Bearer ${json.access_token}`, Accept: 'application/json' },
    });
    let division = 0;
    if (meRes.ok) {
      const me = await meRes.json();
      division = Number(me?.d?.results?.[0]?.CurrentDivision) || 0;
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + (Number(json.expires_in) || 600) * 1000,
      division,
      connectedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function ensureValidToken(): Promise<ExactConfig | null> {
  const config = await getConfig();
  if (!config) return null;
  if (Date.now() < config.expiresAt - 60_000) return config;
  // Token is stale; caller's responsibility to refresh via OAuth flow.
  return config;
}

interface InvoiceInput {
  customerExternalId: string;        // Exact "Account" GUID
  reference?: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
}

export async function createInvoice(input: InvoiceInput): Promise<{ success: boolean; exactId?: string; error?: string }> {
  const config = await ensureValidToken();
  if (!config) return { success: false, error: 'Not connected to Exact Online' };

  const lines = input.lineItems.map((li, idx) => ({
    LineNumber: idx + 1,
    Quantity: li.quantity,
    UnitPrice: li.unitPrice,
    Description: li.description,
    VATPercentage: li.vatRate,
  }));

  try {
    const res = await fetch(`${API_BASE}/${config.division}/salesinvoice/SalesInvoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        InvoiceTo: input.customerExternalId,
        OrderedBy: input.customerExternalId,
        InvoiceDate: input.invoiceDate,
        PaymentReference: input.reference,
        SalesInvoiceLines: lines,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Exact API ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = await res.json();
    const id = json?.d?.InvoiceID ?? json?.d?.results?.[0]?.InvoiceID;
    return id ? { success: true, exactId: String(id) } : { success: false, error: 'no InvoiceID returned' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: string[] }> {
  const config = await ensureValidToken();
  if (!config) return { paidInvoiceIds: [] };

  try {
    const res = await fetch(
      `${API_BASE}/${config.division}/salesinvoice/SalesInvoices?$filter=Status eq 50&$select=InvoiceID`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: 'application/json',
        },
      },
    );
    if (!res.ok) return { paidInvoiceIds: [] };
    const json = await res.json();
    const rows = (json?.d?.results ?? []) as Array<{ InvoiceID?: string }>;
    return { paidInvoiceIds: rows.map((r) => String(r.InvoiceID ?? '')).filter(Boolean) };
  } catch {
    return { paidInvoiceIds: [] };
  }
}
