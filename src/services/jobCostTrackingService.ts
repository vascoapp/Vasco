// =============================================================================
// JOB COST TRACKING SERVICE
// =============================================================================
// Tracks actual vs estimated costs per job. Calculates margin variance,
// identifies leakage reasons, and provides estimation accuracy scoring.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface MaterialEntry {
  name: string;
  estimatedQty: number;
  actualQty: number;
  unitPrice: number;
  estimatedCost: number;
  actualCost: number;
}

export interface JobEstimate {
  jobId: string;
  hours: number;
  materials: number;
  travel: number;
  total: number;
  materialEntries: MaterialEntry[];
}

export interface JobActual {
  jobId: string;
  hours: number;
  materials: number;
  travel: number;
  total: number;
  materialEntries: MaterialEntry[];
}

export type VarianceCategory = 'uren' | 'materiaal' | 'reistijd' | 'herwerk' | 'onvoorzien';

export interface VarianceReason {
  category: VarianceCategory;
  description: string;
  amount: number;
}

export interface JobCostVariance {
  jobId: string;
  jobName: string;
  estimatedHours: number;
  actualHours: number;
  estimatedMaterials: number;
  actualMaterials: number;
  estimatedTotal: number;
  actualTotal: number;
  marginDelta: number; // positive = over budget (leakage)
  marginPercent: number;
  varianceReasons: VarianceReason[];
  completedDate: string;
}

export interface CostTrackingSummary {
  averageHoursAccuracy: number; // 0-100
  totalMarginLeakage: number; // euros
  estimationScore: number; // 0-100
  topVarianceReasons: Array<{ category: VarianceCategory; amount: number; count: number }>;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_ESTIMATES: JobEstimate[] = [
  {
    jobId: 'job_301',
    hours: 24,
    materials: 3200,
    travel: 120,
    total: 4640, // 24h * €55/h + 3200 + 120
    materialEntries: [
      { name: 'Tegels 60x60 antraciet', estimatedQty: 45, actualQty: 45, unitPrice: 38, estimatedCost: 1710, actualCost: 1710 },
      { name: 'Tegellijm flexibel', estimatedQty: 6, actualQty: 6, unitPrice: 28, estimatedCost: 168, actualCost: 168 },
      { name: 'Voegmortel grijs', estimatedQty: 4, actualQty: 4, unitPrice: 18, estimatedCost: 72, actualCost: 72 },
      { name: 'Waterdichtingset', estimatedQty: 1, actualQty: 1, unitPrice: 145, estimatedCost: 145, actualCost: 145 },
    ],
  },
  {
    jobId: 'job_302',
    hours: 16,
    materials: 1850,
    travel: 80,
    total: 2810, // 16h * €55/h + 1850 + 80
    materialEntries: [
      { name: 'Koperen buis 22mm', estimatedQty: 12, actualQty: 12, unitPrice: 24, estimatedCost: 288, actualCost: 288 },
      { name: 'Thermostaatkraan', estimatedQty: 1, actualQty: 1, unitPrice: 340, estimatedCost: 340, actualCost: 340 },
      { name: 'PVC afvoer 50mm', estimatedQty: 8, actualQty: 8, unitPrice: 12, estimatedCost: 96, actualCost: 96 },
      { name: 'Doucheset compleet', estimatedQty: 1, actualQty: 1, unitPrice: 680, estimatedCost: 680, actualCost: 680 },
    ],
  },
  {
    jobId: 'job_303',
    hours: 8,
    materials: 420,
    travel: 45,
    total: 905, // 8h * €55/h + 420 + 45
    materialEntries: [
      { name: 'Groepenkast 12-groeps', estimatedQty: 1, actualQty: 1, unitPrice: 185, estimatedCost: 185, actualCost: 185 },
      { name: 'Automaat 16A', estimatedQty: 6, actualQty: 6, unitPrice: 18, estimatedCost: 108, actualCost: 108 },
      { name: 'Aardlekschakelaar 30mA', estimatedQty: 2, actualQty: 2, unitPrice: 42, estimatedCost: 84, actualCost: 84 },
    ],
  },
  {
    jobId: 'job_304',
    hours: 32,
    materials: 5400,
    travel: 160,
    total: 7320, // 32h * €55/h + 5400 + 160
    materialEntries: [
      { name: 'Keukenblad composiet', estimatedQty: 1, actualQty: 1, unitPrice: 1800, estimatedCost: 1800, actualCost: 1800 },
      { name: 'Kraan met uittrekbare sproeier', estimatedQty: 1, actualQty: 1, unitPrice: 420, estimatedCost: 420, actualCost: 420 },
      { name: 'Afvoerset compleet', estimatedQty: 1, actualQty: 1, unitPrice: 95, estimatedCost: 95, actualCost: 95 },
      { name: 'Wandtegels 10x30 wit', estimatedQty: 60, actualQty: 60, unitPrice: 22, estimatedCost: 1320, actualCost: 1320 },
    ],
  },
  {
    jobId: 'job_305',
    hours: 6,
    materials: 280,
    travel: 35,
    total: 645, // 6h * €55/h + 280 + 35
    materialEntries: [
      { name: 'CV-ketel onderdelen', estimatedQty: 1, actualQty: 1, unitPrice: 145, estimatedCost: 145, actualCost: 145 },
      { name: 'Expansievat 18L', estimatedQty: 1, actualQty: 1, unitPrice: 85, estimatedCost: 85, actualCost: 85 },
      { name: 'Vulslang + koppelingen', estimatedQty: 1, actualQty: 1, unitPrice: 32, estimatedCost: 32, actualCost: 32 },
    ],
  },
];

const MOCK_ACTUALS: JobActual[] = [
  // Job 301: Tegelvloer badkamer — went way over on hours (rework due to uneven subfloor)
  {
    jobId: 'job_301',
    hours: 34, // +10h over estimate
    materials: 3580, // needed extra tiles + extra lijm
    travel: 120,
    total: 5570, // 34h * €55/h + 3580 + 120
    materialEntries: [
      { name: 'Tegels 60x60 antraciet', estimatedQty: 45, actualQty: 52, unitPrice: 38, estimatedCost: 1710, actualCost: 1976 },
      { name: 'Tegellijm flexibel', estimatedQty: 6, actualQty: 9, unitPrice: 28, estimatedCost: 168, actualCost: 252 },
      { name: 'Voegmortel grijs', estimatedQty: 4, actualQty: 5, unitPrice: 18, estimatedCost: 72, actualCost: 90 },
      { name: 'Waterdichtingset', estimatedQty: 1, actualQty: 1, unitPrice: 145, estimatedCost: 145, actualCost: 145 },
      { name: 'Egaline 25kg (ongepland)', estimatedQty: 0, actualQty: 3, unitPrice: 24, estimatedCost: 0, actualCost: 72 },
    ],
  },
  // Job 302: Badkamer leidingwerk — material overrun (corroded pipes needed more copper)
  {
    jobId: 'job_302',
    hours: 18, // +2h, minor
    materials: 2340, // +€490 extra materials
    travel: 80,
    total: 3410, // 18h * €55/h + 2340 + 80
    materialEntries: [
      { name: 'Koperen buis 22mm', estimatedQty: 12, actualQty: 20, unitPrice: 24, estimatedCost: 288, actualCost: 480 },
      { name: 'Thermostaatkraan', estimatedQty: 1, actualQty: 1, unitPrice: 340, estimatedCost: 340, actualCost: 340 },
      { name: 'PVC afvoer 50mm', estimatedQty: 8, actualQty: 11, unitPrice: 12, estimatedCost: 96, actualCost: 132 },
      { name: 'Doucheset compleet', estimatedQty: 1, actualQty: 1, unitPrice: 680, estimatedCost: 680, actualCost: 680 },
      { name: 'Soldeerset + fittingen (extra)', estimatedQty: 0, actualQty: 1, unitPrice: 65, estimatedCost: 0, actualCost: 65 },
    ],
  },
  // Job 303: Groepenkast vervangen — came in UNDER budget (clean job)
  {
    jobId: 'job_303',
    hours: 6, // -2h under estimate
    materials: 390, // slightly less material
    travel: 45,
    total: 765, // 6h * €55/h + 390 + 45
    materialEntries: [
      { name: 'Groepenkast 12-groeps', estimatedQty: 1, actualQty: 1, unitPrice: 185, estimatedCost: 185, actualCost: 185 },
      { name: 'Automaat 16A', estimatedQty: 6, actualQty: 5, unitPrice: 18, estimatedCost: 108, actualCost: 90 },
      { name: 'Aardlekschakelaar 30mA', estimatedQty: 2, actualQty: 2, unitPrice: 42, estimatedCost: 84, actualCost: 84 },
    ],
  },
  // Job 304: Keukenrenovatie — over on hours + travel (unforeseen plumbing issue)
  {
    jobId: 'job_304',
    hours: 40, // +8h over estimate
    materials: 5650, // +€250 extra materials
    travel: 280, // extra trips for parts
    total: 8130, // 40h * €55/h + 5650 + 280
    materialEntries: [
      { name: 'Keukenblad composiet', estimatedQty: 1, actualQty: 1, unitPrice: 1800, estimatedCost: 1800, actualCost: 1800 },
      { name: 'Kraan met uittrekbare sproeier', estimatedQty: 1, actualQty: 1, unitPrice: 420, estimatedCost: 420, actualCost: 420 },
      { name: 'Afvoerset compleet', estimatedQty: 1, actualQty: 2, unitPrice: 95, estimatedCost: 95, actualCost: 190 },
      { name: 'Wandtegels 10x30 wit', estimatedQty: 60, actualQty: 64, unitPrice: 22, estimatedCost: 1320, actualCost: 1408 },
      { name: 'PVC verloopstuk (ongepland)', estimatedQty: 0, actualQty: 3, unitPrice: 8, estimatedCost: 0, actualCost: 24 },
    ],
  },
  // Job 305: CV-ketel onderhoud — slightly over on hours, under on materials
  {
    jobId: 'job_305',
    hours: 7, // +1h
    materials: 230, // -€50 less materials
    travel: 55, // +€20 extra trip
    total: 670, // 7h * €55/h + 230 + 55
    materialEntries: [
      { name: 'CV-ketel onderdelen', estimatedQty: 1, actualQty: 1, unitPrice: 145, estimatedCost: 145, actualCost: 110 },
      { name: 'Expansievat 18L', estimatedQty: 1, actualQty: 1, unitPrice: 85, estimatedCost: 85, actualCost: 85 },
      { name: 'Vulslang + koppelingen', estimatedQty: 1, actualQty: 1, unitPrice: 32, estimatedCost: 32, actualCost: 32 },
    ],
  },
];

const MOCK_JOB_NAMES: Record<string, string> = {
  job_301: 'Tegelvloer badkamer — Van Dijk',
  job_302: 'Badkamer leidingwerk — Pietersen',
  job_303: 'Groepenkast vervangen — Bakker',
  job_304: 'Keukenrenovatie — De Vries',
  job_305: 'CV-ketel onderhoud — Mulder',
};

const MOCK_COMPLETED_DATES: Record<string, string> = {
  job_301: '2026-01-28',
  job_302: '2026-01-22',
  job_303: '2026-02-03',
  job_304: '2026-01-15',
  job_305: '2026-02-05',
};

const MOCK_VARIANCE_REASONS: Record<string, VarianceReason[]> = {
  // Tegelvloer: major hours overrun due to rework on uneven subfloor + extra materials
  job_301: [
    { category: 'herwerk', description: 'Ondergrond ongelijk — egaliseren nodig', amount: 385 },
    { category: 'uren', description: '10 extra uren door herwerk', amount: 550 },
    { category: 'materiaal', description: 'Extra tegels en lijm door snijverlies', amount: 380 },
  ],
  // Badkamer leidingwerk: corroded pipes needed more copper + extra hours
  job_302: [
    { category: 'materiaal', description: 'Verroeste leidingen — extra koperbuis nodig', amount: 490 },
    { category: 'uren', description: '2 extra uren voor vervanging oude leidingen', amount: 110 },
  ],
  // Groepenkast: clean job, under budget
  job_303: [
    { category: 'uren', description: 'Sneller klaar dan verwacht', amount: -110 },
    { category: 'materiaal', description: '1 automaat minder nodig', amount: -18 },
  ],
  // Keukenrenovatie: unforeseen plumbing + extra travel for parts
  job_304: [
    { category: 'onvoorzien', description: 'Verborgen leidingprobleem achter muur', amount: 280 },
    { category: 'uren', description: '8 extra uren door onvoorzien werk', amount: 440 },
    { category: 'reistijd', description: '3 extra ritten naar bouwmarkt voor onderdelen', amount: 120 },
  ],
  // CV-ketel: minor overrun on hours, saved on parts
  job_305: [
    { category: 'uren', description: 'Extra diagnose-uur voor storingscode', amount: 55 },
    { category: 'reistijd', description: 'Extra rit voor specifiek onderdeel', amount: 20 },
    { category: 'materiaal', description: 'Goedkoper onderdeel beschikbaar', amount: -50 },
  ],
};

// =============================================================================
// SERVICE
// =============================================================================

class JobCostTrackingService {
  private buildVariance(jobId: string): JobCostVariance | null {
    const estimate = MOCK_ESTIMATES.find(e => e.jobId === jobId);
    const actual = MOCK_ACTUALS.find(a => a.jobId === jobId);
    if (!estimate || !actual) return null;

    const marginDelta = actual.total - estimate.total; // positive = over budget
    const marginPercent = estimate.total > 0
      ? Math.round((marginDelta / estimate.total) * 100)
      : 0;

    return {
      jobId,
      jobName: MOCK_JOB_NAMES[jobId] || jobId,
      estimatedHours: estimate.hours,
      actualHours: actual.hours,
      estimatedMaterials: estimate.materials,
      actualMaterials: actual.materials,
      estimatedTotal: estimate.total,
      actualTotal: actual.total,
      marginDelta,
      marginPercent,
      varianceReasons: MOCK_VARIANCE_REASONS[jobId] || [],
      completedDate: MOCK_COMPLETED_DATES[jobId] || '2026-01-01',
    };
  }

  getJobCostVariance(jobId: string): JobCostVariance | null {
    return this.buildVariance(jobId);
  }

  getAllVariances(): JobCostVariance[] {
    return MOCK_ESTIMATES
      .map(e => this.buildVariance(e.jobId))
      .filter((v): v is JobCostVariance => v !== null)
      .sort((a, b) => b.completedDate.localeCompare(a.completedDate));
  }

  getRecentVariances(limit: number = 5): JobCostVariance[] {
    return this.getAllVariances().slice(0, limit);
  }

  getSummary(): CostTrackingSummary {
    const variances = this.getAllVariances();

    // Average hours accuracy: how close actual hours are to estimated (0-100, 100 = perfect)
    const hoursAccuracies = variances.map(v => {
      const diff = Math.abs(v.actualHours - v.estimatedHours);
      const accuracy = Math.max(0, 100 - (diff / v.estimatedHours) * 100);
      return accuracy;
    });
    const averageHoursAccuracy = Math.round(
      hoursAccuracies.reduce((sum, a) => sum + a, 0) / hoursAccuracies.length
    );

    // Total margin leakage: sum of positive marginDeltas only (over-budget jobs)
    const totalMarginLeakage = variances
      .filter(v => v.marginDelta > 0)
      .reduce((sum, v) => sum + v.marginDelta, 0);

    // Estimation score: overall accuracy considering both hours and materials (0-100)
    const totalAccuracies = variances.map(v => {
      const diff = Math.abs(v.actualTotal - v.estimatedTotal);
      return Math.max(0, 100 - (diff / v.estimatedTotal) * 100);
    });
    const estimationScore = Math.round(
      totalAccuracies.reduce((sum, a) => sum + a, 0) / totalAccuracies.length
    );

    // Top variance reasons: aggregate by category
    const reasonMap = new Map<VarianceCategory, { amount: number; count: number }>();
    for (const v of variances) {
      for (const r of v.varianceReasons) {
        if (r.amount > 0) { // only leakage reasons
          const existing = reasonMap.get(r.category) || { amount: 0, count: 0 };
          existing.amount += r.amount;
          existing.count += 1;
          reasonMap.set(r.category, existing);
        }
      }
    }
    const topVarianceReasons = Array.from(reasonMap.entries())
      .map(([category, data]) => ({ category, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);

    return {
      averageHoursAccuracy,
      totalMarginLeakage,
      estimationScore,
      topVarianceReasons,
    };
  }
}

export const jobCostTrackingService = new JobCostTrackingService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function useJobCostVariance(jobId: string) {
  return useMemo(() => jobCostTrackingService.getJobCostVariance(jobId), [jobId]);
}

export function useJobCostSummary() {
  return useMemo(() => jobCostTrackingService.getSummary(), []);
}

export function useRecentVariances(limit?: number) {
  return useMemo(() => jobCostTrackingService.getRecentVariances(limit), [limit]);
}

// =============================================================================
// MATERIAL INTELLIGENCE HOOK — uses decisionIntelligence for categorization
// =============================================================================

export function useMaterialAnalysis() {
  return useMemo(() => {
    // Lazy import to avoid circular dependency
    const { decisionIntelligence } = require('../intelligence/decisionIntelligence');

    // Collect all materials from actuals
    const allMaterials: Array<{ name: string; cost: number; supplier?: string }> = [];
    for (const actual of MOCK_ACTUALS) {
      for (const entry of actual.materialEntries) {
        allMaterials.push({
          name: entry.name,
          cost: entry.actualCost,
        });
      }
    }

    return decisionIntelligence.analyzeMaterialSpend(allMaterials);
  }, []);
}
