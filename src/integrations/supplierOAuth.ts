// =============================================================================
// SUPPLIER OAUTH — unified scaffolding for trade suppliers
// =============================================================================
// Mirrors the Moneybird OAuth pattern (PKCE, secure storage, token refresh).
// Individual suppliers wire their IDs + endpoints to this base — most of them
// expose OAuth 2.0 authorisation_code grant behind their B2B API portals.
//
// IMPORTANT: all client_secret values stay server-side (in a token-exchange
// Edge Function). This module only handles the public PKCE dance +
// `access_token` storage on device.
// =============================================================================

import * as Crypto from 'expo-crypto';
import { getSecureItem, setSecureItem, deleteSecureItem } from '../lib/secureStorage';

export type SupplierId =
  | 'hornbach'
  | 'rexel_nl'
  | 'bouwmaat'
  | 'technische_unie'
  | 'solar_nl'
  | 'bauhaus';

interface SupplierConfig {
  id: SupplierId;
  label: string;
  authUrl: string;
  tokenExchangeUrl: string; // points to Supabase Edge Function, not supplier
  scopes: string[];
  countries: string[];
}

export const SUPPLIERS: Record<SupplierId, SupplierConfig> = {
  hornbach: {
    id: 'hornbach', label: 'Hornbach',
    authUrl: 'https://api.hornbach.com/oauth2/authorize',
    tokenExchangeUrl: '{SUPABASE_URL}/functions/v1/supplier-oauth-exchange',
    scopes: ['orders:read', 'orders:write', 'products:read'],
    countries: ['NL','DE'],
  },
  rexel_nl: {
    id: 'rexel_nl', label: 'Rexel NL',
    authUrl: 'https://api.rexel.nl/oauth/authorize',
    tokenExchangeUrl: '{SUPABASE_URL}/functions/v1/supplier-oauth-exchange',
    scopes: ['catalog', 'ordering'],
    countries: ['NL'],
  },
  bouwmaat: {
    id: 'bouwmaat', label: 'Bouwmaat',
    authUrl: 'https://api.bouwmaat.nl/oauth/authorize',
    tokenExchangeUrl: '{SUPABASE_URL}/functions/v1/supplier-oauth-exchange',
    scopes: ['pricing', 'orders'],
    countries: ['NL'],
  },
  technische_unie: {
    id: 'technische_unie', label: 'Technische Unie',
    authUrl: 'https://www.technischeunie.nl/oauth/authorize',
    tokenExchangeUrl: '{SUPABASE_URL}/functions/v1/supplier-oauth-exchange',
    scopes: ['orders', 'catalog'],
    countries: ['NL','BE'],
  },
  solar_nl: {
    id: 'solar_nl', label: 'Solar',
    authUrl: 'https://api.solar.eu/oauth/authorize',
    tokenExchangeUrl: '{SUPABASE_URL}/functions/v1/supplier-oauth-exchange',
    scopes: ['orders'],
    countries: ['NL','DE'],
  },
  bauhaus: {
    id: 'bauhaus', label: 'Bauhaus',
    authUrl: 'https://api.bauhaus.info/oauth/authorize',
    tokenExchangeUrl: '{SUPABASE_URL}/functions/v1/supplier-oauth-exchange',
    scopes: ['b2b-orders'],
    countries: ['DE','ES','IT'],
  },
};

interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  supplier: SupplierId;
}

function storageKey(id: SupplierId): string { return `vasco_supplier_${id}`; }
function pkceKey(id: SupplierId): string { return `vasco_supplier_pkce_${id}`; }

export async function startOAuth(id: SupplierId, redirectUri: string, clientId: string): Promise<string> {
  const cfg = SUPPLIERS[id];
  if (!cfg) throw new Error(`Unknown supplier: ${id}`);

  const verifierBytes = await Crypto.getRandomBytesAsync(32);
  const verifier = toB64Url(verifierBytes);
  const challenge = toB64Url(
    new Uint8Array(
      await (async () => {
        const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 });
        const bin = atob(digest.replace(/-/g, '+').replace(/_/g, '/'));
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
        return out.buffer;
      })(),
    ),
  );

  await setSecureItem(pkceKey(id), verifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: cfg.scopes.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: `vasco_${id}_${Date.now()}`,
  });
  return `${cfg.authUrl}?${params.toString()}`;
}

export async function saveTokens(id: SupplierId, tokens: Omit<TokenBundle, 'supplier'>): Promise<void> {
  await setSecureItem(storageKey(id), JSON.stringify({ ...tokens, supplier: id }));
}

export async function loadTokens(id: SupplierId): Promise<TokenBundle | null> {
  const raw = await getSecureItem(storageKey(id));
  if (!raw) return null;
  try { return JSON.parse(raw) as TokenBundle; } catch { return null; }
}

export async function clearTokens(id: SupplierId): Promise<void> {
  await deleteSecureItem(storageKey(id));
  await deleteSecureItem(pkceKey(id));
}

export async function isConnected(id: SupplierId): Promise<boolean> {
  const t = await loadTokens(id);
  return !!t && t.expiresAt > Date.now();
}

function toB64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < view.length; i += 1) s += String.fromCharCode(view[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
