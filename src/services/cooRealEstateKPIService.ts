// =============================================================================
// COO REAL ESTATE KPI SERVICE
// =============================================================================
// CRE-aligned KPIs for the COO dashboard across 4 pillars:
// Financial Performance, Operational Efficiency, Stakeholder & Market, Emerging
// =============================================================================

import { useMemo } from 'react';

// =============================================================================
// INTERFACES
// =============================================================================

export interface FinancialPerformanceKPIs {
  irr: number;                 // Internal Rate of Return %
  noi: number;                 // Net Operating Income (currency)
  operatingMargin: number;     // Operating Margin %
  gaExpenseRatio: number;      // G&A Expense Ratio %
  ebitda: number;              // EBITDA (currency)
  equityIrr: number;           // Equity IRR %
  irrVariance: number;         // vs plan
  noiVariance: number;         // vs plan
  marginVariance: number;      // vs plan
  currency: string;
}

export interface OperationalEfficiencyKPIs {
  avgConstructionDuration: number;   // months
  plannedDuration: number;           // months
  monthsToBreakeven: number;
  opExRatio: number;                 // %
  maintenanceCostPerSqft: number;    // currency/sqft
  assetUtilization: number;          // %
  spiIndex: number;
  currency: string;
}

export interface StakeholderMarketKPIs {
  occupancyRate: number;        // %
  tenantRetention: number;      // %
  avgDaysOnMarket: number;
  leaseUpVelocity: number;     // units/month
  esgEnergyRating: string;     // A-G
  esgEnergyScore: number;      // 0-100
  esgWaterPerSqft: number;     // litres/sqft
  esgCarbonEmissions: number;  // tonnes CO2
  breeamTarget: string;        // e.g. "Excellent"
  breeamActual: number;        // 0-100 score
  currency: string;
}

export interface EmergingPrioritiesKPIs {
  precisionScore: number;       // 0-100
  planAdherence: number;        // %
  decisionAccuracy: number;     // %
  flexSpacePercent: number;     // %
  coreSpacePercent: number;     // %
  flexUtilization: number;      // %
  flexRevenuePerSqft: number;
  coreRevenuePerSqft: number;
  tenantNps: number;            // -100 to 100
  smartFeatureAdoption: number; // %
  amenityUtilization: number;   // %
  digitalMaturity: number;      // 0-100
  sustainabilityScore: number;  // 0-100
  predictiveMaintenance: PredictiveMaintenanceItem[];
  currency: string;
}

export interface PredictiveMaintenanceItem {
  equipment: string;
  failureProbability: number;   // %
  estimatedCostSaving: number;
  daysUntilFailure: number;
  severity: 'high' | 'medium' | 'low';
}

// =============================================================================
// MOCK DATA PER PROJECT
// =============================================================================

const financialData: Record<string, FinancialPerformanceKPIs> = {
  'uk-001': {
    irr: 18.2, noi: 11_300_000, operatingMargin: 16.4,
    gaExpenseRatio: 4.2, ebitda: 9_800_000, equityIrr: 22.1,
    irrVariance: 1.4, noiVariance: 800_000, marginVariance: 0.8,
    currency: 'GBP',
  },
  'nl-001': {
    irr: 15.6, noi: 8_700_000, operatingMargin: 14.8,
    gaExpenseRatio: 5.1, ebitda: 7_200_000, equityIrr: 19.3,
    irrVariance: -0.6, noiVariance: -300_000, marginVariance: -0.4,
    currency: 'EUR',
  },
  'de-001': {
    irr: 12.8, noi: 6_200_000, operatingMargin: 13.1,
    gaExpenseRatio: 5.8, ebitda: 5_100_000, equityIrr: 16.4,
    irrVariance: -1.2, noiVariance: -500_000, marginVariance: -1.1,
    currency: 'EUR',
  },
};

const efficiencyData: Record<string, OperationalEfficiencyKPIs> = {
  'uk-001': {
    avgConstructionDuration: 18, plannedDuration: 16,
    monthsToBreakeven: 24, opExRatio: 32.5,
    maintenanceCostPerSqft: 4.20, assetUtilization: 87,
    spiIndex: 0.94, currency: 'GBP',
  },
  'nl-001': {
    avgConstructionDuration: 14, plannedDuration: 14,
    monthsToBreakeven: 20, opExRatio: 28.3,
    maintenanceCostPerSqft: 3.80, assetUtilization: 91,
    spiIndex: 1.02, currency: 'EUR',
  },
  'de-001': {
    avgConstructionDuration: 22, plannedDuration: 18,
    monthsToBreakeven: 30, opExRatio: 36.1,
    maintenanceCostPerSqft: 5.10, assetUtilization: 82,
    spiIndex: 0.86, currency: 'EUR',
  },
};

const stakeholderData: Record<string, StakeholderMarketKPIs> = {
  'uk-001': {
    occupancyRate: 93, tenantRetention: 85,
    avgDaysOnMarket: 28, leaseUpVelocity: 4.2,
    esgEnergyRating: 'B', esgEnergyScore: 78,
    esgWaterPerSqft: 12.3, esgCarbonEmissions: 420,
    breeamTarget: 'Excellent', breeamActual: 72,
    currency: 'GBP',
  },
  'nl-001': {
    occupancyRate: 91, tenantRetention: 88,
    avgDaysOnMarket: 22, leaseUpVelocity: 3.8,
    esgEnergyRating: 'A', esgEnergyScore: 86,
    esgWaterPerSqft: 9.8, esgCarbonEmissions: 310,
    breeamTarget: 'Outstanding', breeamActual: 81,
    currency: 'EUR',
  },
  'de-001': {
    occupancyRate: 88, tenantRetention: 79,
    avgDaysOnMarket: 35, leaseUpVelocity: 2.9,
    esgEnergyRating: 'C', esgEnergyScore: 62,
    esgWaterPerSqft: 15.1, esgCarbonEmissions: 580,
    breeamTarget: 'Very Good', breeamActual: 58,
    currency: 'EUR',
  },
};

const emergingData: Record<string, EmergingPrioritiesKPIs> = {
  'uk-001': {
    precisionScore: 82, planAdherence: 91, decisionAccuracy: 87,
    flexSpacePercent: 22, coreSpacePercent: 78,
    flexUtilization: 74, flexRevenuePerSqft: 48, coreRevenuePerSqft: 32,
    tenantNps: 72, smartFeatureAdoption: 64, amenityUtilization: 71,
    digitalMaturity: 68, sustainabilityScore: 74,
    currency: 'GBP',
    predictiveMaintenance: [
      { equipment: 'HVAC Unit B3', failureProbability: 78, estimatedCostSaving: 45_000, daysUntilFailure: 14, severity: 'high' },
      { equipment: 'Elevator #2', failureProbability: 45, estimatedCostSaving: 28_000, daysUntilFailure: 42, severity: 'medium' },
      { equipment: 'Fire Pump A', failureProbability: 32, estimatedCostSaving: 15_000, daysUntilFailure: 60, severity: 'low' },
    ],
  },
  'nl-001': {
    precisionScore: 88, planAdherence: 94, decisionAccuracy: 91,
    flexSpacePercent: 28, coreSpacePercent: 72,
    flexUtilization: 81, flexRevenuePerSqft: 42, coreRevenuePerSqft: 28,
    tenantNps: 68, smartFeatureAdoption: 72, amenityUtilization: 68,
    digitalMaturity: 76, sustainabilityScore: 82,
    currency: 'EUR',
    predictiveMaintenance: [
      { equipment: 'Warmtepomp Zone C', failureProbability: 52, estimatedCostSaving: 32_000, daysUntilFailure: 28, severity: 'medium' },
      { equipment: 'Ventilatie Systeem', failureProbability: 38, estimatedCostSaving: 18_000, daysUntilFailure: 55, severity: 'low' },
      { equipment: 'Sprinkler Valve A', failureProbability: 22, estimatedCostSaving: 8_500, daysUntilFailure: 90, severity: 'low' },
    ],
  },
  'de-001': {
    precisionScore: 71, planAdherence: 82, decisionAccuracy: 78,
    flexSpacePercent: 15, coreSpacePercent: 85,
    flexUtilization: 62, flexRevenuePerSqft: 38, coreRevenuePerSqft: 26,
    tenantNps: 61, smartFeatureAdoption: 48, amenityUtilization: 55,
    digitalMaturity: 52, sustainabilityScore: 58,
    currency: 'EUR',
    predictiveMaintenance: [
      { equipment: 'Heizkessel Ost', failureProbability: 85, estimatedCostSaving: 52_000, daysUntilFailure: 8, severity: 'high' },
      { equipment: 'Aufzug #1', failureProbability: 61, estimatedCostSaving: 35_000, daysUntilFailure: 21, severity: 'high' },
      { equipment: 'Lüftung B-Flügel', failureProbability: 29, estimatedCostSaving: 12_000, daysUntilFailure: 70, severity: 'low' },
    ],
  },
};

// =============================================================================
// HOOKS
// =============================================================================

export function useFinancialPerformance(projectId: string): FinancialPerformanceKPIs {
  return useMemo(() => financialData[projectId] || financialData['uk-001'], [projectId]);
}

export function useOperationalEfficiency(projectId: string): OperationalEfficiencyKPIs {
  return useMemo(() => efficiencyData[projectId] || efficiencyData['uk-001'], [projectId]);
}

export function useStakeholderMarket(projectId: string): StakeholderMarketKPIs {
  return useMemo(() => stakeholderData[projectId] || stakeholderData['uk-001'], [projectId]);
}

export function useEmergingPriorities(projectId: string): EmergingPrioritiesKPIs {
  return useMemo(() => emergingData[projectId] || emergingData['uk-001'], [projectId]);
}
