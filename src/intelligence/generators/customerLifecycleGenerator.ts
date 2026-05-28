// =============================================================================
// CUSTOMER LIFECYCLE GENERATOR (Cross-Service)
// =============================================================================
// Combines projectProfitability (CLV, segments) with collectionsAgent
// (payment behavior) to surface at-risk high-CLV customers and
// top customer opportunities.
// =============================================================================

import type { ScoredInsight, GeneratorContext } from './types';
import { useTopCustomers, useAtRiskCustomers } from '../../services/projectProfitabilityService';
import { useCollectionsAgent } from '../../services/collectionsAgentService';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';

export function useCustomerLifecycleInsight(ctx: GeneratorContext): ScoredInsight | null {
  const topCustomers = useTopCustomers(5);
  const atRiskCustomers = useAtRiskCustomers();
  const { sequences } = useCollectionsAgent();

  // Find high-CLV customers who also have overdue invoices
  const atRiskWithOverdue = atRiskCustomers.filter(customer => {
    return sequences.some(seq =>
      seq.customerName === customer.customerName && seq.daysOverdue > 7
    );
  });

  // Find top customers with excellent payment behavior (no active dunning)
  const loyalTopCustomers = topCustomers.filter(customer => {
    return !sequences.some(seq =>
      seq.customerName === customer.customerName && seq.daysOverdue > 0
    );
  });

  // Log prediction for calibration
  if (atRiskWithOverdue.length > 0) {
    const totalAtRiskCLV = atRiskWithOverdue.reduce((sum, c) => sum + c.predictedClv, 0);
    logPrediction({
      generatorId: 'customer-lifecycle',
      predictedAt: new Date().toISOString(),
      prediction: `${atRiskWithOverdue.length} at-risk customers, CLV ${gtMoney(totalAtRiskCLV, ctx.country)}`,
      predictedValue: totalAtRiskCLV,
    });
  }

  // Prioritize at-risk high-CLV customers
  if (atRiskWithOverdue.length > 0) {
    const worst = atRiskWithOverdue[0];
    const relatedSeq = sequences.find(s => s.customerName === worst.customerName);
    const totalAtRiskCLV = atRiskWithOverdue.reduce((sum, c) => sum + c.predictedClv, 0);

    return {
      id: 'customer-lifecycle-risk',
      generatorId: 'customer-lifecycle',
      category: 'financial',
      priority: worst.predictedClv > 5000 ? 'high' : 'medium',
      title: gt(atRiskWithOverdue.length > 1 ? 'clv_risk_title_multi' : 'clv_risk_title_single', ctx.language, { count: atRiskWithOverdue.length }),
      message: gt('clv_risk_message', ctx.language, { name: worst.customerName, clv: gtMoney(worst.predictedClv, ctx.country), days: relatedSeq?.daysOverdue || 0 }),
      detail: atRiskWithOverdue.length > 1
        ? gt('clv_risk_detail_multi', ctx.language, { amount: gtMoney(totalAtRiskCLV, ctx.country), count: atRiskWithOverdue.length })
        : gt('clv_risk_detail_single', ctx.language, { pct: Math.round(worst.retentionProbability * 100), count: worst.jobCount }),
      icon: 'people',
      actionLabel: gt('clv_action_view_customer', ctx.language),
      actionRoute: '/(contractor)/facturen',
      source: gt('source_customer', ctx.language),
      metric: {
        label: gt('clv_risk_metric_label', ctx.language),
        value: `${gtMoney(totalAtRiskCLV, ctx.country)}`,
        trend: 'down',
      },

      rootCauseTags: ['customer', 'cashflow'],
      rawScore: 0,
      reasoning: {
        observation: gt(atRiskWithOverdue.length > 1 ? 'clv_risk_observation_multi' : 'clv_risk_observation_single', ctx.language, { count: atRiskWithOverdue.length }),
        evidence: gt('clv_risk_evidence', ctx.language, { name: worst.customerName, segment: worst.segment, count: worst.jobCount, pct: Math.round(worst.retentionProbability * 100) }),
        implication: gt('clv_risk_implication', ctx.language, { amount: gtMoney(totalAtRiskCLV, ctx.country) }),
        suggestion: gt('clv_risk_suggestion', ctx.language),
      },
      dataPoints: topCustomers.length + sequences.length,
      confidence: 0.78,
      freshness: 4,
      action: {
        type: 'send_followup',
        label: gt('clv_action_followup', ctx.language),
        params: {},
        requiresApproval: false,
      },
    };
  }

  // Show opportunity: loyal top customers
  if (loyalTopCustomers.length > 0) {
    const best = loyalTopCustomers[0];
    const oppValue = loyalTopCustomers.reduce((sum, c) => sum + c.avgJobValue * 0.3, 0); // 30% upsell potential

    return {
      id: 'customer-lifecycle-opportunity',
      generatorId: 'customer-lifecycle',
      category: 'tip',
      priority: 'low',
      title: gt(loyalTopCustomers.length > 1 ? 'clv_upsell_title_multi' : 'clv_upsell_title_single', ctx.language, { count: loyalTopCustomers.length }),
      message: gt('clv_upsell_message', ctx.language, { name: best.customerName, count: best.jobCount, avg: gtMoney(best.avgJobValue, ctx.country) }),
      icon: 'star',
      source: gt('source_customer', ctx.language),
      metric: {
        label: gt('clv_upsell_metric_label', ctx.language),
        value: `${gtMoney(oppValue, ctx.country)}`,
        trend: 'up',
      },

      rootCauseTags: ['customer', 'upsell'],
      rawScore: 0,
      reasoning: {
        observation: gt('clv_upsell_observation', ctx.language, { count: loyalTopCustomers.length }),
        evidence: gt('clv_upsell_evidence', ctx.language, { name: best.customerName, segment: best.segment, clv: gtMoney(best.predictedClv, ctx.country) }),
        implication: gt('clv_upsell_implication', ctx.language, { amount: gtMoney(oppValue, ctx.country) }),
        suggestion: gt('clv_upsell_suggestion', ctx.language),
      },
      dataPoints: topCustomers.length,
      confidence: 0.65,
      freshness: 24,
      action: {
        type: 'send_followup',
        label: gt('clv_action_followup', ctx.language),
        params: {},
        requiresApproval: false,
      },
    };
  }

  return null;
}
