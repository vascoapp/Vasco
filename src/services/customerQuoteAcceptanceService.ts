// =============================================================================
// CUSTOMER QUOTE ACCEPTANCE — Digital approval link for customers
// =============================================================================
// Contractor shares quote with approval URL → customer taps → quote accepted →
// job auto-created. No phone calls needed.
//
// Until Supabase is live: tokens stored in AsyncStorage.
// Production: tokens in `quote_acceptance_links` table with webhook on accept.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';
import i18n from '../i18n/i18n';
import { MS_PER_DAY } from '../utils/timeConstants';

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

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
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

  const link: AcceptanceLink = {
    token,
    quoteId: quote.id,
    customerId: quote.customer,
    customerName: quote.customerName,
    quoteAmount: quote.amount,
    quoteDescription: quote.description,
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + validDays * MS_PER_DAY).toISOString(),
  };

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

  const message = t('approval.shareMessage', {
    defaultValue: `Hi {{customer}},\n\nHere is your quote for {{job}} — €{{amount}}.\n\nAccept online: {{url}}\n\nValid for 30 days.\n\nKind regards`,
    customer: quote.customerName || quote.customer || '',
    job: quote.job || quote.description || '',
    amount: quote.amount.toLocaleString(),
    url,
  });

  try {
    await Share.share({ message, title: t('approval.quoteTitle', 'Quote') });
  } catch {}

  return url;
}
