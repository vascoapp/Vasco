// =============================================================================
// PROFITABILITY GENERATOR (CFO/Director)
// =============================================================================
// Returns composite of top 3 insights (warnings + opportunities),
// showing total impact instead of just the first warning.
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import type { VascoInsight } from '../../components/shared/VascoInsightCard';
import { useProjectProfitability } from '../../services/projectProfitabilityService';
import { logPrediction } from '../calibration';
import { recordMetricSnapshot, getTrend } from '../learningStorage';
import { isAboveThreshold } from '../adaptiveThresholds';

export const profitabilityGenerator: InsightGenerator = {
  id: 'profitability',
  screens: ['overview'],
  roles: ['contractor', 'cfo', 'director'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useProfitabilityInsight(ctx: GeneratorContext): ScoredInsight | null {
  const profitability = useProjectProfitability();

  const warnings = profitability.insights.filter(i => i.type === 'warning');
  const opportunities = profitability.insights.filter(i => i.type === 'opportunity');
  const actionable = [...warnings, ...opportunities].slice(0, 3);

  if (actionable.length === 0) return null;

  // Log prediction for calibration
  const totalImpactForLog = actionable.reduce((sum, i) => sum + Math.abs(i.impact), 0);
  logPrediction({
    generatorId: 'profitability',
    predictedAt: new Date().toISOString(),
    prediction: `Winstgevendheid impact: €${totalImpactForLog} (${warnings.length} risico's, ${opportunities.length} kansen)`,
    predictedValue: totalImpactForLog,
  });

  // Record margin leakage metric for trend tracking
  recordMetricSnapshot('marginLeakage', totalImpactForLog);

  // Compute total impact across top insights
  const totalImpact = actionable.reduce((sum, i) => sum + Math.abs(i.impact), 0);
  const warningImpact = warnings.reduce((sum, i) => sum + Math.abs(i.impact), 0);
  const oppImpact = opportunities.reduce((sum, i) => sum + Math.abs(i.impact), 0);

  // Build composite message
  const parts: string[] = [];
  if (warnings.length > 0) {
    parts.push(`${warnings.length} risico${warnings.length > 1 ? '\'s' : ''} (€${warningImpact.toLocaleString('nl-NL')} impact)`);
  }
  if (opportunities.length > 0) {
    parts.push(`${opportunities.length} kans${opportunities.length > 1 ? 'en' : ''} (€${oppImpact.toLocaleString('nl-NL')} potentieel)`);
  }

  // Use adaptive threshold for margin leakage to determine priority
  const isHighImpact = isAboveThreshold(ctx.profile, 'marginLeakage', warningImpact);
  const priority = warnings.length >= 2 || isHighImpact ? 'high' : 'medium';
  const topInsight = actionable[0];

  // Detail: list top 3 insights
  const detailLines = actionable.map((i, idx) => {
    const emoji = i.type === 'warning' ? '⚠' : '✦';
    return `${emoji} ${i.title}: €${Math.abs(i.impact).toLocaleString('nl-NL')}`;
  });

  return {
    id: `profit-composite`,
    generatorId: 'profitability',
    category: 'alert',
    priority,
    title: `Winstgevendheid: €${totalImpact.toLocaleString('nl-NL')} in beeld`,
    message: parts.join(' + '),
    detail: detailLines.join('\n'),
    icon: topInsight.icon as VascoInsight['icon'],
    source: 'Winstgevendheid',
    metric: {
      label: 'Totale impact',
      value: `€${totalImpact.toLocaleString('nl-NL')}`,
      trend: warnings.length > opportunities.length ? 'down' : 'up',
    },

    rootCauseTags: ['margin', 'profitability'],
    rawScore: 0,
    reasoning: {
      observation: `${actionable.length} winstgevendheid-inzichten gedetecteerd`,
      evidence: `Op basis van ${profitability.insights.length} projectanalyses — marge ${profitability.overallMargin}%, trend: ${profitability.profitTrend}${(() => { const t = getTrend(ctx.profile, 'marginLeakage', 4); return t && t.slope !== 0 ? ` — historische trend: ${t.direction}` : ''; })()}`,
      implication: `Totale geschatte impact: €${totalImpact.toLocaleString('nl-NL')} (${warnings.length} risico's, ${opportunities.length} kansen)`,
      suggestion: topInsight.description,
    },
    dataPoints: profitability.insights.length,
    confidence: 0.80,
    freshness: 12,
  };
}
