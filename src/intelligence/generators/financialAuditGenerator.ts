// =============================================================================
// FINANCIAL AUDIT GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useFinancialAuditStats } from '../../services/financialAuditorService';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';

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

  // Log prediction for calibration
  logPrediction({
    generatorId: 'financial-audit',
    predictedAt: new Date().toISOString(),
    prediction: `Financial findings: ${totalFindings} (${stats.criticalFindings} critical)`,
    predictedValue: totalFindings,
  });
  const priority = stats.criticalFindings > 0 ? 'critical' : 'high';

  return {
    id: 'financial-audit-alert',
    generatorId: 'financial-audit',
    category: 'financial',
    priority,
    title: gt('financial_audit_title', ctx.language),
    message: `${gt('financial_audit_message', ctx.language, { count: totalFindings })}${stats.criticalFindings > 0 ? ` ${gt('financial_audit_message_critical', ctx.language, { count: stats.criticalFindings })}` : ''}`,
    detail: `${gt('financial_audit_detail', ctx.language, { count: stats.invoicesVerified })}${stats.potentialSavings > 0 ? ` ${gt('financial_audit_detail_savings', ctx.language, { amount: gtMoney(stats.potentialSavings, ctx.country) })}` : ''}`,
    icon: 'alert-circle',
    actionLabel: gt('financial_audit_action', ctx.language),
    actionRoute: ctx.role === 'contractor' ? '/(contractor)/facturen' : undefined,
    source: gt('source_financial', ctx.language),
    metric: stats.potentialSavings > 0 ? {
      label: gt('financial_audit_metric_label', ctx.language),
      value: gtMoney(stats.potentialSavings, ctx.country),
      trend: 'up',
    } : undefined,

    rootCauseTags: ['financial', 'audit'],
    rawScore: 0,
    reasoning: {
      observation: gt('financial_audit_observation', ctx.language, { count: totalFindings }),
      evidence: gt('financial_audit_evidence', ctx.language, { count: stats.invoicesVerified }),
      implication: stats.potentialSavings > 0
        ? gt('financial_audit_implication', ctx.language, { amount: gtMoney(stats.potentialSavings, ctx.country) })
        : gt('financial_audit_implication_manual', ctx.language),
      suggestion: stats.criticalFindings > 0
        ? gt('financial_audit_suggestion_critical', ctx.language)
        : gt('financial_audit_suggestion', ctx.language),
    },
    dataPoints: stats.invoicesVerified,
    confidence: 0.9,
    freshness: 2,
  };
}
