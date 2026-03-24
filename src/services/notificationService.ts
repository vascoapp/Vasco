// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================
// Local notification management for schedule changes, overdue alerts,
// team assignments, and approval requests.
// Ready to wire to expo-notifications when installed.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { MS_PER_DAY, MS_PER_HOUR } from '../utils/timeConstants';

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
// MOCK DATA
// =============================================================================

const now = new Date();

const mockNotifications: AppNotification[] = [
  {
    id: 'n-1', type: 'approval_request', priority: 'high',
    title: 'Offerte wacht op goedkeuring',
    body: 'Q-2026-0055 voor Bakkerij Jansen (€3.800) wacht op uw goedkeuring.',
    read: false, actionRoute: '/(contractor)/facturen', actionLabel: 'Bekijk',
    createdAt: new Date(now.getTime() - MS_PER_HOUR * 2),
  },
  {
    id: 'n-2', type: 'overdue_invoice', priority: 'urgent',
    title: '2 facturen verlopen',
    body: '€344,85 openstaand bij Bakkerij Jansen — 5 dagen verlopen.',
    read: false, actionRoute: '/(contractor)/facturen',
    createdAt: new Date(now.getTime() - MS_PER_HOUR * 6),
  },
  {
    id: 'n-3', type: 'schedule_change', priority: 'medium',
    title: 'Planning gewijzigd',
    body: 'Warmtepomp installatie is verplaatst naar morgen 08:00.',
    read: false,
    createdAt: new Date(now.getTime() - MS_PER_HOUR * 12),
  },
  {
    id: 'n-4', type: 'delivery_update', priority: 'medium',
    title: 'Levering bevestigd',
    body: 'PO-2026-0042 van Technische Unie wordt morgen geleverd.',
    read: true, actionRoute: '/contractor/purchase-orders',
    createdAt: new Date(now.getTime() - MS_PER_DAY),
  },
  {
    id: 'n-5', type: 'team_assignment', priority: 'low',
    title: 'Jan de Vries toegewezen',
    body: 'Onderaannemer Jan de Vries is toegewezen aan Warmtepomp installatie.',
    read: true,
    createdAt: new Date(now.getTime() - MS_PER_DAY * 2),
  },
  {
    id: 'n-6', type: 'credential_expiry', priority: 'high',
    title: 'Certificaat verloopt binnenkort',
    body: 'KOMO Keurmerk van Pieter Bakker verloopt op 10 apr 2026.',
    read: true,
    createdAt: new Date(now.getTime() - MS_PER_DAY * 3),
  },
];

const defaultPreferences: NotificationPreference[] = [
  { type: 'schedule_change', label: 'Planningswijzigingen', enabled: true, pushEnabled: true },
  { type: 'overdue_invoice', label: 'Verlopen facturen', enabled: true, pushEnabled: true },
  { type: 'team_assignment', label: 'Teamtoewijzingen', enabled: true, pushEnabled: false },
  { type: 'approval_request', label: 'Goedkeuringsverzoeken', enabled: true, pushEnabled: true },
  { type: 'permit_update', label: 'Vergunning updates', enabled: true, pushEnabled: false },
  { type: 'delivery_update', label: 'Leveringsupdates', enabled: true, pushEnabled: false },
  { type: 'credential_expiry', label: 'Certificaat verlopen', enabled: true, pushEnabled: true },
  { type: 'general', label: 'Algemeen', enabled: true, pushEnabled: false },
];

// =============================================================================
// SERVICE
// =============================================================================

type NotifListener = () => void;

class NotificationService {
  private static instance: NotificationService;
  private listeners: Set<NotifListener> = new Set();
  private notifications: AppNotification[] = [...mockNotifications];
  private preferences: NotificationPreference[] = [...defaultPreferences];

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
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
    if (n) { n.read = true; this.notify(); }
  }

  markAllRead(): void {
    this.notifications.forEach(n => { n.read = true; });
    this.notify();
  }

  addNotification(type: NotificationType, priority: NotificationPriority, title: string, body: string, actionRoute?: string): void {
    this.notifications.unshift({
      id: `n-${Date.now()}`,
      type, priority, title, body,
      read: false, actionRoute,
      createdAt: new Date(),
    });
    this.notify();
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

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPreference[]>(notificationService.getPreferences());
  useEffect(() => notificationService.subscribe(() => setPrefs(notificationService.getPreferences())), []);
  const toggle = useCallback((type: NotificationType, field: 'enabled' | 'pushEnabled') =>
    notificationService.togglePreference(type, field), []);
  return { preferences: prefs, toggle };
}
