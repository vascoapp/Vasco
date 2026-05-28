// =============================================================================
// SUPPLIER PRICE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useSupplierNegotiation } from '../../services/supplierNegotiationService';
import { logPrediction } from '../calibration';
import { gt, gtMoney } from '../generatorTranslations';

export const supplierPriceGenerator: InsightGenerator = {
  id: 'supplier-price',
  screens: ['savings', 'meer'],
  roles: ['contractor'],
  generate(ctx: GeneratorContext): ScoredInsight | null {
    return null;
  },
};

export function useSupplierPriceInsight(ctx: GeneratorContext): ScoredInsight | null {
  const negotiation = useSupplierNegotiation();

  if (!negotiation || negotiation.totalDiscountPotential <= 0) return null;

  // Log prediction for calibration
  logPrediction({
    generatorId: 'supplier-price',
    predictedAt: new Date().toISOString(),
    prediction: `Supplier discount potential: ${gtMoney(negotiation.totalDiscountPotential, ctx.country)}`,
    predictedValue: negotiation.totalDiscountPotential,
  });

  const topLeverage = negotiation.topLeverage;

  return {
    id: 'supplier-negotiation',
    generatorId: 'supplier-price',
    category: 'opportunity',
    priority: negotiation.totalDiscountPotential > 500 ? 'medium' : 'low',
    title: gt('supplier_price_title', ctx.language),
    message: topLeverage
      ? gt('supplier_price_message', ctx.language, { supplier: topLeverage.supplierName, pct: topLeverage.potentialDiscount })
      : gt('supplier_price_message_generic', ctx.language, { amount: gtMoney(negotiation.totalDiscountPotential, ctx.country) }),
    icon: 'pricetag',
    actionLabel: gt('supplier_price_action', ctx.language),
    actionRoute: '/(contractor)/besparen',
    source: gt('source_procurement', ctx.language),
    metric: {
      label: gt('supplier_price_metric_label', ctx.language),
      value: gtMoney(negotiation.totalDiscountPotential, ctx.country),
      trend: 'up',
    },

    rootCauseTags: ['savings', 'supplier'],
    rawScore: 0,
    reasoning: {
      observation: topLeverage
        ? gt('supplier_price_observation', ctx.language, { amount: gtMoney(topLeverage.annualSpend, ctx.country), supplier: topLeverage.supplierName })
        : gt('supplier_price_observation_generic', ctx.language),
      evidence: gt('supplier_price_evidence', ctx.language, { count: negotiation.suppliers.length }),
      implication: gt('supplier_price_implication', ctx.language, { amount: gtMoney(negotiation.totalDiscountPotential, ctx.country) }),
      suggestion: topLeverage
        ? gt('supplier_price_suggestion', ctx.language, { supplier: topLeverage.supplierName })
        : gt('supplier_price_suggestion_generic', ctx.language),
    },
    dataPoints: negotiation.suppliers.length,
    confidence: 0.7,
    freshness: 24,
    action: {
      type: 'switch_supplier',
      label: gt('supplier_price_action_compare', ctx.language),
      params: {},
      requiresApproval: false,
    },
  };
}
