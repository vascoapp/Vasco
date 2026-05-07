// =============================================================================
// CUSTOMER QUOTE ACCEPTANCE — Digital approval link for customers
// =============================================================================
// Contractor shares quote with approval URL → customer taps → quote accepted →
// job auto-created. No phone calls needed.
//
// R66 round 20: BE primary (`quote_acceptance_links` table from R19 migration
// 20260507000006), AsyncStorage as offline cache for the contractor side. The
// customer's tap on the URL hits BE via dataProvider.getAcceptanceLinkByToken
// (anon SELECT under qal_select_by_token RLS). Status flips through the
// dataProvider.decideAcceptanceLink path (qal_anon_decide RLS, pending →
// accepted/rejected one-shot forward transition).
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import i18n from '../i18n/i18n';
import { MS_PER_DAY } from '../utils/timeConstants';
import { isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import {
  createAcceptanceLink as dbCreateAcceptanceLink,
  getAcceptanceLinkByToken,
  decideAcceptanceLink,
} from '../lib/dataProvider';

const ACCEPTANCE_KEY = '@vasco_quote_acceptance_links';

/** Base URL for customer-facing approval links. Override for staging/custom domains. */
const APPROVAL_BASE_URL = 'https://app.vasco.dev';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcceptanceLink {
  token: string;
  quoteId: string;
  customerId?: string;
  customerName?: string;
  quoteAmount: number;
  quoteDescription?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: string;
  respondedAt?: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

// R66 round 20: bumped entropy from 12 chars × 55-char alphabet (~67 bits)
// to 32 hex chars (128 bits) — capability-URL bearer credentials need
// brute-force resistance even when the BE rate limit is bypassed (e.g.
// distributed scanning). 128 bits is the floor for capability tokens.
function generateToken(): string {
  let token = '';
  for (let i = 0; i < 32; i += 1) {
    token += Math.floor(Math.random() * 16).toString(16);
  }
  return token;
}

// FE AcceptanceLink ↔ BE QuoteAcceptanceLinkRow mapper.
function rowToLink(row: import('../lib/database.types').QuoteAcceptanceLinkRow): AcceptanceLink {
  return {
    token: row.token,
    quoteId: row.quote_id,
    customerId: row.customer_id ?? undefined,
    customerName: row.customer_name ?? undefined,
    quoteAmount: Number(row.quote_amount),
    quoteDescription: row.quote_description ?? undefined,
    status: row.status as AcceptanceLink['status'],
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? undefined,
    expiresAt: row.expires_at,
  };
}

// ---------------------------------------------------------------------------
// Create acceptance link
// ---------------------------------------------------------------------------

export async function createAcceptanceLink(quote: {
  id: string;
  customer?: string;
  customerName?: string;
  amount: number;
  description?: string;
  validDays?: number;
}): Promise<{ token: string; url: string; link: AcceptanceLink }> {
  const token = generateToken();
  const validDays = quote.validDays ?? 30;
  const expiresAt = new Date(Date.now() + validDays * MS_PER_DAY).toISOString();
  const createdAt = new Date().toISOString();

  // R66 round 18 pattern: customer arg is sometimes a FE display string
  // ("Klant"). customer_id is a uuid FK. Null out non-uuids.
  const isUuid = (v: unknown): v is string =>
    typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  let link: AcceptanceLink = {
    token,
    quoteId: quote.id,
    customerId: quote.customer,
    customerName: quote.customerName,
    quoteAmount: quote.amount,
    quoteDescription: quote.description,
    status: 'pending',
    createdAt,
    expiresAt,
  };

  // R66 round 20: BE-primary write. AsyncStorage stays as a contractor-side
  // cache for offline status checks. If BE write fails (offline contractor),
  // the link still gets shared — but the customer's tap will hit BE and
  // resolve correctly once the contractor reconnects and the offline queue
  // drains the insert.
  if (isSupabaseConfigured) {
    try {
      const row = await dbCreateAcceptanceLink({
        token,
        quote_id: quote.id,
        customer_id: isUuid(quote.customer) ? quote.customer : null,
        customer_name: quote.customerName ?? null,
        quote_amount: quote.amount,
        quote_description: quote.description ?? null,
        expires_at: expiresAt,
      });
      link = rowToLink(row);
    } catch (err) {
      logWarn('customerQuoteAcceptance', `BE create failed, queueing: ${err}`);
      try {
        const { queueWrite } = await import('./offlineWriteQueue');
        await queueWrite({
          table: 'quote_acceptance_links',
          op: 'insert',
          payload: {
            token,
            quote_id: quote.id,
            customer_id: isUuid(quote.customer) ? quote.customer : null,
            customer_name: quote.customerName ?? null,
            quote_amount: quote.amount,
            quote_description: quote.description ?? null,
            expires_at: expiresAt,
          },
        });
      } catch {}
    }
  }

  // AsyncStorage cache (contractor-side mirror).
  try {
    const raw = await AsyncStorage.getItem(ACCEPTANCE_KEY);
    const links: AcceptanceLink[] = raw ? JSON.parse(raw) : [];
    const filtered = links.filter(l => l.quoteId !== quote.id);
    filtered.push(link);
    await AsyncStorage.setItem(ACCEPTANCE_KEY, JSON.stringify(filtered));
  } catch {}

  // Deep link for demo/local, web URL for production
  const url = __DEV__ ? `vasco://accept/${token}` : `${APPROVAL_BASE_URL}/accept/${token}`;
  return { token, url, link };
}

// ---------------------------------------------------------------------------
// Process customer acceptance
// ---------------------------------------------------------------------------

export async function processAcceptance(token: string): Promise<{
  success: boolean;
  link?: AcceptanceLink;
  error?: string;
}> {
  // R66 round 20: BE-first. The customer tapping this link is on a different
  // device than the contractor — AsyncStorage on the customer device is
  // empty for this token. Hit BE via the anon SELECT policy, validate, then
  // UPDATE through the qal_anon_decide policy (pending → accepted only).
  if (isSupabaseConfigured) {
    try {
      const existing = await getAcceptanceLinkByToken(token);
      if (!existing) return { success: false, error: 'Invalid link' };
      if (existing.status !== 'pending') return { success: false, error: `Quote already ${existing.status}` };
      if (new Date(existing.expires_at) < new Date()) {
        // Don't mutate to 'expired' from anon — RLS would reject (CHECK
        // accepts only accepted/rejected). Just surface to the customer.
        return { success: false, error: 'Link expired' };
      }
      const updated = await decideAcceptanceLink(token, 'accepted');
      if (!updated) return { success: false, error: 'Processing failed' };
      return { success: true, link: rowToLink(updated) };
    } catch (err) {
      logWarn('customerQuoteAcceptance', `BE processAcceptance failed: ${err}`);
      // Fall through to AsyncStorage cache below.
    }
  }
  // AsyncStorage fallback (rare — the contractor running their own demo
  // build, or BE outage). Customer-on-different-device case is BE-only.
  try {
    const raw = await AsyncStorage.getItem(ACCEPTANCE_KEY);
    const links: AcceptanceLink[] = raw ? JSON.parse(raw) : [];
    const link = links.find(l => l.token === token);

    if (!link) return { success: false, error: 'Invalid link' };
    if (link.status !== 'pending') return { success: false, error: `Quote already ${link.status}` };
    if (new Date(link.expiresAt) < new Date()) {
      link.status = 'expired';
      await AsyncStorage.setItem(ACCEPTANCE_KEY, JSON.stringify(links));
      return { success: false, error: 'Link expired' };
    }

    link.status = 'accepted';
    link.respondedAt = new Date().toISOString();
    await AsyncStorage.setItem(ACCEPTANCE_KEY, JSON.stringify(links));
    return { success: true, link };
  } catch {
    return { success: false, error: 'Processing failed' };
  }
}

// ---------------------------------------------------------------------------
// Process customer rejection
// ---------------------------------------------------------------------------

export async function rejectAcceptance(token: string, reason?: string): Promise<{
  success: boolean;
  link?: AcceptanceLink;
  error?: string;
}> {
  // R66 round 20: BE-first, same shape as processAcceptance. Reason is
  // passed through to the dataProvider which writes it into decline_reason.
  if (isSupabaseConfigured) {
    try {
      const existing = await getAcceptanceLinkByToken(token);
      if (!existing) return { success: false, error: 'Invalid link' };
      if (existing.status !== 'pending') return { success: false, error: `Quote already ${existing.status}` };
      if (new Date(existing.expires_at) < new Date()) {
        return { success: false, error: 'Link expired' };
      }
      const updated = await decideAcceptanceLink(token, 'rejected', reason);
      if (!updated) return { success: false, error: 'Processing failed' };
      return { success: true, link: rowToLink(updated) };
    } catch (err) {
      logWarn('customerQuoteAcceptance', `BE rejectAcceptance failed: ${err}`);
    }
  }
  try {
    const raw = await AsyncStorage.getItem(ACCEPTANCE_KEY);
    const links: AcceptanceLink[] = raw ? JSON.parse(raw) : [];
    const link = links.find(l => l.token === token);

    if (!link) return { success: false, error: 'Invalid link' };
    if (link.status !== 'pending') return { success: false, error: `Quote already ${link.status}` };
    if (new Date(link.expiresAt) < new Date()) {
      link.status = 'expired';
      await AsyncStorage.setItem(ACCEPTANCE_KEY, JSON.stringify(links));
      return { success: false, error: 'Link expired' };
    }

    link.status = 'rejected';
    link.respondedAt = new Date().toISOString();
    await AsyncStorage.setItem(ACCEPTANCE_KEY, JSON.stringify(links));
    return { success: true, link };
  } catch {
    return { success: false, error: 'Processing failed' };
  }
}

// ---------------------------------------------------------------------------
// Get acceptance status
// ---------------------------------------------------------------------------

export async function getAcceptanceStatus(quoteId: string): Promise<AcceptanceLink | null> {
  // R66 round 20: BE-first for the contractor side too — when the customer
  // accepts on their device, the contractor's local AsyncStorage still
  // shows 'pending' until BE → FE refresh. Reading from BE first means the
  // contractor's quote-detail "accepted/rejected" badge stays current.
  if (isSupabaseConfigured) {
    try {
      const { getAcceptanceLinkByQuoteId } = await import('../lib/dataProvider');
      const row = await getAcceptanceLinkByQuoteId(quoteId);
      if (row) return rowToLink(row);
    } catch {}
  }
  try {
    const raw = await AsyncStorage.getItem(ACCEPTANCE_KEY);
    const links: AcceptanceLink[] = raw ? JSON.parse(raw) : [];
    return links.find(l => l.quoteId === quoteId) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Share quote with acceptance link
// ---------------------------------------------------------------------------

export async function shareQuoteWithAcceptanceLink(quote: {
  id: string;
  customer?: string;
  customerName?: string;
  amount: number;
  description?: string;
  job?: string;
}): Promise<string> {
  const t = i18n.t.bind(i18n);
  const { url } = await createAcceptanceLink(quote);

  // R64: previously fell back to `quote.description` when job was empty.
  // R62 repurposed `description` for the SOW prose (up to ~3 paragraphs),
  // so this fallback would inject 600+ chars of scope text into the share
  // message. Use a short trimmed first-line fallback when description is
  // SOW-shaped, otherwise empty.
  const firstLineFallback = quote.description
    ? quote.description.split(/\n/)[0].slice(0, 80)
    : '';
  const message = t('approval.shareMessage', {
    defaultValue: `Hi {{customer}},\n\nHere is your quote for {{job}} — €{{amount}}.\n\nAccept online: {{url}}\n\nValid for 30 days.\n\nKind regards`,
    customer: quote.customerName || quote.customer || '',
    job: quote.job || firstLineFallback,
    amount: quote.amount.toLocaleString(),
    url,
  });

  try {
    await Share.share({ message, title: t('approval.quoteTitle', 'Quote') });
  } catch {}

  return url;
}
