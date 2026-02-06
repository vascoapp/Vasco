// =============================================================================
// SAVINGS AGGREGATOR SERVICE
// =============================================================================
// Unified "Vasco saved you €X" — aggregates savings from ALL services.
// Sources: supplier price comparisons, financial auditor, time savings,
// faster payments, smart purchasing, and predictive savings.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface SavingsCategory {
  id: string;
  label: string;
  icon: string;
  amount: number;
  description: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export interface SavingsAggregation {
  totalSavedThisMonth: number;
  totalSavedThisYear: number;
  projectedAnnual: number;
  breakdown: SavingsCategory[];
  topOpportunity: { label: string; potentialAmount: number; action: string };
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  savingsPerJob: number;
  savingsVsBenchmark: number; // percentage above/below industry avg
}

export interface SavingsTimeline {
  month: string;
  amount: number;
  cumulative: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_BREAKDOWN: SavingsCategory[] = [
  {
    id: 'time',
    label: 'Tijdsbesparing',
    icon: 'time',
    amount: 665,
    description: '12.1 uur × €55/uur via automatisering',
    trend: 'up',
    trendPercent: 15,
  },
  {
    id: 'purchasing',
    label: 'Slimmer inkopen',
    icon: 'cart',
    amount: 320,
    description: 'Prijsvergelijking & bulkkorting bij leveranciers',
    trend: 'up',
    trendPercent: 8,
  },
  {
    id: 'faster-payments',
    label: 'Snellere betalingen',
    icon: 'cash',
    amount: 180,
    description: 'Minder wanbetalers door automatische herinneringen',
    trend: 'stable',
    trendPercent: 2,
  },
  {
    id: 'conversion',
    label: 'Snellere conversie',
    icon: 'trending-up',
    amount: 2400,
    description: '3 extra klussen door snellere offerte-opvolging',
    trend: 'up',
    trendPercent: 12,
  },
  {
    id: 'audit',
    label: 'Foutpreventie',
    icon: 'shield-checkmark',
    amount: 275,
    description: 'Dubbele betalingen en overbetaling voorkomen',
    trend: 'up',
    trendPercent: 20,
  },
  {
    id: 'materials',
    label: 'Materiaalbesparing',
    icon: 'construct',
    amount: 195,
    description: 'TCO-analyse: betere materialen, minder terugkomsten',
    trend: 'up',
    trendPercent: 5,
  },
];

const MOCK_TIMELINE: SavingsTimeline[] = [
  { month: 'Sep', amount: 2800, cumulative: 2800 },
  { month: 'Okt', amount: 3200, cumulative: 6000 },
  { month: 'Nov', amount: 3400, cumulative: 9400 },
  { month: 'Dec', amount: 2900, cumulative: 12300 },
  { month: 'Jan', amount: 3650, cumulative: 15950 },
  { month: 'Feb', amount: 4035, cumulative: 19985 },
];

// =============================================================================
// SERVICE
// =============================================================================

class SavingsAggregatorService {
  getAggregation(): SavingsAggregation {
    const totalMonth = MOCK_BREAKDOWN.reduce((s, c) => s + c.amount, 0);
    return {
      totalSavedThisMonth: totalMonth,
      totalSavedThisYear: 19985,
      projectedAnnual: Math.round(totalMonth * 12),
      breakdown: MOCK_BREAKDOWN,
      topOpportunity: {
        label: 'Bundel bestellingen',
        potentialAmount: 540,
        action: 'Stel een wekelijkse besteldag in',
      },
      trend: 'up',
      trendPercent: 12,
      savingsPerJob: Math.round(totalMonth / 28), // ~28 jobs/month
      savingsVsBenchmark: 35, // 35% more savings than avg contractor
    };
  }

  getTimeline(): SavingsTimeline[] {
    return MOCK_TIMELINE;
  }
}

export const savingsAggregatorService = new SavingsAggregatorService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function useSavingsAggregation() {
  return useMemo(() => savingsAggregatorService.getAggregation(), []);
}

export function useSavingsTimeline() {
  return useMemo(() => savingsAggregatorService.getTimeline(), []);
}
