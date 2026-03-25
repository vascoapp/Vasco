// =============================================================================
// VERSION CHECK SERVICE — Compare app version against remote config
// =============================================================================
// Checks if the current app version meets the minimum required version.
// Falls back to local AsyncStorage when Supabase is not configured.
// Used by: app startup, settings screen.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const VERSION_CONFIG_KEY = '@vasco_version_config';

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

async function fetchRemoteConfig(): Promise<VersionConfig | null> {
  // TODO: When Supabase is active, fetch from app_config table:
  //
  // const { data } = await supabase
  //   .from('app_config')
  //   .select('value')
  //   .eq('key', 'version_config')
  //   .single();
  //
  // if (data?.value) {
  //   const config = JSON.parse(data.value) as VersionConfig;
  //   await saveVersionConfig(config);
  //   return config;
  // }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the current app version from Expo Constants.
 */
export function getCurrentVersion(): string {
  return Constants.expoConfig?.version ?? Constants.manifest?.version ?? '1.0.0';
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
