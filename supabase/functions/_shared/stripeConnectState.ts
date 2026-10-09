/**
 * The `state` of a Stripe Connect OAuth round trip (decision 2a, 2026-10-09).
 *
 * The contractor leaves the app for Stripe and comes back to
 * `stripe-connect-callback` WITHOUT a session (a browser redirect carries no
 * Authorization header). The only thing that says which Vasco account the
 * returning Stripe account belongs to is this state, so it is SIGNED — an
 * unsigned user id would let anyone attach their Stripe account to someone
 * else's Vasco account (and then mark that account's invoices paid through
 * the webhook) — and it EXPIRES, so a leaked link stops working.
 *
 * Pure TypeScript on WebCrypto: Deno and jest (node ≥ 18) both run it.
 */

const enc = new TextEncoder();

/** How long the contractor has on Stripe's page (was 30 min; review 2026-10-09). */
export const STATE_TTL_MS = 10 * 60 * 1000;

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

/** Constant-time compare: a byte-by-byte early exit leaks the signature. */
function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * A signed state, plus its nonce and expiry — the caller STORES the nonce
 * (stripe_connect_states) so the callback can consume it once: a signature
 * alone made the link reusable until it expired (review 2026-10-09).
 */
export async function signConnectState(userId: string, secret: string, now: number = Date.now()): Promise<{ state: string; nonce: string; expiresAt: number }> {
  if (!secret || secret.length < 16) throw new Error('state secret missing');
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const expiresAt = now + STATE_TTL_MS;
  const payload = b64url(enc.encode(JSON.stringify({ u: userId, e: expiresAt, n: nonce })));
  const sig = b64url(await hmac(secret, payload));
  return { state: `${payload}.${sig}`, nonce, expiresAt };
}

/**
 * Who the state was issued to and its nonce, or null (forged, altered,
 * expired). The caller must still CONSUME the nonce — that is what makes it
 * single-use.
 */
export async function verifyConnectState(state: unknown, secret: string, now: number = Date.now()): Promise<{ userId: string; nonce: string } | null> {
  if (typeof state !== 'string' || !secret) return null;
  const [payload, sig, extra] = state.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  try {
    if (!same(await hmac(secret, payload), fromB64url(sig))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u?: unknown; e?: unknown; n?: unknown };
    if (typeof p.u !== 'string' || !p.u || typeof p.e !== 'number' || p.e < now) return null;
    if (typeof p.n !== 'string' || p.n.length < 16) return null;
    return { userId: p.u, nonce: p.n };
  } catch {
    return null;
  }
}
