// =============================================================================
// PUSH NOTIFICATION SERVICE
// =============================================================================
// Expo push notifications for payment reminders, follow-ups, and AI alerts
// Integrates with accounting loop for automated reminders
// =============================================================================

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS_PER_HOUR } from '../utils/timeConstants';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const TOKEN_KEY = '@vasco_push_token';
const DEVICE_ID_KEY = '@vasco_device_id';
const TOKEN_REFRESHED_AT_KEY = '@vasco_push_token_refreshed_at';
const TOKEN_REFRESH_MS = 7 * 24 * 60 * 60 * 1000; // Re-register weekly

/** Call on app foreground — re-registers with Expo if the token is older than
 *  a week or missing. Fast no-op when recent. */
export async function refreshPushTokenIfStale(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_REFRESHED_AT_KEY);
    const last = raw ? Number(raw) : 0;
    if (Date.now() - last < TOKEN_REFRESH_MS) return;
    const token = await registerForPushNotifications();
    if (token) await AsyncStorage.setItem(TOKEN_REFRESHED_AT_KEY, String(Date.now()));
  } catch {}
}

async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function persistPushTokenToSupabase(token: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const deviceId = await getOrCreateDeviceId();
    const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
    await (supabase.from('push_tokens' as any) as any).upsert(
      {
        user_id: user.id,
        device_id: deviceId,
        token,
        platform,
        app_version: Application.nativeApplicationVersion ?? null,
      },
      { onConflict: 'user_id,device_id' },
    );
  } catch {
    // Silent — push tokens are best-effort
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Vasco',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // EAS requires projectId for getExpoPushTokenAsync() outside the dev client.
    const projectId =
      (Constants.expoConfig?.extra as any)?.eas?.projectId ||
      (Constants as any).easConfig?.projectId;
    if (!projectId) {
      // No EAS project yet — skip remote token. Local notifications still work.
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    // Best-effort: register with backend for server-side fanout
    persistPushTokenToSupabase(token).catch(() => {});
    return token;
  } catch {
    return null;
  }
}

/** Remove the push token for this device from Supabase (call on logout). */
export async function unregisterPushToken(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) return;
    await supabase
      .from('push_tokens' as any)
      .delete()
      .eq('user_id', user.id)
      .eq('device_id', deviceId);
  } catch {}
}

export async function getPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Local notifications (no server needed)
// ---------------------------------------------------------------------------

export async function schedulePaymentReminder(data: {
  invoiceId: string;
  customerName: string;
  amount: number;
  daysUntilDue: number;
}): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Betaalherinnering',
        body: `Factuur voor ${data.customerName} (€${data.amount.toLocaleString(undefined)}) is over ${data.daysUntilDue} dagen verlopen`,
        data: { type: 'payment_reminder', invoiceId: data.invoiceId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: data.daysUntilDue * 86400,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleQuoteFollowUp(data: {
  quoteId: string;
  customerName: string;
  daysAfterSent?: number;
}): Promise<string | null> {
  try {
    const days = data.daysAfterSent ?? 3;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Offerte opvolgen',
        body: `Offerte voor ${data.customerName} is ${days} dagen geleden verstuurd — tijd om op te volgen`,
        data: { type: 'quote_followup', quoteId: data.quoteId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: days * 86400,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function scheduleJobReminder(data: {
  jobId: string;
  jobTitle: string;
  scheduledTime: Date;
}): Promise<string | null> {
  try {
    // Remind 1 hour before
    const reminderTime = new Date(data.scheduledTime.getTime() - MS_PER_HOUR);
    if (reminderTime.getTime() <= Date.now()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Klus herinnering',
        body: `${data.jobTitle} begint over 1 uur`,
        data: { type: 'job_reminder', jobId: data.jobId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function sendInstantNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null, // immediate
    });
  } catch {
    // Silent fail
  }
}

// ---------------------------------------------------------------------------
// Notification management
// ---------------------------------------------------------------------------

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

// ---------------------------------------------------------------------------
// Notification Grouping
// ---------------------------------------------------------------------------

import { useState, useEffect, useCallback } from 'react';
import {
  notificationService,
  type AppNotification,
  type NotificationType,
} from './notificationService';

export interface GroupedNotification {
  type: NotificationType;
  notifications: AppNotification[];
  count: number;
  latestAt: Date;
  /** Summary title when collapsed (e.g. "3 overdue invoices") */
  groupTitle: string;
  /** Deep link route for the group action */
  groupRoute?: string;
  isExpanded: boolean;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number; // 0-23
  startMinute: number;
  endHour: number;   // 0-23
  endMinute: number;
}

export interface PushNotificationAction {
  label: string;
  route: string;
  icon: string; // Ionicons name
}

const QUIET_HOURS_KEY = '@vasco_quiet_hours';
const GROUP_THRESHOLD = 3;

const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  startHour: 22,
  startMinute: 0,
  endHour: 7,
  endMinute: 0,
};

/** Maps each notification type to a deep link route and action buttons */
const TYPE_ROUTES: Record<NotificationType, { groupRoute: string; actions: PushNotificationAction[] }> = {
  overdue_invoice: {
    groupRoute: '/(contractor)/geld',
    actions: [
      { label: 'View invoices', route: '/(contractor)/geld', icon: 'document-text' },
      { label: 'Send reminder', route: '/contractor/payments', icon: 'send' },
    ],
  },
  schedule_change: {
    groupRoute: '/(contractor)/werk',
    actions: [
      { label: 'View schedule', route: '/(contractor)/werk', icon: 'calendar' },
    ],
  },
  team_assignment: {
    groupRoute: '/(contractor)/klanten',
    actions: [
      { label: 'View team', route: '/(contractor)/klanten', icon: 'people' },
    ],
  },
  approval_request: {
    groupRoute: '/(contractor)/vasco',
    actions: [
      { label: 'Review', route: '/(contractor)/vasco', icon: 'shield-checkmark' },
    ],
  },
  permit_update: {
    groupRoute: '/contractor/permits',
    actions: [
      { label: 'View permits', route: '/contractor/permits', icon: 'document-text' },
    ],
  },
  delivery_update: {
    groupRoute: '/(contractor)/werk',
    actions: [
      { label: 'View deliveries', route: '/(contractor)/werk', icon: 'cube' },
    ],
  },
  credential_expiry: {
    groupRoute: '/(contractor)/certificaten',
    actions: [
      { label: 'View certs', route: '/(contractor)/certificaten', icon: 'ribbon' },
    ],
  },
  general: {
    groupRoute: '/contractor/notifications',
    actions: [],
  },
};

const TYPE_GROUP_LABELS: Record<NotificationType, string> = {
  overdue_invoice: 'overdue invoices',
  schedule_change: 'schedule changes',
  team_assignment: 'team assignments',
  approval_request: 'approval requests',
  permit_update: 'permit updates',
  delivery_update: 'delivery updates',
  credential_expiry: 'expiring certificates',
  general: 'notifications',
};

// ---------------------------------------------------------------------------
// Grouping + Quiet Hours logic
// ---------------------------------------------------------------------------

let _quietHours: QuietHoursConfig = { ...DEFAULT_QUIET_HOURS };

async function loadQuietHours(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(QUIET_HOURS_KEY);
    if (stored) _quietHours = JSON.parse(stored);
  } catch { /* ignore */ }
}

// Load on import
loadQuietHours();

export function getQuietHours(): QuietHoursConfig {
  return { ..._quietHours };
}

export async function setQuietHours(config: QuietHoursConfig): Promise<void> {
  _quietHours = { ...config };
  try {
    await AsyncStorage.setItem(QUIET_HOURS_KEY, JSON.stringify(_quietHours));
  } catch { /* ignore */ }
}

export function isInQuietHours(now: Date = new Date()): boolean {
  if (!_quietHours.enabled) return false;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = _quietHours.startHour * 60 + _quietHours.startMinute;
  const endMinutes = _quietHours.endHour * 60 + _quietHours.endMinute;

  // Handle overnight range (e.g. 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

export function groupNotifications(notifications: AppNotification[]): GroupedNotification[] {
  const typeMap = new Map<NotificationType, AppNotification[]>();

  for (const n of notifications) {
    const existing = typeMap.get(n.type) || [];
    existing.push(n);
    typeMap.set(n.type, existing);
  }

  const groups: GroupedNotification[] = [];
  const ungrouped: AppNotification[] = [];

  for (const [type, items] of typeMap.entries()) {
    if (items.length >= GROUP_THRESHOLD) {
      const sortedItems = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const routeConfig = TYPE_ROUTES[type];
      groups.push({
        type,
        notifications: sortedItems,
        count: sortedItems.length,
        latestAt: sortedItems[0].createdAt,
        groupTitle: `${sortedItems.length} ${TYPE_GROUP_LABELS[type]}`,
        groupRoute: routeConfig.groupRoute,
        isExpanded: false,
      });
    } else {
      ungrouped.push(...items);
    }
  }

  // Add ungrouped notifications as single-item groups
  for (const n of ungrouped) {
    const routeConfig = TYPE_ROUTES[n.type];
    groups.push({
      type: n.type,
      notifications: [n],
      count: 1,
      latestAt: n.createdAt,
      groupTitle: n.title,
      groupRoute: n.actionRoute || routeConfig.groupRoute,
      isExpanded: true,
    });
  }

  groups.sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
  return groups;
}

/** Get action buttons for a notification type */
export function getActionsForType(type: NotificationType): PushNotificationAction[] {
  return TYPE_ROUTES[type]?.actions || [];
}

/** Should we show/deliver this push? Respects quiet hours + preferences */
export function shouldDeliver(type: NotificationType): boolean {
  if (isInQuietHours()) return false;
  const prefs = notificationService.getPreferences();
  const pref = prefs.find(p => p.type === type);
  return pref ? pref.enabled && pref.pushEnabled : true;
}

/** Sync badge count with actual unread count */
export async function syncBadgeWithUnread(): Promise<number> {
  const stats = notificationService.getStats();
  await setBadgeCount(stats.unread);
  return stats.unread;
}

// ---------------------------------------------------------------------------
// React Hooks
// ---------------------------------------------------------------------------

export function useGroupedNotifications(notifications: AppNotification[]) {
  const [groups, setGroups] = useState<GroupedNotification[]>([]);
  const [expandedTypes, setExpandedTypes] = useState<Set<NotificationType>>(new Set());

  useEffect(() => {
    const grouped = groupNotifications(notifications);
    const withExpansion = grouped.map(g => ({
      ...g,
      isExpanded: g.count === 1 || expandedTypes.has(g.type),
    }));
    setGroups(withExpansion);
  }, [notifications, expandedTypes]);

  const toggleGroup = useCallback((type: NotificationType) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  return { groups, toggleGroup };
}

export function useBadgeCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    getBadgeCount().then(setCount);
    return notificationService.subscribe(() => {
      syncBadgeWithUnread().then(setCount);
    });
  }, []);

  const reset = useCallback(async () => {
    await setBadgeCount(0);
    setCount(0);
  }, []);

  return { count, reset };
}

export function useQuietHours() {
  const [config, setConfig] = useState<QuietHoursConfig>(getQuietHours());

  const update = useCallback(async (newConfig: QuietHoursConfig) => {
    await setQuietHours(newConfig);
    setConfig(newConfig);
  }, []);

  const toggle = useCallback(async () => {
    const updated = { ...config, enabled: !config.enabled };
    await setQuietHours(updated);
    setConfig(updated);
  }, [config]);

  return { config, update, toggle };
}
