// =============================================================================
// PROJECT RISK SCORE GENERATOR
// =============================================================================
// Aggregates risk scores across portfolio. Highlights critical/open risks
// and provides risk exposure metrics.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { mockProjects } from '../../data/mockProjects';
import { logPrediction } from '../calibration';
import { gt } from '../generatorTranslations';

export function useProjectRiskScoreInsight(ctx: GeneratorContext): ScoredInsight | null {
  if (ctx.role !== 'cfo' && ctx.role !== 'director' && ctx.role !== 'coo') return null;

  // Aggregate risks across all projects
  const allRisks = mockProjects.flatMap(p =>
    p.risks.map(r => ({ ...r, projectName: p.name, projectId: p.id }))
  );

  if (allRisks.length === 0) return null;

  // Calculate risk metrics
  const criticalRisks = allRisks.filter(r => {
    const score = r.likelihood * r.impact;
    return score >= 15;
  });

  const openRisks = allRisks.filter(r => r.status === 'identified');
  const mitigatedRisks = allRisks.filter(r => r.status === 'accepted' || r.status === 'closed');

  // Total risk exposure (sum of probability × financial impact)
  const totalExposure = allRisks.reduce((sum, r) => {
    const score = r.likelihood * r.impact;
    const financialEstimate = r.costExposure ?? (score * 50000); // estimate if not provided
    return sum + financialEstimate * (r.likelihood / 5);
  }, 0);

  if (criticalRisks.length === 0 && openRisks.length < 3) return null;

  const topRisk = criticalRisks.length > 0 ? criticalRisks[0] : openRisks[0];

  logPrediction({
    generatorId: 'project-risk-score',
    predictedAt: new Date().toISOString(),
    prediction: `${criticalRisks.length} kritieke risico's, ${openRisks.length} open, totale exposure geschat`,
    predictedValue: criticalRisks.length,
  });

  const formatM = (v: number) => v >= 1_000_000
    ? `£${(v / 1_000_000).toFixed(1)}M`
    : `£${(v / 1000).toFixed(0)}K`;

  return {
    id: 'project-risk-score',
    generatorId: 'project-risk-score',
    category: 'alert',
    priority: criticalRisks.length >= 2 ? 'critical' : criticalRisks.length >= 1 ? 'high' : 'medium',
    title: criticalRisks.length > 0
      ? `${criticalRisks.length} kritiek${criticalRisks.length > 1 ? 'e' : ''} risico${criticalRisks.length > 1 ? '\'s' : ''}`
      : `${openRisks.length} open risico's`,
    message: `${allRisks.length} risico's geregistreerd: ${criticalRisks.length} kritiek, ${openRisks.length} open, ${mitigatedRisks.length} gemitigeerd.${topRisk ? ` Hoogste: "${topRisk.description?.substring(0, 60)}..."` : ''}`,
    detail: `Portfolio risico-overzicht: ${criticalRisks.length} vereisen directe actie. ${mitigatedRisks.length} zijn succesvol gemitigeerd. Geschatte risico-exposure: ${formatM(totalExposure)}.`,
    icon: 'shield',
    actionLabel: 'Bekijk risico\'s',
    actionRoute: '/hub/risks',
    source: gt('source_risk', ctx.language),
    metric: { label: 'Kritiek', value: `${criticalRisks.length}`, trend: criticalRisks.length > 1 ? 'down' : 'neutral' },
    rootCauseTags: ['risk', 'portfolio'],
    rawScore: 0,
    reasoning: {
      observation: `${criticalRisks.length} risico's scoren ≥15 op de risicomatrix`,
      evidence: `${allRisks.length} geregistreerde risico's over ${mockProjects.length} projecten`,
      implication: criticalRisks.length >= 2
        ? 'Meerdere kritieke risico\'s vereisen escalatie en directe mitigatie'
        : 'Risicoprofiel vereist regelmatige monitoring',
      suggestion: criticalRisks.length >= 2
        ? 'Plan een risico-review meeting met projectmanagers deze week'
        : 'Review de mitigatiestatus van open risico\'s maandelijks',
    },
    dataPoints: allRisks.length,
    confidence: 0.85,
    freshness: 4,
  };
}
