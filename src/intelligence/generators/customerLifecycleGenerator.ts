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
import { gt } from '../generatorTranslations';

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
      prediction: `${atRiskWithOverdue.length} at-risk klanten, CLV €${totalAtRiskCLV}`,
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
      title: `${atRiskWithOverdue.length} waardevolle klant${atRiskWithOverdue.length > 1 ? 'en' : ''} at-risk`,
      message: `${worst.customerName} (CLV €${worst.predictedClv.toLocaleString('nl-NL')}) heeft ${relatedSeq?.daysOverdue || 0} dagen achterstand. Persoonlijke opvolging aanbevolen.`,
      detail: atRiskWithOverdue.length > 1
        ? `Totaal at-risk CLV: €${totalAtRiskCLV.toLocaleString('nl-NL')} over ${atRiskWithOverdue.length} klanten`
        : `Retentiekans: ${Math.round(worst.retentionProbability * 100)}% — ${worst.jobCount} eerdere klussen`,
      icon: 'people',
      actionLabel: 'Klant bekijken',
      actionRoute: '/(contractor)/facturen',
      source: gt('source_customer', ctx.language),
      metric: {
        label: 'At-risk CLV',
        value: `€${totalAtRiskCLV.toLocaleString('nl-NL')}`,
        trend: 'down',
      },

      rootCauseTags: ['customer', 'cashflow'],
      rawScore: 0,
      reasoning: {
        observation: `${atRiskWithOverdue.length} klant${atRiskWithOverdue.length > 1 ? 'en' : ''} met hoge levensduurwaarde hebben betalingsachterstand`,
        evidence: `CLV-analyse + incasso-data: ${worst.customerName} segment '${worst.segment}', ${worst.jobCount} klussen, retentie ${Math.round(worst.retentionProbability * 100)}%`,
        implication: `€${totalAtRiskCLV.toLocaleString('nl-NL')} aan toekomstige omzet loopt risico als de relatie verslechtert`,
        suggestion: 'Bel deze klant persoonlijk — hoge-CLV klanten vereisen een andere benadering dan standaard dunning',
      },
      dataPoints: topCustomers.length + sequences.length,
      confidence: 0.78,
      freshness: 4,
      action: {
        type: 'send_followup',
        label: 'Klant opvolgen',
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
      title: `${loyalTopCustomers.length} trouwe topklant${loyalTopCustomers.length > 1 ? 'en' : ''} — upsell kans`,
      message: `${best.customerName} (${best.jobCount} klussen, gem. €${best.avgJobValue.toLocaleString('nl-NL')}) betaalt altijd op tijd. Overweeg een onderhoudscontract.`,
      icon: 'star',
      source: gt('source_customer', ctx.language),
      metric: {
        label: 'Upsell potentieel',
        value: `€${Math.round(oppValue).toLocaleString('nl-NL')}`,
        trend: 'up',
      },

      rootCauseTags: ['customer', 'upsell'],
      rawScore: 0,
      reasoning: {
        observation: `${loyalTopCustomers.length} topklanten betalen consistent op tijd`,
        evidence: `CLV-analyse: ${best.customerName} segment '${best.segment}', CLV €${best.predictedClv.toLocaleString('nl-NL')}`,
        implication: `Geschat upsell-potentieel: €${Math.round(oppValue).toLocaleString('nl-NL')}`,
        suggestion: 'Stuur een persoonlijke aanbieding voor een onderhoudscontract of seizoensgebonden dienst',
      },
      dataPoints: topCustomers.length,
      confidence: 0.65,
      freshness: 24,
      action: {
        type: 'send_followup',
        label: 'Klant opvolgen',
        params: {},
        requiresApproval: false,
      },
    };
  }

  return null;
}
