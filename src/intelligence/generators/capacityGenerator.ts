// =============================================================================
// CAPACITY GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useCapacityForecast } from '../../services/capacityPlanningService';

export const capacityGenerator: InsightGenerator = {
  id: 'capacity',
  screens: ['today', 'decisions'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useCapacityInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { data: forecast } = useCapacityForecast(undefined, 7);

  if (!forecast || forecast.length === 0) return null;

  const lowCapDays = forecast.filter(slot => slot.utilization < 50);
  const overCapDays = forecast.filter(slot => slot.utilization > 90);

  if (lowCapDays.length === 0 && overCapDays.length === 0) return null;

  if (overCapDays.length > 0) {
    return {
      id: 'capacity-overload',
      generatorId: 'capacity',
      category: 'alert',
      priority: 'medium',
      title: `${overCapDays.length} overbelaste dag${overCapDays.length > 1 ? 'en' : ''} deze week`,
      message: `Je planning is ${overCapDays.length > 1 ? 'op meerdere dagen' : 'op een dag'} boven 90% bezetting. Overweeg om klussen te verschuiven.`,
      icon: 'alert-circle',
      actionLabel: 'Planning bekijken',
      source: 'Capaciteitsplanner',

      rawScore: 0,
      reasoning: {
        observation: `${overCapDays.length} van ${forecast.length} dagen boven 90% bezetting`,
        evidence: `Op basis van ${forecast.length}-daagse capaciteitsvoorspelling`,
        implication: 'Overbelasting leidt tot uitloop, kwaliteitsverlies en stress',
        suggestion: 'Verschuif niet-urgente klussen naar dagen met meer ruimte',
      },
      dataPoints: forecast.length,
      confidence: 0.8,
      freshness: 2,
    };
  }

  return {
    id: 'capacity-available',
    generatorId: 'capacity',
    category: 'opportunity',
    priority: 'low',
    title: `${lowCapDays.length} dag${lowCapDays.length > 1 ? 'en' : ''} met ruimte`,
    message: `Je hebt ruimte in je planning — ideaal om offertes op te volgen of extra klussen aan te nemen.`,
    icon: 'calendar',
    source: 'Capaciteitsplanner',

    rawScore: 0,
    reasoning: {
      observation: `${lowCapDays.length} van ${forecast.length} dagen onder 50% bezetting`,
      evidence: `Op basis van ${forecast.length}-daagse capaciteitsvoorspelling`,
      implication: 'Onbenutte capaciteit is gemiste omzet',
      suggestion: 'Gebruik de vrije dagen om nieuwe leads te benaderen of administratie in te halen',
    },
    dataPoints: forecast.length,
    confidence: 0.75,
    freshness: 4,
  };
}
