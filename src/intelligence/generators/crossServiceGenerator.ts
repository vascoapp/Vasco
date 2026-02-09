// =============================================================================
// CROSS SERVICE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { useCrossServiceIntelligence } from '../../services/crossServiceIntelligenceService';

export const crossServiceGenerator: InsightGenerator = {
  id: 'cross-service',
  screens: ['invoices', 'savings', 'decisions'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useCrossServiceInsight(ctx: GeneratorContext): ScoredInsight | null {
  const crossIntel = useCrossServiceIntelligence();

  const relevantInsight = crossIntel.insights
    .filter(i => i.priority === 'high')
    .find(i => {
      if (ctx.screen === 'invoices') return i.sources.some(s => s.includes('cashFlow') || s.includes('invoice'));
      if (ctx.screen === 'savings') return i.sources.some(s => s.includes('supplier') || s.includes('pricing'));
      if (ctx.screen === 'decisions') return i.sources.some(s => s.includes('customer') || s.includes('quote'));
      return false;
    });

  if (!relevantInsight) return null;

  const hasMoneyImpact = relevantInsight.impact.unit.includes('€');

  return {
    id: `cross-${relevantInsight.id}`,
    generatorId: 'cross-service',
    category: 'tip',
    priority: 'medium',
    title: relevantInsight.title,
    message: relevantInsight.description,
    icon: relevantInsight.icon as VascoInsight['icon'],
    actionLabel: relevantInsight.actionLabel,
    source: 'Cross-analyse',
    metric: hasMoneyImpact
      ? {
          label: 'Impact',
          value: `€${relevantInsight.impact.value.toLocaleString('nl-NL')}`,
          trend: relevantInsight.impact.direction === 'positive' ? 'up' : 'down',
        }
      : undefined,

    rawScore: 0,
    reasoning: {
      observation: `Verband gevonden tussen ${relevantInsight.sources.join(' en ')}`,
      evidence: `Op basis van ${relevantInsight.sources.length} gekoppelde databronnen`,
      implication: hasMoneyImpact
        ? `Geschatte impact: €${relevantInsight.impact.value.toLocaleString('nl-NL')}`
        : relevantInsight.description,
      suggestion: relevantInsight.actionLabel || 'Bekijk de details voor meer informatie',
    },
    dataPoints: relevantInsight.sources.length * 10,
    confidence: 0.65,
    freshness: 8,
  };
}
