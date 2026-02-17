// =============================================================================
// CONTINGENCY BURN GENERATOR
// =============================================================================
// Warns when contingency is being consumed too quickly relative to project
// completion percentage. Flags projects at risk of depleting reserves.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects } from '../../data/mockProjects';
import { logPrediction } from '../calibration';

export function useContingencyBurnInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'cfo' && ctx.role !== 'director') return null;

  // Analyze contingency burn across portfolio
  const projectsWithContingency = mockProjects
    .filter(p => p.contingency > 0)
    .map(p => {
      const burnRate = p.contingencyUsed / p.contingency;
      const totalBudget = p.totalBudget;
      const spentPct = totalBudget > 0 ? p.actualSpent / totalBudget : 0;
      // Contingency burn should roughly track spend — if burn >> spend, it's a problem
      const burnOverSpend = spentPct > 0 ? burnRate / spentPct : burnRate;
      return { project: p, burnRate, spentPct, burnOverSpend };
    })
    .sort((a, b) => b.burnRate - a.burnRate);

  if (projectsWithContingency.length === 0) return null;

  const worst = projectsWithContingency[0];
  if (worst.burnRate < 0.5) return null; // Not yet concerning

  const currency = worst.project.currency === 'GBP' ? '£' : '€';
  const remaining = worst.project.contingency - worst.project.contingencyUsed;
  const formatK = (v: number) => `${currency}${(v / 1000).toFixed(0)}K`;
  const formatM = (v: number) => v >= 1_000_000
    ? `${currency}${(v / 1_000_000).toFixed(1)}M`
    : formatK(v);

  const burnPct = Math.round(worst.burnRate * 100);
  const spentPct = Math.round(worst.spentPct * 100);
  const isAccelerated = worst.burnOverSpend > 1.5;

  logPrediction({
    generatorId: 'contingency-burn',
    predictedAt: new Date().toISOString(),
    prediction: `${worst.project.name}: ${burnPct}% contingency verbruikt bij ${spentPct}% projectvoortgang`,
    predictedValue: worst.burnRate,
  });

  return {
    id: 'contingency-burn',
    generatorId: 'contingency-burn',
    category: 'financial',
    priority: worst.burnRate > 0.8 ? 'critical' : worst.burnRate > 0.6 ? 'high' : 'medium',
    title: `Contingency: ${worst.project.name}`,
    message: `${burnPct}% contingency verbruikt bij ${spentPct}% projectvoortgang. ${isAccelerated ? 'Verbruik gaat sneller dan verwacht.' : ''} Resterend: ${formatM(remaining)}.`,
    detail: `Totaal contingency: ${formatM(worst.project.contingency)}. Gebruikt: ${formatM(worst.project.contingencyUsed)}. ${isAccelerated ? 'Contingency-burn is 1.5x sneller dan budgetverbruik.' : ''}`,
    icon: 'umbrella',
    actionLabel: 'Bekijk contingency',
    actionRoute: '/hub/costs',
    source: 'Contingency Tracker',
    metric: { label: 'Verbruikt', value: `${burnPct}%`, trend: isAccelerated ? 'down' : 'neutral' },
    rootCauseTags: ['contingency', 'risk-reserves'],
    rawScore: 0,
    reasoning: {
      observation: `${worst.project.name} verbruikt contingency sneller dan verwacht`,
      evidence: `${burnPct}% contingency bij ${spentPct}% voortgang (ratio: ${worst.burnOverSpend.toFixed(1)}x)`,
      implication: remaining < worst.project.contingency * 0.2
        ? 'Risicoreserve bijna uitgeput — onverwachte kosten kunnen niet meer worden opgevangen'
        : 'Bij huidige burn-rate is contingency mogelijk niet toereikend',
      suggestion: worst.burnRate > 0.8
        ? 'Overweeg contingency-aanvulling of scope-reductie om reserves te beschermen'
        : 'Monitor maandelijks en bespreek met projectmanager',
    },
    dataPoints: projectsWithContingency.length,
    confidence: 0.85,
    freshness: 2,
  };
}
