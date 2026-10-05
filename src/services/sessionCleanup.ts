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

/**
 * Business data that exists ONLY on this device — no server copy — plus the
 * two queues of writes that have not reached the server yet. Logout used to
 * wipe these with everything else, so signing out and straight back in as the
 * SAME contractor lost their hourly rate (what jobBillingBasis bills from),
 * service agreements, purchase orders, templates, permits, insurance claims,
 * closeout state and every unsynced change and photo (sweep 2026-09-23, A4).
 *
 * They are now kept at logout and owned: `claimDeviceData` wipes them only
 * when a DIFFERENT contractor signs in (the #344 cache-owner rule).
 */
export const DEVICE_OWNED_KEYS: readonly string[] = [
  '@vasco_pricebook',
  '@vasco_service_agreements',
  '@vasco_purchase_orders_v1',
  '@vasco_quote_templates',
  '@vasco_message_templates',
  '@vasco_recurring_jobs',
  '@vasco_contractor_permits',
  '@vasco_insurance_claims',
  '@vasco_closeout_state',
  '@vasco_offline_writes',
  '@vasco_pending_job_photos',
];

/** Whose device-owned data is on this phone. Survives logout on purpose. */
export const DEVICE_DATA_OWNER_KEY = '@vasco_device_data_owner';

const KEEP_AT_LOGOUT = new Set<string>([...PRESERVE_KEYS, ...DEVICE_OWNED_KEYS, DEVICE_DATA_OWNER_KEY]);

/**
 * Logout. Wipes everything user-scoped that the server holds or that is
 * regenerated (caches, AI queue, inbox, clock-in …) and KEEPS the
 * device-owned data, recording who owns it.
 */
export async function clearUserScopedStorage(outgoingUserId?: string | null): Promise<void> {
  try {
    if (outgoingUserId) await AsyncStorage.setItem(DEVICE_DATA_OWNER_KEY, outgoingUserId);
    const allKeys = await AsyncStorage.getAllKeys();
    const toWipe = allKeys.filter((k) => k.startsWith('@vasco_') && !KEEP_AT_LOGOUT.has(k));
    if (toWipe.length > 0) {
      // After any AI-queue write in flight, so it cannot land after the wipe
      // and restore the previous account's queue (require: no dynamic import).
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { afterQueueWrites } = require('./aiActionQueueService') as typeof import('./aiActionQueueService');
      await afterQueueWrites(() => AsyncStorage.multiRemove(toWipe));
    }
  } catch (err) {
    logWarn('SessionCleanup', `clearUserScopedStorage failed: ${err}`);
  }
}

/**
 * A DIFFERENT contractor replacing the signed-in one with no logout between
 * (an auth link for another account, a demo switch) — the logout wipe, but
 * as a barrier. The wipe lists the keys, then removes them: anything the new
 * contractor writes in between (their profile, stamped by AuthContext's
 * restore effect in the same commit) is deleted with the previous one's
 * (review, 2026-09-30). Everything that writes for the new contractor awaits
 * `handoverSettled()` first.
 */
let pendingHandover: Promise<void> | null = null;

export function handOverFrom(previousUserId: string): Promise<void> {
  const wipe = clearUserScopedStorage(previousUserId).finally(() => {
    if (pendingHandover === wipe) pendingHandover = null;
  });
  pendingHandover = wipe;
  return wipe;
}

/** The handover in progress, if any — null when there is nothing to wait for. */
export function handoverSettled(): Promise<void> | null {
  return pendingHandover;
}

/**
 * Sign-in. The device-owned data belongs to whoever last used the phone; a
 * DIFFERENT contractor must never see it — nor have its queued writes sent
 * under their session. Same user: kept. Returns true once this user owns it.
 */
export async function claimDeviceData(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const owner = await AsyncStorage.getItem(DEVICE_DATA_OWNER_KEY);
    if (owner && owner !== userId) {
      try {
        const { clearAll } = await import('./pendingJobPhotosQueue');
        await clearAll(); // photo FILES as well as their index
      } catch {}
      // The previous contractor's SIGNING certificate (Facturae / FACe): the
      // next person on this phone must never be able to sign as them. It is
      // also bound to its owner, so a load for anyone else returns nothing.
      // (require, not import(): it must also run where dynamic import is off.)
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { removeSigningCertificate } = require('./signingCertificateStore') as typeof import('./signingCertificateStore');
        await removeSigningCertificate();
      } catch {}
      // Their scheduled local reminders ("Invoice for <their customer> is due
      // today") would fire on the next contractor's phone (2026-10-04).
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { cancelAllNotifications } = require('./pushNotificationService') as typeof import('./pushNotificationService');
        await cancelAllNotifications();
      } catch {}
      await AsyncStorage.multiRemove([...DEVICE_OWNED_KEYS]);
    }
    await AsyncStorage.setItem(DEVICE_DATA_OWNER_KEY, userId);
    return true;
  } catch (err) {
    logWarn('SessionCleanup', `claimDeviceData failed: ${err}`);
    return false;
  }
}

/**
 * May the offline queues upload for this user? Only if the queued data is
 * theirs. Unknown owner (first run of this version) counts as theirs — the
 * queues predate ownership and were written by whoever is signed in.
 */
export async function deviceDataBelongsTo(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    const owner = await AsyncStorage.getItem(DEVICE_DATA_OWNER_KEY);
    return !owner || owner === userId;
  } catch {
    return false;
  }
}
