// =============================================================================
// CROSS SERVICE GENERATOR
// =============================================================================
// R20: removed the dead static `crossServiceGenerator: InsightGenerator`
// export — its `generate(ctx)` always returned null and it had zero
// consumers anywhere. The real surface is `useCrossServiceInsight(ctx)`,
// rendered via generators/index.ts.
// Also localized 4 hardcoded NL reasoning strings + the `nl-NL` number
// formatting hardcode that ignored contractor's locale.

import { formatMoney } from '../../i18n/formatting';
import type { ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { useCrossServiceIntelligence } from '../../services/crossServiceIntelligenceService';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';
import i18n from '../../i18n/i18n';

const localeFor = (lang?: string) => {
  switch (lang) {
    case 'nl': return 'nl-NL';
    case 'de': return 'de-DE';
    case 'fr': return 'fr-FR';
    case 'es': return 'es-ES';
    case 'it': return 'it-IT';
    default: return 'en-GB';
  }
};

export function useCrossServiceInsight(ctx: GeneratorContext): ScoredInsight | null {
  const crossIntel = useCrossServiceIntelligence();
  const t = i18n.t.bind(i18n);

  const relevantInsight = crossIntel.insights
    .filter(i => i.priority === 'high')
    .find(i => {
      if (ctx.screen === 'invoices') return i.sources.some(s => s.includes('cashFlow') || s.includes('invoice'));
      if (ctx.screen === 'savings') return i.sources.some(s => s.includes('supplier') || s.includes('pricing'));
      if (ctx.screen === 'decisions') return i.sources.some(s => s.includes('customer') || s.includes('quote'));
      return false;
    });

  if (!relevantInsight) return null;

  const locale = localeFor(ctx.language);

  // Log prediction for calibration
  logPrediction({
    generatorId: 'cross-service',
    predictedAt: new Date().toISOString(),
    prediction: `Cross-service correlation: ${relevantInsight.title} (impact ${formatMoney(relevantInsight.impact.value)})`,
    predictedValue: relevantInsight.impact.value,
  });

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
    source: gt('source_cross_analysis', ctx.language),
    metric: hasMoneyImpact
      ? {
          label: t('crossService.impact', { defaultValue: 'Impact' }),
          value: `${formatMoney(relevantInsight.impact.value)}`,
          trend: relevantInsight.impact.direction === 'positive' ? 'up' : 'down',
        }
      : undefined,

    rootCauseTags: ['cross-service', 'correlation'],
    rawScore: 0,
    reasoning: {
      observation: t('crossService.observation', {
        defaultValue: 'Connection found between {{sources}}',
        sources: relevantInsight.sources.join(', '),
      }),
      evidence: t('crossService.evidence', {
        defaultValue: 'Based on {{count}} linked data sources',
        count: relevantInsight.sources.length,
      }),
      implication: hasMoneyImpact
        ? t('crossService.implication', {
            defaultValue: 'Estimated impact: {{amount}}',
            amount: formatMoney(relevantInsight.impact.value),
          })
        : relevantInsight.description,
      suggestion: relevantInsight.actionLabel || t('crossService.viewDetails', {
        defaultValue: 'See details for more information',
      }),
    },
    dataPoints: relevantInsight.sources.length * 10,
    confidence: 0.65,
    freshness: 8,
  };
}
