// =============================================================================
// VERSION CHECK SERVICE — Compare app version against remote config
// =============================================================================
// Checks if the current app version meets the minimum required version.
// Falls back to local AsyncStorage when Supabase is not configured.
// Used by: app startup, settings screen.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const VERSION_CONFIG_KEY = '@vasco_version_config';
const VERSION_CONFIG_FETCH_TS_KEY = '@vasco_version_config_fetched_at';
// Throttle remote fetches to once per 6h. Cached value falls through.
const REMOTE_FETCH_THROTTLE_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VersionConfig {
  minimumVersion: string;
  latestVersion: string;
  updateUrl: string;
  forceUpdateBelow: string; // versions below this MUST update
}

export interface VersionCheckResult {
  updateAvailable: boolean;
  forceUpdate: boolean;
  latestVersion: string;
  updateUrl: string;
  currentVersion: string;
}

const DEFAULT_CONFIG: VersionConfig = {
  minimumVersion: '1.0.0',
  latestVersion: '1.0.0',
  updateUrl: 'https://apps.apple.com/app/vasco',
  forceUpdateBelow: '0.9.0',
};

// ---------------------------------------------------------------------------
// Version comparison
// ---------------------------------------------------------------------------

/**
 * Compare two semver strings. Returns:
 *  -1 if a < b
 *   0 if a === b
 *   1 if a > b
 */
function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function loadVersionConfig(): Promise<VersionConfig> {
  try {
    const raw = await AsyncStorage.getItem(VERSION_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VersionConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_CONFIG;
}

async function saveVersionConfig(config: VersionConfig): Promise<void> {
  await AsyncStorage.setItem(VERSION_CONFIG_KEY, JSON.stringify(config)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Remote fetch (Supabase app_config table)
// ---------------------------------------------------------------------------

function isVersionConfig(value: unknown): value is VersionConfig {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.minimumVersion === 'string' &&
    typeof v.latestVersion === 'string' &&
    typeof v.updateUrl === 'string' &&
    typeof v.forceUpdateBelow === 'string'
  );
}

async function shouldFetchRemote(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VERSION_CONFIG_FETCH_TS_KEY);
    if (!raw) return true;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts > REMOTE_FETCH_THROTTLE_MS;
  } catch {
    return true;
  }
}

async function fetchRemoteConfig(): Promise<VersionConfig | null> {
  // Supabase not wired (dev / demo without env) — stay on cached/default.
  if (!isSupabaseConfigured) return null;

  // Throttle: avoid hitting Supabase on every cold start. checkForUpdate
  // already falls back to the cached config when this returns null.
  if (!(await shouldFetchRemote())) return null;

  try {
    // typegen drift: app_config landed in migration 20260511000001, not yet
    // in the generated database.types until `supabase gen types` re-runs.
    // Same `as any` pattern as feature_flags / cron / decision_aggregates.
    const { data, error } = await (supabase.from('app_config' as any) as any)
      .select('value')
      .eq('key', 'version_config')
      .maybeSingle();

    // Record the attempt (success OR transient error) so we don't hammer
    // Supabase if it's down. Real network failures fall through to cache.
    await AsyncStorage.setItem(VERSION_CONFIG_FETCH_TS_KEY, String(Date.now())).catch(() => {});

    if (error || !data?.value) return null;

    // Migration seeds value as jsonb (object); old admin paths may have
    // stored a JSON string — handle both.
    const raw = data.value;
    const parsed: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!isVersionConfig(parsed)) return null;

    await saveVersionConfig(parsed);
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the current app version from Expo Constants.
 */
export function getCurrentVersion(): string {
  // R66r49: `Constants.manifest` is deprecated + untyped in newer Expo
  // SDKs. expoConfig is canonical; keep the manifest fallback via `any`
  // for older dev clients without breaking TS strict.
  return Constants.expoConfig?.version ?? (Constants as any).manifest?.version ?? '1.0.0';
}

/**
 * Check if an update is available or required.
 * Tries remote config first, falls back to cached local config.
 */
export async function checkForUpdate(): Promise<VersionCheckResult> {
  const currentVersion = getCurrentVersion();

  // Try remote first, fall back to cached
  let config = await fetchRemoteConfig();
  if (!config) {
    config = await loadVersionConfig();
  }

  const updateAvailable = compareSemver(currentVersion, config.latestVersion) < 0;
  const forceUpdate = compareSemver(currentVersion, config.forceUpdateBelow) < 0;

  return {
    updateAvailable,
    forceUpdate,
    latestVersion: config.latestVersion,
    updateUrl: config.updateUrl,
    currentVersion,
  };
}

/**
 * Manually set the version config (useful for testing or admin override).
 */
export async function setVersionConfig(config: Partial<VersionConfig>): Promise<void> {
  const current = await loadVersionConfig();
  const merged = { ...current, ...config };
  await saveVersionConfig(merged);
}

/**
 * Get the cached version config without checking remote.
 */
export async function getCachedVersionConfig(): Promise<VersionConfig> {
  return loadVersionConfig();
}
