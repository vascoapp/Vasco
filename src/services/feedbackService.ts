// =============================================================================
// FEEDBACK SERVICE — In-app user feedback collection
// =============================================================================
// Allows users to submit bug reports, feature requests, and general feedback.
// Stores locally in AsyncStorage as a queue, syncs to Supabase when configured.
// Captures device info and user context automatically.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const FEEDBACK_STORAGE_KEY = '@vasco_feedback_queue';
// R33: was hardcoded '1.0.0' — every bug-report sent to Supabase showed
// the same fake version regardless of which build the user was on, so
// triaging by version was impossible. Now reads from expoConfig set by
// app.json (which the EAS build process keeps in sync).
const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined)
  ?? (Constants.manifest as any)?.version
  ?? 'unknown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeedbackType = 'bug_report' | 'feature_request' | 'general';

export type FeedbackStatus = 'pending' | 'synced' | 'failed';

export interface UserContext {
  userId: string;
  role: 'contractor' | 'aannemer' | 'sitelead';
  country: string;
  trade?: string;
}

export interface DeviceInfo {
  platform: string;
  platformVersion: string | number;
  appVersion: string;
}

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  message: string;
  screenshot?: string; // base64 or URI
  userContext: UserContext;
  deviceInfo: DeviceInfo;
  status: FeedbackStatus;
  createdAt: string; // ISO timestamp
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `fb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getDeviceInfo(): DeviceInfo {
  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    appVersion: APP_VERSION,
  };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function loadQueue(): Promise<FeedbackItem[]> {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupted data — start fresh
  }
  return [];
}

async function saveQueue(queue: FeedbackItem[]): Promise<void> {
  await AsyncStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(queue)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Submit feedback from the user.
 * Stores locally and attempts Supabase sync if configured.
 */
export async function submitFeedback(
  type: FeedbackType,
  message: string,
  userContext: UserContext,
  screenshot?: string,
): Promise<FeedbackItem> {
  const item: FeedbackItem = {
    id: generateId(),
    type,
    message: message.trim(),
    screenshot,
    userContext,
    deviceInfo: getDeviceInfo(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Persist locally first
  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);

  // Attempt immediate sync
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('feedback' as never).insert({
        id: item.id,
        type: item.type,
        message: item.message,
        screenshot: item.screenshot ?? null,
        user_id: item.userContext.userId,
        user_role: item.userContext.role,
        country: item.userContext.country,
        trade: item.userContext.trade ?? null,
        platform: item.deviceInfo.platform,
        platform_version: String(item.deviceInfo.platformVersion),
        app_version: item.deviceInfo.appVersion,
        created_at: item.createdAt,
      } as never);

      if (!error) {
        item.status = 'synced';
        const updatedQueue = await loadQueue();
        const idx = updatedQueue.findIndex((f) => f.id === item.id);
        if (idx !== -1) {
          updatedQueue[idx].status = 'synced';
          await saveQueue(updatedQueue);
        }
      }
    } catch {
      // Sync failed — remains pending for later retry
    }
  }

  return item;
}

/**
 * Get all feedback items stored locally, sorted newest first.
 */
export async function getFeedbackHistory(): Promise<FeedbackItem[]> {
  const queue = await loadQueue();
  return queue.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Sync all pending feedback items to Supabase.
 * Returns the number of items successfully synced.
 */
export async function syncFeedback(): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const queue = await loadQueue();
  const pending = queue.filter((item) => item.status === 'pending');

  if (pending.length === 0) return 0;

  let syncedCount = 0;

  for (const item of pending) {
    try {
      const { error } = await supabase.from('feedback' as never).insert({
        id: item.id,
        type: item.type,
        message: item.message,
        screenshot: item.screenshot ?? null,
        user_id: item.userContext.userId,
        user_role: item.userContext.role,
        country: item.userContext.country,
        trade: item.userContext.trade ?? null,
        platform: item.deviceInfo.platform,
        platform_version: String(item.deviceInfo.platformVersion),
        app_version: item.deviceInfo.appVersion,
        created_at: item.createdAt,
      } as never);

      if (!error) {
        item.status = 'synced';
        syncedCount++;
      } else {
        item.status = 'failed';
      }
    } catch {
      item.status = 'failed';
    }
  }

  await saveQueue(queue);
  return syncedCount;
}

/**
 * Remove synced feedback items older than the given number of days.
 * Keeps pending/failed items for retry.
 */
export async function pruneSyncedFeedback(olderThanDays: number = 30): Promise<number> {
  const queue = await loadQueue();
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const kept = queue.filter((item) => {
    if (item.status !== 'synced') return true;
    return new Date(item.createdAt).getTime() > cutoff;
  });

  const pruned = queue.length - kept.length;
  if (pruned > 0) {
    await saveQueue(kept);
  }
  return pruned;
}
