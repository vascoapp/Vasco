// =============================================================================
// SUPPLIER PRICE GENERATOR
// =============================================================================

import type { InsightGenerator, ScoredInsight, GeneratorContext } from './types';
import { useSupplierNegotiation } from '../../services/supplierNegotiationService';
import { logPrediction } from '../calibration';

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
    prediction: `Leverancierskorting potentieel: €${negotiation.totalDiscountPotential}`,
    predictedValue: negotiation.totalDiscountPotential,
  });

  const topLeverage = negotiation.topLeverage;

  return {
    id: 'supplier-negotiation',
    generatorId: 'supplier-price',
    category: 'opportunity',
    priority: negotiation.totalDiscountPotential > 500 ? 'medium' : 'low',
    title: 'Onderhandelingskans bij leverancier',
    message: topLeverage
      ? `Bij ${topLeverage.supplierName} heb je voldoende volume voor ${topLeverage.potentialDiscount}% korting.`
      : `Er zijn besparingskansen bij je leveranciers ter waarde van €${negotiation.totalDiscountPotential.toLocaleString('nl-NL')}.`,
    icon: 'pricetag',
    actionLabel: 'Bekijk kansen',
    actionRoute: '/(contractor)/besparen',
    source: 'Leveranciersanalyse',
    metric: {
      label: 'Besparing mogelijk',
      value: `€${negotiation.totalDiscountPotential.toLocaleString('nl-NL')}`,
      trend: 'up',
    },

    rootCauseTags: ['savings', 'supplier'],
    rawScore: 0,
    reasoning: {
      observation: topLeverage
        ? `Je besteedt €${topLeverage.annualSpend.toLocaleString('nl-NL')}/jaar bij ${topLeverage.supplierName}`
        : 'Er zijn meerdere leveranciers met onderhandelingsruimte',
      evidence: `Op basis van ${negotiation.suppliers.length} leveranciers`,
      implication: `Potentiële jaarlijkse besparing: €${negotiation.totalDiscountPotential.toLocaleString('nl-NL')}`,
      suggestion: topLeverage
        ? `Neem contact op met ${topLeverage.supplierName} — je volume rechtvaardigt een korting`
        : 'Vergelijk prijzen en vraag offertes aan bij alternatieve leveranciers',
    },
    dataPoints: negotiation.suppliers.length,
    confidence: 0.7,
    freshness: 24,
  };
}
