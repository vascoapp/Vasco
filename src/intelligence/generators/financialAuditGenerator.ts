// =============================================================================
// FINANCIAL AUDIT GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useFinancialAuditStats } from '../../services/financialAuditorService';

export const financialAuditGenerator: InsightGenerator = {
  id: 'financial-audit',
  screens: ['today', 'invoices'],
  roles: ['contractor', 'cfo'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useFinancialAuditInsight(ctx: GeneratorContext): ScoredInsight | null {
  const stats = useFinancialAuditStats();

  if (!stats || (stats.criticalFindings === 0 && stats.highFindings === 0)) return null;

  const totalFindings = stats.criticalFindings + stats.highFindings;
  const priority = stats.criticalFindings > 0 ? 'critical' : 'high';

  return {
    id: 'financial-audit-alert',
    generatorId: 'financial-audit',
    category: 'financial',
    priority,
    title: 'Financiële controle bevinding',
    message: `${totalFindings} bevindingen die aandacht vereisen.${stats.criticalFindings > 0 ? ` ${stats.criticalFindings} kritiek.` : ''}`,
    detail: `${stats.invoicesVerified} facturen gecontroleerd.${stats.potentialSavings > 0 ? ` Potentiële besparing: €${stats.potentialSavings.toLocaleString('nl-NL')}.` : ''}`,
    icon: 'alert-circle',
    actionLabel: 'Bekijk bevindingen',
    actionRoute: ctx.role === 'contractor' ? '/(contractor)/facturen' : undefined,
    source: 'Financieel Auditor',
    metric: stats.potentialSavings > 0 ? {
      label: 'Potentiële besparing',
      value: `€${stats.potentialSavings.toLocaleString('nl-NL')}`,
      trend: 'up',
    } : undefined,

    rawScore: 0,
    reasoning: {
      observation: `${totalFindings} financiële bevindingen gedetecteerd`,
      evidence: `Op basis van ${stats.invoicesVerified} gecontroleerde facturen`,
      implication: stats.potentialSavings > 0
        ? `Potentiële besparing: €${stats.potentialSavings.toLocaleString('nl-NL')}`
        : 'Bevindingen vereisen handmatige controle',
      suggestion: stats.criticalFindings > 0
        ? 'Controleer kritieke bevindingen direct — deze kunnen financieel risico opleveren'
        : 'Plan een moment om de bevindingen door te nemen',
    },
    dataPoints: stats.invoicesVerified,
    confidence: 0.9,
    freshness: 2,
  };
}
