// =============================================================================
// AI Queue Notifier — local push when new queue items appear
// =============================================================================
// Polls the AI action queue, diffs against the last-seen snapshot, and fires
// a local notification the first time an item shows up. Prevents spamming
// the same event repeatedly because we key on item.id.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQueue, type QueueItem } from './aiActionQueueService';
import { sendInstantNotification, isInQuietHours, shouldDeliver } from './pushNotificationService';
import i18n from '../i18n/i18n';

const SEEN_KEY = '@vasco_ai_queue_seen';
const QUIET_GRACE_MS = 10 * 60 * 1000;

async function loadSeen(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

async function saveSeen(ids: Set<string>): Promise<void> {
  try {
    // Cap at 500 ids to keep storage small
    const arr = [...ids].slice(-500);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
}

/** Poll once. Call this after queue population and on app foreground. */
export async function notifyNewQueueItems(): Promise<number> {
  try {
    const queue = await getQueue();
    if (queue.length === 0) return 0;

    // Respect quiet hours except for urgent types (overdue invoices, cert renewal)
    const urgentTypes = new Set(['draft_reminder', 'cert_renewal', 'permit_renewal']);
    const seen = await loadSeen();
    let fired = 0;

    for (const item of queue) {
      if (seen.has(item.id)) continue;
      const isUrgent = urgentTypes.has(item.type);
      if (isInQuietHours() && !isUrgent) { seen.add(item.id); continue; }
      if (!shouldDeliver(mapToNotificationType(item))) { seen.add(item.id); continue; }

      const body = item.description || item.actionLabel || i18n.t('notifications.push.eveTapToReview');
      await sendInstantNotification(i18n.t('notifications.push.eveTitle'), `${truncate(item.title, 60)} — ${truncate(body, 80)}`, {
        type: 'ai_queue',
        itemId: item.id,
        itemType: item.type,
      });
      seen.add(item.id);
      fired += 1;
    }

    await saveSeen(seen);
    return fired;
  } catch {
    return 0;
  }
}

function truncate(s: string, max: number): string {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function mapToNotificationType(item: QueueItem): any {
  switch (item.type) {
    case 'draft_reminder': return 'overdue_invoice';
    case 'cert_renewal': return 'credential_expiry';
    case 'permit_renewal': return 'permit_update';
    case 'job_handover': return 'approval_request';
    default: return 'general';
  }
}

/** Export for tests / manual reset (e.g. after "Mark all read") */
export async function clearSeenQueue(): Promise<void> {
  try { await AsyncStorage.removeItem(SEEN_KEY); } catch {}
  // Silence unused-import warning if QUIET_GRACE_MS ever gets used later
  void QUIET_GRACE_MS;
}
