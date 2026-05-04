// =============================================================================
// SESSION CLEANUP (R46)
// =============================================================================
// Wipes all user-scoped AsyncStorage keys on logout so the next contractor
// signing in on the same device doesn't inherit:
//   - Previous user's queued offline writes (@vasco_offline_writes)
//   - Previous user's pending AI queue items (@vasco_ai_queue)
//   - Previous user's offline scans (@vasco_offline_scans)
//   - Previous user's expense list (@vasco_expenses)
//   - Previous user's permits / inbox / clock-in / activation state / etc.
//
// Without this, the previous user's queued writes would fire under the
// new user's auth session — a real multi-tenancy hazard on shared devices
// + demo accounts.
//
// Keys NOT wiped (preserve cross-user device-level state):
//   - @vasco_device_id — analytics device fingerprint
//   - @vasco_seed_version — let next user inherit demo-seed gate
//   - @vasco_consents — privacy/cookie consent (per device, not per user)
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logWarn } from '../utils/errorHandler';

const PRESERVE_KEYS = new Set<string>([
  '@vasco_device_id',
  '@vasco_seed_version',
  '@vasco_consents',
]);

export async function clearUserScopedStorage(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toWipe = allKeys.filter(
      (k) => k.startsWith('@vasco_') && !PRESERVE_KEYS.has(k),
    );
    if (toWipe.length > 0) {
      await AsyncStorage.multiRemove(toWipe);
    }
  } catch (err) {
    logWarn('SessionCleanup', `clearUserScopedStorage failed: ${err}`);
  }
}
