import { useMemo } from 'react';
import { jobCostTrackingService, type JobCostVariance } from './jobCostTrackingService';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface EstimationAccuracy {
  overallScore: number; // 0-100
  trend: 'improving' | 'declining' | 'stable';
  trendDelta: number; // e.g. +5
  totalJobsAnalyzed: number;
  averageHoursDeviation: number; // percentage
  averageMaterialDeviation: number; // percentage
}

export interface JobTypeCalibration {
  jobType: string; // Dutch
  jobCount: number;
  hoursMultiplier: number; // actual/estimated ratio
  materialMultiplier: number;
  avgMarginDelta: number; // euros
  recommendation: string; // Dutch
}

export interface QuoteCalibrationSuggestion {
  lineItemDescription: string;
  originalEstimate: number; // euros
  suggestedEstimate: number; // euros
  multiplier: number;
  basedOnJobCount: number;
  confidence: number; // 0-100
}

export interface LessonLearned {
  id: string;
  jobType: string;
  title: string; // Dutch
  description: string; // Dutch
  impact: 'positief' | 'negatief';
  impactAmount: number; // euros
  date: string;
}

export interface FeedbackLoopSummary {
  accuracy: EstimationAccuracy;
  calibrations: JobTypeCalibration[];
  lessonsLearned: LessonLearned[];
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_ACCURACY: EstimationAccuracy = {
  overallScore: 78,
  trend: 'improving',
  trendDelta: 5,
  totalJobsAnalyzed: 124,
  averageHoursDeviation: 12.3,
  averageMaterialDeviation: 8.7,
};

const MOCK_CALIBRATIONS: JobTypeCalibration[] = [
  {
    jobType: 'Badkamerrenovatie',
    jobCount: 34,
    hoursMultiplier: 1.15,
    materialMultiplier: 1.08,
    avgMarginDelta: -185,
    recommendation: 'Verhoog uurinschatting met 15% — leidingwerk achter tegels kost structureel meer tijd.',
  },
  {
    jobType: 'CV-ketel onderhoud',
    jobCount: 41,
    hoursMultiplier: 0.95,
    materialMultiplier: 1.02,
    avgMarginDelta: 45,
    recommendation: 'Inschatting is goed. Kleine materiaalopslag kan omlaag naar 2%.',
  },
  {
    jobType: 'Leidingwerk',
    jobCount: 22,
    hoursMultiplier: 1.22,
    materialMultiplier: 1.12,
    avgMarginDelta: -310,
    recommendation: 'Voeg een extra uur toe per verdieping — oude panden vergen meer breekwerk.',
  },
  {
    jobType: 'Schilderwerk',
    jobCount: 15,
    hoursMultiplier: 1.05,
    materialMultiplier: 0.92,
    avgMarginDelta: 60,
    recommendation: 'Materiaalkosten zijn lager dan geschat. Verlaag verfbudget met 8%.',
  },
  {
    jobType: 'Keukeninstallatie',
    jobCount: 12,
    hoursMultiplier: 1.30,
    materialMultiplier: 1.18,
    avgMarginDelta: -420,
    recommendation: 'Structureel te laag ingeschat. Verhoog offerte met 25% — aansluitwerk en afwerking kosten extra.',
  },
];

const MOCK_LESSONS: LessonLearned[] = [
  {
    id: 'll-001',
    jobType: 'Badkamerrenovatie',
    title: 'Verborgen leidingwerk kost extra tijd',
    description:
      'Bij 8 van 34 badkamerklussen bleek het leidingwerk achter de muur complexer dan verwacht. Gemiddeld 2,5 uur extra per klus.',
    impact: 'negatief',
    impactAmount: 1480,
    date: '2025-11-14',
  },
  {
    id: 'll-002',
    jobType: 'CV-ketel onderhoud',
    title: 'Standaardprocedure bespaart reistijd',
    description:
      'Door een vaste checklist te hanteren is het gemiddeld onderhoud 15 minuten sneller geworden. Over 41 klussen levert dat op.',
    impact: 'positief',
    impactAmount: 620,
    date: '2025-12-03',
  },
  {
    id: 'll-003',
    jobType: 'Keukeninstallatie',
    title: 'Afwerking onderschat in offertes',
    description:
      'Kit- en afwerkingsuren worden niet meegenomen in de offerte. Bij 10 van 12 klussen was dit 1-2 uur extra.',
    impact: 'negatief',
    impactAmount: 960,
    date: '2026-01-18',
  },
];

// ── Service Class ───────────────────────────────────────────────────────────

class EstimationFeedbackService {
  private static instance: EstimationFeedbackService;

  private constructor() {}

  static getInstance(): EstimationFeedbackService {
    if (!EstimationFeedbackService.instance) {
      EstimationFeedbackService.instance = new EstimationFeedbackService();
    }
    return EstimationFeedbackService.instance;
  }

  getEstimationAccuracy(): EstimationAccuracy {
    // Compute from actual job cost tracking data
    const variances = jobCostTrackingService.getAllVariances();
    if (variances.length === 0) return MOCK_ACCURACY;

    const hoursDeviations = variances.map(v =>
      v.estimatedHours > 0 ? Math.abs(v.actualHours - v.estimatedHours) / v.estimatedHours * 100 : 0
    );
    const materialDeviations = variances.map(v =>
      v.estimatedMaterials > 0 ? Math.abs(v.actualMaterials - v.estimatedMaterials) / v.estimatedMaterials * 100 : 0
    );

    const avgHoursDev = hoursDeviations.reduce((s, d) => s + d, 0) / hoursDeviations.length;
    const avgMatDev = materialDeviations.reduce((s, d) => s + d, 0) / materialDeviations.length;

    // Overall score: 100 minus weighted average deviation
    const overallScore = Math.round(Math.max(0, 100 - (avgHoursDev * 0.6 + avgMatDev * 0.4)));

    return {
      overallScore,
      trend: overallScore > MOCK_ACCURACY.overallScore ? 'improving' : overallScore < MOCK_ACCURACY.overallScore ? 'declining' : 'stable',
      trendDelta: overallScore - MOCK_ACCURACY.overallScore,
      totalJobsAnalyzed: variances.length + MOCK_ACCURACY.totalJobsAnalyzed, // combine with historical
      averageHoursDeviation: Math.round(avgHoursDev * 10) / 10,
      averageMaterialDeviation: Math.round(avgMatDev * 10) / 10,
    };
  }

  getJobTypeCalibrations(): JobTypeCalibration[] {
    // Derive calibrations from actual job cost variance data
    const variances = jobCostTrackingService.getAllVariances();
    if (variances.length === 0) return MOCK_CALIBRATIONS;

    // Group variances by job name patterns to approximate job types
    const jobTypeMap = new Map<string, JobCostVariance[]>();
    for (const v of variances) {
      // Extract job type from job name (e.g., "Tegelvloer badkamer — Van Dijk" → "Tegelvloer")
      const jobType = v.jobName.split('—')[0]?.trim().split(' ')[0] || 'Overig';
      const existing = jobTypeMap.get(jobType) || [];
      existing.push(v);
      jobTypeMap.set(jobType, existing);
    }

    const computed: JobTypeCalibration[] = [];
    for (const [jobType, jobs] of jobTypeMap) {
      const hoursMultiplier = jobs.reduce((s, j) => s + (j.estimatedHours > 0 ? j.actualHours / j.estimatedHours : 1), 0) / jobs.length;
      const materialMultiplier = jobs.reduce((s, j) => s + (j.estimatedMaterials > 0 ? j.actualMaterials / j.estimatedMaterials : 1), 0) / jobs.length;
      const avgMarginDelta = jobs.reduce((s, j) => s + j.marginDelta, 0) / jobs.length;

      let recommendation: string;
      if (hoursMultiplier > 1.15) {
        recommendation = `Verhoog uurinschatting met ${Math.round((hoursMultiplier - 1) * 100)}% — structureel te laag.`;
      } else if (hoursMultiplier < 0.9) {
        recommendation = `Inschatting is te hoog — verlaag met ${Math.round((1 - hoursMultiplier) * 100)}%.`;
      } else {
        recommendation = 'Inschatting is goed. Houd huidige methode aan.';
      }

      computed.push({
        jobType,
        jobCount: jobs.length,
        hoursMultiplier: Math.round(hoursMultiplier * 100) / 100,
        materialMultiplier: Math.round(materialMultiplier * 100) / 100,
        avgMarginDelta: Math.round(avgMarginDelta),
        recommendation,
      });
    }

    // Merge with historical mock data (for job types not in recent variances)
    const computedTypes = new Set(computed.map(c => c.jobType));
    const merged = [
      ...computed,
      ...MOCK_CALIBRATIONS.filter(m => !computedTypes.has(m.jobType)),
    ];

    return merged.sort((a, b) => a.avgMarginDelta - b.avgMarginDelta);
  }

  getQuoteCalibration(
    lineItems: { description: string; estimate: number }[]
  ): QuoteCalibrationSuggestion[] {
    return lineItems.map((item) => {
      const match = this.findCalibrationMatch(item.description);
      const multiplier = match ? match.hoursMultiplier : 1.0;
      const suggestedEstimate = Math.round(item.estimate * multiplier);

      return {
        lineItemDescription: item.description,
        originalEstimate: item.estimate,
        suggestedEstimate,
        multiplier,
        basedOnJobCount: match ? match.jobCount : 0,
        confidence: match ? Math.min(95, 50 + match.jobCount) : 0,
      };
    });
  }

  getFeedbackLoopSummary(): FeedbackLoopSummary {
    return {
      accuracy: this.getEstimationAccuracy(),
      calibrations: this.getJobTypeCalibrations(),
      lessonsLearned: this.getLessonsLearned(),
    };
  }

  getLessonsLearned(): LessonLearned[] {
    return MOCK_LESSONS;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private findCalibrationMatch(description: string): JobTypeCalibration | undefined {
    const lower = description.toLowerCase();
    return MOCK_CALIBRATIONS.find((cal) => {
      const keywords = cal.jobType.toLowerCase().split(/\s+/);
      return keywords.some((kw) => lower.includes(kw));
    });
  }
}

// ── Hooks ───────────────────────────────────────────────────────────────────

const service = EstimationFeedbackService.getInstance();

export function useEstimationAccuracy(): EstimationAccuracy {
  return useMemo(() => service.getEstimationAccuracy(), []);
}

export function useJobTypeCalibrations(): JobTypeCalibration[] {
  return useMemo(() => service.getJobTypeCalibrations(), []);
}

export function useQuoteCalibration(
  lineItems: { description: string; estimate: number }[]
): QuoteCalibrationSuggestion[] {
  return useMemo(() => service.getQuoteCalibration(lineItems), [lineItems]);
}

export function useFeedbackLoopSummary(): FeedbackLoopSummary {
  return useMemo(() => service.getFeedbackLoopSummary(), []);
}
