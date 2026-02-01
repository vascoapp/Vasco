// =============================================================================
// ANALYTICS SERVICE
// =============================================================================
// Comprehensive business analytics and performance insights
// Includes benchmarking against anonymized peer data
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface RevenueMetrics {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowth: number;
  avgProjectValue: number;
  monthlyTrend: Array<{ month: string; revenue: number }>;
}

export interface ProfitabilityMetrics {
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  avgProjectMargin: number;
  materialCostRatio: number;
  laborCostRatio: number;
}

export interface CustomerMetrics {
  totalCustomers: number;
  newCustomersThisMonth: number;
  repeatCustomerRate: number;
  avgCustomerLifetimeValue: number;
  customerSatisfactionScore: number;
  npsScore: number;
  customersByType: Array<{ type: string; count: number; revenue: number }>;
}

export interface ProjectMetrics {
  totalProjects: number;
  completedProjects: number;
  activeProjects: number;
  avgProjectDuration: number;
  onTimeDeliveryRate: number;
  projectsByCategory: Array<{ category: string; count: number; revenue: number }>;
  monthlyProjects: Array<{ month: string; count: number }>;
}

export interface SupplierMetrics {
  totalSuppliers: number;
  totalSpent: number;
  avgOrderValue: number;
  topSuppliers: Array<{ name: string; spent: number; orders: number }>;
  categorySpending: Array<{ category: string; amount: number }>;
}

export interface BenchmarkData {
  metric: string;
  yourValue: number;
  industryAvg: number;
  topPerformers: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
}

export interface PerformanceInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'achievement';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  metric?: string;
  actionable: boolean;
  suggestedAction?: string;
}

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_REVENUE: RevenueMetrics = {
  totalRevenue: 245680,
  revenueThisMonth: 32450,
  revenueLastMonth: 28900,
  revenueGrowth: 12.3,
  avgProjectValue: 4850,
  monthlyTrend: [
    { month: 'Aug', revenue: 24500 },
    { month: 'Sep', revenue: 28900 },
    { month: 'Okt', revenue: 31200 },
    { month: 'Nov', revenue: 26800 },
    { month: 'Dec', revenue: 22400 },
    { month: 'Jan', revenue: 32450 },
  ],
};

const MOCK_PROFITABILITY: ProfitabilityMetrics = {
  grossProfit: 89250,
  grossMargin: 36.3,
  netProfit: 62475,
  netMargin: 25.4,
  avgProjectMargin: 28.5,
  materialCostRatio: 38.2,
  laborCostRatio: 25.5,
};

const MOCK_CUSTOMERS: CustomerMetrics = {
  totalCustomers: 127,
  newCustomersThisMonth: 8,
  repeatCustomerRate: 42,
  avgCustomerLifetimeValue: 7850,
  customerSatisfactionScore: 4.7,
  npsScore: 68,
  customersByType: [
    { type: 'Particulier', count: 98, revenue: 156000 },
    { type: 'Zakelijk', count: 29, revenue: 89680 },
  ],
};

const MOCK_PROJECTS: ProjectMetrics = {
  totalProjects: 156,
  completedProjects: 142,
  activeProjects: 14,
  avgProjectDuration: 5.2,
  onTimeDeliveryRate: 89,
  projectsByCategory: [
    { category: 'Schilderwerk', count: 52, revenue: 78500 },
    { category: 'Badkamer', count: 28, revenue: 84000 },
    { category: 'Keuken', count: 21, revenue: 42000 },
    { category: 'Algemeen', count: 55, revenue: 41180 },
  ],
  monthlyProjects: [
    { month: 'Aug', count: 12 },
    { month: 'Sep', count: 15 },
    { month: 'Okt', count: 14 },
    { month: 'Nov', count: 11 },
    { month: 'Dec', count: 8 },
    { month: 'Jan', count: 14 },
  ],
};

const MOCK_BENCHMARKS: BenchmarkData[] = [
  { metric: 'Omzet groei', yourValue: 12.3, industryAvg: 8.5, topPerformers: 18.2, percentile: 72, trend: 'up' },
  { metric: 'Brutomarge', yourValue: 36.3, industryAvg: 32.0, topPerformers: 42.0, percentile: 68, trend: 'stable' },
  { metric: 'Klanttevredenheid', yourValue: 4.7, industryAvg: 4.2, topPerformers: 4.9, percentile: 85, trend: 'up' },
  { metric: 'Op tijd levering', yourValue: 89, industryAvg: 82, topPerformers: 95, percentile: 71, trend: 'stable' },
  { metric: 'Herhalingsklanten', yourValue: 42, industryAvg: 35, topPerformers: 55, percentile: 65, trend: 'up' },
];

const MOCK_INSIGHTS: PerformanceInsight[] = [
  {
    id: 'ins_1',
    type: 'opportunity',
    title: 'Groeipotentieel in badkamers',
    description: 'Badkamerprojecten hebben je hoogste marge (38%). Overweeg meer focus op deze categorie.',
    impact: 'high',
    metric: 'avgProjectMargin',
    actionable: true,
    suggestedAction: 'Start een badkamer-specifieke marketingcampagne',
  },
  {
    id: 'ins_2',
    type: 'achievement',
    title: 'Klanttevredenheid top 15%',
    description: 'Je scoort in de top 15% van vergelijkbare bedrijven op klanttevredenheid!',
    impact: 'high',
    metric: 'customerSatisfactionScore',
    actionable: false,
  },
  {
    id: 'ins_3',
    type: 'warning',
    title: 'Materiaalkosten stijgen',
    description: 'Je materiaalkosten zijn 5% hoger dan vorige maand. Controleer leveranciersprijzen.',
    impact: 'medium',
    metric: 'materialCostRatio',
    actionable: true,
    suggestedAction: 'Vergelijk prijzen bij alternatieve leveranciers',
  },
  {
    id: 'ins_4',
    type: 'opportunity',
    title: 'December dip',
    description: 'December had 43% minder projecten. Plan proactief voor volgende december.',
    impact: 'medium',
    metric: 'monthlyProjects',
    actionable: true,
    suggestedAction: 'Start Q4 met winteraanbiedingen campagne',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class AnalyticsService {
  // -----------------------------------------
  // Revenue Metrics
  // -----------------------------------------

  getRevenueMetrics(dateRange?: DateRange): RevenueMetrics {
    // In production, filter by date range
    return MOCK_REVENUE;
  }

  // -----------------------------------------
  // Profitability Metrics
  // -----------------------------------------

  getProfitabilityMetrics(dateRange?: DateRange): ProfitabilityMetrics {
    return MOCK_PROFITABILITY;
  }

  // -----------------------------------------
  // Customer Metrics
  // -----------------------------------------

  getCustomerMetrics(dateRange?: DateRange): CustomerMetrics {
    return MOCK_CUSTOMERS;
  }

  // -----------------------------------------
  // Project Metrics
  // -----------------------------------------

  getProjectMetrics(dateRange?: DateRange): ProjectMetrics {
    return MOCK_PROJECTS;
  }

  // -----------------------------------------
  // Supplier Metrics
  // -----------------------------------------

  getSupplierMetrics(dateRange?: DateRange): SupplierMetrics {
    return {
      totalSuppliers: 8,
      totalSpent: 98500,
      avgOrderValue: 485,
      topSuppliers: [
        { name: 'Bouwmaat', spent: 32000, orders: 45 },
        { name: 'Technische Unie', spent: 28500, orders: 38 },
        { name: 'Verfwinkel.nl', spent: 18500, orders: 62 },
        { name: 'Hornbach', spent: 12500, orders: 28 },
      ],
      categorySpending: [
        { category: 'Verf', amount: 38500 },
        { category: 'Sanitair', amount: 28000 },
        { category: 'Gereedschap', amount: 18000 },
        { category: 'Overig', amount: 14000 },
      ],
    };
  }

  // -----------------------------------------
  // Benchmarks
  // -----------------------------------------

  getBenchmarks(): BenchmarkData[] {
    return MOCK_BENCHMARKS;
  }

  // -----------------------------------------
  // Insights
  // -----------------------------------------

  getInsights(): PerformanceInsight[] {
    return MOCK_INSIGHTS;
  }

  getHighImpactInsights(): PerformanceInsight[] {
    return MOCK_INSIGHTS.filter((i) => i.impact === 'high');
  }

  dismissInsight(insightId: string): void {
    trackUserAction('insight_dismissed', { insightId });
  }

  actOnInsight(insightId: string): void {
    trackUserAction('insight_actioned', { insightId });
  }

  // -----------------------------------------
  // Dashboard Summary
  // -----------------------------------------

  getDashboardSummary(): {
    revenue: { value: number; change: number };
    profit: { value: number; margin: number };
    customers: { total: number; new: number };
    projects: { active: number; completed: number };
    satisfaction: { score: number; nps: number };
  } {
    return {
      revenue: { value: MOCK_REVENUE.revenueThisMonth, change: MOCK_REVENUE.revenueGrowth },
      profit: { value: MOCK_PROFITABILITY.netProfit, margin: MOCK_PROFITABILITY.netMargin },
      customers: { total: MOCK_CUSTOMERS.totalCustomers, new: MOCK_CUSTOMERS.newCustomersThisMonth },
      projects: { active: MOCK_PROJECTS.activeProjects, completed: MOCK_PROJECTS.completedProjects },
      satisfaction: { score: MOCK_CUSTOMERS.customerSatisfactionScore, nps: MOCK_CUSTOMERS.npsScore },
    };
  }

  // -----------------------------------------
  // Export
  // -----------------------------------------

  exportReport(type: 'pdf' | 'csv', dateRange?: DateRange): void {
    trackUserAction('report_exported', { type, dateRange });
    // In production, generate and download report
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const analyticsService = new AnalyticsService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useMemo, useCallback } from 'react';

export function useAnalytics(dateRange?: DateRange) {
  const revenue = useMemo(() => analyticsService.getRevenueMetrics(dateRange), [dateRange]);
  const profitability = useMemo(() => analyticsService.getProfitabilityMetrics(dateRange), [dateRange]);
  const customers = useMemo(() => analyticsService.getCustomerMetrics(dateRange), [dateRange]);
  const projects = useMemo(() => analyticsService.getProjectMetrics(dateRange), [dateRange]);
  const suppliers = useMemo(() => analyticsService.getSupplierMetrics(dateRange), [dateRange]);

  return { revenue, profitability, customers, projects, suppliers };
}

export function useBenchmarks() {
  return useMemo(() => analyticsService.getBenchmarks(), []);
}

export function useInsights() {
  const [insights, setInsights] = useState<PerformanceInsight[]>(() => analyticsService.getInsights());

  const dismissInsight = useCallback((insightId: string) => {
    analyticsService.dismissInsight(insightId);
    setInsights((prev) => prev.filter((i) => i.id !== insightId));
  }, []);

  const actOnInsight = useCallback((insightId: string) => {
    analyticsService.actOnInsight(insightId);
  }, []);

  return {
    insights,
    highImpactInsights: insights.filter((i) => i.impact === 'high'),
    dismissInsight,
    actOnInsight,
  };
}

export function useDashboardSummary() {
  return useMemo(() => analyticsService.getDashboardSummary(), []);
}
