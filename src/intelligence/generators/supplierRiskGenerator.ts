// =============================================================================
// SUPPLIER RISK GENERATOR
// =============================================================================
// Flags high procurement risk across the project portfolio.
// Uses mockDeliveryMetrics.procurementRiskValue and contractsPending.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects, mockDeliveryMetrics } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

export function useSupplierRiskInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'coo' && ctx.role !== 'sitelead') return null;

  const projectsWithRisk = mockProjects
    .map(p => {
      const m = mockDeliveryMetrics[p.id];
      if (!m) return null;
      return { project: p, riskValue: m.procurementRiskValue, pending: m.contractsPending, awarded: m.contractsAwarded };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null && d.riskValue > 0)
    .sort((a, b) => b.riskValue - a.riskValue);

  if (projectsWithRisk.length === 0) return null;

  const totalRisk = projectsWithRisk.reduce((s, d) => s + d.riskValue, 0);
  const totalPending = projectsWithRisk.reduce((s, d) => s + d.pending, 0);
  const worst = projectsWithRisk[0];

  logPrediction({
    generatorId: 'supplier-risk',
    predictedAt: new Date().toISOString(),
    prediction: `Totale procurement risk: ${(totalRisk / 1_000_000).toFixed(1)}M, ${totalPending} contracten pending`,
    predictedValue: totalRisk,
  });

  const currency = worst.project.currency === 'GBP' ? '£' : '€';
  const formatM = (v: number) => v >= 1_000_000
    ? `${currency}${(v / 1_000_000).toFixed(1)}M`
    : `${currency}${(v / 1000).toFixed(0)}K`;

  return {
    id: 'supplier-risk',
    generatorId: 'supplier-risk',
    category: 'operational',
    priority: totalPending > 10 ? 'high' : totalPending > 5 ? 'medium' : 'low',
    title: `${totalPending} contracten nog niet gegund`,
    message: `Totale procurement risk: ${formatM(totalRisk)}. ${worst.project.name} heeft het hoogste risico: ${formatM(worst.riskValue)} met ${worst.pending} openstaande contracten.`,
    detail: `${projectsWithRisk.length} projecten met procurement risk. ${totalPending} contracten pending over hele portfolio. Hoogste single-project risk: ${formatM(worst.riskValue)}.`,
    icon: 'git-network',
    actionLabel: 'Bekijk leveranciers',
    actionRoute: '/hub/suppliers',
    source: 'Procurement Analyse',
    metric: { label: 'Pending', value: `${totalPending}`, trend: totalPending > 10 ? 'down' : 'neutral' },
    rootCauseTags: ['procurement', 'suppliers'],
    rawScore: 0,
    reasoning: {
      observation: `${totalPending} contracten wachten op gunning over ${projectsWithRisk.length} projecten`,
      evidence: `Totale exposure: ${formatM(totalRisk)}, hoogste: ${worst.project.name} (${formatM(worst.riskValue)})`,
      implication: totalPending > 10
        ? 'Hoge procurement backlog verhoogt vertragingsrisico — prioriteer gunningen'
        : 'Procurement risk is beheersbaar maar vereist monitoring',
      suggestion: totalPending > 10
        ? 'Plan een procurement review meeting en prioriteer contracten op kritiek pad'
        : 'Monitor wekelijks en zorg dat gunningen voor deadline worden afgerond',
    },
    dataPoints: projectsWithRisk.length,
    confidence: 0.82,
    freshness: 3,
  };
}
