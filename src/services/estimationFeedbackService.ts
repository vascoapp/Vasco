import { useMemo } from 'react';
import { jobCostTrackingService, type JobCostVariance } from './jobCostTrackingService';

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface EstimationAccuracy {
  overallScore: number; // 0-100
  trend: 'improving' | 'declining' | 'stable';
  trendDelta: number; // e.g. +5
  totalJobsAnalyzed: number;
  averageHoursDeviation: number;             // %
  averageMaterialDeviation: number;          // % combined (backward compat)
  averageMaterialQuantityDeviation: number;  // % from qty alone
  averageMaterialPriceDeviation: number;     // % from price alone
}

export interface JobTypeCalibration {
  jobType: string;
  jobCount: number;
  hoursMultiplier: number;            // actual/estimated ratio
  materialMultiplier: number;         // combined (backward compat)
  materialQuantityMultiplier: number; // actual qty / estimated qty
  materialPriceMultiplier: number;    // actual unit price / estimated unit price
  laborMaterialRatio: number;         // labor share 0-1 (e.g. 0.55 = 55% labor)
  avgMarginDelta: number;             // euros
  recommendation: string;             // Dutch
}

export interface QuoteCalibrationSuggestion {
  lineItemDescription: string;
  originalEstimate: number;
  suggestedEstimate: number;
  hoursMultiplier: number;
  materialQuantityMultiplier: number;
  materialPriceMultiplier: number;
  combinedMultiplier: number;
  laborMaterialRatio: number;   // labor share used for weighting
  basedOnJobCount: number;
  confidence: number; // 0-100
}

export interface LessonLearned {
  id: string;
  jobType: string;
  title: string;
  description: string;
  impact: 'positief' | 'negatief';
  impactAmount: number;
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
  averageMaterialQuantityDeviation: 5.2,
  averageMaterialPriceDeviation: 3.8,
};

const MOCK_CALIBRATIONS: JobTypeCalibration[] = [
  {
    jobType: 'Badkamerrenovatie',
    jobCount: 34,
    hoursMultiplier: 1.15,
    materialMultiplier: 1.08,
    materialQuantityMultiplier: 1.05,
    materialPriceMultiplier: 1.03,
    laborMaterialRatio: 0.55,
    avgMarginDelta: -185,
    recommendation: 'Verhoog uurinschatting met 15% — leidingwerk achter tegels kost structureel meer tijd.',
  },
  {
    jobType: 'CV-ketel onderhoud',
    jobCount: 41,
    hoursMultiplier: 0.95,
    materialMultiplier: 1.02,
    materialQuantityMultiplier: 1.00,
    materialPriceMultiplier: 1.02,
    laborMaterialRatio: 0.65,
    avgMarginDelta: 45,
    recommendation: 'Inschatting is goed. Kleine materiaalopslag kan omlaag naar 2%.',
  },
  {
    jobType: 'Leidingwerk',
    jobCount: 22,
    hoursMultiplier: 1.22,
    materialMultiplier: 1.12,
    materialQuantityMultiplier: 1.04,
    materialPriceMultiplier: 1.08,
    laborMaterialRatio: 0.50,
    avgMarginDelta: -310,
    recommendation: 'Koperprijzen zijn 8% hoger dan geoffreerd. Voeg prijsbuffer toe voor koperen buizen en fittingen.',
  },
  {
    jobType: 'Schilderwerk',
    jobCount: 15,
    hoursMultiplier: 1.05,
    materialMultiplier: 0.92,
    materialQuantityMultiplier: 0.95,
    materialPriceMultiplier: 0.97,
    laborMaterialRatio: 0.70,
    avgMarginDelta: 60,
    recommendation: 'Materiaalkosten zijn lager dan geschat. Verlaag verfbudget met 8%.',
  },
  {
    jobType: 'Keukeninstallatie',
    jobCount: 12,
    hoursMultiplier: 1.30,
    materialMultiplier: 1.18,
    materialQuantityMultiplier: 1.10,
    materialPriceMultiplier: 1.07,
    laborMaterialRatio: 0.40,
    avgMarginDelta: -420,
    recommendation: 'Structureel te laag ingeschat. Hoeveelheid aansluitmateriaal +10%, prijzen composiet +7%. Verhoog offerte met 25%.',
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
    const variances = jobCostTrackingService.getAllVariances();
    if (variances.length === 0) return MOCK_ACCURACY;

    const hoursDeviations = variances.map(v =>
      v.estimatedHours > 0 ? Math.abs(v.actualHours - v.estimatedHours) / v.estimatedHours * 100 : 0
    );
    const materialDeviations = variances.map(v =>
      v.estimatedMaterials > 0 ? Math.abs(v.actualMaterials - v.estimatedMaterials) / v.estimatedMaterials * 100 : 0
    );

    const avgHoursDev = mean(hoursDeviations);
    const avgMatDev = mean(materialDeviations);

    // Split material deviation: qty vs price attribution
    const matQtyDevs = variances.map(v =>
      v.estimatedMaterials > 0 ? Math.abs(v.materialVariance.totalQuantityVariance) / v.estimatedMaterials * 100 : 0
    );
    const matPriceDevs = variances.map(v =>
      v.estimatedMaterials > 0 ? Math.abs(v.materialVariance.totalPriceVariance) / v.estimatedMaterials * 100 : 0
    );

    // Overall score: 100 minus weighted average deviation (hours 60%, materials 40%)
    const overallScore = Math.round(Math.max(0, 100 - (avgHoursDev * 0.6 + avgMatDev * 0.4)));

    return {
      overallScore,
      trend: overallScore > MOCK_ACCURACY.overallScore ? 'improving'
        : overallScore < MOCK_ACCURACY.overallScore ? 'declining' : 'stable',
      trendDelta: overallScore - MOCK_ACCURACY.overallScore,
      totalJobsAnalyzed: variances.length,
      averageHoursDeviation: round1(avgHoursDev),
      averageMaterialDeviation: round1(avgMatDev),
      averageMaterialQuantityDeviation: round1(mean(matQtyDevs)),
      averageMaterialPriceDeviation: round1(mean(matPriceDevs)),
    };
  }

  getJobTypeCalibrations(): JobTypeCalibration[] {
    const variances = jobCostTrackingService.getAllVariances();
    if (variances.length === 0) return MOCK_CALIBRATIONS;

    // Group variances by job name prefix → approximate job type
    const jobTypeMap = new Map<string, JobCostVariance[]>();
    for (const v of variances) {
      const jobType = v.jobName.split('\u2014')[0]?.trim().split(' ')[0] || 'Overig';
      const existing = jobTypeMap.get(jobType) || [];
      existing.push(v);
      jobTypeMap.set(jobType, existing);
    }

    const computed: JobTypeCalibration[] = [];
    for (const [jobType, jobs] of jobTypeMap) {
      const hoursMultiplier = mean(jobs.map(j =>
        j.estimatedHours > 0 ? j.actualHours / j.estimatedHours : 1,
      ));
      const materialMultiplier = mean(jobs.map(j =>
        j.estimatedMaterials > 0 ? j.actualMaterials / j.estimatedMaterials : 1,
      ));
      const avgMarginDelta = mean(jobs.map(j => j.marginDelta));

      // Split material multiplier: qty vs price
      const totalEstQtyCost = jobs.reduce((s, j) => s + j.materialVariance.totalQuantityVariance, 0);
      const totalEstPriceCost = jobs.reduce((s, j) => s + j.materialVariance.totalPriceVariance, 0);
      const totalEstMaterials = jobs.reduce((s, j) => s + j.estimatedMaterials, 0);
      const materialQuantityMultiplier = totalEstMaterials > 0 ? 1 + totalEstQtyCost / totalEstMaterials : 1;
      const materialPriceMultiplier = totalEstMaterials > 0 ? 1 + totalEstPriceCost / totalEstMaterials : 1;

      // Labor/material ratio: computed from estimated labor vs estimated materials
      // hourlyRate (€55) × estimatedHours = estimated labor per job
      const totalEstLabor = jobs.reduce((s, j) => s + j.estimatedHours * 55, 0);
      const totalEstCost = totalEstLabor + totalEstMaterials;
      const laborMaterialRatio = totalEstCost > 0
        ? round2(totalEstLabor / totalEstCost) : 0.60;

      const recommendation = buildCalibrationRecommendation(
        hoursMultiplier, materialQuantityMultiplier, materialPriceMultiplier,
      );

      computed.push({
        jobType,
        jobCount: jobs.length,
        hoursMultiplier: round2(hoursMultiplier),
        materialMultiplier: round2(materialMultiplier),
        materialQuantityMultiplier: round2(materialQuantityMultiplier),
        materialPriceMultiplier: round2(materialPriceMultiplier),
        laborMaterialRatio,
        avgMarginDelta: Math.round(avgMarginDelta),
        recommendation,
      });
    }

    // Merge with historical data for job types not in recent variances
    const computedTypes = new Set(computed.map(c => c.jobType));
    const merged = [
      ...computed,
      ...MOCK_CALIBRATIONS.filter(m => !computedTypes.has(m.jobType)),
    ];

    return merged.sort((a, b) => a.avgMarginDelta - b.avgMarginDelta);
  }

  /**
   * Calibrates quote line items using hours, material qty, and price multipliers.
   * Uses actual labor/material ratio from historical data (not a fixed 60/40).
   *
   *   combined = hours × laborShare + (qtyMult × priceMult) × materialShare
   *
   * This captures: labor overruns in labor share, and both qty expansion
   * and price inflation in the material share.
   */
  getQuoteCalibration(
    lineItems: { description: string; estimate: number }[],
  ): QuoteCalibrationSuggestion[] {
    const calibrations = this.getJobTypeCalibrations();

    return lineItems.map((item) => {
      const match = findCalibrationMatch(item.description, calibrations);
      const hoursMultiplier = match ? match.hoursMultiplier : 1.0;
      const materialQuantityMultiplier = match ? match.materialQuantityMultiplier : 1.0;
      const materialPriceMultiplier = match ? match.materialPriceMultiplier : 1.0;

      // Use actual labor/material ratio from calibration data (not hardcoded 60/40)
      const laborShare = match ? match.laborMaterialRatio : 0.60;
      const materialShare = 1 - laborShare;

      // Combined: hours affect labor share; qty × price affect material share
      const combinedMultiplier = hoursMultiplier * laborShare
        + (materialQuantityMultiplier * materialPriceMultiplier) * materialShare;
      const suggestedEstimate = Math.round(item.estimate * combinedMultiplier);

      return {
        lineItemDescription: item.description,
        originalEstimate: item.estimate,
        suggestedEstimate,
        hoursMultiplier,
        materialQuantityMultiplier,
        materialPriceMultiplier,
        combinedMultiplier: round2(combinedMultiplier),
        laborMaterialRatio: laborShare,
        basedOnJobCount: match ? match.jobCount : 0,
        // Saturating confidence curve: approaches 95% as jobCount grows
        // confidence = 95 × (1 − e^(−jobCount/15))
        confidence: match
          ? Math.round(95 * (1 - Math.exp(-match.jobCount / 15)))
          : 0,
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
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Search calibrations by fuzzy keyword match on job type. */
function findCalibrationMatch(
  description: string,
  calibrations: JobTypeCalibration[],
): JobTypeCalibration | undefined {
  const lower = description.toLowerCase();
  return calibrations.find((cal) => {
    const keywords = cal.jobType.toLowerCase().split(/\s+/);
    return keywords.some((kw) => kw.length >= 3 && lower.includes(kw));
  });
}

/** Build a Dutch recommendation based on the top calibration issues. */
function buildCalibrationRecommendation(
  hoursMultiplier: number,
  materialQuantityMultiplier: number,
  materialPriceMultiplier: number,
): string {
  // Rank issues by severity (distance from 1.0)
  const issues: { key: string; severity: number; text: string }[] = [];

  if (materialPriceMultiplier > 1.05) {
    issues.push({
      key: 'price',
      severity: materialPriceMultiplier - 1,
      text: `Leverancierprijzen ${pct(materialPriceMultiplier)}% hoger dan geoffreerd. Voeg prijsbuffer toe of wissel van leverancier.`,
    });
  }
  if (hoursMultiplier > 1.15) {
    issues.push({
      key: 'hours',
      severity: hoursMultiplier - 1,
      text: `Verhoog uurinschatting met ${pct(hoursMultiplier)}% \u2014 structureel te laag.`,
    });
  }
  if (materialQuantityMultiplier > 1.08) {
    issues.push({
      key: 'qty',
      severity: materialQuantityMultiplier - 1,
      text: `Materiaalverbruik ${pct(materialQuantityMultiplier)}% hoger \u2014 reken extra hoeveelheden in.`,
    });
  }
  if (hoursMultiplier < 0.9) {
    issues.push({
      key: 'hours-over',
      severity: 1 - hoursMultiplier,
      text: `Inschatting is te hoog \u2014 verlaag met ${pct(2 - hoursMultiplier)}%.`,
    });
  }
  if (materialPriceMultiplier < 0.93) {
    issues.push({
      key: 'price-over',
      severity: 1 - materialPriceMultiplier,
      text: `Materiaalbudget ${pct(2 - materialPriceMultiplier)}% te hoog \u2014 verlaag prijs-opslag.`,
    });
  }

  if (issues.length === 0) return 'Inschatting is goed. Houd huidige methode aan.';

  issues.sort((a, b) => b.severity - a.severity);

  // Return top 2 issues combined for a more complete picture
  if (issues.length >= 2) {
    return `${issues[0].text} Daarnaast: ${issues[1].text.charAt(0).toLowerCase()}${issues[1].text.slice(1)}`;
  }
  return issues[0].text;
}

function pct(multiplier: number): number {
  return Math.round(Math.abs(multiplier - 1) * 100);
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
