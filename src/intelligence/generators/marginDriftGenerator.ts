// =============================================================================
// MARGIN DRIFT GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useJobCostSummary } from '../../services/jobCostTrackingService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { detectAnomaly, getSeasonalMultiplier } from '../adaptiveThresholds';
import { gt } from '../generatorTranslations';

export const marginDriftGenerator: InsightGenerator = {
  id: 'margin-drift',
  screens: ['today', 'savings', 'decisions'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useMarginDriftInsight(ctx: GeneratorContext): ScoredInsight | null {
  const costSummary = useJobCostSummary();

  // Record margin leakage for trend tracking
  recordMetricSnapshot('marginLeakage', costSummary.totalMarginLeakage);

  if (costSummary.totalMarginLeakage === 0) return null;

  // Log prediction for calibration: "margin leakage will be €X this month"
  logPrediction({
    generatorId: 'margin-drift',
    predictedAt: new Date().toISOString(),
    prediction: `Marge-lek deze maand: €${costSummary.totalMarginLeakage}`,
    predictedValue: costSummary.totalMarginLeakage,
  });

  const isNegative = costSummary.totalMarginLeakage > 0;
  const amount = Math.abs(costSummary.totalMarginLeakage);
  const jobCount = costSummary.topVarianceReasons.reduce((sum, r) => sum + r.count, 0);

  // Anomaly detection: escalate on sudden margin spikes
  const anomaly = detectAnomaly(ctx.profile, 'marginLeakage', costSummary.totalMarginLeakage);

  // Seasonal context
  const seasonMult = getSeasonalMultiplier('marginLeakage');
  const seasonNote = seasonMult > 1.05 ? ' Marge-druk is hoger in het laagseizoen.' : '';
  const priority = anomaly.severity === 'severe' ? 'critical'
    : anomaly.severity === 'moderate' ? 'high'
    : amount > 1000 ? 'high' : 'medium';

  return {
    id: 'margin-drift',
    generatorId: 'margin-drift',
    category: isNegative ? 'alert' : 'opportunity',
    priority,
    title: isNegative
      ? gt('margin_title_erosion', ctx.language, { amount: amount.toLocaleString('nl-NL') })
      : gt('margin_title_above', ctx.language, { amount: amount.toLocaleString('nl-NL') }),
    message: isNegative
      ? gt('margin_message_below', ctx.language) + seasonNote
      : gt('margin_message_above', ctx.language),
    detail: isNegative
      ? `De grootste afwijkingen zitten waarschijnlijk in materiaalkosten en extra uren. Bekijk de details per klus.${anomaly.isAnomaly ? ` ${anomaly.description}` : ''}`
      : `Blijf je huidige werkwijze handhaven — je kostenbeheersing is sterk.`,
    icon: isNegative ? 'trending-down' : 'trending-up',
    actionLabel: isNegative ? 'Kostenvariaties bekijken' : undefined,
    actionRoute: isNegative ? '/(contractor)/besparen' : undefined,
    source: gt('source_margin', ctx.language),
    metric: {
      label: 'Marge impact',
      value: `${isNegative ? '-' : '+'}€${amount.toLocaleString('nl-NL')}`,
      trend: isNegative ? 'down' : 'up',
    },

    rootCauseTags: ['margin', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: isNegative
        ? `Marges lopen €${amount.toLocaleString('nl-NL')} achter op begroting`
        : `Marges lopen €${amount.toLocaleString('nl-NL')} voor op begroting`,
      evidence: `Op basis van ${jobCount} actieve klussen deze maand${anomaly.isAnomaly ? ` — anomalie gedetecteerd (${anomaly.zScore.toFixed(1)}σ)` : ''}${(() => { const t = getTrend(ctx.profile, 'marginLeakage', 4); return t && t.slope !== 0 ? ` — marge-trend: ${t.direction}` : ''; })()}`,
      implication: isNegative
        ? `Bij gelijkblijvend tempo verlies je €${(amount * 12).toLocaleString('nl-NL')}/jaar`
        : `Op jaarbasis is dit +€${(amount * 12).toLocaleString('nl-NL')} extra winst`,
      suggestion: isNegative
        ? 'Analyseer de top-3 klussen met de grootste kostenafwijking'
        : 'Documenteer je huidige werkwijze als best practice',
    },
    dataPoints: jobCount,
    confidence: anomaly.isAnomaly ? Math.min(0.95, 0.85 + 0.05) : 0.85,
    freshness: 2,
    action: {
      type: 'adjust_quote',
      label: 'Prijzen aanpassen',
      params: {},
      requiresApproval: true,
    },
    enqueueHint: isNegative ? {
      type: 'general' as const,
      entityKey: `margin-drift:${Math.round(amount / 100) * 100}`,
      expiresInDays: 7,
    } : undefined,
  } as ScoredInsight;
}
