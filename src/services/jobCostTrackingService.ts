// =============================================================================
// JOB COST TRACKING SERVICE
// =============================================================================
// Tracks actual vs estimated costs per job using standard cost-accounting
// variance analysis: quantity variance, rate (price) variance, and mix
// (interaction) variance. Provides per-job and aggregate KPIs.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOURLY_RATE = 55; // €/h — standard labor rate used across all estimates

// =============================================================================
// TYPES
// =============================================================================

export interface MaterialEntry {
  name: string;
  estimatedQty: number;
  actualQty: number;
  estimatedUnitPrice: number;
  actualUnitPrice: number;
  estimatedCost: number; // estQty × estPrice
  actualCost: number;    // actQty × actPrice
  supplierName?: string;
  // Standard cost-accounting variance decomposition
  quantityVariance: number; // (actQty − estQty) × estPrice
  priceVariance: number;    // (actPrice − estPrice) × estQty
  mixVariance: number;      // (actQty − estQty) × (actPrice − estPrice)
}

export interface JobEstimate {
  jobId: string;
  hours: number;
  hourlyRate: number;
  laborCost: number;      // hours × hourlyRate
  materialsCost: number;  // sum of materialEntries.estimatedCost
  travel: number;
  total: number;          // laborCost + materialsCost + travel
  materialEntries: MaterialEntry[];
}

export interface JobActual {
  jobId: string;
  hours: number;
  hourlyRate: number;
  laborCost: number;
  materialsCost: number;
  subcontractorCost: number;
  travel: number;
  total: number;
  materialEntries: MaterialEntry[];
}

export interface MaterialPricePoint {
  materialName: string;
  supplierName: string;
  unitPrice: number;
  quantity: number;
  jobId: string;
}

export type VarianceCategory = 'uren' | 'materiaal' | 'reistijd' | 'herwerk' | 'onvoorzien';

export interface VarianceReason {
  category: VarianceCategory;
  description: string;
  amount: number;
}

export interface SupplierPriceDelta {
  name: string;
  supplierName: string;
  estimatedUnitPrice: number;
  actualUnitPrice: number;
  priceDelta: number;        // |actual − estimated| per unit (always positive)
  priceDeltaPercent: number; // priceDelta / estimatedUnitPrice × 100
  quantity: number;          // actual qty purchased
  totalImpact: number;       // priceDelta × quantity — total financial impact
}

export interface MaterialVarianceSummary {
  totalQuantityVariance: number;
  totalPriceVariance: number;
  totalMixVariance: number;
  totalMaterialVariance: number; // qty + price + mix (should equal actualCost − estimatedCost)
  entryCount: number;
  worstPriceItem?: { name: string; priceVariance: number; supplierName?: string };
  supplierOvercharges: SupplierPriceDelta[];
  supplierSavings: SupplierPriceDelta[];   // entries where actual price < estimated
}

export interface JobCostVariance {
  jobId: string;
  jobName: string;
  estimatedHours: number;
  actualHours: number;
  hoursVariance: number;       // actual − estimated
  hoursVariancePercent: number;
  estimatedMaterials: number;
  actualMaterials: number;
  estimatedTotal: number;
  actualTotal: number;
  marginDelta: number;   // positive = over budget (leakage)
  marginPercent: number; // marginDelta / estimatedTotal × 100
  varianceReasons: VarianceReason[];
  materialVariance: MaterialVarianceSummary;
  completedDate: string;
}

export interface CostTrackingSummary {
  jobCount: number;
  averageHoursAccuracy: number;     // 0-100
  averageMaterialAccuracy: number;  // 0-100 (parallel to hours)
  totalMarginLeakage: number;       // € sum of over-budget jobs
  netMarginDelta: number;           // € net across all jobs (includes under-budget)
  estimationScore: number;          // 0-100
  cpi: number;                      // Cost Performance Index: estimated/actual (>1 = under budget)
  topVarianceReasons: Array<{ category: VarianceCategory; amount: number; count: number }>;
  // Material variance attribution across all jobs
  totalMaterialPriceVariance: number;
  totalMaterialQuantityVariance: number;
  totalMaterialMixVariance: number;
  totalMaterialVariance: number;
  materialPriceVariancePercent: number; // as % of total estimated materials
  // Labor variance
  totalLaborEfficiencyVariance: number; // Σ hoursVariance × hourlyRate
  // Totals for ratio computation
  totalEstimatedMaterials: number;
  totalEstimatedLabor: number;
  // Supplier impact
  allSupplierOvercharges: SupplierPriceDelta[];
  allSupplierSavings: SupplierPriceDelta[];
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Creates a MaterialEntry with standard cost-accounting 3-way variance:
 *   Quantity variance = (actQty − estQty) × estPrice
 *   Price variance    = (actPrice − estPrice) × estQty
 *   Mix variance      = (actQty − estQty) × (actPrice − estPrice)
 *
 * The three sum to the total cost difference: actualCost − estimatedCost.
 */
function mat(
  name: string,
  estQty: number,
  actQty: number,
  estPrice: number,
  actPrice: number,
  supplierName?: string,
): MaterialEntry {
  const estimatedCost = estQty * estPrice;
  const actualCost = actQty * actPrice;
  const dq = actQty - estQty;
  const dp = actPrice - estPrice;
  return {
    name,
    estimatedQty: estQty,
    actualQty: actQty,
    estimatedUnitPrice: estPrice,
    actualUnitPrice: actPrice,
    estimatedCost,
    actualCost,
    supplierName,
    quantityVariance: dq * estPrice,
    priceVariance: dp * estQty,
    mixVariance: dq * dp,
  };
}

/** Build a job record from entries — totals are derived, never hardcoded. */
function buildJob(
  jobId: string,
  hours: number,
  travel: number,
  entries: MaterialEntry[],
  rate: number = HOURLY_RATE,
  subcontractorCost: number = 0,
): JobActual {
  const laborCost = hours * rate;
  const materialsCost = entries.reduce((s, e) => s + e.actualCost, 0);
  return {
    jobId,
    hours,
    hourlyRate: rate,
    laborCost,
    materialsCost,
    subcontractorCost,
    travel,
    total: laborCost + materialsCost + travel + subcontractorCost,
    materialEntries: entries,
  };
}

/** Same as buildJob but uses estimatedCost from entries. */
function buildEstimate(
  jobId: string,
  hours: number,
  travel: number,
  entries: MaterialEntry[],
  rate: number = HOURLY_RATE,
): JobEstimate {
  const laborCost = hours * rate;
  const materialsCost = entries.reduce((s, e) => s + e.estimatedCost, 0);
  return {
    jobId,
    hours,
    hourlyRate: rate,
    laborCost,
    materialsCost,
    travel,
    total: laborCost + materialsCost + travel,
    materialEntries: entries,
  };
}

// =============================================================================
// MOCK DATA
// =============================================================================

// Estimates: est prices = act prices (these are the plan, no variance within estimates)
const MOCK_ESTIMATES: JobEstimate[] = [
  buildEstimate('job_301', 24, 120, [
    mat('Tegels 60x60 antraciet', 45, 45, 38, 38, 'Bouwmaat'),
    mat('Tegellijm flexibel', 6, 6, 28, 28, 'Bouwmaat'),
    mat('Voegmortel grijs', 4, 4, 18, 18, 'Bouwmaat'),
    mat('Waterdichtingset', 1, 1, 145, 145, 'Technische Unie'),
  ]),
  buildEstimate('job_302', 16, 80, [
    mat('Koperen buis 22mm', 12, 12, 24, 24, 'Technische Unie'),
    mat('Thermostaatkraan', 1, 1, 340, 340, 'Technische Unie'),
    mat('PVC afvoer 50mm', 8, 8, 12, 12, 'Bouwmaat'),
    mat('Doucheset compleet', 1, 1, 680, 680, 'Technische Unie'),
  ]),
  buildEstimate('job_303', 8, 45, [
    mat('Groepenkast 12-groeps', 1, 1, 185, 185, 'Technische Unie'),
    mat('Automaat 16A', 6, 6, 18, 18, 'Technische Unie'),
    mat('Aardlekschakelaar 30mA', 2, 2, 42, 42, 'Technische Unie'),
  ]),
  buildEstimate('job_304', 32, 160, [
    mat('Keukenblad composiet', 1, 1, 1800, 1800, 'Keukengroothandel'),
    mat('Kraan met uittrekbare sproeier', 1, 1, 420, 420, 'Technische Unie'),
    mat('Afvoerset compleet', 1, 1, 95, 95, 'Bouwmaat'),
    mat('Wandtegels 10x30 wit', 60, 60, 22, 22, 'Bouwmaat'),
  ]),
  buildEstimate('job_305', 6, 35, [
    mat('CV-ketel onderdelen', 1, 1, 145, 145, 'Technische Unie'),
    mat('Expansievat 18L', 1, 1, 85, 85, 'Technische Unie'),
    mat('Vulslang + koppelingen', 1, 1, 32, 32, 'Hornbach'),
  ]),
];

const MOCK_ACTUALS: JobActual[] = [
  // Job 301: Tegelvloer — qty overrun + Bouwmaat tile price +5%
  buildJob('job_301', 34, 120, [
    mat('Tegels 60x60 antraciet', 45, 52, 38, 40, 'Bouwmaat'),
    mat('Tegellijm flexibel', 6, 9, 28, 28, 'Bouwmaat'),
    mat('Voegmortel grijs', 4, 5, 18, 19.50, 'Bouwmaat'),
    mat('Waterdichtingset', 1, 1, 145, 145, 'Technische Unie'),
    mat('Egaline 25kg (ongepland)', 0, 3, 24, 24, 'Hornbach'),
  ]),
  // Job 302: Leidingwerk — qty overrun + copper price spike +15%
  buildJob('job_302', 18, 80, [
    mat('Koperen buis 22mm', 12, 20, 24, 27.60, 'Technische Unie'),
    mat('Thermostaatkraan', 1, 1, 340, 340, 'Technische Unie'),
    mat('PVC afvoer 50mm', 8, 11, 12, 12, 'Bouwmaat'),
    mat('Doucheset compleet', 1, 1, 680, 680, 'Technische Unie'),
    mat('Soldeerset + fittingen (extra)', 0, 1, 65, 65, 'Technische Unie'),
  ]),
  // Job 303: Groepenkast — under budget, found cheaper automaten
  buildJob('job_303', 6, 45, [
    mat('Groepenkast 12-groeps', 1, 1, 185, 185, 'Technische Unie'),
    mat('Automaat 16A', 6, 5, 18, 15.50, 'Hornbach'),
    mat('Aardlekschakelaar 30mA', 2, 2, 42, 42, 'Technische Unie'),
  ]),
  // Job 304: Keukenrenovatie — wall tiles +8% at Bouwmaat + extra travel
  buildJob('job_304', 40, 280, [
    mat('Keukenblad composiet', 1, 1, 1800, 1800, 'Keukengroothandel'),
    mat('Kraan met uittrekbare sproeier', 1, 1, 420, 420, 'Technische Unie'),
    mat('Afvoerset compleet', 1, 2, 95, 95, 'Bouwmaat'),
    mat('Wandtegels 10x30 wit', 60, 64, 22, 23.75, 'Bouwmaat'),
    mat('PVC verloopstuk (ongepland)', 0, 3, 8, 8, 'Bouwmaat'),
  ]),
  // Job 305: CV-ketel — found cheaper parts at Hornbach
  buildJob('job_305', 7, 55, [
    mat('CV-ketel onderdelen', 1, 1, 145, 110, 'Hornbach'),
    mat('Expansievat 18L', 1, 1, 85, 85, 'Technische Unie'),
    mat('Vulslang + koppelingen', 1, 1, 32, 32, 'Hornbach'),
  ]),
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
  job_301: [
    { category: 'herwerk', description: 'Ondergrond ongelijk — egaliseren nodig', amount: 385 },
    { category: 'uren', description: '10 extra uren door herwerk', amount: 550 },
    { category: 'materiaal', description: 'Extra tegels en lijm door snijverlies (hoeveelheid)', amount: 310 },
    { category: 'materiaal', description: 'Bouwmaat tegelprijsverhoging +5% (€38→€40/stuk)', amount: 104 },
  ],
  job_302: [
    { category: 'materiaal', description: 'Extra koperbuis door verroeste leidingen (hoeveelheid)', amount: 192 },
    { category: 'materiaal', description: 'Technische Unie koperprijsstijging +15% (€24→€27,60/m)', amount: 552 },
    { category: 'uren', description: '2 extra uren voor vervanging oude leidingen', amount: 110 },
  ],
  job_303: [
    { category: 'uren', description: 'Sneller klaar dan verwacht', amount: -110 },
    { category: 'materiaal', description: '1 automaat minder nodig', amount: -18 },
    { category: 'materiaal', description: 'Goedkopere automaten bij Hornbach (€18→€15,50)', amount: -12.50 },
  ],
  job_304: [
    { category: 'onvoorzien', description: 'Verborgen leidingprobleem achter muur', amount: 280 },
    { category: 'uren', description: '8 extra uren door onvoorzien werk', amount: 440 },
    { category: 'reistijd', description: '3 extra ritten naar bouwmarkt voor onderdelen', amount: 120 },
    { category: 'materiaal', description: 'Bouwmaat wandtegel prijsverhoging +8% (€22→€23,75)', amount: 112 },
  ],
  job_305: [
    { category: 'uren', description: 'Extra diagnose-uur voor storingscode', amount: 55 },
    { category: 'reistijd', description: 'Extra rit voor specifiek onderdeel', amount: 20 },
    { category: 'materiaal', description: 'Goedkoper onderdeel bij Hornbach i.p.v. Technische Unie (€145→€110)', amount: -35 },
  ],
};

// =============================================================================
// SERVICE
// =============================================================================

class JobCostTrackingService {
  private buildMaterialVariance(actualEntries: MaterialEntry[]): MaterialVarianceSummary {
    let totalQuantityVariance = 0;
    let totalPriceVariance = 0;
    let totalMixVariance = 0;
    let worstPriceItem: MaterialVarianceSummary['worstPriceItem'];
    const supplierOvercharges: SupplierPriceDelta[] = [];
    const supplierSavings: SupplierPriceDelta[] = [];

    for (const entry of actualEntries) {
      totalQuantityVariance += entry.quantityVariance;
      totalPriceVariance += entry.priceVariance;
      totalMixVariance += entry.mixVariance;

      // Track worst price item (biggest total price impact)
      const entryPriceImpact = entry.priceVariance + entry.mixVariance;
      if (entryPriceImpact > 0 && (!worstPriceItem || entryPriceImpact > worstPriceItem.priceVariance)) {
        worstPriceItem = { name: entry.name, priceVariance: entryPriceImpact, supplierName: entry.supplierName };
      }

      if (entry.supplierName && entry.estimatedUnitPrice > 0) {
        // Track supplier overcharges (actual price > estimated price)
        if (entry.actualUnitPrice > entry.estimatedUnitPrice) {
          const priceDelta = entry.actualUnitPrice - entry.estimatedUnitPrice;
          supplierOvercharges.push({
            name: entry.name,
            supplierName: entry.supplierName,
            estimatedUnitPrice: entry.estimatedUnitPrice,
            actualUnitPrice: entry.actualUnitPrice,
            priceDelta,
            priceDeltaPercent: round2((priceDelta / entry.estimatedUnitPrice) * 100),
            quantity: entry.actualQty,
            totalImpact: round2(priceDelta * entry.actualQty),
          });
        }

        // Track supplier savings (actual price < estimated price)
        if (entry.actualUnitPrice < entry.estimatedUnitPrice) {
          const priceDelta = entry.estimatedUnitPrice - entry.actualUnitPrice;
          supplierSavings.push({
            name: entry.name,
            supplierName: entry.supplierName,
            estimatedUnitPrice: entry.estimatedUnitPrice,
            actualUnitPrice: entry.actualUnitPrice,
            priceDelta,
            priceDeltaPercent: round2((priceDelta / entry.estimatedUnitPrice) * 100),
            quantity: entry.actualQty,
            totalImpact: round2(priceDelta * entry.actualQty),
          });
        }
      }
    }

    return {
      totalQuantityVariance: round2(totalQuantityVariance),
      totalPriceVariance: round2(totalPriceVariance),
      totalMixVariance: round2(totalMixVariance),
      totalMaterialVariance: round2(totalQuantityVariance + totalPriceVariance + totalMixVariance),
      entryCount: actualEntries.length,
      worstPriceItem,
      supplierOvercharges: supplierOvercharges.sort((a, b) => b.totalImpact - a.totalImpact),
      supplierSavings: supplierSavings.sort((a, b) => b.totalImpact - a.totalImpact),
    };
  }

  private buildVariance(jobId: string): JobCostVariance | null {
    const estimate = MOCK_ESTIMATES.find(e => e.jobId === jobId);
    const actual = MOCK_ACTUALS.find(a => a.jobId === jobId);
    if (!estimate || !actual) return null;

    const marginDelta = actual.total - estimate.total;
    const hoursVariance = actual.hours - estimate.hours;

    return {
      jobId,
      jobName: MOCK_JOB_NAMES[jobId] || jobId,
      estimatedHours: estimate.hours,
      actualHours: actual.hours,
      hoursVariance,
      hoursVariancePercent: estimate.hours > 0 ? round2((hoursVariance / estimate.hours) * 100) : 0,
      estimatedMaterials: estimate.materialsCost,
      actualMaterials: actual.materialsCost,
      estimatedTotal: estimate.total,
      actualTotal: actual.total,
      marginDelta: round2(marginDelta),
      marginPercent: estimate.total > 0 ? round2((marginDelta / estimate.total) * 100) : 0,
      varianceReasons: MOCK_VARIANCE_REASONS[jobId] || [],
      materialVariance: this.buildMaterialVariance(actual.materialEntries),
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
    if (variances.length === 0) {
      return {
        jobCount: 0, averageHoursAccuracy: 100, averageMaterialAccuracy: 100,
        totalMarginLeakage: 0, netMarginDelta: 0,
        estimationScore: 100, cpi: 1, topVarianceReasons: [],
        totalMaterialPriceVariance: 0, totalMaterialQuantityVariance: 0,
        totalMaterialMixVariance: 0, totalMaterialVariance: 0,
        materialPriceVariancePercent: 0, totalLaborEfficiencyVariance: 0,
        totalEstimatedMaterials: 0, totalEstimatedLabor: 0,
        allSupplierOvercharges: [], allSupplierSavings: [],
      };
    }

    // Hours accuracy: 0-100 where 100 = perfect estimate
    const hoursAccuracies = variances.map(v => {
      if (v.estimatedHours === 0) return 100;
      return Math.max(0, 100 - Math.abs(v.hoursVariancePercent));
    });
    const averageHoursAccuracy = Math.round(
      hoursAccuracies.reduce((sum, a) => sum + a, 0) / hoursAccuracies.length,
    );

    // Material accuracy: parallel to hours accuracy
    const materialAccuracies = variances.map(v => {
      if (v.estimatedMaterials === 0) return 100;
      const pct = ((v.actualMaterials - v.estimatedMaterials) / v.estimatedMaterials) * 100;
      return Math.max(0, 100 - Math.abs(pct));
    });
    const averageMaterialAccuracy = Math.round(
      materialAccuracies.reduce((sum, a) => sum + a, 0) / materialAccuracies.length,
    );

    // Leakage = sum of positive deltas only; net = all deltas
    const totalMarginLeakage = variances
      .filter(v => v.marginDelta > 0)
      .reduce((sum, v) => sum + v.marginDelta, 0);
    const netMarginDelta = variances.reduce((sum, v) => sum + v.marginDelta, 0);

    // Estimation score: weighted accuracy across all cost components
    const totalAccuracies = variances.map(v => {
      if (v.estimatedTotal === 0) return 100;
      return Math.max(0, 100 - Math.abs(v.marginPercent));
    });
    const estimationScore = Math.round(
      totalAccuracies.reduce((sum, a) => sum + a, 0) / totalAccuracies.length,
    );

    // CPI: Cost Performance Index = estimated / actual
    // >1 = under budget (good), <1 = over budget (bad)
    const totalEstimated = variances.reduce((s, v) => s + v.estimatedTotal, 0);
    const totalActual = variances.reduce((s, v) => s + v.actualTotal, 0);
    const cpi = totalActual > 0 ? round2(totalEstimated / totalActual) : 1;

    // Top variance reasons: aggregate by category
    const reasonMap = new Map<VarianceCategory, { amount: number; count: number }>();
    for (const v of variances) {
      for (const r of v.varianceReasons) {
        if (r.amount > 0) {
          const existing = reasonMap.get(r.category) || { amount: 0, count: 0 };
          existing.amount += r.amount;
          existing.count += 1;
          reasonMap.set(r.category, existing);
        }
      }
    }
    const topVarianceReasons = Array.from(reasonMap.entries())
      .map(([category, data]) => ({ category, amount: round2(data.amount), count: data.count }))
      .sort((a, b) => b.amount - a.amount);

    // Material variance decomposition across all jobs
    const totalMaterialPriceVariance = variances.reduce((s, v) => s + v.materialVariance.totalPriceVariance, 0);
    const totalMaterialQuantityVariance = variances.reduce((s, v) => s + v.materialVariance.totalQuantityVariance, 0);
    const totalMaterialMixVariance = variances.reduce((s, v) => s + v.materialVariance.totalMixVariance, 0);
    const totalEstimatedMaterials = variances.reduce((s, v) => s + v.estimatedMaterials, 0);

    // Labor efficiency variance: hours difference valued at standard rate
    const totalLaborEfficiencyVariance = round2(
      variances.reduce((s, v) => s + v.hoursVariance * HOURLY_RATE, 0),
    );

    // Totals for ratio computation (labor vs material share)
    const totalEstimatedLabor = round2(
      variances.reduce((s, v) => s + v.estimatedHours * HOURLY_RATE, 0),
    );

    // Supplier impact: overcharges + savings aggregated across all jobs
    const allSupplierOvercharges = variances
      .flatMap(v => v.materialVariance.supplierOvercharges)
      .sort((a, b) => b.totalImpact - a.totalImpact);
    const allSupplierSavings = variances
      .flatMap(v => v.materialVariance.supplierSavings)
      .sort((a, b) => b.totalImpact - a.totalImpact);

    return {
      jobCount: variances.length,
      averageHoursAccuracy,
      averageMaterialAccuracy,
      totalMarginLeakage: round2(totalMarginLeakage),
      netMarginDelta: round2(netMarginDelta),
      estimationScore,
      cpi,
      topVarianceReasons,
      totalMaterialPriceVariance: round2(totalMaterialPriceVariance),
      totalMaterialQuantityVariance: round2(totalMaterialQuantityVariance),
      totalMaterialMixVariance: round2(totalMaterialMixVariance),
      totalMaterialVariance: round2(totalMaterialPriceVariance + totalMaterialQuantityVariance + totalMaterialMixVariance),
      materialPriceVariancePercent: totalEstimatedMaterials > 0
        ? round2((totalMaterialPriceVariance / totalEstimatedMaterials) * 100)
        : 0,
      totalLaborEfficiencyVariance,
      totalEstimatedMaterials: round2(totalEstimatedMaterials),
      totalEstimatedLabor,
      allSupplierOvercharges,
      allSupplierSavings,
    };
  }

  /**
   * Returns all actual material price points grouped by material name.
   * Used by the supplier price anomaly generator to find cross-supplier
   * savings (same material, different suppliers, different prices).
   */
  getCrossSupplierPriceMap(): Map<string, MaterialPricePoint[]> {
    const priceMap = new Map<string, MaterialPricePoint[]>();

    for (const actual of MOCK_ACTUALS) {
      for (const entry of actual.materialEntries) {
        if (!entry.supplierName || entry.actualUnitPrice <= 0) continue;
        const key = entry.name;
        const points = priceMap.get(key) || [];
        points.push({
          materialName: entry.name,
          supplierName: entry.supplierName,
          unitPrice: entry.actualUnitPrice,
          quantity: entry.actualQty,
          jobId: actual.jobId,
        });
        priceMap.set(key, points);
      }
    }

    return priceMap;
  }

  /**
   * Records actual material unit prices from a completed job as price
   * observations in Supabase. Every completed job becomes a data point
   * for supplier price tracking — no invoice OCR needed.
   */
  async recordJobPriceObservations(jobId: string): Promise<number> {
    const { createPriceObservationsBatch } = await import('../lib/dataProvider');
    const actual = MOCK_ACTUALS.find(a => a.jobId === jobId);
    if (!actual) return 0;

    const completedDate = MOCK_COMPLETED_DATES[jobId] || new Date().toISOString();

    const observations = actual.materialEntries
      .filter(entry => entry.actualUnitPrice > 0 && entry.actualQty > 0)
      .map(entry => ({
        material_name: entry.name,
        supplier_name: entry.supplierName,
        price: entry.actualUnitPrice,
        unit: 'stuk',
        source: 'job_completion' as const,
        observed_at: completedDate,
      }));

    return createPriceObservationsBatch(observations);
  }

  /** Records price observations for all completed jobs (initial seeding). */
  async recordAllJobPriceObservations(): Promise<number> {
    let total = 0;
    for (const actual of MOCK_ACTUALS) {
      total += await this.recordJobPriceObservations(actual.jobId);
    }
    return total;
  }
}

/** Round to 2 decimal places. Avoids floating-point display noise. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
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

export function useCrossSupplierPriceMap() {
  return useMemo(() => jobCostTrackingService.getCrossSupplierPriceMap(), []);
}

// =============================================================================
// MATERIAL INTELLIGENCE HOOK
// =============================================================================

export function useMaterialAnalysis() {
  return useMemo(() => {
    const { decisionIntelligence } = require('../intelligence/decisionIntelligence');

    const allMaterials: Array<{ name: string; cost: number; supplier?: string }> = [];
    for (const actual of MOCK_ACTUALS) {
      for (const entry of actual.materialEntries) {
        allMaterials.push({
          name: entry.name,
          cost: entry.actualCost,
          supplier: entry.supplierName,
        });
      }
    }

    return decisionIntelligence.analyzeMaterialSpend(allMaterials);
  }, []);
}
