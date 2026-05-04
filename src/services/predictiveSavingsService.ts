// =============================================================================
// PREDICTIVE SAVINGS SERVICE
// =============================================================================
// AI-predicted future savings: procurement timing, early payment discounts,
// bundle opportunities, and contract renewal timing.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type SavingType = 'timing' | 'bundle' | 'early-payment' | 'contract' | 'seasonal';

export interface PredictiveSaving {
  id: string;
  type: SavingType;
  title: string;
  description: string;
  potentialSaving: number;
  confidence: number; // 0-100
  timeframe: string;
  actionLabel: string;
  icon: string;
  urgency: 'low' | 'medium' | 'high';
  expiresAt?: string;
}

export interface PredictiveSummary {
  totalPotential: number;
  opportunities: PredictiveSaving[];
  topAction: string;
  confidenceAvg: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_PREDICTIONS: PredictiveSaving[] = [
  {
    id: 'pred_1',
    type: 'timing',
    title: 'Verf goedkoper in maart',
    description: 'Historische data toont dat Dulux producten gemiddeld 12% goedkoper zijn in maart. Bestel nu voor je voorjaarsprojecten.',
    potentialSaving: 185,
    confidence: 82,
    timeframe: 'Komende 3 weken',
    actionLabel: 'Voorraad aanvullen',
    icon: 'calendar',
    urgency: 'medium',
    expiresAt: '2026-03-15',
  },
  {
    id: 'pred_2',
    type: 'bundle',
    title: 'Bundel Technische Unie orders',
    description: 'Je bestelt 3x per week bij Technische Unie. Door te bundelen bespaar je €45/maand aan verzendkosten en krijg je 5% volumekorting.',
    potentialSaving: 540,
    confidence: 91,
    timeframe: 'Per jaar',
    actionLabel: 'Besteldag instellen',
    icon: 'layers',
    urgency: 'high',
  },
  {
    id: 'pred_3',
    type: 'early-payment',
    title: 'Vroeg betalen = 2% korting',
    description: 'Bouwmaat biedt 2% korting bij betaling binnen 10 dagen. Bij je gemiddelde besteding: €28/maand besparing.',
    potentialSaving: 336,
    confidence: 95,
    timeframe: 'Per jaar',
    actionLabel: 'Automatisch betalen',
    icon: 'flash',
    urgency: 'low',
  },
  {
    id: 'pred_4',
    type: 'seasonal',
    title: 'Kopergoot nu inkopen',
    description: 'Koperprijzen zijn 8% gedaald t.o.v. vorige maand. Dit is het laagste punt van het seizoen — ideaal om voorraad aan te leggen.',
    potentialSaving: 420,
    confidence: 74,
    timeframe: 'Komende 4 weken',
    actionLabel: 'Prijzen bekijken',
    icon: 'trending-down',
    urgency: 'medium',
    expiresAt: '2026-03-01',
  },
  {
    id: 'pred_5',
    type: 'contract',
    title: 'Onderhoudscontract verlengen',
    description: 'Familie De Vries contractverlenging over 6 weken. Vroegtijdig aanbieden geeft 15% hogere kans op verlenging.',
    potentialSaving: 1200,
    confidence: 68,
    timeframe: '6 weken',
    actionLabel: 'Contact opnemen',
    icon: 'document-text',
    urgency: 'medium',
  },
];

// =============================================================================
// SERVICE
// =============================================================================

class PredictiveSavingsService {
  // R32: was returning [...MOCK_PREDICTIONS] to every contractor on the
  // besparen tab. Now returns empty unless test-seeded; real predictive
  // savings should flow from purchasingAgentService + savingsAggregator
  // through the besparen UI directly.
  private useMockData = false;
  /** @internal Test-only mock seeder. */
  __seedMockData(): void { this.useMockData = true; }

  getPredictions(filter?: { type?: SavingType; urgency?: PredictiveSaving['urgency'] }): PredictiveSaving[] {
    if (!this.useMockData) return [];
    let results = [...MOCK_PREDICTIONS];
    if (filter?.type) results = results.filter(p => p.type === filter.type);
    if (filter?.urgency) results = results.filter(p => p.urgency === filter.urgency);
    return results.sort((a, b) => b.potentialSaving - a.potentialSaving);
  }

  getSummary(): PredictiveSummary {
    const predictions = this.getPredictions();
    if (predictions.length === 0) {
      return { totalPotential: 0, opportunities: [], topAction: '', confidenceAvg: 0 };
    }
    const total = predictions.reduce((s, p) => s + p.potentialSaving, 0);
    const avgConf = Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length);
    return {
      totalPotential: total,
      opportunities: predictions,
      topAction: predictions[0]?.actionLabel || '',
      confidenceAvg: avgConf,
    };
  }
}

export const predictiveSavingsService = new PredictiveSavingsService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function usePredictiveSavings(filter?: { type?: SavingType; urgency?: PredictiveSaving['urgency'] }) {
  return useMemo(() => predictiveSavingsService.getPredictions(filter), [filter?.type, filter?.urgency]);
}

export function usePredictiveSavingsSummary() {
  return useMemo(() => predictiveSavingsService.getSummary(), []);
}
