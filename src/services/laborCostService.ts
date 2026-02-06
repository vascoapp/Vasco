// =============================================================================
// LABOR COST OPTIMIZATION SERVICE
// =============================================================================
// Per-job-type rates, travel cost analysis, idle time tracking,
// and effective rate optimization suggestions.
// =============================================================================

import { useMemo } from 'react';

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

const MOCK_JOB_TYPES: JobTypeCost[] = [
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
// REACT HOOKS
// =============================================================================

export function useLaborCosts() {
  return useMemo(() => laborCostService.getSummary(), []);
}

export function useJobTypeCosts() {
  return useMemo(() => laborCostService.getJobTypeCosts(), []);
}
