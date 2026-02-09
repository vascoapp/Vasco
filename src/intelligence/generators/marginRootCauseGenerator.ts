// =============================================================================
// MARGIN ROOT CAUSE GENERATOR (Cross-Service)
// =============================================================================
// Chains: jobCostTracking → laborCost → estimationFeedback to identify the
// PRIMARY cause of margin loss. Instead of showing isolated warnings, this
// generator traces variance back to its root: estimation error, idle time,
// supplier overcharge, or scope creep.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useJobCostSummary } from '../../services/jobCostTrackingService';
import { useLaborCosts } from '../../services/laborCostService';
import { useEstimationAccuracy } from '../../services/estimationFeedbackService';
import { recordMetricSnapshot } from '../learningStorage';

export function useMarginRootCauseInsight(ctx: GeneratorContext): ScoredInsight | null {
  const costSummary = useJobCostSummary();
  const labor = useLaborCosts();
  const estimation = useEstimationAccuracy();

  // Record margin leakage snapshot
  recordMetricSnapshot('marginLeakage', costSummary.totalMarginLeakage);
  recordMetricSnapshot('estimationAccuracy', estimation.overallScore);

  // Only trigger if there's meaningful margin leakage
  if (costSummary.totalMarginLeakage < 200) return null;

  // Identify root causes and rank by contribution
  interface RootCause {
    id: string;
    label: string;
    amount: number;
    explanation: string;
  }

  const causes: RootCause[] = [];

  // 1. Estimation accuracy issues
  if (estimation.overallScore < 75) {
    const estImpact = costSummary.totalMarginLeakage * (1 - estimation.overallScore / 100);
    causes.push({
      id: 'estimation',
      label: 'Schatfouten',
      amount: Math.round(estImpact),
      explanation: `Schattingsnauwkeurigheid ${estimation.overallScore}% — uren afwijking ${estimation.averageHoursDeviation > 0 ? '+' : ''}${estimation.averageHoursDeviation.toFixed(1)}%, materiaal afwijking ${estimation.averageMaterialDeviation > 0 ? '+' : ''}${estimation.averageMaterialDeviation.toFixed(1)}%`,
    });
  }

  // 2. Idle time / labor inefficiency
  if (labor.idleTime.idlePercent > 8) {
    causes.push({
      id: 'idle',
      label: 'Leegloop',
      amount: labor.idleTime.idleCost,
      explanation: `${labor.idleTime.idlePercent}% leegloop = €${labor.idleTime.idleCost} verlies`,
    });
  }

  // 3. Variance by category from job cost tracking
  for (const reason of costSummary.topVarianceReasons) {
    if (reason.amount > 100) {
      causes.push({
        id: reason.category,
        label: reason.category === 'uren' ? 'Uren-overschrijding'
          : reason.category === 'materiaal' ? 'Materiaaloverschrijding'
          : reason.category === 'reistijd' ? 'Reistijd'
          : reason.category === 'herwerk' ? 'Herwerk'
          : 'Onvoorzien',
        amount: reason.amount,
        explanation: `${reason.count} klussen met ${reason.category}-afwijking: €${reason.amount.toLocaleString('nl-NL')}`,
      });
    }
  }

  if (causes.length === 0) return null;

  // Sort by impact
  causes.sort((a, b) => b.amount - a.amount);
  const primaryCause = causes[0];
  const totalIdentified = causes.reduce((sum, c) => sum + c.amount, 0);

  // Build chain reasoning
  const chainSteps = causes.slice(0, 3).map(c => `${c.label}: €${c.amount.toLocaleString('nl-NL')}`);

  return {
    id: 'margin-root-cause',
    generatorId: 'margin-root-cause',
    category: 'financial',
    priority: costSummary.totalMarginLeakage > 1000 ? 'high' : 'medium',
    title: `Marge-lek: ${primaryCause.label} is hoofdoorzaak`,
    message: `€${costSummary.totalMarginLeakage.toLocaleString('nl-NL')} totaal marge-verlies. Primaire oorzaak: ${primaryCause.label} (€${primaryCause.amount.toLocaleString('nl-NL')}).`,
    detail: `Oorzakenanalyse:\n${chainSteps.join('\n')}`,
    icon: 'git-branch',
    actionLabel: 'Analyseer',
    actionRoute: '/(contractor)/decisions',
    source: 'Cross-Service Analyse',
    metric: {
      label: 'Marge-lek',
      value: `€${costSummary.totalMarginLeakage.toLocaleString('nl-NL')}`,
      trend: 'down',
    },

    rawScore: 0,
    reasoning: {
      observation: `€${costSummary.totalMarginLeakage.toLocaleString('nl-NL')} marge-lek over recente klussen`,
      evidence: `Oorzakenanalyse uit ${causes.length} bronnen: kostentracking, arbeidsanalyse, schattingsfeedback`,
      implication: `${primaryCause.explanation}. Totaal verklaard: €${totalIdentified.toLocaleString('nl-NL')} van €${costSummary.totalMarginLeakage.toLocaleString('nl-NL')}`,
      suggestion: primaryCause.id === 'estimation'
        ? 'Kalibreer je uurschattingen per klustype — de feedback-loop toont waar je consistent te laag schat'
        : primaryCause.id === 'idle'
          ? 'Optimaliseer planning om reistijd en wachttijden te reduceren'
          : `Focus op ${primaryCause.label.toLowerCase()} — dit is de grootste bron van marge-verlies`,
    },
    dataPoints: costSummary.topVarianceReasons.reduce((sum, r) => sum + r.count, 0),
    confidence: 0.82,
    freshness: 8,
  };
}
