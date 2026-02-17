// =============================================================================
// MARGIN WARNING GENERATOR
// =============================================================================
// Real-time margin check — compares material costs + estimated labor against
// quoted price. Fires if projected margin < 15%.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useAppState } from '../../state/AppState';
import { recordMetricSnapshot } from '../learningStorage';
import { logPrediction } from '../calibration';

export function useMarginWarningInsight(ctx: GeneratorContext): ScoredInsight | null {
  const { jobs, jobMaterials, quotes } = useAppState();

  // Find jobs with both a quoted amount and materials
  const jobsWithCosts = jobs.filter(j => {
    const quoted = j.agreedAmount ?? j.quotedAmount;
    const mats = jobMaterials[j.id];
    return quoted && quoted > 0 && mats && mats.length > 0;
  });

  if (jobsWithCosts.length === 0) return null;

  // Find the job with the lowest margin
  let worstJob: typeof jobs[0] | null = null;
  let worstMargin = 1;
  let worstMaterialCost = 0;
  let worstQuoted = 0;

  for (const job of jobsWithCosts) {
    const quoted = (job.agreedAmount ?? job.quotedAmount)!;
    const mats = jobMaterials[job.id] ?? [];
    const materialCost = mats.reduce((sum, m) => sum + (m.totalPrice ?? 0), 0);

    // Estimate labor at 40% of quoted (typical construction trade split)
    const estimatedLabor = quoted * 0.4;
    const totalCost = materialCost + estimatedLabor;
    const margin = quoted > 0 ? (quoted - totalCost) / quoted : 0;

    if (margin < worstMargin) {
      worstMargin = margin;
      worstJob = job;
      worstMaterialCost = materialCost;
      worstQuoted = quoted;
    }
  }

  if (!worstJob || worstMargin >= 0.15) return null;

  const marginPct = Math.round(worstMargin * 100);

  // Record metric for trend tracking
  recordMetricSnapshot('jobMargin', worstMargin);

  // Log prediction
  logPrediction({
    generatorId: 'margin-warning',
    predictedAt: new Date().toISOString(),
    prediction: `Klus "${worstJob.title}" heeft een marge van ${marginPct}%`,
    predictedValue: worstMargin,
  });

  const isNegative = worstMargin < 0;
  const estimatedLabor = worstQuoted * 0.4;
  const totalCost = worstMaterialCost + estimatedLabor;

  return {
    id: 'margin-warning',
    generatorId: 'margin-warning',
    category: 'financial',
    priority: isNegative ? 'critical' : worstMargin < 0.05 ? 'high' : 'medium',
    title: isNegative ? `Verlies op: ${worstJob.title}` : `Lage marge: ${worstJob.title}`,
    message: isNegative
      ? `Deze klus draait verlies (${marginPct}%). Materiaalkosten €${worstMaterialCost.toLocaleString('nl-NL')} + geschatte arbeid overschrijden de offerte van €${worstQuoted.toLocaleString('nl-NL')}.`
      : `Marge is slechts ${marginPct}% op "${worstJob.title}". Materiaalkosten: €${worstMaterialCost.toLocaleString('nl-NL')}.`,
    detail: `Offerte: €${worstQuoted.toLocaleString('nl-NL')}. Materialen: €${worstMaterialCost.toLocaleString('nl-NL')}. Geschatte arbeid: €${Math.round(estimatedLabor).toLocaleString('nl-NL')}. Totale kosten: €${Math.round(totalCost).toLocaleString('nl-NL')}.`,
    icon: 'warning',
    actionLabel: 'Bekijk kostenoverzicht',
    source: 'Marge Analyse',
    metric: { label: 'Marge', value: `${marginPct}%`, trend: isNegative ? 'down' : 'neutral' },

    rootCauseTags: ['margin', 'cost-variance'],
    rawScore: 0,
    reasoning: {
      observation: `Klus "${worstJob.title}" heeft een projectmarge van ${marginPct}%`,
      evidence: `Materiaalkosten: €${worstMaterialCost.toLocaleString('nl-NL')}, offerte: €${worstQuoted.toLocaleString('nl-NL')}`,
      implication: isNegative
        ? 'Deze klus kost meer dan de offerte — directe actie nodig'
        : 'Bij onverwachte kosten draait deze klus verlies',
      suggestion: isNegative
        ? 'Bespreek meerwerk met de klant of zoek goedkopere materialen'
        : 'Houd materiaalkosten scherp in de gaten en voorkom scope creep',
    },
    dataPoints: jobsWithCosts.length,
    confidence: 0.85,
    freshness: 1,
  };
}
