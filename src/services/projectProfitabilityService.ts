// =============================================================================
// PROJECT PROFITABILITY SERVICE
// =============================================================================
// Per-project and per-job-type profitability analysis, CLV ranking,
// break-even calculation, and job type recommendation engine.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface JobTypeProfitability {
  jobType: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  margin: number;
  jobCount: number;
  avgProfit: number;
  breakEvenHours: number;
  recommendation: 'grow' | 'maintain' | 'review' | 'reduce';
  reasonNl: string;
}

export interface CustomerLifetimeValue {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  jobCount: number;
  avgJobValue: number;
  firstJobDate: string;
  lastJobDate: string;
  predictedClv: number;
  retentionProbability: number;
  segment: 'vip' | 'loyal' | 'regular' | 'at-risk' | 'new';
}

export interface ProfitabilityInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'trend';
  title: string;
  description: string;
  impact: number;
  icon: string;
}

export interface ProfitabilitySummary {
  overallMargin: number;
  bestJobType: JobTypeProfitability;
  worstJobType: JobTypeProfitability;
  jobTypeRanking: JobTypeProfitability[];
  topCustomers: CustomerLifetimeValue[];
  monthlyProfit: number;
  profitTrend: 'up' | 'down' | 'stable';
  profitTrendPercent: number;
  insights: ProfitabilityInsight[];
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_JOB_TYPES: JobTypeProfitability[] = [
  {
    jobType: 'Loodgieterswerk',
    totalRevenue: 4080,
    totalCost: 1920,
    totalProfit: 2160,
    margin: 53,
    jobCount: 6,
    avgProfit: 360,
    breakEvenHours: 2.1,
    recommendation: 'grow',
    reasonNl: 'Hoogste marge en snelste break-even — plan meer van dit type',
  },
  {
    jobType: 'Badkamerrenovatie',
    totalRevenue: 28800,
    totalCost: 19200,
    totalProfit: 9600,
    margin: 33,
    jobCount: 4,
    avgProfit: 2400,
    breakEvenHours: 21.3,
    recommendation: 'maintain',
    reasonNl: 'Goed volume en stabiele winstgevendheid',
  },
  {
    jobType: 'Keukenrenovatie',
    totalRevenue: 17400,
    totalCost: 11700,
    totalProfit: 5700,
    margin: 33,
    jobCount: 3,
    avgProfit: 1900,
    breakEvenHours: 18.5,
    recommendation: 'maintain',
    reasonNl: 'Solide marge, zoek naar materiaalbesparingen',
  },
  {
    jobType: 'Schilderwerk',
    totalRevenue: 11200,
    totalCost: 6800,
    totalProfit: 4400,
    margin: 39,
    jobCount: 8,
    avgProfit: 550,
    breakEvenHours: 7.3,
    recommendation: 'review',
    reasonNl: 'Goede marge maar laag effectief uurtarief — overweeg prijsverhoging',
  },
  {
    jobType: 'Tegelen',
    totalRevenue: 14000,
    totalCost: 9500,
    totalProfit: 4500,
    margin: 32,
    jobCount: 5,
    avgProfit: 900,
    breakEvenHours: 13.6,
    recommendation: 'review',
    reasonNl: 'Hoge materiaalkosten drukken marge — vergelijk leveranciers',
  },
];

const MOCK_CUSTOMERS: CustomerLifetimeValue[] = [
  {
    customerId: 'cust_1',
    customerName: 'Familie De Jong',
    totalRevenue: 18500,
    jobCount: 4,
    avgJobValue: 4625,
    firstJobDate: '2024-03-15',
    lastJobDate: '2025-11-20',
    predictedClv: 32000,
    retentionProbability: 88,
    segment: 'vip',
  },
  {
    customerId: 'cust_2',
    customerName: 'Bakkerij Janssen',
    totalRevenue: 12800,
    jobCount: 6,
    avgJobValue: 2133,
    firstJobDate: '2024-01-10',
    lastJobDate: '2026-01-15',
    predictedClv: 24000,
    retentionProbability: 92,
    segment: 'loyal',
  },
  {
    customerId: 'cust_3',
    customerName: 'Woningcorporatie Hestia',
    totalRevenue: 45000,
    jobCount: 12,
    avgJobValue: 3750,
    firstJobDate: '2023-06-01',
    lastJobDate: '2026-02-01',
    predictedClv: 85000,
    retentionProbability: 95,
    segment: 'vip',
  },
  {
    customerId: 'cust_4',
    customerName: 'Familie Smit',
    totalRevenue: 3200,
    jobCount: 1,
    avgJobValue: 3200,
    firstJobDate: '2025-12-01',
    lastJobDate: '2025-12-01',
    predictedClv: 8000,
    retentionProbability: 55,
    segment: 'new',
  },
  {
    customerId: 'cust_5',
    customerName: 'Restaurant De Gouden Leeuw',
    totalRevenue: 8400,
    jobCount: 3,
    avgJobValue: 2800,
    firstJobDate: '2024-09-15',
    lastJobDate: '2025-06-10',
    predictedClv: 14000,
    retentionProbability: 42,
    segment: 'at-risk',
  },
];

const MOCK_INSIGHTS: ProfitabilityInsight[] = [
  {
    id: 'pi_1',
    type: 'opportunity',
    title: 'Focus op loodgieterswerk',
    description: 'Loodgieterswerk heeft de hoogste marge (53%) en snelste break-even. Plan 2 extra klussen per maand voor €720 extra winst.',
    impact: 720,
    icon: 'trending-up',
  },
  {
    id: 'pi_2',
    type: 'warning',
    title: 'Restaurant De Gouden Leeuw dreigt af te haken',
    description: 'Laatste contact 8 maanden geleden. CLV van €14.000 op het spel. Stuur een follow-up.',
    impact: 14000,
    icon: 'alert-circle',
  },
  {
    id: 'pi_3',
    type: 'trend',
    title: 'Materiaalkosten stijgen bij Tegelen',
    description: 'Je materiaalkosten per tegelklus zijn 8% gestegen. Vergelijk leveranciers of pas je offerteprijzen aan.',
    impact: 380,
    icon: 'arrow-up-circle',
  },
];

// =============================================================================
// SERVICE
// =============================================================================

class ProjectProfitabilityService {
  getJobTypeProfitability(): JobTypeProfitability[] {
    return [...MOCK_JOB_TYPES].sort((a, b) => b.margin - a.margin);
  }

  getTopCustomers(limit: number = 5): CustomerLifetimeValue[] {
    return [...MOCK_CUSTOMERS]
      .sort((a, b) => b.predictedClv - a.predictedClv)
      .slice(0, limit);
  }

  getAtRiskCustomers(): CustomerLifetimeValue[] {
    return MOCK_CUSTOMERS.filter(c => c.segment === 'at-risk');
  }

  getInsights(): ProfitabilityInsight[] {
    return MOCK_INSIGHTS;
  }

  getSummary(): ProfitabilitySummary {
    const jobTypes = this.getJobTypeProfitability();
    const totalRevenue = jobTypes.reduce((s, jt) => s + jt.totalRevenue, 0);
    const totalProfit = jobTypes.reduce((s, jt) => s + jt.totalProfit, 0);

    return {
      overallMargin: Math.round((totalProfit / totalRevenue) * 100),
      bestJobType: jobTypes[0],
      worstJobType: jobTypes[jobTypes.length - 1],
      jobTypeRanking: jobTypes,
      topCustomers: this.getTopCustomers(),
      monthlyProfit: Math.round(totalProfit / 5), // ~5 months of data
      profitTrend: 'up',
      profitTrendPercent: 8,
      insights: this.getInsights(),
    };
  }
}

export const projectProfitabilityService = new ProjectProfitabilityService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function useProjectProfitability() {
  return useMemo(() => projectProfitabilityService.getSummary(), []);
}

export function useJobTypeProfitability() {
  return useMemo(() => projectProfitabilityService.getJobTypeProfitability(), []);
}

export function useTopCustomers(limit?: number) {
  return useMemo(() => projectProfitabilityService.getTopCustomers(limit), [limit]);
}

export function useAtRiskCustomers() {
  return useMemo(() => projectProfitabilityService.getAtRiskCustomers(), []);
}
