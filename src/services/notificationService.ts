// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================
// Local notification management for schedule changes, overdue alerts,
// team assignments, and approval requests.
// Ready to wire to expo-notifications when installed.
// =============================================================================

import { formatMoney } from '../i18n/formatting';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS_PER_DAY, MS_PER_HOUR } from '../utils/timeConstants';
import { registerSingletonReset } from './singletonReset';

const PERSIST_KEY = '@vasco_notifications_v2';

// =============================================================================
// TYPES
// =============================================================================

export type NotificationType =
  | 'schedule_change'
  | 'overdue_invoice'
  | 'team_assignment'
  | 'approval_request'
  | 'permit_update'
  | 'delivery_update'
  | 'credential_expiry'
  | 'general';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AppNotification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  read: boolean;
  actionRoute?: string;
  actionLabel?: string;
  createdAt: Date;
}

export interface NotificationPreference {
  type: NotificationType;
  label: string;
  enabled: boolean;
  pushEnabled: boolean;
}

export interface NotificationStats {
  total: number;
  unread: number;
  urgent: number;
}

// =============================================================================
// DEFAULT PREFERENCES
// =============================================================================
// Labels are i18n keys looked up at render time, so the same data drives
// every locale. Translation lives in src/i18n/locales/{xx}.json under
// notifications.prefLabels.*
//
// R272 — removed the 6 hardcoded Dutch mock notifications that referenced
// fake job/invoice IDs (q-seed-3, inv-seed-1, etc.). The notifications
// screen now derives live notifications from real AppState data via
// `deriveLiveNotifications()`, and persists user-fired ones to
// AsyncStorage so they survive app reload.

const defaultPreferences: NotificationPreference[] = [
  { type: 'schedule_change', label: 'notifications.prefLabels.schedule_change', enabled: true, pushEnabled: true },
  { type: 'overdue_invoice', label: 'notifications.prefLabels.overdue_invoice', enabled: true, pushEnabled: true },
  { type: 'team_assignment', label: 'notifications.prefLabels.team_assignment', enabled: true, pushEnabled: false },
  { type: 'approval_request', label: 'notifications.prefLabels.approval_request', enabled: true, pushEnabled: true },
  { type: 'permit_update', label: 'notifications.prefLabels.permit_update', enabled: true, pushEnabled: false },
  { type: 'delivery_update', label: 'notifications.prefLabels.delivery_update', enabled: true, pushEnabled: false },
  { type: 'credential_expiry', label: 'notifications.prefLabels.credential_expiry', enabled: true, pushEnabled: true },
  { type: 'general', label: 'notifications.prefLabels.general', enabled: true, pushEnabled: false },
];

// =============================================================================
// SERVICE
// =============================================================================

type NotifListener = () => void;

class NotificationService {
  private static instance: NotificationService;
  private listeners: Set<NotifListener> = new Set();
  private notifications: AppNotification[] = [];
  private preferences: NotificationPreference[] = [...defaultPreferences];
  private hydrated = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
      NotificationService.instance.hydrate();
      // R47/R48: clear in-memory notifications + preferences on user
      // change. Singleton survives logout, so without this user A's
      // marked-read notifications + preference toggles would carry over to
      // user B. Routed through registerSingletonReset for centralized wiring.
      registerSingletonReset((userId) => {
        NotificationService.instance.notifications = [];
        NotificationService.instance.preferences = [...defaultPreferences];
        NotificationService.instance.hydrated = false;
        NotificationService.instance.notify();
        if (userId) NotificationService.instance.hydrate();
      });
    }
    return NotificationService.instance;
  }

  /** Load persisted user-fired notifications on first instantiation. */
  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(PERSIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppNotification[];
        if (Array.isArray(parsed)) {
          // Revive Date objects from ISO strings
          this.notifications = parsed.map((n) => ({
            ...n,
            createdAt: new Date(n.createdAt as any),
          }));
          this.notify();
        }
      }
    } catch {
      // Ignore; start with empty list
    }
    this.hydrated = true;
  }

  private async persist(): Promise<void> {
    try {
      // Trim to last 50 — older notifications drop off
      const trimmed = this.notifications.slice(0, 50);
      await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(trimmed));
    } catch {
      // Silent
    }
  }

  subscribe(listener: NotifListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getNotifications(): AppNotification[] { return this.notifications; }

  getUnread(): AppNotification[] { return this.notifications.filter(n => !n.read); }

  getPreferences(): NotificationPreference[] { return this.preferences; }

  markRead(id: string): void {
    const n = this.notifications.find(x => x.id === id);
    if (n) { n.read = true; this.notify(); this.persist(); }
  }

  markAllRead(): void {
    this.notifications.forEach(n => { n.read = true; });
    this.notify();
    this.persist();
  }

  addNotification(type: NotificationType, priority: NotificationPriority, title: string, body: string, actionRoute?: string): void {
    // Dedup: same type+title+body within last 5min collapses
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const dup = this.notifications.find(
      (n) => n.type === type && n.title === title && n.body === body && n.createdAt.getTime() > fiveMinAgo,
    );
    if (dup) return;

    this.notifications.unshift({
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type, priority, title, body,
      read: false, actionRoute,
      createdAt: new Date(),
    });
    this.notify();
    this.persist();
  }

  togglePreference(type: NotificationType, field: 'enabled' | 'pushEnabled'): void {
    const pref = this.preferences.find(p => p.type === type);
    if (pref) {
      pref[field] = !pref[field];
      this.notify();
    }
  }

  getStats(): NotificationStats {
    return {
      total: this.notifications.length,
      unread: this.notifications.filter(n => !n.read).length,
      urgent: this.notifications.filter(n => !n.read && n.priority === 'urgent').length,
    };
  }
}

export const notificationService = NotificationService.getInstance();

// =============================================================================
// HOOKS
// =============================================================================

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setNotifications(notificationService.getNotifications());
    return notificationService.subscribe(() => setNotifications(notificationService.getNotifications()));
  }, []);

  const markRead = useCallback((id: string) => notificationService.markRead(id), []);
  const markAllRead = useCallback(() => notificationService.markAllRead(), []);

  return { notifications, markRead, markAllRead };
}

export function useUnreadCount() {
  const [stats, setStats] = useState<NotificationStats>(notificationService.getStats());
  useEffect(() => {
    setStats(notificationService.getStats());
    return notificationService.subscribe(() => setStats(notificationService.getStats()));
  }, []);
  return stats;
}

/** Fire a notification from anywhere in the app */
export function fireNotification(
  type: NotificationType,
  priority: 'urgent' | 'high' | 'medium' | 'low',
  title: string,
  body: string,
  actionRoute?: string,
): void {
  notificationService.addNotification(type, priority, title, body, actionRoute);
}

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>(notificationService.getPreferences());
  useEffect(() => notificationService.subscribe(() => setPrefs(notificationService.getPreferences())), []);
  const toggle = useCallback((type: NotificationType, field: 'enabled' | 'pushEnabled') =>
    notificationService.togglePreference(type, field), []);
  return { preferences: prefs, toggle };
}

// =============================================================================
// LIVE-DERIVED NOTIFICATIONS (R272)
// =============================================================================
// Generate notifications on the fly from real AppState data so the inbox is
// never empty when the contractor has actionable items. These are virtual —
// they don't persist or count toward markRead state. Combined with the
// persisted user-fired list at the screen level.

export interface DerivableState {
  invoices: Array<{ id: string; status: string; dueInDays?: number; amount?: number; customer?: string }>;
  jobs: Array<{ id: string; title?: string; status?: string; scheduledDate?: string }>;
  certifications?: Array<{ id: string; name?: string; expiresAt?: string }>;
}

export function deriveLiveNotifications(state: DerivableState): AppNotification[] {
  const out: AppNotification[] = [];
  const todayStr = new Date().toISOString().split('T')[0];

  // Overdue invoices → urgent virtual notifications.
  // Skip paid/partial — only unsent/overdue trigger reminders.
  const PAID_STATUSES = new Set(['paid', 'partial', 'draft']);
  for (const inv of state.invoices ?? []) {
    if (PAID_STATUSES.has(inv.status)) continue;
    if (inv.status === 'overdue' || (typeof inv.dueInDays === 'number' && inv.dueInDays < 0)) {
      const days = Math.abs(inv.dueInDays ?? 0);
      out.push({
        id: `live-invoice-${inv.id}`,
        type: 'overdue_invoice',
        priority: days > 14 ? 'urgent' : 'high',
        title: 'Invoice overdue',
        body: `${inv.customer ? `${inv.customer} — ` : ''}invoice ${inv.id} is ${days} days overdue${inv.amount ? ` (${formatMoney(Math.round(inv.amount))})` : ''}.`,
        read: false,
        actionRoute: `/invoices/${inv.id}`,
        createdAt: new Date(Date.now() - MS_PER_HOUR * Math.min(days, 24)),
      });
    }
  }

  // Today's scheduled jobs → medium "schedule" notifications (low priority,
  // fewer surfaced)
  const todayJobs = (state.jobs ?? []).filter(
    (j) => j.scheduledDate === todayStr && (j.status === 'scheduled' || j.status === 'in-progress'),
  );
  if (todayJobs.length > 0) {
    out.push({
      id: 'live-today-schedule',
      type: 'schedule_change',
      priority: 'medium',
      title: `${todayJobs.length} job${todayJobs.length > 1 ? 's' : ''} today`,
      body: todayJobs.slice(0, 3).map((j) => j.title).filter(Boolean).join(', ') + (todayJobs.length > 3 ? '…' : ''),
      read: false,
      actionRoute: '/contractor/drag-schedule',
      createdAt: new Date(Date.now() - MS_PER_HOUR * 1),
    });
  }

  // Expiring certifications (≤30 days)
  for (const cert of state.certifications ?? []) {
    if (!cert.expiresAt) continue;
    const daysUntil = Math.floor((new Date(cert.expiresAt).getTime() - Date.now()) / MS_PER_DAY);
    if (daysUntil >= 0 && daysUntil <= 30) {
      out.push({
        id: `live-cert-${cert.id}`,
        type: 'credential_expiry',
        priority: daysUntil <= 7 ? 'urgent' : 'high',
        title: 'Certificate expiring',
        body: `${cert.name ?? 'Certificate'} expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
        read: false,
        actionRoute: '/(contractor)/certificaten',
        createdAt: new Date(Date.now() - MS_PER_HOUR * 2),
      });
    }
  }

  return out;
}

/**
 * Combine derived (real-data) + persisted (user-fired) into a single feed.
 * Pass the AppState's invoices/jobs/certifications arrays.
 */
export function useCombinedNotifications(state: DerivableState) {
  const { notifications: persisted, markRead, markAllRead } = useNotifications();
  const derived = useMemo(() => deriveLiveNotifications(state), [
    state.invoices, state.jobs, state.certifications,
  ]);
  const merged = useMemo(() => {
    // Persisted first (newest user-actions), derived after
    const all = [...persisted, ...derived];
    // Dedup by id
    const seen = new Set<string>();
    return all.filter((n) => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  }, [persisted, derived]);

  return { notifications: merged, markRead, markAllRead };
}
