// =============================================================================
// PROJECT BUDGET VARIANCE GENERATOR
// =============================================================================
// Flags projects with CPI < 1.0 (over budget). Highlights cost overruns and
// estimates at completion vs budget.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects, mockDeliveryMetrics } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

export function useProjectBudgetVarianceInsight(ctx: GeneratorContext): ScoredInsight | null {
  // Only relevant for CFO/Director
  if (ctx.role !== 'cfo' && ctx.role !== 'director') return null;

  const overBudgetProjects = mockProjects
    .map(p => {
      const metrics = mockDeliveryMetrics[p.id];
      if (!metrics) return null;
      const cpi = metrics.cpiCostPerformanceIndex;
      const variance = metrics.costVariance;
      return { project: p, metrics, cpi, variance };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null && d.cpi < 1.0)
    .sort((a, b) => a.cpi - b.cpi);

  if (overBudgetProjects.length === 0) return null;

  const worst = overBudgetProjects[0];
  const eac = worst.metrics.estimateAtCompletion;
  const bac = worst.metrics.budgetAtCompletion;
  const overrun = eac - bac;

  logPrediction({
    generatorId: 'project-budget-variance',
    predictedAt: new Date().toISOString(),
    prediction: `${worst.project.name} CPI: ${worst.cpi.toFixed(2)}, EAC overschrijding: £${Math.round(overrun / 1000)}K`,
    predictedValue: worst.cpi,
  });

  const currency = worst.project.currency === 'GBP' ? '£' : '€';
  const formatM = (v: number) => `${currency}${(Math.abs(v) / 1_000_000).toFixed(1)}M`;

  return {
    id: 'project-budget-variance',
    generatorId: 'project-budget-variance',
    category: 'financial',
    priority: worst.cpi < 0.9 ? 'critical' : worst.cpi < 0.95 ? 'high' : 'medium',
    title: `Budgetoverschrijding: ${worst.project.name}`,
    message: `CPI ${worst.cpi.toFixed(2)} — project overschrijdt budget met ${formatM(overrun)}. EAC: ${formatM(eac)} vs budget ${formatM(bac)}.`,
    detail: `${overBudgetProjects.length} project${overBudgetProjects.length > 1 ? 'en' : ''} boven budget. Kostenafwijking: ${formatM(Math.abs(worst.variance))}. Controleer change orders en aannemerskosten.`,
    icon: 'warning',
    actionLabel: 'Bekijk kostenoverzicht',
    actionRoute: '/hub/costs',
    source: 'Budget Analyse',
    metric: { label: 'CPI', value: worst.cpi.toFixed(2), trend: worst.cpi < 0.95 ? 'down' : 'neutral' },
    rootCauseTags: ['budget', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: `${worst.project.name} heeft een CPI van ${worst.cpi.toFixed(2)}`,
      evidence: `EAC ${formatM(eac)} vs BAC ${formatM(bac)}, ${worst.metrics.changeOrdersSubmitted} change orders ingediend`,
      implication: `Project overschrijdt budget met ${formatM(overrun)} — directe actie vereist`,
      suggestion: worst.cpi < 0.9
        ? 'Escaleer naar directie — overweeg scope reductie of contract heronderhandeling'
        : 'Review aannemerskosten en claim management',
    },
    dataPoints: mockProjects.length,
    confidence: 0.9,
    freshness: 1,
  };
}
