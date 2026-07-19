// =============================================================================
// LABOR COST OPTIMIZATION SERVICE
// =============================================================================
// Per-job-type rates, travel cost analysis, idle time tracking,
// and effective rate optimization suggestions.
// =============================================================================

import { useMemo } from 'react';
import { DEMO_MODE } from '../config/demo';

// =============================================================================
// TYPES
// =============================================================================

export interface JobTypeCost {
  jobType: string;
  jobsCompleted: number;
  avgRevenue: number;
  avgCost: number;
  avgProfit: number;
  margin: number;
  avgHours: number;
  effectiveHourlyRate: number;
  trend: 'up' | 'down' | 'stable';
  recommendation?: string;
}

export interface TravelCostAnalysis {
  totalTravelHours: number;
  totalTravelCost: number;
  avgTravelPerJob: number;
  avgKmPerJob: number;
  clusteringPotential: number; // savings from better route clustering
  worstDay: { day: string; hours: number; cost: number };
}

export interface IdleTimeAnalysis {
  totalIdleHours: number;
  idleCost: number;
  idlePercent: number;
  mainCauses: Array<{ cause: string; hours: number; percent: number }>;
  suggestion: string;
}

export interface LaborCostSummary {
  effectiveRate: number;
  rateVsBenchmark: number;
  jobTypeRanking: JobTypeCost[];
  travelAnalysis: TravelCostAnalysis;
  idleTime: IdleTimeAnalysis;
  monthlyOptimizationPotential: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const DEMO_MOCK_JOB_TYPES: JobTypeCost[] = [
  {
    jobType: 'Badkamerrenovatie',
    jobsCompleted: 4,
    avgRevenue: 7200,
    avgCost: 4800,
    avgProfit: 2400,
    margin: 33,
    avgHours: 32,
    effectiveHourlyRate: 75,
    trend: 'up',
  },
  {
    jobType: 'Keukenrenovatie',
    jobsCompleted: 3,
    avgRevenue: 5800,
    avgCost: 3900,
    avgProfit: 1900,
    margin: 33,
    avgHours: 28,
    effectiveHourlyRate: 68,
    trend: 'stable',
  },
  {
    jobType: 'Schilderwerk',
    jobsCompleted: 8,
    avgRevenue: 1400,
    avgCost: 850,
    avgProfit: 550,
    margin: 39,
    avgHours: 12,
    effectiveHourlyRate: 46,
    trend: 'down',
    recommendation: 'Overweeg prijsverhoging — je marge is goed maar uurtarief is laag',
  },
  {
    jobType: 'Loodgieterswerk',
    jobsCompleted: 6,
    avgRevenue: 680,
    avgCost: 320,
    avgProfit: 360,
    margin: 53,
    avgHours: 4,
    effectiveHourlyRate: 90,
    trend: 'up',
  },
  {
    jobType: 'Tegelen',
    jobsCompleted: 5,
    avgRevenue: 2800,
    avgCost: 1900,
    avgProfit: 900,
    margin: 32,
    avgHours: 20,
    effectiveHourlyRate: 45,
    trend: 'down',
    recommendation: 'Materiaalkosten zijn hoog — vergelijk leveranciers via Besparen',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_JOB_TYPES: JobTypeCost[] = DEMO_MODE ? DEMO_MOCK_JOB_TYPES : [];

const MOCK_TRAVEL: TravelCostAnalysis = {
  totalTravelHours: 18.5,
  totalTravelCost: 485,
  avgTravelPerJob: 0.71,
  avgKmPerJob: 22,
  clusteringPotential: 195,
  worstDay: { day: 'Maandag', hours: 4.2, cost: 110 },
};

const MOCK_IDLE: IdleTimeAnalysis = {
  totalIdleHours: 8.5,
  idleCost: 468,
  idlePercent: 12,
  mainCauses: [
    { cause: 'Wachten op materiaal', hours: 3.5, percent: 41 },
    { cause: 'Gaten in planning', hours: 2.8, percent: 33 },
    { cause: 'Klant niet thuis', hours: 1.2, percent: 14 },
    { cause: 'Overig', hours: 1.0, percent: 12 },
  ],
  suggestion: 'Plan materiaallevering een dag eerder. Dit kan 3.5 uur/maand besparen.',
};

// =============================================================================
// SERVICE
// =============================================================================

class LaborCostService {
  getJobTypeCosts(): JobTypeCost[] {
    return [...MOCK_JOB_TYPES].sort((a, b) => b.effectiveHourlyRate - a.effectiveHourlyRate);
  }

  getTravelAnalysis(): TravelCostAnalysis {
    return MOCK_TRAVEL;
  }

  getIdleTimeAnalysis(): IdleTimeAnalysis {
    return MOCK_IDLE;
  }

  getSummary(): LaborCostSummary {
    const jobTypes = this.getJobTypeCosts();
    const weightedRate = jobTypes.reduce((sum, jt) => sum + jt.effectiveHourlyRate * jt.jobsCompleted, 0)
      / jobTypes.reduce((sum, jt) => sum + jt.jobsCompleted, 0);

    return {
      effectiveRate: Math.round(weightedRate),
      rateVsBenchmark: Math.round(((weightedRate - 55) / 55) * 100),
      jobTypeRanking: jobTypes,
      travelAnalysis: MOCK_TRAVEL,
      idleTime: MOCK_IDLE,
      monthlyOptimizationPotential: MOCK_TRAVEL.clusteringPotential + MOCK_IDLE.idleCost,
    };
  }
}

export const laborCostService = new LaborCostService();

// =============================================================================
// REACT HOOKS — R28: derive from real completed jobs
// =============================================================================
// Was returning hardcoded `Badkamerrenovatie / Keukenrenovatie / Schilderwerk`
// job-type costs to every contractor. Now aggregates per-trade revenue /
// hours / margin from `useAppState().jobs` filtered to completed.
// Travel + idle analyses still hardcoded — those need GPS data we don't
// have yet (per R10 GPS deferral). When all-zero, hook returns empty and
// downstream consumers (savingsAggregator, crossServiceIntelligence) gracefully
// reduce the labor-savings categories to €0 via the R9.4 idle-time guard.
// =============================================================================

import { useAppState } from '../state/AppState';

function deriveJobTypeCosts(jobs: any[]): JobTypeCost[] {
  const completed = jobs.filter((j) => j.status === 'completed' || j.status === 'gereed');
  if (completed.length === 0) return [];

  // Group by trade (or fall back to title pattern).
  const byTrade = new Map<string, { jobs: any[]; revenue: number; cost: number; hours: number }>();
  for (const j of completed) {
    const key = (j.trade ?? 'general') as string;
    const cur = byTrade.get(key) ?? { jobs: [], revenue: 0, cost: 0, hours: 0 };
    cur.jobs.push(j);
    cur.revenue += j.agreedAmount ?? j.quotedAmount ?? 0;
    cur.cost += j.actualCost ?? 0;
    cur.hours += j.actualHours ?? j.estimatedDuration ?? 0;
    byTrade.set(key, cur);
  }

  return Array.from(byTrade.entries())
    .map(([trade, agg]) => {
      const profit = agg.revenue - agg.cost;
      const margin = agg.revenue > 0 ? Math.round((profit / agg.revenue) * 100) : 0;
      const effectiveHourlyRate = agg.hours > 0 ? Math.round(profit / agg.hours) : 0;
      return {
        jobType: trade,
        jobsCompleted: agg.jobs.length,
        avgRevenue: Math.round(agg.revenue / agg.jobs.length),
        avgCost: Math.round(agg.cost / agg.jobs.length),
        avgProfit: Math.round(profit / agg.jobs.length),
        margin,
        avgHours: Math.round((agg.hours / agg.jobs.length) * 10) / 10,
        effectiveHourlyRate,
        trend: 'stable' as const,
        ...(effectiveHourlyRate > 0 && effectiveHourlyRate < 50 ? {
          recommendation: 'Hourly rate below €50 — review pricing for this trade',
        } : {}),
      };
    })
    .sort((a, b) => b.effectiveHourlyRate - a.effectiveHourlyRate);
}

export function useLaborCosts(): LaborCostSummary {
  const { jobs } = useAppState();
  return useMemo(() => {
    const jobTypes = deriveJobTypeCosts(jobs);
    const totalJobs = jobTypes.reduce((s, jt) => s + jt.jobsCompleted, 0);
    const weightedRate = totalJobs > 0
      ? jobTypes.reduce((sum, jt) => sum + jt.effectiveHourlyRate * jt.jobsCompleted, 0) / totalJobs
      : 0;
    // Travel + idle still empty (no GPS / shift-clocking data yet).
    // Downstream savingsAggregator's R9.4 guard returns €0 when idleCost === 0,
    // so this gracefully degrades the savings card instead of inventing numbers.
    const emptyTravel: TravelCostAnalysis = {
      totalTravelHours: 0,
      totalTravelCost: 0,
      avgTravelPerJob: 0,
      avgKmPerJob: 0,
      clusteringPotential: 0,
      worstDay: { day: '', hours: 0, cost: 0 },
    };
    const emptyIdle: IdleTimeAnalysis = {
      totalIdleHours: 0,
      idleCost: 0,
      idlePercent: 0,
      mainCauses: [],
      suggestion: '',
    };
    return {
      effectiveRate: Math.round(weightedRate),
      rateVsBenchmark: weightedRate > 0 ? Math.round(((weightedRate - 55) / 55) * 100) : 0,
      jobTypeRanking: jobTypes,
      travelAnalysis: emptyTravel,
      idleTime: emptyIdle,
      monthlyOptimizationPotential: 0,
    };
  }, [jobs]);
}

export function useJobTypeCosts(): JobTypeCost[] {
  const { jobs } = useAppState();
  return useMemo(() => deriveJobTypeCosts(jobs), [jobs]);
}
