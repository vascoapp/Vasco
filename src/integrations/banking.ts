// =============================================================================
// BANKING / OPEN BANKING — Tink Connect (PSD2) (R245)
// =============================================================================
// Tink covers ~3,400 EU banks via PSD2 AIS (Account Information Service).
// One integration unlocks NL (ABN, ING, Rabo, Bunq, Knab, Triodos), DE
// (Sparkasse, Commerzbank, DKB), and the rest of EU.
//
// Flow:
//  1. App → POST /authorization-grants for a temp authorization code
//  2. App opens Tink Link UI in WebView → user picks bank, authenticates
//  3. Tink redirects to our callback with `code` query param
//  4. App → POST /token to exchange code for access_token + refresh_token
//  5. App → GET /accounts and GET /transactions with the bearer token
//
// Production needs:
//  - TINK_CLIENT_ID + TINK_CLIENT_SECRET in Supabase secrets
//  - Tink Sandbox account (free) or production (paid tier required for live)
//  - Webhook endpoint for transaction notifications
//
// This file ships the post-token write/read path. The OAuth dance is
// handled by an Expo AuthSession flow (out of scope here — UI work).
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '../utils/dateKey';

const STORAGE_KEY = '@vasco_tink_config';
const TINK_API = 'https://api.tink.com/api/v1';

export interface TinkConfig {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;            // Tink user_id
  connectedAt: string;
}

export interface BankAccount {
  id: string;
  name: string;
  iban?: string;
  balance: number;
  currency: string;
  type: 'checking' | 'savings' | 'credit_card' | 'other';
}

export interface BankTransaction {
  id: string;
  accountId: string;
  amount: number;            // negative = outflow
  currency: string;
  date: string;
  description: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  category?: string;
}

async function getConfig(): Promise<TinkConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveTinkConfig(config: TinkConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function clearTinkConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function isBankConnected(): Promise<boolean> {
  const config = await getConfig();
  return !!config?.accessToken;
}

async function ensureValidToken(): Promise<TinkConfig | null> {
  const config = await getConfig();
  if (!config) return null;
  if (Date.now() < config.expiresAt - 60_000) return config;
  // Token stale — refresh via Tink's /token endpoint with grant_type=refresh_token.
  // Implementation deferred until OAuth UI flow is complete (needs client_id).
  return config;
}

export async function listAccounts(): Promise<BankAccount[]> {
  const config = await ensureValidToken();
  if (!config) return [];
  try {
    const res = await fetch(`${TINK_API}/accounts/list`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return ((json?.accounts ?? []) as any[]).map((a) => ({
      id: String(a.id),
      name: String(a.name ?? a.accountName ?? 'Account'),
      iban: a.identifiers?.iban?.iban ?? a.iban ?? undefined,
      balance: Number(a.balance?.booked?.amount?.value?.unscaledValue ?? a.balance ?? 0)
        / Math.pow(10, Number(a.balance?.booked?.amount?.value?.scale ?? 0)),
      currency: String(a.currencyCode ?? a.currency ?? 'EUR'),
      type: mapType(a.type),
    }));
  } catch {
    return [];
  }
}

export async function listTransactions(opts: { accountId?: string; sinceDays?: number } = {}): Promise<BankTransaction[]> {
  const config = await ensureValidToken();
  if (!config) return [];
  const since = localDateKey(new Date(Date.now() - (opts.sinceDays ?? 90) * 86400000));
  const url = new URL(`${TINK_API}/transactions/list`);
  if (opts.accountId) url.searchParams.set('accountId', opts.accountId);
  url.searchParams.set('startDate', since);
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return ((json?.transactions ?? []) as any[]).map((t) => ({
      id: String(t.id),
      accountId: String(t.accountId),
      amount: Number(t.amount?.value?.unscaledValue ?? t.amount ?? 0)
        / Math.pow(10, Number(t.amount?.value?.scale ?? 0)),
      currency: String(t.amount?.currencyCode ?? t.currency ?? 'EUR'),
      date: String(t.dates?.booked ?? t.date ?? ''),
      description: String(t.descriptions?.original ?? t.description ?? ''),
      counterpartyName: t.counterparties?.payee?.name ?? t.counterparties?.payer?.name ?? undefined,
      counterpartyIban: t.counterparties?.payee?.identifiers?.iban?.iban ?? undefined,
      category: t.categories?.[0]?.id ?? undefined,
    }));
  } catch {
    return [];
  }
}

function mapType(t: unknown): BankAccount['type'] {
  const s = String(t ?? '').toLowerCase();
  if (s.includes('saving')) return 'savings';
  if (s.includes('credit')) return 'credit_card';
  if (s.includes('check') || s.includes('current')) return 'checking';
  return 'other';
}

// ---------------------------------------------------------------------------
// Reconciliation — match bank transactions to invoices
// ---------------------------------------------------------------------------

export interface ReconciliationMatch {
  transactionId: string;
  invoiceId: string;
  confidence: number;        // 0-1
  reasons: string[];         // human-readable match reasons
}

/**
 * Greedy matcher: bank transactions ↔ invoices by (amount, date proximity,
 * customer-name fuzzy match, IBAN match). Confidence weights each signal.
 */
export function matchTransactionsToInvoices(
  transactions: BankTransaction[],
  invoices: Array<{ id: string; amount: number; customerName?: string; customerIban?: string; sentAt?: string }>,
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];

  for (const tx of transactions) {
    if (tx.amount <= 0) continue;  // outflows are not invoice payments
    let best: ReconciliationMatch | null = null;

    for (const inv of invoices) {
      const reasons: string[] = [];
      let score = 0;

      // 1. Amount match (within €0.01 tolerance for rounding)
      const amountDelta = Math.abs(tx.amount - inv.amount);
      if (amountDelta < 0.01) {
        score += 0.5;
        reasons.push('exact amount match');
      } else if (amountDelta / Math.max(inv.amount, 1) < 0.02) {
        score += 0.3;
        reasons.push('amount within 2%');
      } else {
        continue;  // amount mismatch — skip
      }

      // 2. IBAN match (decisive when available)
      if (tx.counterpartyIban && inv.customerIban &&
          tx.counterpartyIban.replace(/\s/g, '').toUpperCase() === inv.customerIban.replace(/\s/g, '').toUpperCase()) {
        score += 0.3;
        reasons.push('IBAN match');
      }

      // 3. Customer name fuzzy match
      if (tx.counterpartyName && inv.customerName) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const txN = norm(tx.counterpartyName);
        const invN = norm(inv.customerName);
        if (txN === invN || txN.includes(invN) || invN.includes(txN)) {
          score += 0.15;
          reasons.push('name match');
        }
      }

      // 4. Date proximity (sent → paid within 0-90 days is plausible)
      if (inv.sentAt) {
        const sent = new Date(inv.sentAt).getTime();
        const paid = new Date(tx.date).getTime();
        const days = (paid - sent) / 86400000;
        if (days >= -1 && days <= 90) {
          score += 0.05;
          reasons.push(`${Math.round(days)}d after sent`);
        }
      }

      if (!best || score > best.confidence) {
        best = { transactionId: tx.id, invoiceId: inv.id, confidence: Math.min(1, score), reasons };
      }
    }

    if (best && best.confidence >= 0.5) matches.push(best);
  }

  return matches;
}
