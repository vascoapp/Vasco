// =============================================================================
// SMART PRICE ALERT SERVICE
// =============================================================================
// Monitors prices and triggers alerts when conditions are met
// Learns from user actions to improve alert relevance
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { DEMO_MODE } from '../config/demo';

// ============================================
// TYPES
// ============================================

export interface PriceAlert {
  id: string;
  materialId: string;
  materialName: string;
  brand?: string;
  category: string;

  // Alert configuration
  type: 'price_drop' | 'price_target' | 'competitor_match' | 'bulk_opportunity';
  condition: AlertCondition;

  // Current state
  status: 'active' | 'triggered' | 'expired' | 'snoozed';
  createdAt: string;
  triggeredAt?: string;
  expiresAt?: string;
  snoozedUntil?: string;

  // Trigger data
  triggerPrice?: number;
  triggerSupplier?: string;
  currentPrice?: number;
  previousPrice?: number;
  savingsAmount?: number;
  savingsPercent?: number;

  // Learning
  priority: 'high' | 'medium' | 'low';
  confidenceScore: number; // 0-1, how relevant this alert is
  viewCount: number;
  actionTaken?: 'purchased' | 'dismissed' | 'snoozed' | 'ignored';
}

export interface AlertCondition {
  // Price drop alerts
  dropPercent?: number; // Alert when price drops by X%
  dropAmount?: number; // Alert when price drops by €X

  // Target price alerts
  targetPrice?: number; // Alert when price reaches target

  // Competitor alerts
  beatSupplier?: string; // Alert when another supplier beats this one

  // Bulk alerts
  bulkQuantity?: number; // Alert for bulk discounts
  bulkDiscount?: number; // Minimum discount %
}

export interface AlertNotification {
  id: string;
  alertId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sentAt: string;
  readAt?: string;
  actionedAt?: string;
}

export interface AlertPreferences {
  enabled: boolean;
  quietHoursStart?: string; // e.g., "22:00"
  quietHoursEnd?: string; // e.g., "07:00"
  channels: {
    push: boolean;
    email: boolean;
    inApp: boolean;
  };
  frequency: 'instant' | 'hourly' | 'daily';
  minimumSavings: number; // Don't alert for savings below this
  categories: string[]; // Only alert for these categories
}

// ============================================
// MOCK DATA
// ============================================

const DEMO_MOCK_ALERTS: PriceAlert[] = [
  {
    id: 'alert_1',
    materialId: 'mat_dulux_white_5l',
    materialName: 'Dulux Trade Eggshell White 5L',
    brand: 'Dulux',
    category: 'Verf',
    type: 'price_drop',
    condition: { dropPercent: 10 },
    status: 'triggered',
    createdAt: '2025-01-15T10:00:00Z',
    triggeredAt: '2025-01-30T14:30:00Z',
    triggerPrice: 23.40,
    triggerSupplier: 'Bouwmaat',
    currentPrice: 23.40,
    previousPrice: 28.50,
    savingsAmount: 5.10,
    savingsPercent: 18,
    priority: 'high',
    confidenceScore: 0.92,
    viewCount: 0,
  },
  {
    id: 'alert_2',
    materialId: 'mat_sigma_satin',
    materialName: 'Sigma S2U Allure 2.5L',
    brand: 'Sigma',
    category: 'Verf',
    type: 'price_target',
    condition: { targetPrice: 40 },
    status: 'active',
    createdAt: '2025-01-20T09:00:00Z',
    currentPrice: 42.00,
    priority: 'medium',
    confidenceScore: 0.75,
    viewCount: 2,
  },
  {
    id: 'alert_3',
    materialId: 'mat_grohe_kraan',
    materialName: 'Grohe Eurosmart Keukenkraan',
    brand: 'Grohe',
    category: 'Sanitair',
    type: 'competitor_match',
    condition: { beatSupplier: 'Technische Unie' },
    status: 'triggered',
    createdAt: '2025-01-10T11:00:00Z',
    triggeredAt: '2025-01-29T16:00:00Z',
    triggerPrice: 89.00,
    triggerSupplier: 'Sanitairwinkel.nl',
    currentPrice: 89.00,
    previousPrice: 92.50,
    savingsAmount: 3.50,
    savingsPercent: 4,
    priority: 'medium',
    confidenceScore: 0.81,
    viewCount: 1,
  },
  {
    id: 'alert_4',
    materialId: 'mat_flexa_chalk',
    materialName: 'Flexa Creations Chalk 1L',
    brand: 'Flexa',
    category: 'Verf',
    type: 'bulk_opportunity',
    condition: { bulkQuantity: 10, bulkDiscount: 15 },
    status: 'triggered',
    createdAt: '2025-01-25T08:00:00Z',
    triggeredAt: '2025-01-31T09:00:00Z',
    triggerPrice: 16.12,
    triggerSupplier: 'Verfwinkel.nl',
    currentPrice: 16.12,
    previousPrice: 18.95,
    savingsAmount: 28.30,
    savingsPercent: 15,
    priority: 'high',
    confidenceScore: 0.88,
    viewCount: 0,
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_ALERTS: PriceAlert[] = DEMO_MODE ? DEMO_MOCK_ALERTS : [];

const DEFAULT_PREFERENCES: AlertPreferences = {
  enabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  channels: {
    push: true,
    email: false,
    inApp: true,
  },
  frequency: 'instant',
  minimumSavings: 5,
  categories: [],
};

// ============================================
// SERVICE CLASS
// ============================================

class PriceAlertService {
  private alerts: Map<string, PriceAlert> = new Map();
  private preferences: AlertPreferences = DEFAULT_PREFERENCES;
  private listeners: Set<(alerts: PriceAlert[]) => void> = new Set();

  constructor() {
    // Initialize with mock data
    MOCK_ALERTS.forEach((alert) => this.alerts.set(alert.id, alert));
  }

  // -----------------------------------------
  // Alert Management
  // -----------------------------------------

  /**
   * Get all alerts
   */
  getAlerts(filter?: { status?: PriceAlert['status']; category?: string }): PriceAlert[] {
    let alerts = Array.from(this.alerts.values());

    if (filter?.status) {
      alerts = alerts.filter((a) => a.status === filter.status);
    }
    if (filter?.category) {
      alerts = alerts.filter((a) => a.category === filter.category);
    }

    // Sort by priority and trigger date
    return alerts.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.triggeredAt && b.triggeredAt) {
        return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
      }
      return 0;
    });
  }

  /**
   * Get triggered alerts (ready for action)
   */
  getTriggeredAlerts(): PriceAlert[] {
    return this.getAlerts({ status: 'triggered' });
  }

  /**
   * Get active alerts (watching)
   */
  getActiveAlerts(): PriceAlert[] {
    return this.getAlerts({ status: 'active' });
  }

  /**
   * Create a new price alert
   */
  createAlert(params: {
    materialId: string;
    materialName: string;
    brand?: string;
    category: string;
    type: PriceAlert['type'];
    condition: AlertCondition;
    expiresAt?: string;
  }): PriceAlert {
    const alert: PriceAlert = {
      id: `alert_${Date.now()}`,
      ...params,
      status: 'active',
      createdAt: new Date().toISOString(),
      priority: this.calculatePriority(params),
      confidenceScore: 0.7, // Default confidence
      viewCount: 0,
    };

    this.alerts.set(alert.id, alert);
    this.notifyListeners();

    trackUserAction('price_alert_created', {
      alertId: alert.id,
      materialId: params.materialId,
      type: params.type,
      condition: params.condition,
    });

    return alert;
  }

  /**
   * Update alert status
   */
  updateAlertStatus(
    alertId: string,
    status: PriceAlert['status'],
    action?: PriceAlert['actionTaken']
  ): void {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.status = status;
    if (action) {
      alert.actionTaken = action;
    }

    this.notifyListeners();

    trackUserAction('price_alert_actioned', {
      alertId,
      status,
      action,
      savingsAmount: alert.savingsAmount,
    });
  }

  /**
   * Snooze an alert
   */
  snoozeAlert(alertId: string, hours: number): void {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    const snoozedUntil = new Date();
    snoozedUntil.setHours(snoozedUntil.getHours() + hours);

    alert.status = 'snoozed';
    alert.snoozedUntil = snoozedUntil.toISOString();
    alert.actionTaken = 'snoozed';

    this.notifyListeners();

    trackUserAction('price_alert_snoozed', {
      alertId,
      hours,
    });
  }

  /**
   * Dismiss an alert
   */
  dismissAlert(alertId: string, reason?: string): void {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.status = 'expired';
    alert.actionTaken = 'dismissed';

    this.notifyListeners();

    trackUserAction('price_alert_dismissed', {
      alertId,
      reason,
      savingsAmount: alert.savingsAmount,
    });
  }

  /**
   * Mark alert as purchased
   */
  markPurchased(alertId: string, details?: { actualPrice?: number; supplier?: string }): void {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.status = 'expired';
    alert.actionTaken = 'purchased';

    this.notifyListeners();

    trackUserAction('price_alert_purchased', {
      alertId,
      savingsAmount: alert.savingsAmount,
      actualPrice: details?.actualPrice,
      supplier: details?.supplier,
    });
  }

  /**
   * Delete an alert
   */
  deleteAlert(alertId: string): void {
    this.alerts.delete(alertId);
    this.notifyListeners();
  }

  /**
   * Record alert view
   */
  recordView(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.viewCount++;
    }
  }

  // -----------------------------------------
  // Preferences
  // -----------------------------------------

  /**
   * Get alert preferences
   */
  getPreferences(): AlertPreferences {
    return { ...this.preferences };
  }

  /**
   * Update alert preferences
   */
  updatePreferences(updates: Partial<AlertPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };

    trackUserAction('alert_preferences_updated', updates);
  }

  // -----------------------------------------
  // Smart Features
  // -----------------------------------------

  /**
   * Get suggested alerts based on purchase history
   */
  getSuggestedAlerts(): Array<{
    materialId: string;
    materialName: string;
    category: string;
    reason: string;
    potentialSavings: number;
  }> {
    // In production, this would analyze purchase history
    return [
      {
        materialId: 'mat_sikkens_rubbol',
        materialName: 'Sikkens Rubbol BL Satin',
        category: 'Verf',
        reason: 'Je koopt dit vaak en prijs schommelt 15%',
        potentialSavings: 45,
      },
      {
        materialId: 'mat_geberit_sigma',
        materialName: 'Geberit Sigma50 Bedieningsplaat',
        category: 'Sanitair',
        reason: 'Prijzen dalen gemiddeld 10% in februari',
        potentialSavings: 25,
      },
    ];
  }

  /**
   * Get alert statistics
   */
  getStatistics(): {
    totalAlerts: number;
    triggeredCount: number;
    totalSavings: number;
    avgSavingsPercent: number;
    actedOnRate: number;
  } {
    const alerts = Array.from(this.alerts.values());
    const triggered = alerts.filter((a) => a.status === 'triggered' || a.actionTaken);
    const actedOn = alerts.filter((a) => a.actionTaken === 'purchased');
    const totalSavings = actedOn.reduce((sum, a) => sum + (a.savingsAmount || 0), 0);
    const avgSavings = triggered.length > 0
      ? triggered.reduce((sum, a) => sum + (a.savingsPercent || 0), 0) / triggered.length
      : 0;

    return {
      totalAlerts: alerts.length,
      triggeredCount: triggered.length,
      totalSavings,
      avgSavingsPercent: Math.round(avgSavings),
      actedOnRate: triggered.length > 0 ? Math.round((actedOn.length / triggered.length) * 100) : 0,
    };
  }

  // -----------------------------------------
  // Private Methods
  // -----------------------------------------

  private calculatePriority(params: { condition: AlertCondition; category: string }): PriceAlert['priority'] {
    // Simple priority calculation
    if (params.condition.dropPercent && params.condition.dropPercent >= 15) return 'high';
    if (params.condition.bulkDiscount && params.condition.bulkDiscount >= 15) return 'high';
    if (params.condition.targetPrice) return 'medium';
    return 'medium';
  }

  private notifyListeners(): void {
    const alerts = this.getAlerts();
    this.listeners.forEach((listener) => listener(alerts));
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: (alerts: PriceAlert[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const priceAlertService = new PriceAlertService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback } from 'react';

export function usePriceAlerts(filter?: { status?: PriceAlert['status']; category?: string }) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => priceAlertService.getAlerts(filter));

  useEffect(() => {
    const unsubscribe = priceAlertService.subscribe((allAlerts) => {
      let filtered = allAlerts;
      if (filter?.status) {
        filtered = filtered.filter((a) => a.status === filter.status);
      }
      if (filter?.category) {
        filtered = filtered.filter((a) => a.category === filter.category);
      }
      setAlerts(filtered);
    });

    return unsubscribe;
  }, [filter?.status, filter?.category]);

  const createAlert = useCallback((params: Parameters<typeof priceAlertService.createAlert>[0]) => {
    return priceAlertService.createAlert(params);
  }, []);

  const dismissAlert = useCallback((alertId: string, reason?: string) => {
    priceAlertService.dismissAlert(alertId, reason);
  }, []);

  const snoozeAlert = useCallback((alertId: string, hours: number) => {
    priceAlertService.snoozeAlert(alertId, hours);
  }, []);

  const markPurchased = useCallback((alertId: string, details?: { actualPrice?: number; supplier?: string }) => {
    priceAlertService.markPurchased(alertId, details);
  }, []);

  return {
    alerts,
    createAlert,
    dismissAlert,
    snoozeAlert,
    markPurchased,
    statistics: priceAlertService.getStatistics(),
    suggestedAlerts: priceAlertService.getSuggestedAlerts(),
  };
}

export function useTriggeredAlerts() {
  return usePriceAlerts({ status: 'triggered' });
}

export function useAlertPreferences() {
  const [preferences, setPreferences] = useState<AlertPreferences>(
    priceAlertService.getPreferences()
  );

  const updatePreferences = useCallback((updates: Partial<AlertPreferences>) => {
    priceAlertService.updatePreferences(updates);
    setPreferences(priceAlertService.getPreferences());
  }, []);

  return { preferences, updatePreferences };
}
