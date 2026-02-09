// =============================================================================
// SAVINGS OPPORTUNITY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { usePredictiveSavingsSummary } from '../../services/predictiveSavingsService';

export const savingsOpportunityGenerator: InsightGenerator = {
  id: 'savings-opportunity',
  screens: ['today', 'savings'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useSavingsOpportunityInsight(ctx: GeneratorContext): ScoredInsight | null {
  const predictive = usePredictiveSavingsSummary();

  const urgentOpps = predictive.opportunities.filter(p => p.urgency === 'high');
  if (urgentOpps.length === 0) return null;

  const top = urgentOpps[0];
  const totalPotential = predictive.opportunities.reduce((sum, o) => sum + o.potentialSaving, 0);

  return {
    id: `predictive-${top.id}`,
    generatorId: 'savings-opportunity',
    category: 'opportunity',
    priority: 'medium',
    title: top.title,
    message: top.description,
    icon: top.icon as VascoInsight['icon'],
    actionLabel: top.actionLabel,
    actionRoute: '/(contractor)/besparen',
    source: 'Besparingsanalyse',
    metric: { label: 'Potentieel', value: `€${top.potentialSaving}`, trend: 'up' },

    rawScore: 0,
    reasoning: {
      observation: `${urgentOpps.length} urgente besparingskansen gedetecteerd`,
      evidence: `Op basis van ${predictive.opportunities.length} geanalyseerde mogelijkheden`,
      implication: `Totaal besparingspotentieel: €${totalPotential.toLocaleString('nl-NL')}`,
      suggestion: top.actionLabel || 'Bekijk de besparingsdetails en neem actie',
    },
    dataPoints: predictive.opportunities.length,
    confidence: 0.75,
    freshness: 4,
  };
}
