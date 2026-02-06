// =============================================================================
// SUPPLIER NEGOTIATION INTELLIGENCE SERVICE
// =============================================================================
// Spend concentration analysis, loyalty tier tracking, volume discount
// opportunities, and negotiation leverage scoring per supplier.
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface SupplierLeverage {
  supplierId: string;
  supplierName: string;
  annualSpend: number;
  spendShare: number; // % of total supplier spend
  loyaltyTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTierThreshold: number;
  nextTierName: string;
  currentDiscount: number;
  potentialDiscount: number;
  leverageScore: number; // 0-100
  leverageFactors: string[];
  negotiationTip: string;
}

export interface SpendConcentration {
  totalAnnualSpend: number;
  topSupplierShare: number;
  supplierCount: number;
  herfindahlIndex: number; // concentration metric
  diversificationAdvice: string;
}

export interface NegotiationSummary {
  totalDiscountPotential: number;
  topLeverage: SupplierLeverage;
  concentration: SpendConcentration;
  suppliers: SupplierLeverage[];
  quickWins: Array<{ supplier: string; action: string; saving: number }>;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_LEVERAGE: SupplierLeverage[] = [
  {
    supplierId: 'sup_technische_unie',
    supplierName: 'Technische Unie',
    annualSpend: 8400,
    spendShare: 38,
    loyaltyTier: 'silver',
    nextTierThreshold: 10000,
    nextTierName: 'Gold',
    currentDiscount: 8,
    potentialDiscount: 12,
    leverageScore: 78,
    leverageFactors: ['Hoge orderfrequentie', 'Groeiende uitgaven', 'Op-tijd betalingen'],
    negotiationTip: 'Nog €1.600 tot Gold-tier met 12% korting. Bundel je Q2 bestellingen.',
  },
  {
    supplierId: 'sup_bouwmaat',
    supplierName: 'Bouwmaat',
    annualSpend: 6200,
    spendShare: 28,
    loyaltyTier: 'silver',
    nextTierThreshold: 8000,
    nextTierName: 'Gold',
    currentDiscount: 5,
    potentialDiscount: 10,
    leverageScore: 65,
    leverageFactors: ['Stabiele uitgaven', 'Breed productassortiment'],
    negotiationTip: 'Vraag om projectkorting voor je badkamerrenovaties — volume rechtvaardigt 10%.',
  },
  {
    supplierId: 'sup_verfwinkel',
    supplierName: 'Verfwinkel.nl',
    annualSpend: 4800,
    spendShare: 22,
    loyaltyTier: 'gold',
    nextTierThreshold: 6000,
    nextTierName: 'Platinum',
    currentDiscount: 12,
    potentialDiscount: 15,
    leverageScore: 85,
    leverageFactors: ['Trouwe klant', 'Hoog volume in categorie', 'Referral potentieel'],
    negotiationTip: 'Je bent top-klant in de verf categorie. Vraag om exclusieve prijslijst.',
  },
  {
    supplierId: 'sup_hornbach',
    supplierName: 'Hornbach',
    annualSpend: 2600,
    spendShare: 12,
    loyaltyTier: 'bronze',
    nextTierThreshold: 5000,
    nextTierName: 'Silver',
    currentDiscount: 0,
    potentialDiscount: 5,
    leverageScore: 32,
    leverageFactors: ['Lage orderfrequentie'],
    negotiationTip: 'Overweeg Hornbach-orders te verplaatsen naar Bouwmaat voor hogere tier-korting.',
  },
];

// =============================================================================
// SERVICE
// =============================================================================

class SupplierNegotiationService {
  getSupplierLeverage(): SupplierLeverage[] {
    return [...MOCK_LEVERAGE].sort((a, b) => b.leverageScore - a.leverageScore);
  }

  getConcentration(): SpendConcentration {
    const total = MOCK_LEVERAGE.reduce((s, l) => s + l.annualSpend, 0);
    const shares = MOCK_LEVERAGE.map(l => l.spendShare / 100);
    const hhi = Math.round(shares.reduce((s, sh) => s + sh * sh, 0) * 10000);

    return {
      totalAnnualSpend: total,
      topSupplierShare: Math.max(...MOCK_LEVERAGE.map(l => l.spendShare)),
      supplierCount: MOCK_LEVERAGE.length,
      herfindahlIndex: hhi,
      diversificationAdvice: hhi > 2500
        ? 'Hoge concentratie — spreid risico over meer leveranciers'
        : 'Gezonde spreiding over leveranciers',
    };
  }

  getSummary(): NegotiationSummary {
    const suppliers = this.getSupplierLeverage();
    const concentration = this.getConcentration();
    const totalPotential = suppliers.reduce(
      (s, l) => s + Math.round(l.annualSpend * (l.potentialDiscount - l.currentDiscount) / 100),
      0
    );

    return {
      totalDiscountPotential: totalPotential,
      topLeverage: suppliers[0],
      concentration,
      suppliers,
      quickWins: [
        { supplier: 'Technische Unie', action: 'Bundel Q2 bestellingen voor Gold-tier', saving: 480 },
        { supplier: 'Verfwinkel.nl', action: 'Vraag exclusieve prijslijst aan', saving: 144 },
        { supplier: 'Hornbach', action: 'Verplaats orders naar Bouwmaat', saving: 130 },
      ],
    };
  }
}

export const supplierNegotiationService = new SupplierNegotiationService();

// =============================================================================
// REACT HOOKS
// =============================================================================

export function useSupplierNegotiation() {
  return useMemo(() => supplierNegotiationService.getSummary(), []);
}

export function useSupplierLeverage() {
  return useMemo(() => supplierNegotiationService.getSupplierLeverage(), []);
}
