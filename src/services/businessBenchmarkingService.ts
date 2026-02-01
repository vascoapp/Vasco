// =============================================================================
// BUSINESS BENCHMARKING SERVICE
// =============================================================================
// Industry benchmarking and performance comparison
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface BenchmarkCategory {
  id: string;
  name: string;
  description: string;
  metrics: BenchmarkMetric[];
}

export interface BenchmarkMetric {
  id: string;
  name: string;
  description: string;
  yourValue: number;
  industryAvg: number;
  topPerformers: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
  status: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  percentile: number;
  recommendations?: string[];
}

export interface PerformanceGoal {
  id: string;
  metricId: string;
  metricName: string;
  currentValue: number;
  targetValue: number;
  deadline: Date;
  progress: number;
  status: 'on_track' | 'at_risk' | 'behind';
  milestones: { date: Date; value: number }[];
}

export interface CompetitivePosition {
  category: string;
  yourPosition: number;
  totalCompetitors: number;
  strengthsVsCompetitors: string[];
  weaknessesVsCompetitors: string[];
}

export interface ImprovementOpportunity {
  id: string;
  title: string;
  description: string;
  potentialImpact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  category: string;
  currentMetric: string;
  currentValue: number;
  targetValue: number;
  estimatedRevenue?: number;
  priority: number;
  actions: string[];
}

export interface BenchmarkStats {
  overallScore: number;
  percentile: number;
  metricsAboveAvg: number;
  metricsBelowAvg: number;
  biggestStrength: string;
  biggestOpportunity: string;
  goalsOnTrack: number;
  totalGoals: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockBenchmarks: BenchmarkCategory[] = [
  {
    id: 'cat-1', name: 'Financiële Prestaties', description: 'Omzet en winstgevendheid',
    metrics: [
      { id: 'm-1', name: 'Omzet per monteur', description: 'Jaarlijkse omzet gedeeld door FTE', yourValue: 145000, industryAvg: 125000, topPerformers: 180000, unit: '€', trend: 'up', trendPercentage: 12, status: 'good', percentile: 72, recommendations: ['Focus op upselling tijdens onderhoud', 'Verhoog onderhoudscontracten'] },
      { id: 'm-2', name: 'Bruto marge', description: 'Percentage bruto winst', yourValue: 38, industryAvg: 35, topPerformers: 45, unit: '%', trend: 'stable', trendPercentage: 0, status: 'good', percentile: 65 },
      { id: 'm-3', name: 'Gem. factuurwaarde', description: 'Gemiddelde waarde per factuur', yourValue: 285, industryAvg: 320, topPerformers: 450, unit: '€', trend: 'up', trendPercentage: 8, status: 'below_average', percentile: 42, recommendations: ['Bundel services', 'Upsell mogelijkheden benutten'] },
    ],
  },
  {
    id: 'cat-2', name: 'Operationele Efficiëntie', description: 'Productiviteit en doorlooptijd',
    metrics: [
      { id: 'm-4', name: 'Klussen per dag', description: 'Gemiddeld aantal afgeronde klussen', yourValue: 3.2, industryAvg: 2.8, topPerformers: 4.0, unit: 'klussen', trend: 'up', trendPercentage: 5, status: 'excellent', percentile: 85 },
      { id: 'm-5', name: 'Eerste-keer-goed', description: 'Percentage zonder terugkomst', yourValue: 92, industryAvg: 88, topPerformers: 96, unit: '%', trend: 'stable', trendPercentage: 1, status: 'good', percentile: 70 },
      { id: 'm-6', name: 'Responstijd storingen', description: 'Gemiddelde tijd tot aankomst', yourValue: 6, industryAvg: 8, topPerformers: 4, unit: 'uur', trend: 'down', trendPercentage: -15, status: 'good', percentile: 68 },
    ],
  },
  {
    id: 'cat-3', name: 'Klantrelaties', description: 'Tevredenheid en retentie',
    metrics: [
      { id: 'm-7', name: 'Klanttevredenheid', description: 'Gemiddelde score (1-5)', yourValue: 4.6, industryAvg: 4.2, topPerformers: 4.8, unit: '/5', trend: 'up', trendPercentage: 3, status: 'excellent', percentile: 88 },
      { id: 'm-8', name: 'Contract retentie', description: 'Percentage verlengende contracten', yourValue: 85, industryAvg: 78, topPerformers: 92, unit: '%', trend: 'up', trendPercentage: 5, status: 'good', percentile: 75 },
      { id: 'm-9', name: 'Referral rate', description: 'Percentage nieuwe klanten via verwijzing', yourValue: 28, industryAvg: 22, topPerformers: 40, unit: '%', trend: 'up', trendPercentage: 8, status: 'good', percentile: 70 },
    ],
  },
];

const mockGoals: PerformanceGoal[] = [
  { id: 'goal-1', metricId: 'm-3', metricName: 'Gem. factuurwaarde', currentValue: 285, targetValue: 350, deadline: new Date('2024-12-31'), progress: 45, status: 'on_track', milestones: [] },
  { id: 'goal-2', metricId: 'm-4', metricName: 'Klussen per dag', currentValue: 3.2, targetValue: 3.5, deadline: new Date('2024-06-30'), progress: 70, status: 'on_track', milestones: [] },
];

const mockOpportunities: ImprovementOpportunity[] = [
  { id: 'opp-1', title: 'Verhoog gemiddelde factuurwaarde', description: 'Focus op upselling en cross-selling tijdens servicebezoeken', potentialImpact: 'high', effort: 'medium', category: 'Financieel', currentMetric: 'Gem. factuurwaarde', currentValue: 285, targetValue: 350, estimatedRevenue: 18000, priority: 1, actions: ['Train monteurs in upselling', 'Implementeer checklist voor extra services', 'Creëer bundel-aanbiedingen'] },
  { id: 'opp-2', title: 'Uitbreiden onderhoudscontracten', description: 'Meer klanten converteren naar onderhoudsabonnementen', potentialImpact: 'high', effort: 'low', category: 'Klantrelaties', currentMetric: 'Contract penetratie', currentValue: 35, targetValue: 50, estimatedRevenue: 25000, priority: 2, actions: ['Bied korting bij nieuwe installatie', 'Follow-up na elke reparatie'] },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type BenchmarkListener = () => void;

class BusinessBenchmarkingService {
  private static instance: BusinessBenchmarkingService;
  private listeners: Set<BenchmarkListener> = new Set();
  private benchmarks: BenchmarkCategory[] = [...mockBenchmarks];
  private goals: PerformanceGoal[] = [...mockGoals];
  private opportunities: ImprovementOpportunity[] = [...mockOpportunities];

  static getInstance(): BusinessBenchmarkingService {
    if (!BusinessBenchmarkingService.instance) {
      BusinessBenchmarkingService.instance = new BusinessBenchmarkingService();
    }
    return BusinessBenchmarkingService.instance;
  }

  subscribe(listener: BenchmarkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getBenchmarks(): BenchmarkCategory[] { return this.benchmarks; }
  getGoals(): PerformanceGoal[] { return this.goals; }
  getOpportunities(): ImprovementOpportunity[] { return this.opportunities.sort((a, b) => a.priority - b.priority); }

  setGoal(metricId: string, targetValue: number, deadline: Date): PerformanceGoal {
    const metrics = this.benchmarks.flatMap(b => b.metrics);
    const metric = metrics.find(m => m.id === metricId);
    if (!metric) throw new Error('Metric not found');

    const goal: PerformanceGoal = {
      id: `goal-${Date.now()}`, metricId, metricName: metric.name, currentValue: metric.yourValue,
      targetValue, deadline, progress: 0, status: 'on_track', milestones: [],
    };
    this.goals.push(goal);
    trackUserAction('benchmark_goal_set', { metricId, targetValue });
    this.notify();
    return goal;
  }

  updateGoalProgress(goalId: string, currentValue: number): void {
    const goal = this.goals.find(g => g.id === goalId);
    if (goal) {
      goal.currentValue = currentValue;
      goal.progress = Math.round(((currentValue - goal.currentValue) / (goal.targetValue - goal.currentValue)) * 100);
      goal.milestones.push({ date: new Date(), value: currentValue });
      this.notify();
    }
  }

  getCompetitivePosition(): CompetitivePosition[] {
    return this.benchmarks.map(cat => {
      const avgPercentile = cat.metrics.reduce((sum, m) => sum + m.percentile, 0) / cat.metrics.length;
      const position = Math.round((100 - avgPercentile) / 10) + 1;
      return {
        category: cat.name,
        yourPosition: position,
        totalCompetitors: 100,
        strengthsVsCompetitors: cat.metrics.filter(m => m.percentile >= 70).map(m => m.name),
        weaknessesVsCompetitors: cat.metrics.filter(m => m.percentile < 50).map(m => m.name),
      };
    });
  }

  getStats(): BenchmarkStats {
    const allMetrics = this.benchmarks.flatMap(b => b.metrics);
    const aboveAvg = allMetrics.filter(m => m.percentile >= 50).length;
    const avgPercentile = Math.round(allMetrics.reduce((sum, m) => sum + m.percentile, 0) / allMetrics.length);
    const best = allMetrics.reduce((max, m) => m.percentile > max.percentile ? m : max);
    const worst = allMetrics.reduce((min, m) => m.percentile < min.percentile ? m : min);

    return {
      overallScore: Math.round(avgPercentile * 0.1),
      percentile: avgPercentile,
      metricsAboveAvg: aboveAvg,
      metricsBelowAvg: allMetrics.length - aboveAvg,
      biggestStrength: best.name,
      biggestOpportunity: worst.name,
      goalsOnTrack: this.goals.filter(g => g.status === 'on_track').length,
      totalGoals: this.goals.length,
    };
  }
}

export const businessBenchmarkingService = BusinessBenchmarkingService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useBenchmarkCategories() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setBenchmarks(businessBenchmarkingService.getBenchmarks());
    setLoading(false);
    return businessBenchmarkingService.subscribe(() => setBenchmarks(businessBenchmarkingService.getBenchmarks()));
  }, []);

  return { benchmarks, loading };
}

export function usePerformanceGoals() {
  const [goals, setGoals] = useState<PerformanceGoal[]>([]);

  useEffect(() => {
    setGoals(businessBenchmarkingService.getGoals());
    return businessBenchmarkingService.subscribe(() => setGoals(businessBenchmarkingService.getGoals()));
  }, []);

  const setGoal = useCallback((metricId: string, target: number, deadline: Date) => businessBenchmarkingService.setGoal(metricId, target, deadline), []);

  return { goals, setGoal };
}

export function useImprovementOpportunities() {
  const [opportunities, setOpportunities] = useState<ImprovementOpportunity[]>([]);
  useEffect(() => { setOpportunities(businessBenchmarkingService.getOpportunities()); }, []);
  return opportunities;
}

export function useCompetitivePosition() {
  const [position, setPosition] = useState<CompetitivePosition[]>([]);
  useEffect(() => { setPosition(businessBenchmarkingService.getCompetitivePosition()); }, []);
  return position;
}

export function useBenchmarkStats() {
  const [stats, setStats] = useState<BenchmarkStats>(businessBenchmarkingService.getStats());
  useEffect(() => businessBenchmarkingService.subscribe(() => setStats(businessBenchmarkingService.getStats())), []);
  return stats;
}
