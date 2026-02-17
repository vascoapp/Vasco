// =============================================================================
// BUDGET ENRICHMENT SERVICE — Market Pricing Layer
// =============================================================================
// Takes extracted budget lines and enriches them with market pricing data,
// savings potential analysis, and supplier/material benchmarking.
// Part of the budget optimizer pipeline.
// =============================================================================

import type { ExtractedBudgetLine } from '../ingestion/budgetExtractor';

// =============================================================================
// TYPES
// =============================================================================

export interface MarketSource {
  name: string;
  price: number;
  unit: string;
  lastUpdated: string;
  reliability: number; // 0-1
}

export interface MarketEnrichment {
  sources: MarketSource[];
  marketAvg: number;
  marketLow: number;
  marketHigh: number;
  trend: 'rising' | 'stable' | 'falling';
  confidence: number; // 0-1
  percentileVsMarket: number; // 0-100
}

export interface SavingsAction {
  type:
    | 'negotiate_rate'
    | 'switch_supplier'
    | 'alternative_material'
    | 'bulk_purchase'
    | 'reduce_quantity'
    | 'phase_timing'
    | 'spec_optimization'
    | 'remove_redundant';
  label: string;
  description: string;
  estimatedSaving: number;
  confidence: number; // 0-1
  risk: 'low' | 'medium' | 'high';
}

export interface SavingsPotential {
  currentTotal: number;
  optimizedTotal: number;
  savingsAmount: number;
  savingsPercent: number;
  difficulty: 'easy' | 'medium' | 'hard';
  actions: SavingsAction[];
}

export interface EnrichedBudgetLine {
  // All fields from ExtractedBudgetLine
  id: string;
  costCode: string;
  description: string;
  category: string;
  subcategory: string;
  quantity: number;
  unit: string;
  unitRate: number;
  total: number;
  supplier?: string;
  sheetSource: string;
  confidence: number;
  // Enrichment
  marketData: MarketEnrichment | null;
  savingsPotential: SavingsPotential | null;
}

// =============================================================================
// MARKET RATE DATA STRUCTURE
// =============================================================================

interface MarketRateData {
  avgRate: number;
  lowRate: number;
  highRate: number;
  unit: string;
  trend: 'rising' | 'stable' | 'falling';
  sources: MarketSource[];
}

// =============================================================================
// MOCK MARKET RATES — 30+ Dutch construction materials
// =============================================================================
// Rates reflect realistic NL market pricing (2024-2025).
// avgRate is set slightly below typical budget quotes so enrichment
// surfaces ~60% of lines with savings potential ranging 2-20%.
// =============================================================================

const MOCK_MARKET_RATES: Record<string, MarketRateData> = {
  // ── Sloopwerk ──────────────────────────────────────────────────────────────
  sloopwerk: {
    avgRate: 42.0,
    lowRate: 32.0,
    highRate: 65.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'Bouwkosten Kompas', price: 40.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
      { name: 'Cobouw Marktdata', price: 43.5, unit: 'm²', lastUpdated: '2025-02-01', reliability: 0.85 },
      { name: 'NVTB Richtprijzen', price: 42.5, unit: 'm²', lastUpdated: '2024-12-10', reliability: 0.88 },
    ],
  },
  asbestverwijdering: {
    avgRate: 28.0,
    lowRate: 18.0,
    highRate: 48.0,
    unit: 'm²',
    trend: 'rising',
    sources: [
      { name: 'Ascert Register', price: 27.0, unit: 'm²', lastUpdated: '2025-01-20', reliability: 0.92 },
      { name: 'Bouwkosten Kompas', price: 29.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },
  'afvoer sloopafval': {
    avgRate: 165.0,
    lowRate: 120.0,
    highRate: 240.0,
    unit: 'ton',
    trend: 'rising',
    sources: [
      { name: 'Renewi Tarieven', price: 160.0, unit: 'ton', lastUpdated: '2025-02-05', reliability: 0.87 },
      { name: 'BRBS Recycling', price: 170.0, unit: 'ton', lastUpdated: '2025-01-25', reliability: 0.84 },
    ],
  },

  // ── Bouwkundig ─────────────────────────────────────────────────────────────
  beton: {
    avgRate: 115.0,
    lowRate: 88.0,
    highRate: 165.0,
    unit: 'm³',
    trend: 'rising',
    sources: [
      { name: 'Mebin Betonprijzen', price: 112.0, unit: 'm³', lastUpdated: '2025-02-01', reliability: 0.93 },
      { name: 'VOBN Richtprijzen', price: 118.0, unit: 'm³', lastUpdated: '2025-01-10', reliability: 0.91 },
      { name: 'Cobouw Marktdata', price: 115.0, unit: 'm³', lastUpdated: '2025-01-28', reliability: 0.85 },
    ],
  },
  staal: {
    avgRate: 2.85,
    lowRate: 2.10,
    highRate: 3.80,
    unit: 'kg',
    trend: 'falling',
    sources: [
      { name: 'Staalbouwinstituut', price: 2.80, unit: 'kg', lastUpdated: '2025-02-03', reliability: 0.92 },
      { name: 'MCB Staalhandel', price: 2.90, unit: 'kg', lastUpdated: '2025-01-18', reliability: 0.88 },
    ],
  },
  metselwerk: {
    avgRate: 68.0,
    lowRate: 52.0,
    highRate: 95.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'Bouwkosten Kompas', price: 66.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
      { name: 'KNB Richtprijzen', price: 70.0, unit: 'm²', lastUpdated: '2024-12-20', reliability: 0.87 },
    ],
  },
  kozijnen: {
    avgRate: 320.0,
    lowRate: 240.0,
    highRate: 480.0,
    unit: 'stuk',
    trend: 'stable',
    sources: [
      { name: 'NBvT Marktmonitor', price: 315.0, unit: 'stuk', lastUpdated: '2025-01-22', reliability: 0.89 },
      { name: 'Bouwkosten Kompas', price: 325.0, unit: 'stuk', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },
  isolatie: {
    avgRate: 24.0,
    lowRate: 16.0,
    highRate: 38.0,
    unit: 'm²',
    trend: 'falling',
    sources: [
      { name: 'NVTI Isolatiewijzer', price: 23.0, unit: 'm²', lastUpdated: '2025-02-01', reliability: 0.91 },
      { name: 'Bouwkosten Kompas', price: 25.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
      { name: 'Isover Marktdata', price: 24.0, unit: 'm²', lastUpdated: '2025-01-08', reliability: 0.86 },
    ],
  },
  dakbedekking: {
    avgRate: 55.0,
    lowRate: 38.0,
    highRate: 82.0,
    unit: 'm²',
    trend: 'rising',
    sources: [
      { name: 'VEBIDAK Prijslijst', price: 53.0, unit: 'm²', lastUpdated: '2025-01-30', reliability: 0.88 },
      { name: 'Cobouw Marktdata', price: 57.0, unit: 'm²', lastUpdated: '2025-01-28', reliability: 0.85 },
    ],
  },

  // ── Elektra ────────────────────────────────────────────────────────────────
  bekabeling: {
    avgRate: 14.5,
    lowRate: 10.0,
    highRate: 22.0,
    unit: 'm',
    trend: 'stable',
    sources: [
      { name: 'Technische Unie', price: 14.0, unit: 'm', lastUpdated: '2025-02-04', reliability: 0.91 },
      { name: 'Rexel Marktdata', price: 15.0, unit: 'm', lastUpdated: '2025-01-20', reliability: 0.87 },
    ],
  },
  verlichting: {
    avgRate: 85.0,
    lowRate: 55.0,
    highRate: 140.0,
    unit: 'stuk',
    trend: 'falling',
    sources: [
      { name: 'Technische Unie', price: 82.0, unit: 'stuk', lastUpdated: '2025-02-04', reliability: 0.91 },
      { name: 'Signify Prijslijst', price: 88.0, unit: 'stuk', lastUpdated: '2025-01-12', reliability: 0.89 },
    ],
  },
  verdeelinrichting: {
    avgRate: 1850.0,
    lowRate: 1350.0,
    highRate: 2800.0,
    unit: 'stuk',
    trend: 'stable',
    sources: [
      { name: 'Hager Catalogus', price: 1800.0, unit: 'stuk', lastUpdated: '2025-01-18', reliability: 0.88 },
      { name: 'Schneider Electric', price: 1900.0, unit: 'stuk', lastUpdated: '2025-02-01', reliability: 0.9 },
    ],
  },
  noodverlichting: {
    avgRate: 125.0,
    lowRate: 85.0,
    highRate: 195.0,
    unit: 'stuk',
    trend: 'stable',
    sources: [
      { name: 'Technische Unie', price: 120.0, unit: 'stuk', lastUpdated: '2025-02-04', reliability: 0.91 },
      { name: 'Cobouw Marktdata', price: 130.0, unit: 'stuk', lastUpdated: '2025-01-28', reliability: 0.85 },
    ],
  },
  databekabeling: {
    avgRate: 18.5,
    lowRate: 12.0,
    highRate: 28.0,
    unit: 'm',
    trend: 'falling',
    sources: [
      { name: 'Rexel Marktdata', price: 17.5, unit: 'm', lastUpdated: '2025-01-20', reliability: 0.87 },
      { name: 'Technische Unie', price: 19.5, unit: 'm', lastUpdated: '2025-02-04', reliability: 0.91 },
    ],
  },

  // ── Installaties W ────────────────────────────────────────────────────────
  'cv-ketel': {
    avgRate: 2400.0,
    lowRate: 1800.0,
    highRate: 3600.0,
    unit: 'stuk',
    trend: 'falling',
    sources: [
      { name: 'Technische Unie', price: 2350.0, unit: 'stuk', lastUpdated: '2025-02-04', reliability: 0.91 },
      { name: 'Brink Climate', price: 2450.0, unit: 'stuk', lastUpdated: '2025-01-15', reliability: 0.86 },
    ],
  },
  sanitair: {
    avgRate: 380.0,
    lowRate: 260.0,
    highRate: 580.0,
    unit: 'stuk',
    trend: 'stable',
    sources: [
      { name: 'Technische Unie', price: 370.0, unit: 'stuk', lastUpdated: '2025-02-04', reliability: 0.91 },
      { name: 'Grohe Catalogus', price: 390.0, unit: 'stuk', lastUpdated: '2025-01-10', reliability: 0.88 },
    ],
  },
  sprinkler: {
    avgRate: 35.0,
    lowRate: 24.0,
    highRate: 52.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'NVBR Richtprijzen', price: 34.0, unit: 'm²', lastUpdated: '2025-01-20', reliability: 0.87 },
      { name: 'Cobouw Marktdata', price: 36.0, unit: 'm²', lastUpdated: '2025-01-28', reliability: 0.85 },
    ],
  },
  ventilatie: {
    avgRate: 32.0,
    lowRate: 22.0,
    highRate: 48.0,
    unit: 'm²',
    trend: 'rising',
    sources: [
      { name: 'Brink Climate', price: 31.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.86 },
      { name: 'Technische Unie', price: 33.0, unit: 'm²', lastUpdated: '2025-02-04', reliability: 0.91 },
    ],
  },
  warmtepomp: {
    avgRate: 5800.0,
    lowRate: 4200.0,
    highRate: 8500.0,
    unit: 'stuk',
    trend: 'falling',
    sources: [
      { name: 'Daikin Nederland', price: 5600.0, unit: 'stuk', lastUpdated: '2025-02-01', reliability: 0.9 },
      { name: 'Technische Unie', price: 5900.0, unit: 'stuk', lastUpdated: '2025-02-04', reliability: 0.91 },
      { name: 'NVKL Marktdata', price: 5900.0, unit: 'stuk', lastUpdated: '2025-01-12', reliability: 0.84 },
    ],
  },

  // ── Afbouw ─────────────────────────────────────────────────────────────────
  systeemplafond: {
    avgRate: 38.0,
    lowRate: 26.0,
    highRate: 58.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'Armstrong Catalogus', price: 37.0, unit: 'm²', lastUpdated: '2025-01-18', reliability: 0.88 },
      { name: 'Bouwkosten Kompas', price: 39.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },
  vloerafwerking: {
    avgRate: 48.0,
    lowRate: 32.0,
    highRate: 75.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'Forbo Flooring', price: 46.0, unit: 'm²', lastUpdated: '2025-01-22', reliability: 0.87 },
      { name: 'Bouwkosten Kompas', price: 50.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },
  schilderwerk: {
    avgRate: 22.0,
    lowRate: 15.0,
    highRate: 35.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'OnderhoudNL', price: 21.0, unit: 'm²', lastUpdated: '2025-01-25', reliability: 0.86 },
      { name: 'Bouwkosten Kompas', price: 23.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },
  binnenwanden: {
    avgRate: 52.0,
    lowRate: 38.0,
    highRate: 78.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'Knauf Systemen', price: 50.0, unit: 'm²', lastUpdated: '2025-01-20', reliability: 0.89 },
      { name: 'Bouwkosten Kompas', price: 54.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },
  stucwerk: {
    avgRate: 18.0,
    lowRate: 12.0,
    highRate: 28.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'NOA Stukadoors', price: 17.5, unit: 'm²', lastUpdated: '2025-01-14', reliability: 0.85 },
      { name: 'Bouwkosten Kompas', price: 18.5, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },

  // ── Terrein ────────────────────────────────────────────────────────────────
  bestrating: {
    avgRate: 42.0,
    lowRate: 28.0,
    highRate: 65.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'Struyk Verwo', price: 40.0, unit: 'm²', lastUpdated: '2025-01-20', reliability: 0.87 },
      { name: 'Bouwkosten Kompas', price: 44.0, unit: 'm²', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },
  groenvoorziening: {
    avgRate: 35.0,
    lowRate: 22.0,
    highRate: 55.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'VHG Hoveniers', price: 34.0, unit: 'm²', lastUpdated: '2025-01-18', reliability: 0.84 },
      { name: 'Cobouw Marktdata', price: 36.0, unit: 'm²', lastUpdated: '2025-01-28', reliability: 0.85 },
    ],
  },
  buitenverlichting: {
    avgRate: 195.0,
    lowRate: 130.0,
    highRate: 310.0,
    unit: 'stuk',
    trend: 'stable',
    sources: [
      { name: 'Philips Outdoor', price: 190.0, unit: 'stuk', lastUpdated: '2025-01-12', reliability: 0.88 },
      { name: 'Technische Unie', price: 200.0, unit: 'stuk', lastUpdated: '2025-02-04', reliability: 0.91 },
    ],
  },
  hekwerk: {
    avgRate: 75.0,
    lowRate: 50.0,
    highRate: 120.0,
    unit: 'm',
    trend: 'rising',
    sources: [
      { name: 'Heras Fencing', price: 72.0, unit: 'm', lastUpdated: '2025-01-22', reliability: 0.87 },
      { name: 'Bouwkosten Kompas', price: 78.0, unit: 'm', lastUpdated: '2025-01-15', reliability: 0.9 },
    ],
  },

  // ── Algemene kosten ────────────────────────────────────────────────────────
  bouwplaatsinrichting: {
    avgRate: 12.0,
    lowRate: 8.0,
    highRate: 18.0,
    unit: 'm²',
    trend: 'stable',
    sources: [
      { name: 'Boels Verhuur', price: 11.5, unit: 'm²', lastUpdated: '2025-01-25', reliability: 0.86 },
      { name: 'Cobouw Marktdata', price: 12.5, unit: 'm²', lastUpdated: '2025-01-28', reliability: 0.85 },
    ],
  },
  uitvoering: {
    avgRate: 85.0,
    lowRate: 65.0,
    highRate: 115.0,
    unit: 'uur',
    trend: 'rising',
    sources: [
      { name: 'Bouwend Nederland', price: 83.0, unit: 'uur', lastUpdated: '2025-02-01', reliability: 0.92 },
      { name: 'Cobouw Marktdata', price: 87.0, unit: 'uur', lastUpdated: '2025-01-28', reliability: 0.85 },
    ],
  },
  verzekeringen: {
    avgRate: 0.35,
    lowRate: 0.2,
    highRate: 0.55,
    unit: '% bouwsom',
    trend: 'stable',
    sources: [
      { name: 'AON Bouwverzekering', price: 0.33, unit: '% bouwsom', lastUpdated: '2025-01-10', reliability: 0.9 },
      { name: 'Marsh Nederland', price: 0.37, unit: '% bouwsom', lastUpdated: '2025-01-20', reliability: 0.88 },
    ],
  },
};

// =============================================================================
// FUZZY MATCHING
// =============================================================================

/**
 * Match a budget line description to a known material keyword.
 * Checks if any MOCK_MARKET_RATES key appears within the description
 * (case-insensitive). Returns the matched key or null.
 *
 * Keys are sorted longest-first so "afvoer sloopafval" matches before
 * "sloopwerk", and "cv-ketel" before "ketel", etc.
 */
const SORTED_KEYS = Object.keys(MOCK_MARKET_RATES).sort(
  (a, b) => b.length - a.length,
);

export function fuzzyMatchMaterial(description: string): string | null {
  const lower = description.toLowerCase();
  for (const key of SORTED_KEYS) {
    if (lower.includes(key)) {
      return key;
    }
  }
  return null;
}

// =============================================================================
// SAVINGS ANALYSIS HELPERS
// =============================================================================

function determineDifficulty(
  savingsPercent: number,
): 'easy' | 'medium' | 'hard' {
  if (savingsPercent < 5) return 'easy';
  if (savingsPercent <= 15) return 'medium';
  return 'hard';
}

function buildSavingsActions(
  line: ExtractedBudgetLine,
  marketRate: MarketRateData,
): SavingsAction[] {
  const { unitRate, quantity, description } = line;
  const { avgRate } = marketRate;
  const actions: SavingsAction[] = [];

  // Tier 1 — unit rate > 5% above market average
  if (unitRate > avgRate * 1.05) {
    const targetRate = avgRate * 1.02; // negotiate to just above avg
    const saving = (unitRate - targetRate) * quantity;
    actions.push({
      type: 'negotiate_rate',
      label: 'Tarief onderhandelen',
      description: `Huidig tarief ${unitRate.toFixed(2)} ligt boven marktgemiddelde ${avgRate.toFixed(2)}. Onderhandel naar ${targetRate.toFixed(2)} per ${marketRate.unit}.`,
      estimatedSaving: Math.round(saving * 100) / 100,
      confidence: 0.75,
      risk: 'low',
    });
  }

  // Tier 2 — unit rate > 15% above market average
  if (unitRate > avgRate * 1.15) {
    const targetRate = avgRate * 0.98; // competitive supplier can undercut
    const saving = (unitRate - targetRate) * quantity;
    actions.push({
      type: 'switch_supplier',
      label: 'Leverancier wisselen',
      description: `Overweeg alternatieve leverancier voor "${description}". Marktlaag is ${marketRate.lowRate.toFixed(2)} per ${marketRate.unit}.`,
      estimatedSaving: Math.round(saving * 100) / 100,
      confidence: 0.6,
      risk: 'medium',
    });
  }

  // Tier 3 — unit rate > 25% above market average
  if (unitRate > avgRate * 1.25) {
    const targetRate = avgRate * 0.92;
    const saving = (unitRate - targetRate) * quantity;
    actions.push({
      type: 'alternative_material',
      label: 'Alternatief materiaal',
      description: `Kijk naar gelijkwaardig alternatief voor "${description}" met lagere specificatie-eisen.`,
      estimatedSaving: Math.round(saving * 100) / 100,
      confidence: 0.45,
      risk: 'high',
    });
  }

  // Bonus: bulk purchase suggestion for large quantities
  if (quantity > 100 && unitRate > avgRate * 1.03) {
    const bulkDiscount = 0.05; // 5% volume discount
    const saving = unitRate * bulkDiscount * quantity;
    actions.push({
      type: 'bulk_purchase',
      label: 'Volume-inkoopkorting',
      description: `Bij afname van ${quantity} ${marketRate.unit} is 5% staffelkorting realistisch.`,
      estimatedSaving: Math.round(saving * 100) / 100,
      confidence: 0.7,
      risk: 'low',
    });
  }

  return actions;
}

// =============================================================================
// ENRICHMENT — SINGLE LINE
// =============================================================================

export function enrichBudgetLine(line: ExtractedBudgetLine): EnrichedBudgetLine {
  const matchedKey = fuzzyMatchMaterial(line.description);

  // Base enriched line (copies all original fields)
  const base: EnrichedBudgetLine = {
    id: line.id,
    costCode: line.costCode,
    description: line.description,
    category: line.category,
    subcategory: line.subcategory,
    quantity: line.quantity,
    unit: line.unit,
    unitRate: line.unitRate,
    total: line.total,
    supplier: line.supplier,
    sheetSource: line.sheetSource,
    confidence: line.confidence,
    marketData: null,
    savingsPotential: null,
  };

  if (!matchedKey) {
    // No market data available — return unenriched
    base.confidence = 0;
    return base;
  }

  const rate = MOCK_MARKET_RATES[matchedKey];

  // ── Market enrichment ───────────────────────────────────────────────────
  const range = rate.highRate - rate.lowRate;
  const rawPercentile =
    range > 0 ? ((line.unitRate - rate.lowRate) / range) * 100 : 50;
  const percentileVsMarket = Math.max(0, Math.min(100, Math.round(rawPercentile)));

  // Confidence based on source count and their average reliability
  const avgReliability =
    rate.sources.reduce((sum, s) => sum + s.reliability, 0) / rate.sources.length;
  const sourceCountFactor = Math.min(rate.sources.length / 3, 1); // max at 3+ sources
  const enrichmentConfidence =
    Math.round(avgReliability * sourceCountFactor * 100) / 100;

  const marketData: MarketEnrichment = {
    sources: rate.sources,
    marketAvg: rate.avgRate,
    marketLow: rate.lowRate,
    marketHigh: rate.highRate,
    trend: rate.trend,
    confidence: enrichmentConfidence,
    percentileVsMarket,
  };

  base.marketData = marketData;

  // ── Savings potential ───────────────────────────────────────────────────
  // Only calculate if current rate exceeds market average by at least 5%
  if (line.unitRate > rate.avgRate * 1.05) {
    const actions = buildSavingsActions(line, rate);

    if (actions.length > 0) {
      // Use the best single action's target rate for the optimized total
      const bestSaving = Math.max(...actions.map((a) => a.estimatedSaving));
      const currentTotal = line.unitRate * line.quantity;
      const optimizedTotal = currentTotal - bestSaving;
      const savingsAmount = Math.round(bestSaving * 100) / 100;
      const savingsPercent =
        currentTotal > 0
          ? Math.round((savingsAmount / currentTotal) * 10000) / 100
          : 0;

      base.savingsPotential = {
        currentTotal: Math.round(currentTotal * 100) / 100,
        optimizedTotal: Math.round(optimizedTotal * 100) / 100,
        savingsAmount,
        savingsPercent,
        difficulty: determineDifficulty(savingsPercent),
        actions,
      };
    }
  }

  return base;
}

// =============================================================================
// ENRICHMENT — BATCH
// =============================================================================

export function enrichBudgetLines(
  lines: ExtractedBudgetLine[],
): EnrichedBudgetLine[] {
  return lines.map(enrichBudgetLine);
}
