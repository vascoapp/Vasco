// =============================================================================
// MARGIN DRIFT GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useJobCostSummary } from '../../services/jobCostTrackingService';
import { logPrediction } from '../calibration';

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
  const priority = amount > 1000 ? 'high' : 'medium';
  const jobCount = costSummary.topVarianceReasons.reduce((sum, r) => sum + r.count, 0);

  return {
    id: 'margin-drift',
    generatorId: 'margin-drift',
    category: isNegative ? 'alert' : 'opportunity',
    priority,
    title: isNegative
      ? `Marge-erosie: €${amount.toLocaleString('nl-NL')}`
      : `Marge boven verwachting: +€${amount.toLocaleString('nl-NL')}`,
    message: isNegative
      ? `Je marges zijn deze maand lager dan begroot. Controleer je kostenvariaties per klus.`
      : `Je marges presteren beter dan gepland. Goed bezig!`,
    detail: isNegative
      ? `De grootste afwijkingen zitten waarschijnlijk in materiaalkosten en extra uren. Bekijk de details per klus.`
      : `Blijf je huidige werkwijze handhaven — je kostenbeheersing is sterk.`,
    icon: isNegative ? 'trending-down' : 'trending-up',
    actionLabel: isNegative ? 'Kostenvariaties bekijken' : undefined,
    actionRoute: isNegative ? '/(contractor)/besparen' : undefined,
    source: 'Margeanalyse',
    metric: {
      label: 'Marge impact',
      value: `${isNegative ? '-' : '+'}€${amount.toLocaleString('nl-NL')}`,
      trend: isNegative ? 'down' : 'up',
    },

    rawScore: 0,
    reasoning: {
      observation: isNegative
        ? `Marges lopen €${amount.toLocaleString('nl-NL')} achter op begroting`
        : `Marges lopen €${amount.toLocaleString('nl-NL')} voor op begroting`,
      evidence: `Op basis van ${jobCount} actieve klussen deze maand`,
      implication: isNegative
        ? `Bij gelijkblijvend tempo verlies je €${(amount * 12).toLocaleString('nl-NL')}/jaar`
        : `Op jaarbasis is dit +€${(amount * 12).toLocaleString('nl-NL')} extra winst`,
      suggestion: isNegative
        ? 'Analyseer de top-3 klussen met de grootste kostenafwijking'
        : 'Documenteer je huidige werkwijze als best practice',
    },
    dataPoints: jobCount,
    confidence: 0.85,
    freshness: 2,
  };
}
