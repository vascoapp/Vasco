// =============================================================================
// CENTRALIZED ENVIRONMENT CONFIGURATION
// =============================================================================
// Single source of truth for all environment variables used in the app.
// Uses EXPO_PUBLIC_ prefix which Expo injects at build time via process.env.
//
// Usage:  import { ENV } from '@/config/env';
//         fetch(`${ENV.SUPABASE_URL}/rest/v1/...`)
// =============================================================================

const getEnvVar = (key: string, fallback: string = ''): string => {
  const value = process.env[key] ?? fallback;
  if (!value && !fallback && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing environment variable: ${key}`);
  }
  return value;
};

/** All environment variables used by the Vasco app. */
export const ENV = {
  // --- Supabase ---
  SUPABASE_URL: getEnvVar('EXPO_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),

  // --- Vasco API ---
  VASCO_API_URL: getEnvVar('EXPO_PUBLIC_VASCO_API_URL'),

  // --- Moneybird OAuth ---
  MONEYBIRD_CLIENT_ID: getEnvVar('EXPO_PUBLIC_MONEYBIRD_CLIENT_ID'),
  MONEYBIRD_TOKEN_URL: getEnvVar('EXPO_PUBLIC_MONEYBIRD_TOKEN_URL'),

  // --- Xero OAuth ---
  XERO_CLIENT_ID: getEnvVar('EXPO_PUBLIC_XERO_CLIENT_ID'),
  XERO_TOKEN_URL: getEnvVar('EXPO_PUBLIC_XERO_TOKEN_URL'),
} as const;

/** True when Supabase env vars are both set (non-empty). */
export const isSupabaseConfigured = !!(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);
