// =============================================================================
// E-BOEKHOUDEN INTEGRATION (R244)
// =============================================================================
// e-Boekhouden — popular NL accounting platform for ZZP'ers and small teams.
// REST API at api.e-boekhouden.nl. Auth: API token + securityCode.
// Docs: https://www.e-boekhouden.nl/api
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@vasco_eboekhouden_config';
const API_BASE = 'https://api.e-boekhouden.nl/v1';

export interface EBoekhoudenConfig {
  accessToken: string;        // session token from POST /session
  apiToken: string;           // long-lived API token
  expiresAt: number;          // session token expires after ~10 min idle
  connectedAt: string;
}

async function getConfig(): Promise<EBoekhoudenConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveEBoekhoudenConfig(config: EBoekhoudenConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearEBoekhoudenConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function isConnected(): Promise<boolean> {
  const config = await getConfig();
  return !!config?.accessToken;
}

export async function startSession(opts: {
  apiToken: string;
  source: string;
}): Promise<EBoekhoudenConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: opts.apiToken, source: opts.source }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.token) return null;
    return {
      accessToken: json.token,
      apiToken: opts.apiToken,
      // Session is idle-expiry; refresh on use, treat 8 min as safe TTL.
      expiresAt: Date.now() + 8 * 60_000,
      connectedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function ensureValidSession(): Promise<EBoekhoudenConfig | null> {
  const config = await getConfig();
  if (!config) return null;
  if (Date.now() < config.expiresAt) return config;
  // Stale — re-open session with the long-lived API token.
  const refreshed = await startSession({ apiToken: config.apiToken, source: 'vasco' });
  if (refreshed) await saveEBoekhoudenConfig(refreshed);
  return refreshed;
}

interface InvoiceInput {
  customerExternalId: string;          // e-Boekhouden relation_id
  reference?: string;
  invoiceDate: string;                  // YYYY-MM-DD
  dueDate: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
}

export async function createInvoice(input: InvoiceInput): Promise<{ success: boolean; eboekhoudenId?: string; error?: string }> {
  const config = await ensureValidSession();
  if (!config) return { success: false, error: 'Not connected to e-Boekhouden' };

  const lines = input.lineItems.map((li) => ({
    quantity: li.quantity,
    description: li.description,
    unitPrice: li.unitPrice,
    vatPercentage: li.vatRate,
    accountId: null,                   // optional grootboek mapping
  }));

  try {
    const res = await fetch(`${API_BASE}/invoice`, {
      method: 'POST',
      headers: {
        Authorization: config.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: input.invoiceDate,
        dueDate: input.dueDate,
        relationId: input.customerExternalId,
        reference: input.reference,
        invoiceLines: lines,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `e-Boekhouden ${res.status}: ${text.slice(0, 200)}` };
    }
    const json = await res.json();
    const id = json?.id ?? json?.invoiceId;
    return id ? { success: true, eboekhoudenId: String(id) } : { success: false, error: 'no invoiceId returned' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function syncPaymentStatus(): Promise<{ paidInvoiceIds: string[] }> {
  const config = await ensureValidSession();
  if (!config) return { paidInvoiceIds: [] };

  try {
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const res = await fetch(`${API_BASE}/invoice?dateFrom=${since}&onlyPaid=true`, {
      headers: { Authorization: config.accessToken, Accept: 'application/json' },
    });
    if (!res.ok) return { paidInvoiceIds: [] };
    const json = await res.json();
    const rows = (json?.items ?? json?.invoices ?? []) as Array<{ id?: string | number }>;
    return { paidInvoiceIds: rows.map((r) => String(r.id ?? '')).filter(Boolean) };
  } catch {
    return { paidInvoiceIds: [] };
  }
}
