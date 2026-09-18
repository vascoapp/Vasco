// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================
// Local notification management for schedule changes, overdue alerts,
// team assignments, and approval requests.
// Ready to wire to expo-notifications when installed.
// =============================================================================

import { formatMoney } from '../i18n/formatting';
import { documentNumber } from '../domain/documents';
import { daysOverdue } from '../utils/invoiceDue';
import i18n from '../i18n/i18n';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS_PER_DAY, MS_PER_HOUR } from '../utils/timeConstants';
import { registerSingletonReset } from './singletonReset';
// STATIC, not `await import(...)`: a dynamic import throws under jest without
// --experimental-vm-modules and the try/catch below would swallow it, leaving
// every stored copy ownerless and dropped on the next launch (#300's trap).
import { getAuthedUserId } from '../lib/currentUser';
import { todayKey } from '../utils/dateKey';

const PERSIST_KEY = '@vasco_notifications_v2';
// Which notification types the contractor wants. Separate key: the inbox is
// trimmed to 50 and rewritten constantly, and a preference must not ride on
// that. Every switch on the notifications screen used to live in memory only —
// muting "Angebot abgelaufen" lasted until the app was next killed (#339).
const PREFS_KEY = '@vasco_notification_prefs_v1';
/**
 * Which account the two stored copies belong to.
 *
 * Wiping them on every user CHANGE was wrong, because a cold start is one:
 * `currentUserId` starts as the `'current-user'` placeholder and becomes the
 * real id the moment AuthContext restores the session, so every launch deleted
 * the inbox and the mute list of the account that was still signed in. The
 * data has to be dropped when it belongs to SOMEONE ELSE, which is a different
 * question — and only this owner tag can answer it.
 */
const OWNER_KEY = '@vasco_notifications_owner_v1';

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
  // Two events the app actually pushes that had NO type here, so the
  // notifications screen could not offer a switch for them and
  // `shouldDeliver()` had nothing to check: a payment landing
  // (invoicePaymentWatcher) and a customer accepting / asking for a change
  // (customerInteractionWatcher). Both pushed regardless of any setting
  // (sweep 2026-09-18).
  | 'invoice_paid'
  | 'customer_interaction'
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
  { type: 'invoice_paid', label: 'notifications.prefLabels.invoice_paid', enabled: true, pushEnabled: true },
  { type: 'customer_interaction', label: 'notifications.prefLabels.customer_interaction', enabled: true, pushEnabled: true },
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
  // Cloned per ELEMENT, not just the array: `togglePreference` mutates the
  // objects in place, so `[...defaultPreferences]` let one account's toggle
  // rewrite the module-level defaults that every later account starts from.
  private preferences: NotificationPreference[] = defaultPreferences.map((p) => ({ ...p }));
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
        const inst = NotificationService.instance;
        inst.notifications = [];
        inst.preferences = defaultPreferences.map((p) => ({ ...p }));
        inst.hydrated = false;
        inst.notify();
        // BOTH stored copies belong to the account that just left, and both
        // must be gone BEFORE the next account hydrates — clearing the memory
        // and then re-reading the same keys handed user B user A's inbox and
        // (once preferences persisted) their mute list. Awaited via the chain,
        // not fired alongside hydrate().
        void AsyncStorage.getItem(OWNER_KEY)
          .catch(() => null)
          .then(async (owner) => {
            // Same account arriving from the placeholder (every cold start):
            // keep what is on disk. A different account, or a logout: the
            // stored copies belong to whoever left, and must be gone BEFORE
            // the next account hydrates — clearing memory and then re-reading
            // the same keys handed user B user A's inbox and mute list.
            if (owner && userId && owner === userId) { if (userId) await inst.hydrate(); return; }
            await Promise.all([
              AsyncStorage.removeItem(PERSIST_KEY).catch(() => {}),
              AsyncStorage.removeItem(PREFS_KEY).catch(() => {}),
              AsyncStorage.removeItem(OWNER_KEY).catch(() => {}),
            ]);
            if (userId) await inst.hydrate();
          });
      });
    }
    return NotificationService.instance;
  }

  /** Load persisted user-fired notifications + preferences on first instantiation. */
  private async hydrate(): Promise<void> {
    if (this.hydrated) return;
    try {
      const rawPrefs = await AsyncStorage.getItem(PREFS_KEY);
      if (rawPrefs) {
        const saved = JSON.parse(rawPrefs) as Array<{ type: NotificationType; enabled?: boolean; pushEnabled?: boolean }>;
        if (Array.isArray(saved)) {
          // Merge onto the defaults by type, so a type added in a later release
          // arrives with its default rather than missing from the screen.
          this.preferences = defaultPreferences.map((d) => {
            const hit = saved.find((x) => x?.type === d.type);
            return hit ? { ...d, enabled: hit.enabled ?? d.enabled, pushEnabled: hit.pushEnabled ?? d.pushEnabled } : { ...d };
          });
          this.notify();
        }
      }
    } catch {
      // Ignore; keep the defaults.
    }
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
      await this.stampOwner();
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
      this.persistPreferences();
    }
  }

  /** Record who the stored copies belong to; see OWNER_KEY. */
  private async stampOwner(): Promise<void> {
    try {
      const id = getAuthedUserId();
      if (id) await AsyncStorage.setItem(OWNER_KEY, id);
    } catch {
      // Ignore: an unstamped copy is treated as someone else's and dropped,
      // which is the safe direction.
    }
  }

  private async persistPreferences(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        PREFS_KEY,
        JSON.stringify(this.preferences.map(({ type, enabled, pushEnabled }) => ({ type, enabled, pushEnabled }))),
      );
      // A mute is often the FIRST thing written — without this stamp the
      // preferences would be ownerless and dropped on the next launch.
      await this.stampOwner();
    } catch {
      // Silent — the switch still reflects this session.
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
  const todayStr = todayKey();

  // Overdue invoices → urgent virtual notifications.
  // Skip paid/partial — only unsent/overdue trigger reminders.
  const PAID_STATUSES = new Set(['paid', 'partial', 'draft']);
  for (const inv of state.invoices ?? []) {
    if (PAID_STATUSES.has(inv.status)) continue;
    // Derived from dueDate, not the stored dueInDays snapshot: that field is
    // frozen at send time and decays, which had this inbox saying "14 dagen
    // achterstallig" for an invoice the Geld tab correctly called 32.
    const overdueDays = daysOverdue(inv);
    if (inv.status === 'overdue' || (overdueDays !== null && overdueDays > 0)) {
      const days = overdueDays ?? 0;
      out.push({
        id: `live-invoice-${inv.id}`,
        type: 'overdue_invoice',
        priority: days > 14 ? 'urgent' : 'high',
        // Was hardcoded English AND interpolated the raw row id
        // ("invoice i-1043 is 10 days overdue") into a notification a Dutch
        // contractor reads. `reference` is the human document number.
        title: i18n.t('notifications.invoiceOverdueTitle', { defaultValue: 'Invoice overdue' }),
        body: i18n.t('notifications.invoiceOverdueBody', {
          defaultValue: '{{customer}}invoice {{ref}} is {{days}} days overdue{{amount}}.',
          customer: inv.customer ? `${inv.customer} — ` : '',
          // `invoiceNumber` is not a field on Invoice and `reference` has no
          // writer, so this rendered "invoice  is 10 days overdue" — the
          // document number the contractor is chasing was missing from the
          // notification about chasing it.
          ref: documentNumber(inv),
          days,
          amount: inv.amount ? ` (${formatMoney(Math.round(inv.amount))})` : '',
        }).replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1'),
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
      title: i18n.t('notifications.jobsTodayTitle', { count: todayJobs.length, defaultValue: '{{count}} jobs today' }),
      body: todayJobs.slice(0, 3).map((j) => j.title).filter(Boolean).join(', ') + (todayJobs.length > 3 ? '…' : ''),
      read: false,
      actionRoute: '/contractor/schedule',
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
        title: i18n.t('notifications.certExpiringTitle', { defaultValue: 'Certificate expiring' }),
        body: i18n.t('notifications.certExpiringBody', {
          count: daysUntil,
          name: cert.name ?? i18n.t('notifications.certFallback', { defaultValue: 'Certificate' }),
          defaultValue: '{{name}} expires in {{count}} days.',
        }),
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
