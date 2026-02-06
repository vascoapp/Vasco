// =============================================================================
// TCO (TOTAL COST OF OWNERSHIP) CALCULATOR SERVICE
// =============================================================================
// Lifecycle cost comparison for materials — factors in purchase price,
// installation time, durability, warranty, callback risk, and disposal.
// Helps contractors recommend value-over-price to customers.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface TCOMaterial {
  id: string;
  name: string;
  brand: string;
  category: string;
  tier: 'budget' | 'mid' | 'premium';
  purchasePrice: number;
  installationHours: number;
  installationCost: number;
  durabilityYears: number;
  warrantyYears: number;
  callbackRisk: number;       // % chance of callback within 2 years
  callbackCost: number;       // estimated callback cost
  annualMaintenanceCost: number;
  disposalCost: number;
  tcoPerYear: number;          // total cost of ownership per year
  totalTco: number;            // over durability period
  ecoRating: 'A' | 'B' | 'C' | 'D';
}

export interface TCOComparison {
  category: string;
  materials: TCOMaterial[];
  recommendation: TCOMaterial;
  savingsVsBudget: number;      // per year savings of recommended vs budget
  customerPitch: string;        // Dutch text to use with customers
}

export interface TCOSummary {
  comparisons: TCOComparison[];
  avgSavingsPerProject: number;
  totalSavingsThisYear: number;
  topRecommendation: string;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_COMPARISONS: TCOComparison[] = [
  {
    category: 'Keukenkranen',
    materials: [
      {
        id: 'tco_1',
        name: 'Budget Mengkraan',
        brand: 'NoName',
        category: 'Keukenkranen',
        tier: 'budget',
        purchasePrice: 45,
        installationHours: 1.5,
        installationCost: 83,
        durabilityYears: 3,
        warrantyYears: 1,
        callbackRisk: 35,
        callbackCost: 120,
        annualMaintenanceCost: 15,
        disposalCost: 10,
        tcoPerYear: 68,
        totalTco: 204,
        ecoRating: 'D',
      },
      {
        id: 'tco_2',
        name: 'Grohe Eurosmart',
        brand: 'Grohe',
        category: 'Keukenkranen',
        tier: 'mid',
        purchasePrice: 89,
        installationHours: 1.0,
        installationCost: 55,
        durabilityYears: 8,
        warrantyYears: 5,
        callbackRisk: 8,
        callbackCost: 45,
        annualMaintenanceCost: 5,
        disposalCost: 10,
        tcoPerYear: 24,
        totalTco: 192,
        ecoRating: 'B',
      },
      {
        id: 'tco_3',
        name: 'Grohe Minta Professional',
        brand: 'Grohe',
        category: 'Keukenkranen',
        tier: 'premium',
        purchasePrice: 189,
        installationHours: 1.0,
        installationCost: 55,
        durabilityYears: 12,
        warrantyYears: 5,
        callbackRisk: 3,
        callbackCost: 45,
        annualMaintenanceCost: 3,
        disposalCost: 10,
        tcoPerYear: 23,
        totalTco: 276,
        ecoRating: 'A',
      },
    ],
    recommendation: {
      id: 'tco_2',
      name: 'Grohe Eurosmart',
      brand: 'Grohe',
      category: 'Keukenkranen',
      tier: 'mid',
      purchasePrice: 89,
      installationHours: 1.0,
      installationCost: 55,
      durabilityYears: 8,
      warrantyYears: 5,
      callbackRisk: 8,
      callbackCost: 45,
      annualMaintenanceCost: 5,
      disposalCost: 10,
      tcoPerYear: 24,
      totalTco: 192,
      ecoRating: 'B',
    },
    savingsVsBudget: 44,
    customerPitch: 'De Grohe Eurosmart kost €44 meer bij aanschaf, maar bespaart u €44 per jaar aan onderhoud en vervanging. Na 2 jaar is het al goedkoper.',
  },
  {
    category: 'Buitenverf',
    materials: [
      {
        id: 'tco_4',
        name: 'Budget Buitenlak',
        brand: 'Huismerk',
        category: 'Buitenverf',
        tier: 'budget',
        purchasePrice: 18,
        installationHours: 3.0,
        installationCost: 165,
        durabilityYears: 3,
        warrantyYears: 0,
        callbackRisk: 25,
        callbackCost: 200,
        annualMaintenanceCost: 0,
        disposalCost: 5,
        tcoPerYear: 79,
        totalTco: 238,
        ecoRating: 'C',
      },
      {
        id: 'tco_5',
        name: 'Sigma S2U Allure',
        brand: 'Sigma',
        category: 'Buitenverf',
        tier: 'mid',
        purchasePrice: 42,
        installationHours: 2.5,
        installationCost: 138,
        durabilityYears: 6,
        warrantyYears: 2,
        callbackRisk: 8,
        callbackCost: 150,
        annualMaintenanceCost: 0,
        disposalCost: 5,
        tcoPerYear: 33,
        totalTco: 197,
        ecoRating: 'B',
      },
      {
        id: 'tco_6',
        name: 'Sikkens Rubbol BL Satura',
        brand: 'Sikkens',
        category: 'Buitenverf',
        tier: 'premium',
        purchasePrice: 65,
        installationHours: 2.0,
        installationCost: 110,
        durabilityYears: 9,
        warrantyYears: 3,
        callbackRisk: 3,
        callbackCost: 120,
        annualMaintenanceCost: 0,
        disposalCost: 5,
        tcoPerYear: 21,
        totalTco: 184,
        ecoRating: 'A',
      },
    ],
    recommendation: {
      id: 'tco_5',
      name: 'Sigma S2U Allure',
      brand: 'Sigma',
      category: 'Buitenverf',
      tier: 'mid',
      purchasePrice: 42,
      installationHours: 2.5,
      installationCost: 138,
      durabilityYears: 6,
      warrantyYears: 2,
      callbackRisk: 8,
      callbackCost: 150,
      annualMaintenanceCost: 0,
      disposalCost: 5,
      tcoPerYear: 33,
      totalTco: 197,
      ecoRating: 'B',
    },
    savingsVsBudget: 46,
    customerPitch: 'Sigma S2U gaat 2x zo lang mee als budget verf. U bespaart €46/jaar doordat u minder vaak hoeft te laten schilderen.',
  },
];

// =============================================================================
// SERVICE
// =============================================================================

class TCOCalculatorService {
  getComparisons(): TCOComparison[] {
    return MOCK_COMPARISONS;
  }

  getComparison(category: string): TCOComparison | undefined {
    return MOCK_COMPARISONS.find(c => c.category === category);
  }

  calculateTCO(material: Omit<TCOMaterial, 'tcoPerYear' | 'totalTco'>): { tcoPerYear: number; totalTco: number } {
    const expectedCallbackCost = material.callbackRisk / 100 * material.callbackCost;
    const totalCost = material.purchasePrice + material.installationCost +
      (material.annualMaintenanceCost * material.durabilityYears) +
      expectedCallbackCost + material.disposalCost;
    return {
      totalTco: Math.round(totalCost),
      tcoPerYear: Math.round(totalCost / material.durabilityYears),
    };
  }

  getSummary(): TCOSummary {
    const comparisons = this.getComparisons();
    const avgSavings = Math.round(
      comparisons.reduce((s, c) => s + c.savingsVsBudget, 0) / comparisons.length
    );

    return {
      comparisons,
      avgSavingsPerProject: avgSavings,
      totalSavingsThisYear: avgSavings * 26, // ~26 projects/year
      topRecommendation: 'Gebruik altijd TCO-vergelijking bij klantadvies — het verkoopt mid-tier producten en verhoogt je marge.',
    };
  }
}

export const tcoCalculatorService = new TCOCalculatorService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function useTCOComparisons() {
  return useMemo(() => tcoCalculatorService.getComparisons(), []);
}

export function useTCOSummary() {
  return useMemo(() => tcoCalculatorService.getSummary(), []);
}
