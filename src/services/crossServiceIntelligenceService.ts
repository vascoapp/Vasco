// =============================================================================
// CROSS-SERVICE INTELLIGENCE SERVICE
// =============================================================================
// Connects findings across services to surface non-obvious correlations:
// audit findings → pricing, compliance → cost, schedule → profitability,
// customer satisfaction → repeat business.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface CrossInsight {
  id: string;
  type: 'correlation' | 'causation' | 'prediction' | 'anomaly';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  sources: string[]; // services that contributed
  impact: { value: number; unit: string; direction: 'positive' | 'negative' };
  actionLabel?: string;
  icon: string;
}

export interface ServiceConnection {
  from: string;
  to: string;
  relationship: string;
  strength: number; // 0-100
}

export interface CrossIntelligenceSummary {
  insights: CrossInsight[];
  connections: ServiceConnection[];
  topInsight: CrossInsight;
  totalImpact: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_INSIGHTS: CrossInsight[] = [
  {
    id: 'cross_1',
    type: 'correlation',
    priority: 'high',
    title: 'Foto-offertes converteren 35% beter',
    description: 'Offertes met foto-documentatie (via Bon Scanner) hebben een win-rate van 72% versus 45% zonder. Activeer standaard foto-uploads bij elke offerte.',
    sources: ['quoteOptimizerService', 'customerInsightsService'],
    impact: { value: 1800, unit: '€/maand', direction: 'positive' },
    actionLabel: 'Offerte-template aanpassen',
    icon: 'camera',
  },
  {
    id: 'cross_2',
    type: 'causation',
    priority: 'high',
    title: 'Compliance-gaten kosten je klanten',
    description: 'Klanten die jouw certificeringen online controleerden (3 dit kwartaal) en ontbrekende BRL-certificering zagen, kozen voor een concurrent. Geschatte gemiste omzet: €8.400.',
    sources: ['complianceService', 'customerInsightsService', 'leadGenerationService'],
    impact: { value: 8400, unit: '€', direction: 'negative' },
    actionLabel: 'Certificering aanvragen',
    icon: 'shield-checkmark',
  },
  {
    id: 'cross_3',
    type: 'prediction',
    priority: 'medium',
    title: 'Onderhoudscontract-klanten kopen 3x vaker',
    description: 'Klanten met een onderhoudscontract bestellen gemiddeld €2.100/jaar aan extra werk. 12 klanten zonder contract zijn ideale kandidaten.',
    sources: ['serviceContractsService', 'projectProfitabilityService'],
    impact: { value: 25200, unit: '€/jaar', direction: 'positive' },
    actionLabel: 'Contracten aanbieden',
    icon: 'document-text',
  },
  {
    id: 'cross_4',
    type: 'anomaly',
    priority: 'medium',
    title: 'Reistijd correleert met lagere reviews',
    description: 'Klussen buiten 15km hebben 0.4 sterren lagere reviews (4.3 vs 4.7). Vermoedelijk door latere aankomsttijd. Optimaliseer routes voor verre klussen.',
    sources: ['routeOptimizerService', 'reputationService', 'laborCostService'],
    impact: { value: 0.4, unit: 'sterren', direction: 'negative' },
    actionLabel: 'Routes optimaliseren',
    icon: 'navigate',
  },
  {
    id: 'cross_5',
    type: 'correlation',
    priority: 'low',
    title: 'Snellere facturering = snellere betaling',
    description: 'Facturen verstuurd binnen 24 uur na klus worden gemiddeld 8 dagen sneller betaald. Je huidige gemiddelde: 3.2 dagen na klus.',
    sources: ['cashFlowService', 'invoiceAutomationService'],
    impact: { value: 420, unit: '€/maand', direction: 'positive' },
    icon: 'receipt',
  },
];

const MOCK_CONNECTIONS: ServiceConnection[] = [
  { from: 'complianceService', to: 'customerInsightsService', relationship: 'Certificeringen beïnvloeden klantvertrouwen', strength: 72 },
  { from: 'pricingEngineService', to: 'quoteOptimizerService', relationship: 'Marktprijzen sturen offerteprijzen', strength: 88 },
  { from: 'laborCostService', to: 'projectProfitabilityService', relationship: 'Arbeid bepaalt projectmarge', strength: 95 },
  { from: 'routeOptimizerService', to: 'reputationService', relationship: 'Reistijd beïnvloedt klanttevredenheid', strength: 45 },
  { from: 'cashFlowService', to: 'supplierNegotiationService', relationship: 'Cash flow bepaalt betalingstiming', strength: 65 },
];

// =============================================================================
// SERVICE
// =============================================================================

class CrossServiceIntelligenceService {
  getInsights(filter?: { priority?: CrossInsight['priority'] }): CrossInsight[] {
    let results = [...MOCK_INSIGHTS];
    if (filter?.priority) results = results.filter(i => i.priority === filter.priority);
    return results.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    });
  }

  getConnections(): ServiceConnection[] {
    return MOCK_CONNECTIONS;
  }

  getSummary(): CrossIntelligenceSummary {
    const insights = this.getInsights();
    const positiveImpact = insights
      .filter(i => i.impact.direction === 'positive' && i.impact.unit.includes('€'))
      .reduce((s, i) => s + i.impact.value, 0);

    return {
      insights,
      connections: MOCK_CONNECTIONS,
      topInsight: insights[0],
      totalImpact: positiveImpact,
    };
  }
}

export const crossServiceIntelligenceService = new CrossServiceIntelligenceService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function useCrossServiceIntelligence() {
  return useMemo(() => crossServiceIntelligenceService.getSummary(), []);
}

export function useCrossInsights(filter?: { priority?: CrossInsight['priority'] }) {
  return useMemo(() => crossServiceIntelligenceService.getInsights(filter), [filter?.priority]);
}
