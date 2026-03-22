// =============================================================================
// CROSS-SERVICE INTELLIGENCE SERVICE
// =============================================================================
// Connects findings across services to surface non-obvious correlations.
// NOW: Computes insights from actual service data rather than hardcoded mocks.
// =============================================================================

import { useMemo } from 'react';
import { useLaborCosts } from './laborCostService';
import { useSupplierNegotiation } from './supplierNegotiationService';
import { useCollectionsAgent } from './collectionsAgentService';
import { useJobCostSummary } from './jobCostTrackingService';
import { useEstimationAccuracy } from './estimationFeedbackService';

// =============================================================================
// TYPES
// =============================================================================

export interface CrossInsight {
  id: string;
  type: 'correlation' | 'causation' | 'prediction' | 'anomaly';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sources: string[]; // services that contributed
  impact: { value: number; unit: string; direction: 'positive' | 'negative' };
  actionLabel?: string;
  icon: string;
}

export interface ServiceConnection {
  from: string;
  to: string;
  relationship: string;
  strength: number; // 0-100
}

export interface CrossIntelligenceSummary {
  insights: CrossInsight[];
  connections: ServiceConnection[];
  topInsight: CrossInsight;
  totalImpact: number;
}

// =============================================================================
// HOOKS — now compute from real service data
// =============================================================================

export function useCrossServiceIntelligence(): CrossIntelligenceSummary {
  const laborCosts = useLaborCosts();
  const supplierNeg = useSupplierNegotiation();
  const collections = useCollectionsAgent();
  const costSummary = useJobCostSummary();
  const estimation = useEstimationAccuracy();

  return useMemo(() => {
    const insights: CrossInsight[] = [];

    // 1. Labor efficiency → Profitability correlation
    const bestJobType = laborCosts.jobTypeRanking[0];
    const worstJobType = laborCosts.jobTypeRanking[laborCosts.jobTypeRanking.length - 1];
    if (bestJobType && worstJobType && bestJobType.effectiveHourlyRate > worstJobType.effectiveHourlyRate * 1.3) {
      const rateGap = bestJobType.effectiveHourlyRate - worstJobType.effectiveHourlyRate;
      insights.push({
        id: 'cross_labor_profit',
        type: 'correlation',
        priority: 'high',
        title: `${bestJobType.jobType} levert €${rateGap}/uur meer op`,
        description: `${bestJobType.jobType} (€${bestJobType.effectiveHourlyRate}/uur) vs ${worstJobType.jobType} (€${worstJobType.effectiveHourlyRate}/uur). Meer focus op ${bestJobType.jobType} verhoogt je gemiddeld uurtarief.`,
        sources: ['laborCostService', 'projectProfitabilityService'],
        impact: { value: rateGap * 20, unit: '€/maand', direction: 'positive' },
        actionLabel: 'Klustype-mix aanpassen',
        icon: 'trending-up',
      });
    }

    // 2. Supplier concentration → Negotiation leverage
    if (supplierNeg.concentration.herfindahlIndex > 2500) {
      const topSupplier = supplierNeg.topLeverage;
      insights.push({
        id: 'cross_supplier_risk',
        type: 'anomaly',
        priority: 'medium',
        title: `Leveranciersrisico: ${supplierNeg.concentration.topSupplierShare}% bij ${topSupplier.supplierName}`,
        description: `HHI-index ${supplierNeg.concentration.herfindahlIndex} — hoge concentratie. ${supplierNeg.concentration.diversificationAdvice}`,
        sources: ['supplierNegotiationService'],
        impact: { value: supplierNeg.totalDiscountPotential, unit: '€/jaar', direction: 'positive' },
        actionLabel: 'Leveranciers spreiden',
        icon: 'shield-checkmark',
      });
    }

    // 3. DSO × Outstanding → Cash gap prediction
    const dsoOverTarget = collections.dso.currentDSO - collections.dso.targetDSO;
    if (dsoOverTarget > 0 && collections.summary.totalOutstanding > 3000) {
      const workingCapitalCost = Math.round(
        dsoOverTarget * collections.summary.totalOutstanding / 365 * 0.08 // 8% cost of capital
      );
      insights.push({
        id: 'cross_dso_cashgap',
        type: 'causation',
        priority: dsoOverTarget > 7 ? 'high' : 'medium',
        title: `Langzame betaling kost €${workingCapitalCost}/maand werkkapitaal`,
        description: `DSO ${collections.dso.currentDSO}d (doel ${collections.dso.targetDSO}d) bij €${collections.summary.totalOutstanding.toLocaleString('nl-NL')} uitstaand. Snellere incasso bespaart werkkapitaal.`,
        sources: ['collectionsAgentService', 'cashFlowService'],
        impact: { value: workingCapitalCost * 12, unit: '€/jaar', direction: 'negative' },
        actionLabel: 'Incasso versnellen',
        icon: 'timer',
      });
    }

    // 4. Estimation accuracy → Margin leakage causation
    if (estimation.overallScore < 85 && costSummary.totalMarginLeakage > 500) {
      insights.push({
        id: 'cross_estimation_margin',
        type: 'causation',
        priority: 'high',
        title: `Inschattingsfouten kosten €${costSummary.totalMarginLeakage.toLocaleString('nl-NL')}/maand`,
        description: `Schattingsscore ${estimation.overallScore}/100 — uren ${estimation.averageHoursDeviation}% te laag, materiaal hoeveelheid ${estimation.averageMaterialQuantityDeviation}% afwijking, materiaal prijs ${estimation.averageMaterialPriceDeviation}% afwijking. Gebruik de kalibratie-tips om offertes te verbeteren.`,
        sources: ['estimationFeedbackService', 'jobCostTrackingService'],
        impact: { value: costSummary.totalMarginLeakage, unit: '€/maand', direction: 'negative' },
        actionLabel: 'Kalibratie bekijken',
        icon: 'calculator',
      });
    }

    // 5. Travel cost × Idle time correlation
    const travelWaste = laborCosts.travelAnalysis.totalTravelCost;
    const idleWaste = laborCosts.idleTime.idleCost;
    if (travelWaste > 300 && idleWaste > 300) {
      insights.push({
        id: 'cross_travel_idle',
        type: 'correlation',
        priority: 'medium',
        title: `Reistijd + idle = €${travelWaste + idleWaste}/maand verlies`,
        description: `Reiskosten (€${travelWaste}) en idle-tijd (€${idleWaste}) samen reduceren door route-clustering en betere planning. Potentieel: €${laborCosts.monthlyOptimizationPotential}/maand.`,
        sources: ['laborCostService', 'scheduleService'],
        impact: { value: laborCosts.monthlyOptimizationPotential, unit: '€/maand', direction: 'positive' },
        actionLabel: 'Routes optimaliseren',
        icon: 'navigate',
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Compute service connections from actual data relationships
    const connections: ServiceConnection[] = [
      {
        from: 'laborCostService',
        to: 'projectProfitabilityService',
        relationship: 'Arbeid bepaalt projectmarge',
        strength: 95,
      },
      {
        from: 'estimationFeedbackService',
        to: 'jobCostTrackingService',
        relationship: `Inschattingsscore ${estimation.overallScore}% → marge-lek €${costSummary.totalMarginLeakage}`,
        strength: Math.min(95, Math.round(100 - estimation.overallScore)),
      },
      {
        from: 'collectionsAgentService',
        to: 'cashFlowService',
        relationship: `DSO ${collections.dso.currentDSO}d → werkkapitaal impact`,
        strength: Math.min(90, dsoOverTarget * 10 + 40),
      },
      {
        from: 'supplierNegotiationService',
        to: 'laborCostService',
        relationship: `€${supplierNeg.totalDiscountPotential} onbenut korting potentieel`,
        strength: Math.min(88, Math.round(supplierNeg.totalDiscountPotential / 20)),
      },
      {
        from: 'laborCostService',
        to: 'scheduleService',
        relationship: `€${laborCosts.monthlyOptimizationPotential} optimalisatiepotentieel`,
        strength: Math.min(85, Math.round(laborCosts.monthlyOptimizationPotential / 10)),
      },
    ];

    const positiveImpact = insights
      .filter(i => i.impact.direction === 'positive' && i.impact.unit.includes('€'))
      .reduce((s, i) => s + i.impact.value, 0);

    return {
      insights,
      connections,
      topInsight: insights[0] || {
        id: 'cross_none',
        type: 'correlation' as const,
        priority: 'low' as const,
        title: 'Geen correlaties gevonden',
        description: 'Meer data nodig voor cross-service inzichten.',
        sources: [],
        impact: { value: 0, unit: '€', direction: 'positive' as const },
        icon: 'analytics',
      },
      totalImpact: positiveImpact,
    };
  }, [laborCosts, supplierNeg, collections, costSummary, estimation]);
}

export function useCrossInsights(filter?: { priority?: CrossInsight['priority'] }): CrossInsight[] {
  const summary = useCrossServiceIntelligence();
  return useMemo(() => {
    if (!filter?.priority) return summary.insights;
    return summary.insights.filter(i => i.priority === filter.priority);
  }, [summary.insights, filter?.priority]);
}
