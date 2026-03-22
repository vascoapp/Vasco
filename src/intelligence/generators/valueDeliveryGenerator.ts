// Value Delivery Generator - Tracks platform ROI metrics
import type { ScoredInsight, GeneratorContext } from './types';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

// Platform value metrics (matches hub/metrics.tsx mock)
const PLATFORM_VALUE = {
  hoursSaved: 127,
  valueDelivered: 48000,  // £48K
  aiActions: 156,
  documentAccuracy: 0.92,
  previousMonthValue: 39000, // for trend
};

export function useValueDeliveryInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'director' && ctx.role !== 'cfo') return null;

  const growth = PLATFORM_VALUE.previousMonthValue > 0
    ? ((PLATFORM_VALUE.valueDelivered - PLATFORM_VALUE.previousMonthValue) / PLATFORM_VALUE.previousMonthValue)
    : 0;
  const isGrowing = growth > 0;

  logPrediction({
    generatorId: 'value-delivery',
    predictedAt: new Date().toISOString(),
    prediction: `Platform waarde: £${(PLATFORM_VALUE.valueDelivered / 1000).toFixed(0)}K, ${PLATFORM_VALUE.hoursSaved}u bespaard`,
    predictedValue: PLATFORM_VALUE.valueDelivered,
  });

  return {
    id: 'value-delivery',
    generatorId: 'value-delivery',
    category: 'financial',
    priority: 'low',
    title: isGrowing ? 'Platform ROI stijgt' : 'Platform ROI daalt',
    message: `Vasco heeft deze maand £${(PLATFORM_VALUE.valueDelivered / 1000).toFixed(0)}K aan waarde geleverd en ${PLATFORM_VALUE.hoursSaved} uur bespaard. ${isGrowing ? `+${Math.round(growth * 100)}% t.o.v. vorige maand.` : `${Math.round(growth * 100)}% t.o.v. vorige maand.`}`,
    detail: `${PLATFORM_VALUE.aiActions} AI-acties uitgevoerd. Documentnauwkeurigheid: ${Math.round(PLATFORM_VALUE.documentAccuracy * 100)}%. Waarde wordt berekend op basis van tijdsbesparing, foutpreventie en snellere incasso.`,
    icon: 'rocket',
    actionLabel: 'Bekijk metrics',
    actionRoute: '/hub/metrics',
    source: gt('source_roi', ctx.language),
    metric: { label: 'Waarde', value: `£${(PLATFORM_VALUE.valueDelivered / 1000).toFixed(0)}K`, trend: isGrowing ? 'up' : 'down' },
    rootCauseTags: ['roi', 'platform'],
    rawScore: 0,
    reasoning: {
      observation: `Platform heeft £${(PLATFORM_VALUE.valueDelivered / 1000).toFixed(0)}K aan waarde geleverd deze maand`,
      evidence: `${PLATFORM_VALUE.hoursSaved} uur bespaard, ${PLATFORM_VALUE.aiActions} AI-acties, ${Math.round(growth * 100)}% groei`,
      implication: isGrowing
        ? 'Platform adoptie en waardecreatie nemen toe — behoud huidige koers'
        : 'Platform ROI daalt — onderzoek of teams alle features benutten',
      suggestion: isGrowing
        ? 'Deel ROI-resultaten met stakeholders om draagvlak te vergroten'
        : 'Plan een platform-adoptie review en identificeer onbenutte features',
    },
    dataPoints: 4,
    confidence: 0.80,
    freshness: 8,
  };
}
