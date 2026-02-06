// =============================================================================
// COMPETITIVE INTELLIGENCE SERVICE
// =============================================================================
// Win/loss analysis, price sensitivity, optimal pricing zone per job type,
// customer decision factors, and market positioning.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface WinLossRecord {
  id: string;
  jobType: string;
  quotedPrice: number;
  outcome: 'won' | 'lost' | 'pending';
  customerType: 'particulier' | 'zakelijk';
  competitorPrice?: number;
  lossReason?: string;
  decisionFactors: string[];
}

export interface PriceZone {
  jobType: string;
  optimalMin: number;
  optimalMax: number;
  sweetSpot: number;
  winRateAtSweetSpot: number;
  currentAvgPrice: number;
  positionVsOptimal: 'below' | 'in-zone' | 'above';
  adjustment: number; // suggested % adjustment
}

export interface PriceSensitivity {
  jobType: string;
  elasticity: number; // % change in win rate per % change in price
  sensitivityLabel: 'low' | 'medium' | 'high';
  insight: string;
}

export interface DecisionFactor {
  factor: string;
  importance: number; // 0-100
  yourScore: number;  // 0-100
  gap: number;
}

export interface CompetitiveIntelligenceSummary {
  overallWinRate: number;
  winRateTrend: 'up' | 'down' | 'stable';
  priceZones: PriceZone[];
  sensitivity: PriceSensitivity[];
  decisionFactors: DecisionFactor[];
  topLossReason: string;
  recentRecords: WinLossRecord[];
  monthlyInsight: string;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_RECORDS: WinLossRecord[] = [
  { id: 'wl_1', jobType: 'Badkamerrenovatie', quotedPrice: 7500, outcome: 'won', customerType: 'particulier', decisionFactors: ['Prijs', 'Reviews', 'Snelheid'] },
  { id: 'wl_2', jobType: 'Badkamerrenovatie', quotedPrice: 8200, outcome: 'lost', customerType: 'particulier', competitorPrice: 6800, lossReason: 'Prijs te hoog', decisionFactors: ['Prijs'] },
  { id: 'wl_3', jobType: 'Schilderwerk', quotedPrice: 1200, outcome: 'won', customerType: 'particulier', decisionFactors: ['Reviews', 'Beschikbaarheid'] },
  { id: 'wl_4', jobType: 'Schilderwerk', quotedPrice: 1800, outcome: 'lost', customerType: 'zakelijk', competitorPrice: 1400, lossReason: 'Concurrent goedkoper', decisionFactors: ['Prijs', 'Referenties'] },
  { id: 'wl_5', jobType: 'Loodgieterswerk', quotedPrice: 650, outcome: 'won', customerType: 'particulier', decisionFactors: ['Snelheid', 'Nabijheid'] },
  { id: 'wl_6', jobType: 'Keukenrenovatie', quotedPrice: 5500, outcome: 'won', customerType: 'zakelijk', decisionFactors: ['Kwaliteit', 'Ervaring'] },
  { id: 'wl_7', jobType: 'Tegelen', quotedPrice: 3200, outcome: 'lost', customerType: 'particulier', competitorPrice: 2800, lossReason: 'Prijs te hoog', decisionFactors: ['Prijs'] },
  { id: 'wl_8', jobType: 'Loodgieterswerk', quotedPrice: 720, outcome: 'won', customerType: 'particulier', decisionFactors: ['Snelheid', 'Reviews'] },
];

const MOCK_PRICE_ZONES: PriceZone[] = [
  { jobType: 'Badkamerrenovatie', optimalMin: 6500, optimalMax: 8000, sweetSpot: 7200, winRateAtSweetSpot: 68, currentAvgPrice: 7500, positionVsOptimal: 'in-zone', adjustment: 0 },
  { jobType: 'Schilderwerk', optimalMin: 1100, optimalMax: 1500, sweetSpot: 1250, winRateAtSweetSpot: 72, currentAvgPrice: 1400, positionVsOptimal: 'in-zone', adjustment: -5 },
  { jobType: 'Loodgieterswerk', optimalMin: 550, optimalMax: 750, sweetSpot: 650, winRateAtSweetSpot: 82, currentAvgPrice: 680, positionVsOptimal: 'in-zone', adjustment: 0 },
  { jobType: 'Keukenrenovatie', optimalMin: 5000, optimalMax: 6500, sweetSpot: 5500, winRateAtSweetSpot: 65, currentAvgPrice: 5800, positionVsOptimal: 'in-zone', adjustment: 0 },
  { jobType: 'Tegelen', optimalMin: 2200, optimalMax: 3000, sweetSpot: 2600, winRateAtSweetSpot: 70, currentAvgPrice: 2800, positionVsOptimal: 'in-zone', adjustment: -8 },
];

const MOCK_SENSITIVITY: PriceSensitivity[] = [
  { jobType: 'Schilderwerk', elasticity: 2.1, sensitivityLabel: 'high', insight: 'Klanten vergelijken schilderwerk-offertes het meest. Prijs is de hoofdfactor.' },
  { jobType: 'Tegelen', elasticity: 1.8, sensitivityLabel: 'high', insight: 'Hoge prijsgevoeligheid — overweeg value-based pricing met materiaalgarantie.' },
  { jobType: 'Badkamerrenovatie', elasticity: 0.9, sensitivityLabel: 'medium', insight: 'Gemiddelde gevoeligheid — kwaliteit en reviews wegen zwaarder dan prijs.' },
  { jobType: 'Keukenrenovatie', elasticity: 0.7, sensitivityLabel: 'low', insight: 'Lage gevoeligheid — klanten kiezen op ervaring en portfolio.' },
  { jobType: 'Loodgieterswerk', elasticity: 0.5, sensitivityLabel: 'low', insight: 'Urgentie overheerst — snelheid en beschikbaarheid zijn belangrijker dan prijs.' },
];

const MOCK_FACTORS: DecisionFactor[] = [
  { factor: 'Prijs', importance: 78, yourScore: 65, gap: -13 },
  { factor: 'Reviews & Reputatie', importance: 85, yourScore: 92, gap: 7 },
  { factor: 'Snelheid & Beschikbaarheid', importance: 72, yourScore: 80, gap: 8 },
  { factor: 'Kwaliteit & Garantie', importance: 90, yourScore: 88, gap: -2 },
  { factor: 'Communicatie', importance: 68, yourScore: 85, gap: 17 },
];

// =============================================================================
// SERVICE
// =============================================================================

class CompetitiveIntelligenceService {
  getWinLossRecords(): WinLossRecord[] {
    return MOCK_RECORDS;
  }

  getPriceZones(): PriceZone[] {
    return MOCK_PRICE_ZONES;
  }

  getPriceSensitivity(): PriceSensitivity[] {
    return [...MOCK_SENSITIVITY].sort((a, b) => b.elasticity - a.elasticity);
  }

  getDecisionFactors(): DecisionFactor[] {
    return [...MOCK_FACTORS].sort((a, b) => b.importance - a.importance);
  }

  getSummary(): CompetitiveIntelligenceSummary {
    const records = this.getWinLossRecords();
    const decided = records.filter(r => r.outcome !== 'pending');
    const won = decided.filter(r => r.outcome === 'won');
    const lost = decided.filter(r => r.outcome === 'lost');

    const lossReasons = lost.map(r => r.lossReason).filter(Boolean);
    const topReason = lossReasons.length > 0
      ? lossReasons.sort((a, b) =>
          lossReasons.filter(r => r === b).length - lossReasons.filter(r => r === a).length
        )[0]!
      : 'Geen data';

    return {
      overallWinRate: Math.round((won.length / decided.length) * 100),
      winRateTrend: 'up',
      priceZones: this.getPriceZones(),
      sensitivity: this.getPriceSensitivity(),
      decisionFactors: this.getDecisionFactors(),
      topLossReason: topReason,
      recentRecords: records.slice(0, 5),
      monthlyInsight: 'Je wint het meest op snelheid en reviews. Investeer in snellere responstijd voor schilderwerk-leads om je zwakste segment te versterken.',
    };
  }
}

export const competitiveIntelligenceService = new CompetitiveIntelligenceService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function useCompetitiveIntelligence() {
  return useMemo(() => competitiveIntelligenceService.getSummary(), []);
}

export function usePriceZones() {
  return useMemo(() => competitiveIntelligenceService.getPriceZones(), []);
}

export function usePriceSensitivity() {
  return useMemo(() => competitiveIntelligenceService.getPriceSensitivity(), []);
}
