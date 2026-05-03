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
// REACT HOOKS — R27: derive from real contractor expenses
// =============================================================================
// Was returning hardcoded `Technische Unie / Bouwmaat / Verfwinkel.nl /
// Hornbach` to every contractor regardless of who they actually buy from.
// Now aggregates per-supplier spend from useExpenses() and computes loyalty
// tiers + discount potential heuristically.
// =============================================================================

import { useExpenses } from './expenseService';

const TIER_THRESHOLDS: { tier: SupplierLeverage['loyaltyTier']; nextTierName: string; threshold: number; nextThreshold: number; discount: number; potential: number }[] = [
  { tier: 'bronze',   nextTierName: 'Silver',   threshold: 0,     nextThreshold: 5000,  discount: 0,  potential: 5  },
  { tier: 'silver',   nextTierName: 'Gold',     threshold: 5000,  nextThreshold: 10000, discount: 5,  potential: 10 },
  { tier: 'gold',     nextTierName: 'Platinum', threshold: 10000, nextThreshold: 20000, discount: 10, potential: 12 },
  { tier: 'platinum', nextTierName: 'Platinum', threshold: 20000, nextThreshold: 50000, discount: 12, potential: 15 },
];

function tierFor(annualSpend: number): typeof TIER_THRESHOLDS[number] {
  for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
    if (annualSpend >= TIER_THRESHOLDS[i].threshold) return TIER_THRESHOLDS[i];
  }
  return TIER_THRESHOLDS[0];
}

function deriveSupplierLeverage(expenses: any[]): SupplierLeverage[] {
  // Aggregate per-supplier spend over the last 12 months.
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const recent = expenses.filter((e) => {
    const d = e.date instanceof Date ? e.date.getTime() : new Date(e.date).getTime();
    return d >= yearAgo;
  });
  const bySupplier = new Map<string, { spend: number; orderCount: number }>();
  for (const e of recent) {
    const s = (e.supplier ?? '').trim();
    if (!s) continue;
    const cur = bySupplier.get(s) ?? { spend: 0, orderCount: 0 };
    cur.spend += (e.amount ?? 0) + (e.vatAmount ?? 0);
    cur.orderCount += 1;
    bySupplier.set(s, cur);
  }
  const total = Array.from(bySupplier.values()).reduce((sum, x) => sum + x.spend, 0);
  if (total === 0 || bySupplier.size === 0) return [];

  return Array.from(bySupplier.entries())
    .map(([name, { spend, orderCount }]) => {
      const tier = tierFor(spend);
      const spendShare = (spend / total) * 100;
      // Leverage score: blend of share + tier headroom + order frequency
      const tierHeadroom = Math.max(0, 1 - (spend - tier.threshold) / Math.max(1, tier.nextThreshold - tier.threshold));
      const score = Math.round(
        Math.min(100, spendShare * 1.2 + tierHeadroom * 30 + Math.min(orderCount, 20) * 1.5)
      );
      const factors: string[] = [];
      if (spendShare > 30) factors.push('High spend share');
      if (orderCount >= 6) factors.push('High order frequency');
      if (tier.tier === 'bronze') factors.push('Tier upgrade available');
      else if (tier.tier === 'gold' || tier.tier === 'platinum') factors.push('Loyal customer');
      return {
        supplierId: `sup_${name.toLowerCase().replace(/\s+/g, '_')}`,
        supplierName: name,
        annualSpend: Math.round(spend),
        spendShare: Math.round(spendShare),
        loyaltyTier: tier.tier,
        nextTierThreshold: tier.nextThreshold,
        nextTierName: tier.nextTierName,
        currentDiscount: tier.discount,
        potentialDiscount: tier.potential,
        leverageScore: score,
        leverageFactors: factors.length > 0 ? factors : ['Stable spend'],
        negotiationTip: spend < tier.nextThreshold
          ? `€${Math.round(tier.nextThreshold - spend)} more to reach ${tier.nextTierName} (${tier.potential}% discount)`
          : `You're a top customer — ask for an exclusive price list.`,
      };
    })
    .sort((a, b) => b.leverageScore - a.leverageScore);
}

export function useSupplierNegotiation(): NegotiationSummary {
  const { expenses } = useExpenses();
  return useMemo(() => {
    const suppliers = deriveSupplierLeverage(expenses);
    if (suppliers.length === 0) {
      return {
        totalDiscountPotential: 0,
        topLeverage: {} as SupplierLeverage,
        concentration: {
          totalAnnualSpend: 0,
          topSupplierShare: 0,
          supplierCount: 0,
          herfindahlIndex: 0,
          diversificationAdvice: '',
        },
        suppliers: [],
        quickWins: [],
      };
    }
    const totalAnnualSpend = suppliers.reduce((s, l) => s + l.annualSpend, 0);
    const shares = suppliers.map((l) => l.spendShare / 100);
    const hhi = Math.round(shares.reduce((s, sh) => s + sh * sh, 0) * 10000);
    const totalPotential = suppliers.reduce(
      (s, l) => s + Math.round(l.annualSpend * (l.potentialDiscount - l.currentDiscount) / 100),
      0,
    );
    const quickWins = suppliers
      .filter((l) => l.potentialDiscount > l.currentDiscount && l.annualSpend > 200)
      .slice(0, 3)
      .map((l) => ({
        supplier: l.supplierName,
        action: l.negotiationTip,
        saving: Math.round(l.annualSpend * (l.potentialDiscount - l.currentDiscount) / 100),
      }));
    return {
      totalDiscountPotential: totalPotential,
      topLeverage: suppliers[0],
      concentration: {
        totalAnnualSpend,
        topSupplierShare: suppliers[0]?.spendShare ?? 0,
        supplierCount: suppliers.length,
        herfindahlIndex: hhi,
        diversificationAdvice: hhi > 2500
          ? 'High concentration — spread risk across more suppliers'
          : 'Healthy supplier diversity',
      },
      suppliers,
      quickWins,
    };
  }, [expenses]);
}

export function useSupplierLeverage(): SupplierLeverage[] {
  const { expenses } = useExpenses();
  return useMemo(() => deriveSupplierLeverage(expenses), [expenses]);
}
