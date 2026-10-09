// =============================================================================
// STRIPE CONNECT — the app side (decision 2a, 2026-10-09)
// =============================================================================
// The contractor connects their Stripe account by signing in at Stripe; the
// server (edge function `stripe-connect`) holds the link and makes payment
// links with Vasco's platform key on that account. No secret key on the phone.
//
// The server says whether Connect is set up at all (`configured`). Until it is
// (no Vasco platform account yet) the Stripe screen keeps its old key form, so
// a UK contractor — whose only payment provider is Stripe — loses nothing; the
// day the platform keys are set, the app switches to "Connect with Stripe" by
// itself, no build, no OTA.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAuthedUserId } from '../lib/currentUser';

export interface ConnectStatus {
  configured: boolean;
  connected: boolean;
  livemode: boolean;
}

const OFF: ConnectStatus = { configured: false, connected: false, livemode: false };

/** Per account, short-lived: a payment-link call asks before each mint. */
let memo: { uid: string; at: number; status: ConnectStatus } | null = null;
const TTL_MS = 60_000;

async function call<T>(body: Record<string, unknown>): Promise<T | null> {
  if (!isSupabaseConfigured || !getAuthedUserId()) return null;
  try {
    const { data, error } = await supabase.functions.invoke('stripe-connect', { body });
    if (error || !data) return null;
    return data as T;
  } catch {
    return null;
  }
}

export async function getConnectStatus(opts: { force?: boolean } = {}): Promise<ConnectStatus> {
  const uid = getAuthedUserId();
  if (!uid) return OFF;
  if (!opts.force && memo && memo.uid === uid && Date.now() - memo.at < TTL_MS) return memo.status;
  const data = await call<Partial<ConnectStatus>>({ action: 'status' });
  // Unreachable = not configured: the screen falls back, never a dead button.
  const status: ConnectStatus = {
    configured: data?.configured === true,
    connected: data?.connected === true,
    livemode: data?.livemode === true,
  };
  // An account switch while the request was out: not this account's answer.
  if (getAuthedUserId() !== uid) return OFF;
  memo = { uid, at: Date.now(), status };
  return status;
}

/** Stripe's consent page, or null when Connect is not available. */
export async function startConnect(): Promise<string | null> {
  const data = await call<{ url?: string }>({ action: 'start' });
  return typeof data?.url === 'string' && data.url.startsWith('https://connect.stripe.com/') ? data.url : null;
}

export async function disconnectConnect(): Promise<boolean> {
  const data = await call<{ ok?: boolean }>({ action: 'disconnect' });
  memo = null;
  return data?.ok === true;
}

export interface ConnectPaymentLinkRequest {
  invoiceId: string;
  description: string;
  amount: number;
  currency: string;
  paymentMethods?: string[];
  /** A customer-decision deposit (the webhook marks that tracker paid). */
  trackerAccessCode?: string;
}

export async function createConnectPaymentLink(req: ConnectPaymentLinkRequest): Promise<{ url: string; id: string } | null> {
  const data = await call<{ url?: string; id?: string }>({ action: 'payment-link', ...req });
  return data?.url && data.id ? { url: data.url, id: data.id } : null;
}

/** Test seam. */
export function __resetConnectStatusForTests(): void {
  memo = null;
}
