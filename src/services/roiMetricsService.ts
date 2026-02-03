// =============================================================================
// ROI METRICS SERVICE
// =============================================================================
// Contractor-native KPIs and "Hours Saved" tracking
// a16z pattern: ROI expressed in hard operational metrics
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ContractorROIMetrics,
  MetricValue,
  TierWinRates,
  HoursSavedMetrics,
  AutomationROI,
  AutomationType,
  ROIInsight,
  ROIGoal,
  ROIDashboardSummary,
  HoursSavedDisplayData,
  DEFAULT_DUTCH_BENCHMARKS,
} from '../types/roi-metrics';

// ============================================
// MOCK DATA
// ============================================

const MOCK_METRICS: ContractorROIMetrics = {
  contractorId: 'contractor_1',
  periodStart: '2025-01-01',
  periodEnd: '2025-01-31',
  periodType: 'month',

  quoteToJobDays: {
    value: 5.2,
    unit: 'dagen',
    trend: 'down',
    changePercent: -12,
    benchmark: 7,
    benchmarkLabel: 'Branche gemiddelde',
    isGood: true,
    target: 4,
    targetLabel: 'Jouw doel',
  },

  jobToCashDays: {
    value: 18,
    unit: 'dagen',
    trend: 'down',
    changePercent: -8,
    benchmark: 28,
    benchmarkLabel: 'Branche gemiddelde',
    isGood: true,
  },

  quoteToCashDays: {
    value: 32,
    unit: 'dagen',
    trend: 'down',
    changePercent: -15,
    benchmark: 42,
    benchmarkLabel: 'Branche gemiddelde',
    isGood: true,
  },

  avgInvoicePaymentDays: {
    value: 18,
    unit: 'dagen',
    trend: 'stable',
    changePercent: -2,
    benchmark: 28,
    benchmarkLabel: 'Branche gemiddelde',
    isGood: true,
  },

  effectiveHourlyRate: {
    value: 62,
    unit: '€/uur',
    trend: 'up',
    changePercent: 8,
    benchmark: 55,
    benchmarkLabel: 'Branche gemiddelde',
    isGood: true,
    target: 70,
  },

  billableHourlyRate: {
    value: 75,
    unit: '€/uur',
    trend: 'up',
    changePercent: 5,
    benchmark: 65,
    isGood: true,
  },

  revenuePerJob: {
    value: 2450,
    unit: '€',
    trend: 'up',
    changePercent: 12,
    benchmark: 1800,
    isGood: true,
  },

  materialMargin: {
    value: 22,
    unit: '%',
    trend: 'up',
    changePercent: 3,
    benchmark: 15,
    isGood: true,
  },

  quoteWinRate: {
    value: 58,
    unit: '%',
    trend: 'up',
    changePercent: 5,
    benchmark: 45,
    benchmarkLabel: 'Branche gemiddelde',
    isGood: true,
    target: 65,
  },

  winRateByTier: {
    good: { rate: 72, count: 8, revenue: 12400 },
    better: { rate: 54, count: 12, revenue: 28800 },
    best: { rate: 38, count: 6, revenue: 24000 },
    noTier: { rate: 45, count: 4, revenue: 6200 },
    recommendedTier: 'better',
    insight: "'Better' tier heeft de beste balans tussen conversie en omzet",
  },

  leadToQuoteRate: {
    value: 78,
    unit: '%',
    trend: 'up',
    changePercent: 4,
    benchmark: 65,
    isGood: true,
  },

  repeatCustomerRate: {
    value: 42,
    unit: '%',
    trend: 'up',
    changePercent: 8,
    benchmark: 35,
    isGood: true,
  },

  utilizationRate: {
    value: 72,
    unit: '%',
    trend: 'up',
    changePercent: 5,
    benchmark: 65,
    isGood: true,
    target: 80,
  },

  scheduleAdherence: {
    value: 88,
    unit: '%',
    trend: 'stable',
    changePercent: 1,
    benchmark: 82,
    isGood: true,
  },

  firstTimeFixRate: {
    value: 94,
    unit: '%',
    trend: 'up',
    changePercent: 2,
    benchmark: 90,
    isGood: true,
  },

  customerSatisfaction: {
    value: 4.7,
    unit: 'sterren',
    trend: 'up',
    changePercent: 3,
    benchmark: 4.2,
    isGood: true,
  },

  hoursSaved: {
    totalMinutesSaved: 728,
    totalHoursSaved: 12.1,
    byAutomationType: [
      { type: 'invoice-generation', minutesSaved: 180, actionsCount: 9, description: 'Facturen gegenereerd' },
      { type: 'quote-followup', minutesSaved: 120, actionsCount: 12, description: 'Offertes opgevolgd' },
      { type: 'scheduling', minutesSaved: 150, actionsCount: 5, description: 'Planning geoptimaliseerd' },
      { type: 'document-processing', minutesSaved: 135, actionsCount: 9, description: 'Bonnen verwerkt' },
      { type: 'invoice-collection', minutesSaved: 88, actionsCount: 11, description: 'Betalingsherinneringen' },
      { type: 'reporting', minutesSaved: 55, actionsCount: 4, description: 'Rapporten gemaakt' },
    ],
    vsManualEstimate: 18,
    efficiencyGain: 33,
    trend: 'increasing',
    projectedMonthlySavings: 48,
    hourlyRateUsed: 55,
    monetaryValue: 665,
  },

  automationROI: {
    monthlyCost: 49,
    hoursSavedValue: 665,
    revenueFromFasterConversion: 2400,
    savingsFromSmartPurchasing: 320,
    reducedOverdueInvoices: 180,
    totalValue: 3565,
    netROI: 3516,
    roiMultiple: 72.8,
    breakdown: [
      { category: 'Tijdsbesparing', value: 665, description: '12.1 uur × €55/uur' },
      { category: 'Snellere conversie', value: 2400, description: '3 extra klussen door snellere opvolging' },
      { category: 'Slimmer inkopen', value: 320, description: 'Korting en bulkvoordelen' },
      { category: 'Minder wanbetalers', value: 180, description: 'Snellere betaling door herinneringen' },
    ],
  },
};

const MOCK_INSIGHTS: ROIInsight[] = [
  {
    id: 'insight_1',
    type: 'positive',
    category: 'conversion',
    title: 'Quote conversie stijgt',
    description: 'Je win-rate is 5% gestegen deze maand. Snellere opvolging werkt!',
    impact: { value: 5, unit: '%', isPositive: true },
    actionable: false,
    priority: 'medium',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'insight_2',
    type: 'opportunity',
    category: 'money',
    title: "Upsell naar 'Best' tier",
    description: "Klanten die 'Better' kiezen reageren vaak positief op premium opties. Overweeg 'Best' actiever aan te bieden.",
    impact: { value: 850, unit: '€/maand', isPositive: true },
    actionable: true,
    suggestedAction: 'Bekijk upsell tips',
    priority: 'high',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'insight_3',
    type: 'positive',
    category: 'time',
    title: '12 uur bespaard deze week',
    description: "Automatische offertes en herinneringen bespaarden je een halve werkdag.",
    impact: { value: 12, unit: 'uur', isPositive: true },
    actionable: false,
    priority: 'low',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'insight_4',
    type: 'negative',
    category: 'efficiency',
    title: 'Reistijd kan beter',
    description: 'Maandag en woensdag had je 2+ uur reistijd. Clustering kan dit halveren.',
    impact: { value: 4, unit: 'uur/week', isPositive: false },
    actionable: true,
    suggestedAction: 'Optimaliseer routes',
    priority: 'medium',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const MOCK_GOALS: ROIGoal[] = [
  {
    id: 'goal_1',
    metricName: 'Quote Win Rate',
    currentValue: 58,
    targetValue: 65,
    unit: '%',
    deadline: '2025-03-31',
    progress: 83,
    status: 'on-track',
    createdAt: '2025-01-01',
  },
  {
    id: 'goal_2',
    metricName: 'Effectief Uurtarief',
    currentValue: 62,
    targetValue: 70,
    unit: '€/uur',
    deadline: '2025-06-30',
    progress: 77,
    status: 'on-track',
    createdAt: '2025-01-01',
  },
  {
    id: 'goal_3',
    metricName: 'Bezettingsgraad',
    currentValue: 72,
    targetValue: 80,
    unit: '%',
    deadline: '2025-03-31',
    progress: 90,
    status: 'on-track',
    createdAt: '2025-01-01',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class ROIMetricsService {
  private metrics: ContractorROIMetrics = MOCK_METRICS;
  private insights: ROIInsight[] = MOCK_INSIGHTS;
  private goals: ROIGoal[] = MOCK_GOALS;
  private listeners: Set<() => void> = new Set();

  // -----------------------------------------
  // Metrics
  // -----------------------------------------

  getMetrics(periodType?: 'day' | 'week' | 'month' | 'quarter'): ContractorROIMetrics {
    // In production, would filter/aggregate by period
    return this.metrics;
  }

  getMetricHistory(metricName: string, periods: number = 12): { period: string; value: number }[] {
    // Mock historical data
    const history: { period: string; value: number }[] = [];
    const baseValue = (this.metrics as any)[metricName]?.value || 50;

    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      history.push({
        period: date.toISOString().slice(0, 7),
        value: baseValue + (Math.random() - 0.5) * baseValue * 0.2,
      });
    }

    return history;
  }

  // -----------------------------------------
  // Hours Saved
  // -----------------------------------------

  getHoursSavedMetrics(): HoursSavedMetrics {
    return this.metrics.hoursSaved;
  }

  getHoursSavedDisplay(hourlyRate: number = 55): HoursSavedDisplayData {
    const hs = this.metrics.hoursSaved;
    const hours = Math.round(hs.totalHoursSaved * 10) / 10;
    const value = Math.round(hours * hourlyRate);

    return {
      headline: `Vasco bespaarde je ${hours} uur deze week`,
      subheadline: `Dat is €${value} aan tijdswaarde`,
      breakdown: hs.byAutomationType.slice(0, 4).map((item) => ({
        category: this.getAutomationLabel(item.type),
        icon: this.getAutomationIcon(item.type),
        hours: Math.round(item.minutesSaved / 60 * 10) / 10,
        description: item.description,
      })),
      comparison: {
        label: 'Vergelijkbaar met',
        value: hours >= 8 ? 'Een complete werkdag' : hours >= 4 ? 'Een halve werkdag' : `${Math.round(hours * 60)} minuten`,
      },
      trendText: hs.trend === 'increasing' ? 'Stijgende trend' : hs.trend === 'decreasing' ? 'Dalende trend' : 'Stabiel',
      trendDirection: hs.trend === 'increasing' ? 'up' : hs.trend === 'decreasing' ? 'down' : 'stable',
    };
  }

  private getAutomationLabel(type: AutomationType): string {
    const labels: Record<AutomationType, string> = {
      'quote-generation': 'Offertes',
      'quote-followup': 'Opvolging',
      'invoice-generation': 'Facturatie',
      'invoice-collection': 'Incasso',
      'scheduling': 'Planning',
      'document-processing': 'Documenten',
      'compliance-tracking': 'Compliance',
      'reporting': 'Rapportage',
      'customer-communication': 'Communicatie',
      'material-ordering': 'Inkoop',
      'other': 'Overig',
    };
    return labels[type] || type;
  }

  private getAutomationIcon(type: AutomationType): string {
    const icons: Record<AutomationType, string> = {
      'quote-generation': 'file-text',
      'quote-followup': 'send',
      'invoice-generation': 'receipt',
      'invoice-collection': 'credit-card',
      'scheduling': 'calendar',
      'document-processing': 'scan',
      'compliance-tracking': 'shield-check',
      'reporting': 'bar-chart-2',
      'customer-communication': 'message-circle',
      'material-ordering': 'shopping-cart',
      'other': 'zap',
    };
    return icons[type] || 'zap';
  }

  // -----------------------------------------
  // Automation ROI
  // -----------------------------------------

  getAutomationROI(): AutomationROI {
    return this.metrics.automationROI;
  }

  // -----------------------------------------
  // Insights
  // -----------------------------------------

  getInsights(filter?: { type?: ROIInsight['type']; category?: ROIInsight['category'] }): ROIInsight[] {
    let insights = [...this.insights];

    if (filter?.type) {
      insights = insights.filter((i) => i.type === filter.type);
    }
    if (filter?.category) {
      insights = insights.filter((i) => i.category === filter.category);
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  getTopInsights(limit: number = 3): ROIInsight[] {
    return this.getInsights().slice(0, limit);
  }

  // -----------------------------------------
  // Goals
  // -----------------------------------------

  getGoals(): ROIGoal[] {
    return this.goals;
  }

  updateGoalProgress(goalId: string, currentValue: number): void {
    const goal = this.goals.find((g) => g.id === goalId);
    if (goal) {
      goal.currentValue = currentValue;
      goal.progress = Math.min(100, (currentValue / goal.targetValue) * 100);

      // Update status
      const daysRemaining = Math.ceil(
        (new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const progressNeeded = (goal.targetValue - goal.currentValue) / goal.targetValue * 100;

      if (goal.progress >= 100) {
        goal.status = 'achieved';
      } else if (progressNeeded > daysRemaining * 0.5) {
        goal.status = 'behind';
      } else if (progressNeeded > daysRemaining * 0.3) {
        goal.status = 'at-risk';
      } else {
        goal.status = 'on-track';
      }

      this.notifyListeners();
    }
  }

  // -----------------------------------------
  // Dashboard Summary
  // -----------------------------------------

  getDashboardSummary(): ROIDashboardSummary {
    const hs = this.metrics.hoursSaved;
    const hourlyRate = 55;

    return {
      hoursSavedThisWeek: Math.round(hs.totalHoursSaved * 10) / 10,
      hoursSavedThisMonth: Math.round(hs.projectedMonthlySavings * 10) / 10,
      moneyValueThisMonth: Math.round(hs.projectedMonthlySavings * hourlyRate),

      quoteToCashDays: this.metrics.quoteToCashDays.value,
      quoteToCashTrend: this.metrics.quoteToCashDays.trend === 'down' ? 'improving' : this.metrics.quoteToCashDays.trend === 'up' ? 'declining' : 'stable',

      quoteWinRate: this.metrics.quoteWinRate.value,
      quoteWinRateTrend: this.metrics.quoteWinRate.trend === 'up' ? 'improving' : this.metrics.quoteWinRate.trend === 'down' ? 'declining' : 'stable',

      effectiveHourlyRate: this.metrics.effectiveHourlyRate.value,
      effectiveHourlyRateTrend: this.metrics.effectiveHourlyRate.trend === 'up' ? 'improving' : this.metrics.effectiveHourlyRate.trend === 'down' ? 'declining' : 'stable',

      vsBenchmark: [
        {
          metric: 'Quote Win Rate',
          yourValue: this.metrics.quoteWinRate.value,
          benchmark: DEFAULT_DUTCH_BENCHMARKS.quoteWinRate.median,
          percentDiff: Math.round(((this.metrics.quoteWinRate.value - DEFAULT_DUTCH_BENCHMARKS.quoteWinRate.median) / DEFAULT_DUTCH_BENCHMARKS.quoteWinRate.median) * 100),
          isAbove: this.metrics.quoteWinRate.value > DEFAULT_DUTCH_BENCHMARKS.quoteWinRate.median,
        },
        {
          metric: 'Quote-to-Cash',
          yourValue: this.metrics.quoteToCashDays.value,
          benchmark: DEFAULT_DUTCH_BENCHMARKS.quoteToCashDays.median,
          percentDiff: Math.round(((DEFAULT_DUTCH_BENCHMARKS.quoteToCashDays.median - this.metrics.quoteToCashDays.value) / DEFAULT_DUTCH_BENCHMARKS.quoteToCashDays.median) * 100),
          isAbove: this.metrics.quoteToCashDays.value < DEFAULT_DUTCH_BENCHMARKS.quoteToCashDays.median,
        },
        {
          metric: 'Uurtarief',
          yourValue: this.metrics.effectiveHourlyRate.value,
          benchmark: DEFAULT_DUTCH_BENCHMARKS.effectiveHourlyRate.median,
          percentDiff: Math.round(((this.metrics.effectiveHourlyRate.value - DEFAULT_DUTCH_BENCHMARKS.effectiveHourlyRate.median) / DEFAULT_DUTCH_BENCHMARKS.effectiveHourlyRate.median) * 100),
          isAbove: this.metrics.effectiveHourlyRate.value > DEFAULT_DUTCH_BENCHMARKS.effectiveHourlyRate.median,
        },
      ],

      topInsights: this.getTopInsights(3),
      activeGoals: this.goals.filter((g) => g.status !== 'achieved'),

      automationSummary: {
        actionsThisWeek: hs.byAutomationType.reduce((sum, a) => sum + a.actionsCount, 0),
        topAutomations: hs.byAutomationType
          .sort((a, b) => b.minutesSaved - a.minutesSaved)
          .slice(0, 3)
          .map((a) => ({
            type: a.type,
            count: a.actionsCount,
            timeSaved: Math.round(a.minutesSaved / 60 * 10) / 10,
          })),
      },
    };
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

export const roiMetricsService = new ROIMetricsService();

// ============================================
// REACT HOOKS
// ============================================

export function useROIMetrics(periodType?: 'day' | 'week' | 'month' | 'quarter') {
  const [metrics, setMetrics] = useState<ContractorROIMetrics>(() =>
    roiMetricsService.getMetrics(periodType)
  );

  useEffect(() => {
    const unsubscribe = roiMetricsService.subscribe(() => {
      setMetrics(roiMetricsService.getMetrics(periodType));
    });
    return unsubscribe;
  }, [periodType]);

  return metrics;
}

export function useHoursSavedDisplay(hourlyRate: number = 55) {
  const [display, setDisplay] = useState<HoursSavedDisplayData>(() =>
    roiMetricsService.getHoursSavedDisplay(hourlyRate)
  );

  useEffect(() => {
    const unsubscribe = roiMetricsService.subscribe(() => {
      setDisplay(roiMetricsService.getHoursSavedDisplay(hourlyRate));
    });
    return unsubscribe;
  }, [hourlyRate]);

  return display;
}

export function useROIInsights(filter?: { type?: ROIInsight['type']; category?: ROIInsight['category'] }) {
  const [insights, setInsights] = useState<ROIInsight[]>(() =>
    roiMetricsService.getInsights(filter)
  );

  useEffect(() => {
    const unsubscribe = roiMetricsService.subscribe(() => {
      setInsights(roiMetricsService.getInsights(filter));
    });
    return unsubscribe;
  }, [filter?.type, filter?.category]);

  return insights;
}

export function useROIGoals() {
  const [goals, setGoals] = useState<ROIGoal[]>(() => roiMetricsService.getGoals());

  useEffect(() => {
    const unsubscribe = roiMetricsService.subscribe(() => {
      setGoals(roiMetricsService.getGoals());
    });
    return unsubscribe;
  }, []);

  const updateProgress = useCallback((goalId: string, currentValue: number) => {
    roiMetricsService.updateGoalProgress(goalId, currentValue);
  }, []);

  return { goals, updateProgress };
}

export function useROIDashboard() {
  const [summary, setSummary] = useState<ROIDashboardSummary>(() =>
    roiMetricsService.getDashboardSummary()
  );

  useEffect(() => {
    const unsubscribe = roiMetricsService.subscribe(() => {
      setSummary(roiMetricsService.getDashboardSummary());
    });
    return unsubscribe;
  }, []);

  return summary;
}

export function useAutomationROI() {
  return useMemo(() => roiMetricsService.getAutomationROI(), []);
}
