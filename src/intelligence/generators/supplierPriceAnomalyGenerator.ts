// =============================================================================
// SUPPLIER PRICE ANOMALY GENERATOR
// =============================================================================
// Analyses supplier pricing across completed jobs to detect:
//   1. Suppliers with net overcharge or savings position
//   2. Same material available cheaper from another supplier
//   3. Annualized cost impact with seasonal adjustment
//   4. Z-score anomaly detection for sudden price spikes
//
// Uses the 3-way variance decomposition from jobCostTrackingService and
// matches the quality bar of peer generators (anomaly detection, trend
// recording, seasonal context, continuous confidence).
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import {
  useJobCostSummary,
  useRecentVariances,
  useCrossSupplierPriceMap,
  type SupplierPriceDelta,
} from '../../services/jobCostTrackingService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { gt } from '../generatorTranslations';
import { detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';

// ── Analysis types ──────────────────────────────────────────────────────────

interface SupplierProfile {
  name: string;
  overchargeCount: number;
  savingsCount: number;
  netImpact: number;              // overcharge − savings (positive = net cost)
  totalOvercharge: number;
  totalSavings: number;
  avgPriceDeviationPercent: number;
  materials: string[];
}

interface CrossSupplierSaving {
  materialName: string;
  expensiveSupplier: string;
  expensivePrice: number;
  cheaperSupplier: string;
  cheaperPrice: number;
  savingsPerUnit: number;
  savingsPercent: number;
  estimatedAnnualSavings: number; // savingsPerUnit × annualized qty
}

// ── Generator ───────────────────────────────────────────────────────────────

export function useSupplierPriceAnomalyInsight(ctx: GeneratorContext): ScoredInsight | null {
  const summary = useJobCostSummary();
  const variances = useRecentVariances(10);
  const priceMap = useCrossSupplierPriceMap();

  if (variances.length === 0) return null;

  // Record metric for trend tracking (uses marginLeakage as composite metric)
  recordMetricSnapshot('marginLeakage', summary.totalMarginLeakage);

  // ── 1. Build net supplier profiles (overcharges AND savings) ──────────
  const supplierData = new Map<string, {
    overchargeDevs: number[];
    totalOvercharge: number;
    totalSavings: number;
    savingsCount: number;
    materials: Set<string>;
  }>();

  // Aggregate overcharges per supplier
  for (const oc of summary.allSupplierOvercharges) {
    const existing = supplierData.get(oc.supplierName) || {
      overchargeDevs: [], totalOvercharge: 0, totalSavings: 0,
      savingsCount: 0, materials: new Set<string>(),
    };
    existing.overchargeDevs.push(oc.priceDeltaPercent);
    existing.totalOvercharge += oc.totalImpact;
    existing.materials.add(oc.name);
    supplierData.set(oc.supplierName, existing);
  }

  // Aggregate savings per supplier
  for (const sv of summary.allSupplierSavings) {
    const existing = supplierData.get(sv.supplierName) || {
      overchargeDevs: [], totalOvercharge: 0, totalSavings: 0,
      savingsCount: 0, materials: new Set<string>(),
    };
    existing.totalSavings += sv.totalImpact;
    existing.savingsCount += 1;
    existing.materials.add(sv.name);
    supplierData.set(sv.supplierName, existing);
  }

  const supplierProfiles: SupplierProfile[] = [];
  supplierData.forEach((data, name) => {
    const avgDev = data.overchargeDevs.length > 0
      ? data.overchargeDevs.reduce((s, v) => s + v, 0) / data.overchargeDevs.length
      : 0;
    supplierProfiles.push({
      name,
      overchargeCount: data.overchargeDevs.length,
      savingsCount: data.savingsCount,
      netImpact: round2(data.totalOvercharge - data.totalSavings),
      totalOvercharge: round2(data.totalOvercharge),
      totalSavings: round2(data.totalSavings),
      avgPriceDeviationPercent: round1(avgDev),
      materials: Array.from(data.materials),
    });
  });
  supplierProfiles.sort((a, b) => b.netImpact - a.netImpact);

  // ── 2. Cross-supplier price comparison with annualized volume ─────────
  const crossSavings: CrossSupplierSaving[] = [];

  // Compute annualization factor from job date span
  const dates = variances.map(v => new Date(v.completedDate).getTime());
  const spanMs = Math.max(...dates) - Math.min(...dates);
  const spanMonths = Math.max(1, spanMs / (30.44 * 24 * 60 * 60 * 1000));
  const annualizationFactor = 12 / spanMonths;

  priceMap.forEach((points, materialName) => {
    // Group by supplier: lowest price seen + total qty purchased
    const supplierPrices = new Map<string, { bestPrice: number; totalQty: number }>();
    for (const pt of points) {
      const existing = supplierPrices.get(pt.supplierName);
      if (!existing) {
        supplierPrices.set(pt.supplierName, { bestPrice: pt.unitPrice, totalQty: pt.quantity });
      } else {
        if (pt.unitPrice < existing.bestPrice) existing.bestPrice = pt.unitPrice;
        existing.totalQty += pt.quantity;
      }
    }

    if (supplierPrices.size < 2) return;

    // Find cheapest and most expensive
    let cheapest = { supplier: '', price: Infinity, qty: 0 };
    let expensive = { supplier: '', price: 0, qty: 0 };
    supplierPrices.forEach((data, supplier) => {
      if (data.bestPrice < cheapest.price) cheapest = { supplier, price: data.bestPrice, qty: data.totalQty };
      if (data.bestPrice > expensive.price) expensive = { supplier, price: data.bestPrice, qty: data.totalQty };
    });

    // Only flag if >5% price difference
    if (expensive.price > cheapest.price * 1.05) {
      const savingsPerUnit = round2(expensive.price - cheapest.price);
      // Estimate annual savings: expensive supplier's qty × savings per unit, annualized
      const estimatedAnnualSavings = round2(
        savingsPerUnit * expensive.qty * annualizationFactor,
      );
      crossSavings.push({
        materialName,
        expensiveSupplier: expensive.supplier,
        expensivePrice: expensive.price,
        cheaperSupplier: cheapest.supplier,
        cheaperPrice: cheapest.price,
        savingsPerUnit,
        savingsPercent: round1((savingsPerUnit / expensive.price) * 100),
        estimatedAnnualSavings,
      });
    }
  });

  // Sort by estimated annual savings (highest first)
  crossSavings.sort((a, b) => b.estimatedAnnualSavings - a.estimatedAnnualSavings);

  // ── 3. Annualized projection ──────────────────────────────────────────
  const annualizedOvercharge = round2(
    summary.totalMaterialPriceVariance * annualizationFactor,
  );
  const totalCrossSupplierSavings = crossSavings.reduce(
    (s, cs) => s + cs.estimatedAnnualSavings, 0,
  );

  // ── 4. Anomaly detection & seasonal context ───────────────────────────
  const anomaly = detectAnomaly(
    ctx.profile, 'marginLeakage', summary.totalMarginLeakage,
  );
  const seasonMult = getSeasonalMultiplier('marginLeakage');
  const seasonNote = seasonMult > 1.05
    ? ' Materiaalkosten zijn hoger in het laagseizoen.' : '';

  // ── 5. Relative trigger threshold ─────────────────────────────────────
  const overchargeCount = summary.allSupplierOvercharges.length;
  const savingsCount = summary.allSupplierSavings.length;
  const priceVariancePct = Math.abs(summary.materialPriceVariancePercent);
  const hasCrossSavings = crossSavings.length > 0;

  if (priceVariancePct < 2 && !hasCrossSavings && overchargeCount === 0) {
    return null;
  }

  // ── 6. Log prediction for calibration ─────────────────────────────────
  logPrediction({
    generatorId: 'supplier-price-anomaly',
    predictedAt: new Date().toISOString(),
    prediction: `Prijsafwijking: \u20AC${Math.round(summary.totalMaterialPriceVariance)} (${round1(priceVariancePct)}% van geschat materiaal)`,
    predictedValue: summary.totalMaterialPriceVariance,
  });

  // ── 7. Build insight ──────────────────────────────────────────────────
  const isOvercharge = summary.totalMaterialPriceVariance > 0;
  const worstSupplier = supplierProfiles[0];
  const worstOvercharge = summary.allSupplierOvercharges[0];

  // Priority: anomaly severity overrides static thresholds
  const priority = anomaly.severity === 'severe' ? 'critical' as const
    : anomaly.severity === 'moderate' ? 'high' as const
    : priceVariancePct > 8 ? 'high' as const
    : priceVariancePct > 4 ? 'medium' as const
    : 'low' as const;

  const title = isOvercharge
    ? `Leveranciersprijzen \u20AC${Math.round(summary.totalMaterialPriceVariance)} boven offerte`
    : hasCrossSavings
      ? `${crossSavings.length} materialen goedkoper bij andere leverancier`
      : `Materiaalkosten \u20AC${Math.abs(Math.round(summary.totalMaterialPriceVariance))} lager door slimme inkoop`;

  const messageParts: string[] = [];
  if (isOvercharge && worstSupplier) {
    messageParts.push(
      `${worstSupplier.name} rekent gemiddeld ${worstSupplier.avgPriceDeviationPercent}% meer dan geoffreerd (netto \u20AC${Math.round(worstSupplier.netImpact)} impact).`,
    );
  }
  if (hasCrossSavings) {
    const top = crossSavings[0];
    messageParts.push(
      `${top.materialName}: ${top.savingsPercent}% goedkoper bij ${top.cheaperSupplier} (\u20AC${Math.round(top.estimatedAnnualSavings)}/jaar besparing).`,
    );
  }
  if (!isOvercharge && !hasCrossSavings) {
    messageParts.push(
      'Materiaalkosten zijn lager uitgevallen dan geoffreerd. Goede leverancierskeuze.',
    );
  }

  const detailParts: string[] = [];

  // Net supplier position (overcharges vs savings)
  if (supplierProfiles.length > 0) {
    detailParts.push('Leveranciersprofiel (netto positie):');
    for (const sp of supplierProfiles.slice(0, 4)) {
      const direction = sp.netImpact > 0 ? '+' : '\u2212';
      detailParts.push(
        `\u2022 ${sp.name}: ${direction}\u20AC${Math.abs(Math.round(sp.netImpact))} netto (${sp.overchargeCount} duurder, ${sp.savingsCount} goedkoper)`,
      );
    }
  }

  if (crossSavings.length > 0) {
    detailParts.push('');
    detailParts.push('Besparingsmogelijkheden (andere leverancier):');
    for (const cs of crossSavings.slice(0, 4)) {
      detailParts.push(
        `\u2022 ${cs.materialName}: \u20AC${cs.cheaperPrice} bij ${cs.cheaperSupplier} vs. \u20AC${cs.expensivePrice} bij ${cs.expensiveSupplier} (\u2212${cs.savingsPercent}%, \u20AC${Math.round(cs.estimatedAnnualSavings)}/jaar)`,
      );
    }
    if (totalCrossSupplierSavings > 0) {
      detailParts.push(
        `Totale geschatte jaarlijkse besparing door leverancierswisseling: \u20AC${Math.round(totalCrossSupplierSavings)}`,
      );
    }
  }

  if (annualizedOvercharge !== 0) {
    detailParts.push('');
    detailParts.push(
      `Projectie: bij huidig inkooppatroon is de jaarlijkse prijsafwijking \u20AC${Math.abs(Math.round(annualizedOvercharge))} ${annualizedOvercharge > 0 ? 'extra kosten' : 'besparing'}.${seasonNote}`,
    );
  }

  if (anomaly.isAnomaly) {
    detailParts.push('');
    detailParts.push(`\u26A0 ${anomaly.description}`);
  }

  detailParts.push('');
  detailParts.push(
    `Variantie-decompositie: prijs \u20AC${Math.round(summary.totalMaterialPriceVariance)}, hoeveelheid \u20AC${Math.round(summary.totalMaterialQuantityVariance)}, mix \u20AC${Math.round(summary.totalMaterialMixVariance)} | CPI: ${summary.cpi.toFixed(2)}`,
  );

  // ── 8. Continuous confidence ──────────────────────────────────────────
  // Saturating curve: confidence = maxConf × (1 − e^(−dataPoints/k))
  // More data points → higher confidence, asymptotically approaching 0.92
  const totalDataPoints = overchargeCount + savingsCount + variances.length + crossSavings.length;
  const baseConfidence = 0.92 * (1 - Math.exp(-totalDataPoints / 8));
  // Anomaly detection boosts confidence if confirmed
  const confidence = anomaly.isAnomaly
    ? Math.min(0.95, baseConfidence + 0.05)
    : round2(Math.max(0.40, baseConfidence));

  return {
    id: 'supplier-price-anomaly',
    generatorId: 'supplier-price-anomaly',
    category: isOvercharge ? 'alert' : 'opportunity',
    priority,
    title,
    message: messageParts.join(' '),
    detail: detailParts.join('\n'),
    icon: 'pricetags',
    actionLabel: isOvercharge
      ? 'Prijzen vergelijken'
      : hasCrossSavings
        ? 'Bekijk alternatieven'
        : 'Bekijk besparing',
    actionRoute: '/(contractor)/decisions',
    source: gt('source_procurement', ctx.language),
    metric: {
      label: isOvercharge ? 'Prijsafwijking' : 'Besparing',
      value: `${summary.totalMaterialPriceVariance > 0 ? '+' : ''}\u20AC${Math.abs(Math.round(summary.totalMaterialPriceVariance))}`,
      trend: isOvercharge ? 'down' : 'up',
    },
    rootCauseTags: ['supplier', 'price-variance', 'procurement'],
    rawScore: 0,
    reasoning: {
      observation: isOvercharge
        ? `${overchargeCount} materialen duurder per stuk dan geoffreerd (${round1(priceVariancePct)}% van materiaalbudget)`
        : hasCrossSavings
          ? `${crossSavings.length} materialen beschikbaar bij een goedkopere leverancier`
          : 'Materiaalkosten lager dan geoffreerd door betere leverancierskeuze',
      evidence: [
        `${summary.jobCount} klussen geanalyseerd`,
        `Materiaal prijsvariantie: \u20AC${Math.round(summary.totalMaterialPriceVariance)} (${round1(priceVariancePct)}%)`,
        `Hoeveelheid: \u20AC${Math.round(summary.totalMaterialQuantityVariance)}, mix: \u20AC${Math.round(summary.totalMaterialMixVariance)}`,
        `CPI: ${summary.cpi.toFixed(2)}`,
        worstSupplier
          ? `Duurste leverancier: ${worstSupplier.name} (netto +\u20AC${Math.round(worstSupplier.netImpact)})`
          : null,
        anomaly.isAnomaly
          ? `Anomalie: ${anomaly.severity} (${anomaly.zScore.toFixed(1)}\u03C3)`
          : null,
        (() => {
          const t = getTrend(ctx.profile, 'marginLeakage', 4);
          return t && t.slope !== 0 ? `Marge-trend: ${t.direction}` : null;
        })(),
      ].filter(Boolean).join('. '),
      implication: isOvercharge
        ? `Jaarlijkse impact bij huidig patroon: \u20AC${Math.abs(Math.round(annualizedOvercharge))} extra materiaalkosten.${totalCrossSupplierSavings > 0 ? ` Wisselen van leverancier bespaart \u20AC${Math.round(totalCrossSupplierSavings)}/jaar.` : ''}`
        : `Door prijzen te vergelijken bespaar je gemiddeld \u20AC${Math.abs(Math.round(summary.totalMaterialPriceVariance / Math.max(summary.jobCount, 1)))} per klus.`,
      suggestion: isOvercharge
        ? `Vraag vooraf actuele prijzen op bij 2+ leveranciers.${worstOvercharge ? ` Begin met ${worstOvercharge.name} \u2014 hier is het verschil het grootst.` : ''}${crossSavings.length > 0 ? ` Wissel ${crossSavings[0].materialName} naar ${crossSavings[0].cheaperSupplier} voor directe besparing.` : ''}`
        : 'Houd deze werkwijze aan. Overweeg raamcontracten voor materialen die je het vaakst gebruikt.',
    },
    dataPoints: totalDataPoints,
    confidence,
    freshness: anomaly.isAnomaly ? 1 : 3,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
