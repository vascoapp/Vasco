// =============================================================================
// SUPPLIER RELIABILITY SERVICE
// =============================================================================
// Tracks supplier performance, detects reliability drift, and suggests alternatives
// Implements the Supplier Reliability Tracking feature (P1 - a16z E11 Predictive)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { registerSingletonReset } from './singletonReset';
import type {
  Supplier,
  SupplierCategory,
  SupplierMetrics,
  SupplierPerformance,
  DeliveryRecord,
  DriftAlert,
  DriftType,
  DriftSeverity,
  SupplierRanking,
  AlternativeSupplier,
  AlternativeSuggestion,
  SupplierReliabilityStats,
  ReliabilityThresholds,
  MetricWeights,
} from '../types/supplier-reliability';
import {
  DEFAULT_RELIABILITY_THRESHOLDS,
  DEFAULT_METRIC_WEIGHTS,
} from '../types/supplier-reliability';

// ============================================
// MOCK DATA
// ============================================

const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'BuildMart Supplies',
    category: 'materials',
    contactEmail: 'orders@buildmart.com',
    contactPhone: '+44 20 1234 5678',
    paymentTerms: 'Net 30',
    preferredStatus: true,
    activeStatus: 'active',
    createdAt: '2023-01-15',
    updatedAt: '2025-01-20',
  },
  {
    id: 'sup-2',
    name: 'ProPaint Distributors',
    category: 'materials',
    contactEmail: 'sales@propaint.co.uk',
    contactPhone: '+44 20 2345 6789',
    paymentTerms: 'Net 14',
    preferredStatus: true,
    activeStatus: 'active',
    createdAt: '2023-03-20',
    updatedAt: '2025-01-18',
  },
  {
    id: 'sup-3',
    name: 'QuickFix Equipment',
    category: 'equipment',
    contactEmail: 'hire@quickfix.com',
    paymentTerms: 'Net 7',
    preferredStatus: false,
    activeStatus: 'active',
    createdAt: '2024-02-10',
    updatedAt: '2025-01-15',
  },
  {
    id: 'sup-4',
    name: 'SafetyFirst Supplies',
    category: 'safety',
    contactEmail: 'orders@safetyfirst.co.uk',
    paymentTerms: 'Net 30',
    preferredStatus: true,
    activeStatus: 'active',
    createdAt: '2023-06-01',
    updatedAt: '2025-01-22',
  },
  {
    id: 'sup-5',
    name: 'ValueBuild Materials',
    category: 'materials',
    contactEmail: 'sales@valuebuild.com',
    paymentTerms: 'Net 30',
    preferredStatus: false,
    activeStatus: 'probation',
    createdAt: '2024-05-15',
    updatedAt: '2025-01-10',
  },
];

const MOCK_DELIVERY_RECORDS: DeliveryRecord[] = [
  {
    id: 'del-1',
    supplierId: 'sup-1',
    orderId: 'ord-1',
    orderDate: '2025-01-10',
    expectedDeliveryDate: '2025-01-15',
    actualDeliveryDate: '2025-01-15',
    status: 'delivered',
    qualityScore: 95,
    hasIssues: false,
    orderedQuantity: 50,
    deliveredQuantity: 50,
    unit: 'bags',
    orderedAmount: 750,
    invoicedAmount: 750,
    currency: 'GBP',
    recordedBy: 'user-1',
    recordedAt: '2025-01-15T14:30:00Z',
  },
  {
    id: 'del-2',
    supplierId: 'sup-1',
    orderId: 'ord-2',
    orderDate: '2025-01-18',
    expectedDeliveryDate: '2025-01-22',
    actualDeliveryDate: '2025-01-23',
    status: 'delayed',
    delayDays: 1,
    qualityScore: 90,
    hasIssues: false,
    orderedQuantity: 30,
    deliveredQuantity: 30,
    unit: 'bags',
    orderedAmount: 450,
    invoicedAmount: 450,
    currency: 'GBP',
    recordedBy: 'user-1',
    recordedAt: '2025-01-23T10:00:00Z',
  },
  {
    id: 'del-3',
    supplierId: 'sup-5',
    orderId: 'ord-3',
    orderDate: '2025-01-05',
    expectedDeliveryDate: '2025-01-08',
    actualDeliveryDate: '2025-01-12',
    status: 'delayed',
    delayDays: 4,
    qualityScore: 65,
    hasIssues: true,
    issueDescription: 'Some materials damaged in transit',
    orderedQuantity: 100,
    deliveredQuantity: 85,
    unit: 'sheets',
    orderedAmount: 1200,
    invoicedAmount: 1020,
    currency: 'GBP',
    recordedBy: 'user-2',
    recordedAt: '2025-01-12T16:00:00Z',
  },
];

const MOCK_ALERTS: DriftAlert[] = [
  {
    id: 'alert-1',
    supplierId: 'sup-5',
    supplierName: 'ValueBuild Materials',
    type: 'delivery-delays',
    severity: 'high',
    metricName: 'On-Time Delivery Rate',
    previousValue: 85,
    currentValue: 62,
    changePercentage: -27,
    message: 'Significant decline in delivery performance',
    description: 'ValueBuild Materials has experienced a 27% drop in on-time deliveries over the past 30 days.',
    recommendation: 'Consider switching to alternative supplier or negotiate improvement plan.',
    detectedAt: '2025-01-20T09:00:00Z',
    periodStart: '2024-12-20',
    periodEnd: '2025-01-20',
    status: 'new',
    impactAssessment: {
      projectsAffected: 3,
      potentialCostImpact: 5000,
      scheduleRiskLevel: 'high',
    },
  },
];

// ============================================
// SERVICE CLASS
// ============================================

type ReliabilityListener = () => void;

class SupplierReliabilityService {
  private static instance: SupplierReliabilityService;
  private listeners: Set<ReliabilityListener> = new Set();
  private suppliers: Map<string, Supplier> = new Map();
  private deliveryRecords: DeliveryRecord[] = [];
  private alerts: Map<string, DriftAlert> = new Map();
  private performanceCache: Map<string, SupplierPerformance> = new Map();
  private thresholds: ReliabilityThresholds = DEFAULT_RELIABILITY_THRESHOLDS;
  private weights: MetricWeights = DEFAULT_METRIC_WEIGHTS;

  constructor() {
    // R31: dropped MOCK_SUPPLIERS + MOCK_DELIVERY_RECORDS + MOCK_ALERTS
    // seeds (was injecting fake supplier reliability scores into every
    // contractor's reliability cache). Test setups call __seedMockData.
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_SUPPLIERS.forEach(s => this.suppliers.set(s.id, s));
    this.deliveryRecords = [...MOCK_DELIVERY_RECORDS];
    MOCK_ALERTS.forEach(a => this.alerts.set(a.id, a));
    this.suppliers.forEach((_, id) => {
      this.performanceCache.set(id, this.calculatePerformance(id));
    });
  }

  static getInstance(): SupplierReliabilityService {
    if (!SupplierReliabilityService.instance) {
      SupplierReliabilityService.instance = new SupplierReliabilityService();
      registerSingletonReset(() => {
        const inst = SupplierReliabilityService.instance;
        inst.suppliers.clear();
        inst.deliveryRecords = [];
        inst.alerts.clear();
        inst.performanceCache.clear();
        inst.thresholds = DEFAULT_RELIABILITY_THRESHOLDS;
        inst.weights = DEFAULT_METRIC_WEIGHTS;
        inst.listeners.forEach((l) => l());
      });
    }
    return SupplierReliabilityService.instance;
  }

  subscribe(listener: ReliabilityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // ----------------------------------------
  // DELIVERY TRACKING
  // ----------------------------------------

  /**
   * Records a delivery and updates supplier performance
   */
  trackDelivery(
    supplierId: string,
    orderId: string,
    delivery: {
      expectedDate: string;
      actualDate: string;
      wasOnTime: boolean;
      qualityScore: number;
      orderedQuantity: number;
      deliveredQuantity: number;
      unit: string;
      amount: number;
      currency: 'GBP' | 'EUR';
      hasIssues?: boolean;
      issueDescription?: string;
      recordedBy: string;
      projectId?: string;
    }
  ): DeliveryRecord {
    const record: DeliveryRecord = {
      id: `del-${Date.now()}`,
      supplierId,
      orderId,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: delivery.expectedDate,
      actualDeliveryDate: delivery.actualDate,
      status: delivery.wasOnTime ? 'delivered' : 'delayed',
      delayDays: delivery.wasOnTime ? undefined : this.calculateDelayDays(delivery.expectedDate, delivery.actualDate),
      qualityScore: delivery.qualityScore,
      hasIssues: delivery.hasIssues || false,
      issueDescription: delivery.issueDescription,
      orderedQuantity: delivery.orderedQuantity,
      deliveredQuantity: delivery.deliveredQuantity,
      unit: delivery.unit,
      orderedAmount: delivery.amount,
      invoicedAmount: delivery.amount,
      currency: delivery.currency,
      recordedBy: delivery.recordedBy,
      recordedAt: new Date().toISOString(),
      projectId: delivery.projectId,
    };

    this.deliveryRecords.push(record);

    // Recalculate performance
    const performance = this.calculatePerformance(supplierId);
    this.performanceCache.set(supplierId, performance);

    // Check for drift
    const driftAlert = this.detectDrift(supplierId);
    if (driftAlert) {
      this.alerts.set(driftAlert.id, driftAlert);
    }

    trackUserAction('delivery_tracked', { supplierId, wasOnTime: delivery.wasOnTime, qualityScore: delivery.qualityScore });
    this.notify();

    return record;
  }

  /**
   * Gets delivery records for a supplier
   */
  getDeliveryRecords(supplierId: string, limit?: number): DeliveryRecord[] {
    const records = this.deliveryRecords
      .filter(r => r.supplierId === supplierId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

    return limit ? records.slice(0, limit) : records;
  }

  private calculateDelayDays(expected: string, actual: string): number {
    const expectedDate = new Date(expected);
    const actualDate = new Date(actual);
    const diffTime = actualDate.getTime() - expectedDate.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // ----------------------------------------
  // RELIABILITY SCORING
  // ----------------------------------------

  /**
   * Calculates the reliability score for a supplier
   */
  calculateReliabilityScore(supplierId: string): number {
    const performance = this.performanceCache.get(supplierId);
    if (!performance) {
      return this.calculatePerformance(supplierId).reliabilityScore;
    }
    return performance.reliabilityScore;
  }

  /**
   * Calculates comprehensive performance metrics for a supplier
   */
  private calculatePerformance(supplierId: string): SupplierPerformance {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error(`Supplier ${supplierId} not found`);
    }

    const records = this.getDeliveryRecords(supplierId);
    const metrics = this.calculateMetrics(records);
    const reliabilityScore = this.computeReliabilityScore(metrics);
    const trend = this.calculateTrend(supplierId, reliabilityScore);
    const alerts = Array.from(this.alerts.values()).filter(a => a.supplierId === supplierId);

    // Calculate historical scores (simplified)
    const historicalScores = this.getHistoricalScores(supplierId);

    // Calculate totals
    const totalOrders = records.length;
    const totalSpend = records.reduce((sum, r) => sum + r.orderedAmount, 0);
    const lastOrder = records[0];

    return {
      supplierId,
      supplierName: supplier.name,
      category: supplier.category,
      metrics,
      trend: trend.direction,
      trendPercentage: trend.percentage,
      reliabilityScore,
      reliabilityGrade: this.scoreToGrade(reliabilityScore),
      historicalScores,
      totalOrders,
      totalSpend,
      currency: 'GBP',
      lastOrderDate: lastOrder?.recordedAt,
      alerts,
      lastAssessedAt: new Date().toISOString(),
    };
  }

  private calculateMetrics(records: DeliveryRecord[]): SupplierMetrics {
    if (records.length === 0) {
      return {
        onTimeDeliveryRate: 100,
        qualityScore: 100,
        priceStability: 100,
        responsiveness: 80,
        disputeRate: 0,
        orderAccuracy: 100,
        documentationQuality: 80,
      };
    }

    const onTimeCount = records.filter(r => r.status === 'delivered' && !r.delayDays).length;
    const onTimeDeliveryRate = (onTimeCount / records.length) * 100;

    const qualityScores = records.filter(r => r.qualityScore !== undefined).map(r => r.qualityScore!);
    const qualityScore = qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 100;

    const issueCount = records.filter(r => r.hasIssues).length;
    const disputeRate = (issueCount / records.length) * 100;

    const accurateCount = records.filter(r => r.orderedQuantity === r.deliveredQuantity).length;
    const orderAccuracy = (accurateCount / records.length) * 100;

    // Price stability (simplified - using invoiced vs ordered variance)
    const priceVariances = records
      .filter(r => r.invoicedAmount !== undefined)
      .map(r => Math.abs((r.invoicedAmount! - r.orderedAmount) / r.orderedAmount));
    const avgVariance = priceVariances.length > 0
      ? priceVariances.reduce((a, b) => a + b, 0) / priceVariances.length
      : 0;
    const priceStability = Math.max(0, 100 - avgVariance * 100);

    return {
      onTimeDeliveryRate,
      qualityScore,
      priceStability,
      responsiveness: 80, // Would need more data to calculate
      disputeRate,
      orderAccuracy,
      documentationQuality: 80, // Would need more data to calculate
    };
  }

  private computeReliabilityScore(metrics: SupplierMetrics): number {
    const { weights } = this;

    // Invert dispute rate (lower is better)
    const adjustedDisputeRate = 100 - metrics.disputeRate;

    const score =
      metrics.onTimeDeliveryRate * weights.onTimeDeliveryRate +
      metrics.qualityScore * weights.qualityScore +
      metrics.priceStability * weights.priceStability +
      metrics.responsiveness * weights.responsiveness +
      adjustedDisputeRate * weights.disputeRate +
      metrics.orderAccuracy * weights.orderAccuracy +
      metrics.documentationQuality * weights.documentationQuality;

    return Math.round(score);
  }

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= this.thresholds.gradeA) return 'A';
    if (score >= this.thresholds.gradeB) return 'B';
    if (score >= this.thresholds.gradeC) return 'C';
    if (score >= this.thresholds.gradeD) return 'D';
    return 'F';
  }

  private calculateTrend(
    supplierId: string,
    currentScore: number
  ): { direction: 'improving' | 'stable' | 'declining'; percentage: number } {
    const historical = this.getHistoricalScores(supplierId);
    if (historical.length < 2) {
      return { direction: 'stable', percentage: 0 };
    }

    const previousScore = historical[historical.length - 2]?.score || currentScore;
    const percentage = ((currentScore - previousScore) / previousScore) * 100;

    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    if (percentage > 5) direction = 'improving';
    else if (percentage < -5) direction = 'declining';

    return { direction, percentage: Math.round(percentage) };
  }

  private getHistoricalScores(supplierId: string): { date: string; score: number }[] {
    // In production, this would fetch from historical data
    // Simplified mock implementation
    const today = new Date();
    const scores: { date: string; score: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      scores.push({
        date: date.toISOString().split('T')[0],
        score: 75 + Math.floor(Math.random() * 20),
      });
    }

    return scores;
  }

  // ----------------------------------------
  // DRIFT DETECTION
  // ----------------------------------------

  /**
   * Detects performance drift for a supplier
   */
  detectDrift(supplierId: string): DriftAlert | null {
    const performance = this.performanceCache.get(supplierId);
    if (!performance) return null;

    const { metrics, historicalScores } = performance;
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) return null;

    // Compare current metrics to historical average
    const avgHistoricalScore = historicalScores.length > 1
      ? historicalScores.slice(0, -1).reduce((sum, h) => sum + h.score, 0) / (historicalScores.length - 1)
      : performance.reliabilityScore;

    const scoreDrop = avgHistoricalScore - performance.reliabilityScore;
    const dropPercentage = (scoreDrop / avgHistoricalScore) * 100;

    // Determine severity
    let severity: DriftSeverity | null = null;
    if (dropPercentage >= this.thresholds.criticalDecline) {
      severity = 'critical';
    } else if (dropPercentage >= this.thresholds.highDecline) {
      severity = 'high';
    } else if (dropPercentage >= this.thresholds.mediumDecline) {
      severity = 'medium';
    }

    if (!severity) return null;

    // Determine drift type
    let driftType: DriftType = 'overall-decline';
    let metricName = 'Overall Reliability';
    let previousValue = avgHistoricalScore;
    let currentValue = performance.reliabilityScore;

    // Check specific metrics for major declines
    if (metrics.onTimeDeliveryRate < 70) {
      driftType = 'delivery-delays';
      metricName = 'On-Time Delivery Rate';
      currentValue = metrics.onTimeDeliveryRate;
      previousValue = 85; // Assume previous baseline
    } else if (metrics.qualityScore < 70) {
      driftType = 'quality-decline';
      metricName = 'Quality Score';
      currentValue = metrics.qualityScore;
      previousValue = 85;
    } else if (metrics.disputeRate > 15) {
      driftType = 'dispute-increase';
      metricName = 'Dispute Rate';
      currentValue = metrics.disputeRate;
      previousValue = 5;
    }

    const alert: DriftAlert = {
      id: `drift-${Date.now()}`,
      supplierId,
      supplierName: supplier.name,
      type: driftType,
      severity,
      metricName,
      previousValue: Math.round(previousValue),
      currentValue: Math.round(currentValue),
      changePercentage: Math.round(dropPercentage),
      message: `${severity === 'critical' ? 'Critical' : 'Significant'} decline detected in ${metricName.toLowerCase()}`,
      description: `${supplier.name} has experienced a ${Math.abs(Math.round(dropPercentage))}% decline in ${metricName.toLowerCase()} over the past period.`,
      recommendation: this.getRecommendation(severity, driftType),
      detectedAt: new Date().toISOString(),
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
      status: 'new',
    };

    trackUserAction('drift_detected', { supplierId, type: driftType, severity });

    return alert;
  }

  private getRecommendation(severity: DriftSeverity, type: DriftType): string {
    const recommendations: Record<DriftType, Record<DriftSeverity, string>> = {
      'delivery-delays': {
        critical: 'Immediately source alternative supplier and schedule performance review meeting.',
        high: 'Contact supplier for root cause analysis and consider activating backup supplier.',
        medium: 'Monitor closely and request improvement plan from supplier.',
        low: 'Track delivery times for the next 2 weeks.',
      },
      'quality-decline': {
        critical: 'Halt orders and conduct quality audit. Switch to alternative supplier.',
        high: 'Request quality improvement plan and increase incoming inspection.',
        medium: 'Discuss quality concerns with supplier and document issues.',
        low: 'Continue monitoring quality scores.',
      },
      'price-increase': {
        critical: 'Renegotiate pricing or switch supplier immediately.',
        high: 'Request price justification and explore alternatives.',
        medium: 'Review contract terms and compare market prices.',
        low: 'Monitor pricing trends.',
      },
      'responsiveness-drop': {
        critical: 'Escalate to supplier management and consider alternatives.',
        high: 'Contact supplier account manager to address communication issues.',
        medium: 'Document response time issues and raise in next review.',
        low: 'Continue monitoring response times.',
      },
      'dispute-increase': {
        critical: 'Review all recent orders and consider supplier suspension.',
        high: 'Conduct comprehensive order review and implement additional checks.',
        medium: 'Investigate root causes of disputes with supplier.',
        low: 'Monitor dispute frequency.',
      },
      'overall-decline': {
        critical: 'Comprehensive supplier review required. Prepare alternative sourcing.',
        high: 'Schedule performance review and request improvement action plan.',
        medium: 'Increase monitoring frequency and communicate concerns.',
        low: 'Continue regular performance tracking.',
      },
    };

    return recommendations[type][severity];
  }

  // ----------------------------------------
  // SUPPLIER RANKING
  // ----------------------------------------

  /**
   * Gets supplier ranking for a category
   */
  getSupplierRanking(category?: SupplierCategory): SupplierRanking[] {
    let suppliers = Array.from(this.suppliers.values());

    if (category) {
      suppliers = suppliers.filter(s => s.category === category);
    }

    const rankings: SupplierRanking[] = suppliers.map(supplier => {
      const performance = this.performanceCache.get(supplier.id) || this.calculatePerformance(supplier.id);
      return {
        rank: 0, // Will be set after sorting
        supplierId: supplier.id,
        supplierName: supplier.name,
        category: supplier.category,
        reliabilityScore: performance.reliabilityScore,
        trend: performance.trend,
        totalOrders: performance.totalOrders,
        totalSpend: performance.totalSpend,
        currency: performance.currency,
      };
    });

    // Sort by reliability score descending
    rankings.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

    // Assign ranks
    rankings.forEach((r, index) => {
      r.rank = index + 1;
    });

    return rankings;
  }

  // ----------------------------------------
  // ALTERNATIVE SUGGESTIONS
  // ----------------------------------------

  /**
   * Suggests alternative suppliers for a given supplier
   */
  suggestAlternatives(supplierId: string): AlternativeSuggestion {
    const supplier = this.suppliers.get(supplierId);
    if (!supplier) {
      throw new Error(`Supplier ${supplierId} not found`);
    }

    const currentPerformance = this.performanceCache.get(supplierId) || this.calculatePerformance(supplierId);

    // Get suppliers in same category
    const categorySuppliers = Array.from(this.suppliers.values())
      .filter(s => s.id !== supplierId && s.category === supplier.category && s.activeStatus === 'active');

    const alternatives: AlternativeSupplier[] = categorySuppliers
      .map(alt => {
        const altPerformance = this.performanceCache.get(alt.id) || this.calculatePerformance(alt.id);
        const scoreDiff = altPerformance.reliabilityScore - currentPerformance.reliabilityScore;

        const reasons: string[] = [];
        if (scoreDiff > 10) reasons.push('Higher reliability score');
        if (altPerformance.metrics.onTimeDeliveryRate > currentPerformance.metrics.onTimeDeliveryRate + 5) {
          reasons.push('Better delivery performance');
        }
        if (altPerformance.metrics.qualityScore > currentPerformance.metrics.qualityScore + 5) {
          reasons.push('Higher quality ratings');
        }
        if (alt.preferredStatus) reasons.push('Preferred supplier status');

        return {
          supplierId: alt.id,
          supplierName: alt.name,
          category: alt.category,
          reliabilityScore: altPerformance.reliabilityScore,
          reliabilityDifference: scoreDiff,
          reasons,
          confidence: Math.min(100, Math.max(0, 50 + scoreDiff)),
          matchingProducts: 0, // Would need product catalog data
          matchPercentage: 80, // Simplified
        };
      })
      .filter(alt => alt.reliabilityDifference > 0 || alt.reasons.length > 0)
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore)
      .slice(0, 3);

    const suggestion: AlternativeSuggestion = {
      currentSupplierId: supplierId,
      currentSupplierName: supplier.name,
      reason: currentPerformance.reliabilityScore < 70
        ? 'Current supplier has low reliability score'
        : currentPerformance.trend === 'declining'
        ? 'Current supplier performance is declining'
        : 'Better alternatives available',
      alternatives,
      suggestedAt: new Date().toISOString(),
      status: 'pending',
    };

    trackUserAction('alternatives_suggested', { supplierId, alternativeCount: alternatives.length });

    return suggestion;
  }

  // ----------------------------------------
  // ACCESSORS
  // ----------------------------------------

  /**
   * Gets supplier performance data
   */
  getSupplierPerformance(supplierId: string): SupplierPerformance | undefined {
    return this.performanceCache.get(supplierId) || this.calculatePerformance(supplierId);
  }

  /**
   * Gets all suppliers
   */
  getSuppliers(category?: SupplierCategory): Supplier[] {
    let suppliers = Array.from(this.suppliers.values());
    if (category) {
      suppliers = suppliers.filter(s => s.category === category);
    }
    return suppliers;
  }

  /**
   * Gets active drift alerts
   */
  getActiveAlerts(supplierId?: string): DriftAlert[] {
    let alerts = Array.from(this.alerts.values())
      .filter(a => a.status === 'new' || a.status === 'acknowledged' || a.status === 'investigating');

    if (supplierId) {
      alerts = alerts.filter(a => a.supplierId === supplierId);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Acknowledges an alert
   */
  acknowledgeAlert(alertId: string, userId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date().toISOString();
      this.notify();
    }
  }

  /**
   * Resolves an alert
   */
  resolveAlert(alertId: string, userId: string, resolution: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedBy = userId;
      alert.resolvedAt = new Date().toISOString();
      alert.resolution = resolution;
      this.notify();
    }
  }

  /**
   * Gets overall statistics
   */
  getStats(): SupplierReliabilityStats {
    const suppliers = Array.from(this.suppliers.values());
    const performances = Array.from(this.performanceCache.values());
    const activeAlerts = this.getActiveAlerts();

    const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    const trendDistribution = { improving: 0, stable: 0, declining: 0 };

    performances.forEach(p => {
      gradeDistribution[p.reliabilityGrade]++;
      trendDistribution[p.trend]++;
    });

    const scores = performances.map(p => p.reliabilityScore);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    const onTimeRates = performances.map(p => p.metrics.onTimeDeliveryRate);
    const avgOnTime = onTimeRates.length > 0 ? onTimeRates.reduce((a, b) => a + b, 0) / onTimeRates.length : 0;

    const qualityScores = performances.map(p => p.metrics.qualityScore);
    const avgQuality = qualityScores.length > 0 ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 0;

    return {
      totalSuppliers: suppliers.length,
      activeSuppliers: suppliers.filter(s => s.activeStatus === 'active').length,
      suppliersOnProbation: suppliers.filter(s => s.activeStatus === 'probation').length,
      gradeDistribution,
      trendDistribution,
      totalActiveAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      highAlerts: activeAlerts.filter(a => a.severity === 'high').length,
      averageReliabilityScore: Math.round(avgScore),
      averageOnTimeDeliveryRate: Math.round(avgOnTime),
      averageQualityScore: Math.round(avgQuality),
      topPerformers: this.getSupplierRanking().slice(0, 5),
      atRiskSuppliers: performances
        .filter(p => p.reliabilityScore < 70 || p.alerts.length > 0)
        .map(p => ({
          supplierId: p.supplierId,
          supplierName: p.supplierName,
          reliabilityScore: p.reliabilityScore,
          alertCount: p.alerts.length,
        })),
    };
  }
}

export const supplierReliabilityService = SupplierReliabilityService.getInstance();

// ============================================
// REACT HOOKS
// ============================================

export function useSupplierPerformance(supplierId: string | undefined) {
  const [performance, setPerformance] = useState<SupplierPerformance | undefined>(
    supplierId ? supplierReliabilityService.getSupplierPerformance(supplierId) : undefined
  );

  useEffect(() => {
    if (supplierId) {
      setPerformance(supplierReliabilityService.getSupplierPerformance(supplierId));
    }
    return supplierReliabilityService.subscribe(() => {
      if (supplierId) {
        setPerformance(supplierReliabilityService.getSupplierPerformance(supplierId));
      }
    });
  }, [supplierId]);

  const trackDelivery = useCallback(
    (orderId: string, delivery: Parameters<typeof supplierReliabilityService.trackDelivery>[2]) => {
      if (supplierId) {
        return supplierReliabilityService.trackDelivery(supplierId, orderId, delivery);
      }
      return null;
    },
    [supplierId]
  );

  const suggestAlternatives = useCallback(() => {
    if (supplierId) {
      return supplierReliabilityService.suggestAlternatives(supplierId);
    }
    return null;
  }, [supplierId]);

  return { performance, trackDelivery, suggestAlternatives };
}

export function useSupplierRanking(category?: SupplierCategory, limit?: number) {
  const [data, setData] = useState<SupplierRanking[]>(
    supplierReliabilityService.getSupplierRanking(category).slice(0, limit)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const ranking = supplierReliabilityService.getSupplierRanking(category);
    setData(limit ? ranking.slice(0, limit) : ranking);
    setLoading(false);
    return supplierReliabilityService.subscribe(() => {
      const ranking = supplierReliabilityService.getSupplierRanking(category);
      setData(limit ? ranking.slice(0, limit) : ranking);
    });
  }, [category, limit]);

  return { data, loading };
}

export function useDriftAlerts(supplierId?: string) {
  const [data, setData] = useState<DriftAlert[]>(
    supplierReliabilityService.getActiveAlerts(supplierId)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(supplierReliabilityService.getActiveAlerts(supplierId));
    setLoading(false);
    return supplierReliabilityService.subscribe(() => {
      setData(supplierReliabilityService.getActiveAlerts(supplierId));
    });
  }, [supplierId]);

  const acknowledge = useCallback((alertId: string, userId: string) => {
    supplierReliabilityService.acknowledgeAlert(alertId, userId);
  }, []);

  const resolve = useCallback((alertId: string, userId: string, resolution: string) => {
    supplierReliabilityService.resolveAlert(alertId, userId, resolution);
  }, []);

  return { data, loading, acknowledge, resolve };
}

export function useSupplierReliabilityStats() {
  const [data, setData] = useState<SupplierReliabilityStats>(
    supplierReliabilityService.getStats()
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(supplierReliabilityService.getStats());
    setLoading(false);
    return supplierReliabilityService.subscribe(() => {
      setData(supplierReliabilityService.getStats());
    });
  }, []);

  return { data, loading };
}
