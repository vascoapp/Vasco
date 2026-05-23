// =============================================================================
// CENTRALIZED ENVIRONMENT CONFIGURATION
// =============================================================================
// Single source of truth for all environment variables used in the app.
// Uses EXPO_PUBLIC_ prefix which Expo injects at build time via process.env.
//
// Usage:  import { ENV } from '@/config/env';
//         fetch(`${ENV.SUPABASE_URL}/rest/v1/...`)
//
// R105 — DO NOT use indirect access like `process.env[key]` or a helper
// like getEnvVar(name). Metro's static analyzer only inlines DIRECT
// `process.env.EXPO_PUBLIC_X` references at bundle time. Dynamic lookups
// fall back to `undefined` in production, which silently broke Supabase
// config (URL+key empty → isSupabaseConfigured=false → mock data + demo
// banner + signup blocked in every TF build between R66 and R104).
// =============================================================================

/** All environment variables used by the Vasco app. */
export const ENV = {
  // --- Supabase ---
  SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',

  // --- Vasco API ---
  VASCO_API_URL: process.env.EXPO_PUBLIC_VASCO_API_URL ?? '',

  // --- Moneybird OAuth ---
  MONEYBIRD_CLIENT_ID: process.env.EXPO_PUBLIC_MONEYBIRD_CLIENT_ID ?? '',
  MONEYBIRD_TOKEN_URL: process.env.EXPO_PUBLIC_MONEYBIRD_TOKEN_URL ?? '',

  // --- Xero OAuth ---
  XERO_CLIENT_ID: process.env.EXPO_PUBLIC_XERO_CLIENT_ID ?? '',
  XERO_TOKEN_URL: process.env.EXPO_PUBLIC_XERO_TOKEN_URL ?? '',
} as const;

if (__DEV__) {
  for (const [key, value] of Object.entries(ENV)) {
    if (!value) {
      // eslint-disable-next-line no-console
      console.warn(`[env] Missing environment variable: EXPO_PUBLIC_${key}`);
    }
  }
}

/** True when Supabase env vars are both set (non-empty). */
export const isSupabaseConfigured = !!(ENV.SUPABASE_URL && ENV.SUPABASE_ANON_KEY);
