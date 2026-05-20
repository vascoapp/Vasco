// =============================================================================
// FEATURE FLAGS — remote kill switch + gradual rollout
// =============================================================================
// Read once on app start + on user country change. Cached in AsyncStorage so
// the app is fast offline. Flags come from Supabase `feature_flags`; local
// defaults keep the app functional when Supabase is unconfigured.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type Country = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK' | 'US';

export type FeatureKey =
  | 'payments_mollie'
  | 'payments_stripe_uk'
  | 'payments_stripe_us'
  | 'eve_agent'
  | 'purchasing_agent'
  | 'whatsapp_business'
  | 'live_tracking'
  | 'sms_us';

interface FlagRow {
  key: string;
  country: string | null;
  enabled: boolean;
  rollout_percent: number;
}

const CACHE_KEY = '@vasco_feature_flags';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// Local defaults keep the app functional if Supabase is unreachable.
const DEFAULTS: Record<FeatureKey, boolean> = {
  payments_mollie: true,
  payments_stripe_uk: true,
  payments_stripe_us: true,
  eve_agent: true,
  purchasing_agent: true,
  whatsapp_business: false,
  // R79 US Phase 2: SMS off by default. Operator flips it on after the
  // Twilio account is provisioned and TWILIO_* secrets land in
  // Supabase. Until then sendSms returns sms_disabled, callers fall
  // through to email / WhatsApp / in-app push.
  sms_us: false,
  live_tracking: false,
};

let memo: Record<string, FlagRow> = {};
let fetchedAt = 0;

// Deterministic 0-99 bucket for a given user — used for rollout_percent gating
function userBucket(userId: string | undefined): number {
  if (!userId) return 0;
  let h = 0;
  for (let i = 0; i < userId.length; i += 1) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100;
}

async function loadCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.rows) memo = parsed.rows;
    if (parsed?.fetchedAt) fetchedAt = parsed.fetchedAt;
  } catch {}
}

async function saveCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ rows: memo, fetchedAt }));
  } catch {}
}

function flagKey(key: string, country: string | null | undefined): string {
  return `${key}::${country ?? ''}`;
}

export async function refreshFeatureFlags(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data, error } = await (supabase.from('feature_flags' as any) as any).select('*');
    if (error || !Array.isArray(data)) return;
    const next: Record<string, FlagRow> = {};
    for (const r of data as FlagRow[]) {
      next[flagKey(r.key, r.country)] = r;
    }
    memo = next;
    fetchedAt = Date.now();
    await saveCache();
  } catch {
    // Swallow — defaults are fine
  }
}

/** Sync read. Call `ensureFlagsLoaded()` once during app boot so this is populated. */
export function isFeatureEnabled(
  key: FeatureKey,
  opts: { userId?: string; country?: Country } = {},
): boolean {
  const scoped = memo[flagKey(key, opts.country ?? null)];
  const global = memo[flagKey(key, null)];
  const row = scoped ?? global;

  if (!row) return DEFAULTS[key];
  if (!row.enabled) return false;
  if (row.rollout_percent >= 100) return true;
  if (row.rollout_percent <= 0) return false;
  return userBucket(opts.userId) < row.rollout_percent;
}

/** Await once at app start so the cache is populated before any flag check. */
export async function ensureFlagsLoaded(): Promise<void> {
  if (Object.keys(memo).length === 0) await loadCache();
  if (Date.now() - fetchedAt > CACHE_TTL_MS) {
    await refreshFeatureFlags();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useFeatureFlag(key: FeatureKey, opts?: { userId?: string; country?: Country }): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isFeatureEnabled(key, opts));

  useEffect(() => {
    let alive = true;
    ensureFlagsLoaded().then(() => {
      if (alive) setEnabled(isFeatureEnabled(key, opts));
    });
    return () => { alive = false; };
  }, [key, opts?.userId, opts?.country]);

  return enabled;
}
