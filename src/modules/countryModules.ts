// BuildOS Europe - Country Modules
// Tax calculators, permit clocks, and compliance rules for UK, NL, DE

import { Country, Currency } from '../types/buildos';

// ============================================
// TAX CALCULATORS
// ============================================

/**
 * UK Stamp Duty Land Tax (SDLT) for non-residential property
 * Rates as of 2024: 0% up to £150k, 2% on £150k-£250k, 5% above £250k
 */
export function calculateUKSDLT(purchasePrice: number): {
  totalTax: number;
  effectiveRate: number;
  breakdown: { band: string; taxableAmount: number; rate: number; tax: number }[];
} {
  const bands = [
    { threshold: 150000, rate: 0 },
    { threshold: 250000, rate: 0.02 },
    { threshold: Infinity, rate: 0.05 },
  ];

  let remainingValue = purchasePrice;
  let previousThreshold = 0;
  const breakdown: { band: string; taxableAmount: number; rate: number; tax: number }[] = [];
  let totalTax = 0;

  for (const band of bands) {
    const taxableInBand = Math.min(
      Math.max(0, remainingValue),
      band.threshold - previousThreshold
    );

    if (taxableInBand > 0) {
      const tax = taxableInBand * band.rate;
      totalTax += tax;

      breakdown.push({
        band: previousThreshold === 0
          ? `Up to £${band.threshold.toLocaleString()}`
          : `£${previousThreshold.toLocaleString()} - £${band.threshold === Infinity ? '∞' : band.threshold.toLocaleString()}`,
        taxableAmount: taxableInBand,
        rate: band.rate,
        tax,
      });

      remainingValue -= taxableInBand;
    }

    previousThreshold = band.threshold;
    if (remainingValue <= 0) break;
  }

  return {
    totalTax,
    effectiveRate: purchasePrice > 0 ? totalTax / purchasePrice : 0,
    breakdown,
  };
}

/**
 * Netherlands Real Estate Transfer Tax (Overdrachtsbelasting)
 * 10.4% for commercial property, 2% for owner-occupied residential
 */
export function calculateNLRETT(
  purchasePrice: number,
  isResidential: boolean = false
): { totalTax: number; effectiveRate: number } {
  const rate = isResidential ? 0.02 : 0.104;
  return {
    totalTax: purchasePrice * rate,
    effectiveRate: rate,
  };
}

/**
 * Germany Real Estate Transfer Tax (Grunderwerbsteuer)
 * Varies by federal state (Bundesland): 3.5% to 6.5%
 */
export const DE_RETT_RATES: Record<string, number> = {
  'Bayern': 0.035,
  'Sachsen': 0.055,
  'Hamburg': 0.055,
  'Baden-Württemberg': 0.05,
  'Niedersachsen': 0.05,
  'Rheinland-Pfalz': 0.05,
  'Sachsen-Anhalt': 0.05,
  'Berlin': 0.06,
  'Hessen': 0.06,
  'Mecklenburg-Vorpommern': 0.06,
  'Bremen': 0.05,
  'Nordrhein-Westfalen': 0.065,
  'Saarland': 0.065,
  'Schleswig-Holstein': 0.065,
  'Brandenburg': 0.065,
  'Thüringen': 0.065,
};

export function calculateDERETT(
  purchasePrice: number,
  bundesland: string
): { totalTax: number; effectiveRate: number; bundesland: string } {
  const rate = DE_RETT_RATES[bundesland] || 0.05; // Default 5%
  return {
    totalTax: purchasePrice * rate,
    effectiveRate: rate,
    bundesland,
  };
}

/**
 * Universal transfer tax calculator
 */
export type TransferTaxDetails =
  | { breakdown: { band: string; taxableAmount: number; rate: number; tax: number }[] }
  | { bundesland: string }
  | null;

export function calculateTransferTax(
  country: Country,
  purchasePrice: number,
  options?: { bundesland?: string; isResidential?: boolean }
): { totalTax: number; effectiveRate: number; details: TransferTaxDetails } {
  switch (country) {
    case 'UK':
      return { ...calculateUKSDLT(purchasePrice), details: calculateUKSDLT(purchasePrice) };
    case 'NL':
      return { ...calculateNLRETT(purchasePrice, options?.isResidential), details: null };
    case 'DE':
      return {
        ...calculateDERETT(purchasePrice, options?.bundesland || 'Bayern'),
        details: { bundesland: options?.bundesland || 'Bayern' },
      };
  }
}

// ============================================
// PERMIT CLOCK TRACKING
// ============================================

export interface PermitClockConfig {
  country: Country;
  permitType: string;
  standardDays: number;
  extendedDays?: number;
  description: string;
  extensionPossible: boolean;
  appealPossible: boolean;
}

export const PERMIT_CLOCKS: PermitClockConfig[] = [
  // UK
  {
    country: 'UK',
    permitType: 'planning-minor',
    standardDays: 56, // 8 weeks
    description: 'Minor planning applications',
    extensionPossible: true,
    appealPossible: true,
  },
  {
    country: 'UK',
    permitType: 'planning-major',
    standardDays: 91, // 13 weeks
    extendedDays: 182, // 26 weeks (planning guarantee)
    description: 'Major planning applications',
    extensionPossible: true,
    appealPossible: true,
  },
  {
    country: 'UK',
    permitType: 'building-control',
    standardDays: 35, // 5 weeks for full plans
    description: 'Building regulations approval',
    extensionPossible: true,
    appealPossible: false,
  },
  // Netherlands
  {
    country: 'NL',
    permitType: 'omgevingsvergunning-regular',
    standardDays: 56, // 8 weeks
    description: 'Omgevingsvergunning regular procedure',
    extensionPossible: true,
    appealPossible: true,
  },
  {
    country: 'NL',
    permitType: 'omgevingsvergunning-extended',
    standardDays: 182, // 26 weeks / ~6 months
    description: 'Omgevingsvergunning extended procedure',
    extensionPossible: true,
    appealPossible: true,
  },
  // Germany
  {
    country: 'DE',
    permitType: 'baugenehmigung-simplified',
    standardDays: 84, // 12 weeks after completeness
    description: 'Simplified building permit (vereinfachtes Verfahren)',
    extensionPossible: true,
    appealPossible: true,
  },
  {
    country: 'DE',
    permitType: 'baugenehmigung-full',
    standardDays: 91, // 13 weeks typical, but can vary by state
    description: 'Full building permit procedure',
    extensionPossible: true,
    appealPossible: true,
  },
];

export function getPermitClock(country: Country, permitType: string): PermitClockConfig | undefined {
  return PERMIT_CLOCKS.find(
    (clock) => clock.country === country && clock.permitType === permitType
  );
}

export function calculateTargetDecisionDate(
  submissionDate: string,
  country: Country,
  permitType: string,
  useExtended: boolean = false
): { targetDate: string; daysAllowed: number } {
  const clock = getPermitClock(country, permitType);
  if (!clock) {
    throw new Error(`No permit clock found for ${country} - ${permitType}`);
  }

  const days = useExtended && clock.extendedDays ? clock.extendedDays : clock.standardDays;
  const submission = new Date(submissionDate);
  const target = new Date(submission);
  target.setDate(target.getDate() + days);

  return {
    targetDate: target.toISOString().split('T')[0],
    daysAllowed: days,
  };
}

export function calculatePermitStatus(
  submissionDate: string,
  targetDate: string,
  currentDate: string = new Date().toISOString().split('T')[0]
): {
  daysElapsed: number;
  daysRemaining: number;
  percentElapsed: number;
  status: 'on-track' | 'at-risk' | 'overdue';
} {
  const submission = new Date(submissionDate);
  const target = new Date(targetDate);
  const current = new Date(currentDate);

  const totalDays = Math.ceil((target.getTime() - submission.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((current.getTime() - submission.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((target.getTime() - current.getTime()) / (1000 * 60 * 60 * 24));
  const percentElapsed = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 100;

  let status: 'on-track' | 'at-risk' | 'overdue' = 'on-track';
  if (daysRemaining < 0) {
    status = 'overdue';
  } else if (percentElapsed > 75) {
    status = 'at-risk';
  }

  return { daysElapsed, daysRemaining, percentElapsed, status };
}

// ============================================
// COMPLIANCE REQUIREMENTS
// ============================================

export interface ComplianceRequirement {
  country: Country;
  code: string;
  name: string;
  description: string;
  category: 'energy' | 'safety' | 'planning' | 'tax' | 'environmental';
  mandatory: boolean;
  effectiveDate: string;
  threshold?: string;
}

export const COMPLIANCE_REQUIREMENTS: ComplianceRequirement[] = [
  // UK
  {
    country: 'UK',
    code: 'UK-BSA-2022',
    name: 'Building Safety Act',
    description: 'Building Safety Regulator requirements for higher-risk buildings',
    category: 'safety',
    mandatory: true,
    effectiveDate: '2023-10-01',
    threshold: 'Buildings 18m+ or 7+ storeys',
  },
  {
    country: 'UK',
    code: 'UK-MEES',
    name: 'Minimum Energy Efficiency Standards',
    description: 'Non-domestic MEES requirements for EPC ratings',
    category: 'energy',
    mandatory: true,
    effectiveDate: '2023-04-01',
    threshold: 'EPC rating E minimum for letting',
  },
  {
    country: 'UK',
    code: 'UK-S106',
    name: 'Section 106 Obligations',
    description: 'Planning obligations under Town and Country Planning Act 1990',
    category: 'planning',
    mandatory: false, // Site-specific
    effectiveDate: '1990-01-01',
  },
  {
    country: 'UK',
    code: 'UK-CIL',
    name: 'Community Infrastructure Levy',
    description: 'Local authority infrastructure charge',
    category: 'planning',
    mandatory: false, // Depends on local authority
    effectiveDate: '2010-04-06',
  },
  // Netherlands
  {
    country: 'NL',
    code: 'NL-LABEL-C',
    name: 'Office Energy Label C',
    description: 'Minimum energy label C for office buildings >100m²',
    category: 'energy',
    mandatory: true,
    effectiveDate: '2023-01-01',
    threshold: 'Office buildings >100m²',
  },
  {
    country: 'NL',
    code: 'NL-BENG',
    name: 'BENG Requirements',
    description: 'Nearly Energy Neutral Building requirements for new construction',
    category: 'energy',
    mandatory: true,
    effectiveDate: '2021-01-01',
  },
  // Germany
  {
    country: 'DE',
    code: 'DE-GEG',
    name: 'Gebäudeenergiegesetz (GEG)',
    description: 'Building Energy Act - energy requirements for buildings',
    category: 'energy',
    mandatory: true,
    effectiveDate: '2024-01-01',
    threshold: '65% renewable heating for new systems',
  },
  {
    country: 'DE',
    code: 'DE-GRUNDSTEUER',
    name: 'Grundsteuer Reform',
    description: 'Property tax reform with new valuation methodology',
    category: 'tax',
    mandatory: true,
    effectiveDate: '2025-01-01',
  },
];

export function getComplianceRequirements(country: Country): ComplianceRequirement[] {
  return COMPLIANCE_REQUIREMENTS.filter((req) => req.country === country);
}

// ============================================
// CURRENCY & FORMATTING
// ============================================

export function getCurrencyForCountry(country: Country): Currency {
  return country === 'UK' ? 'GBP' : 'EUR';
}

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = currency === 'GBP' ? '£' : '€';
  return `${symbol}${amount.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// ============================================
// FINANCIAL CALCULATIONS
// ============================================

/**
 * Calculate IRR using Newton-Raphson method
 */
export function calculateIRR(cashflows: number[], guess: number = 0.1): number {
  const maxIterations = 100;
  const tolerance = 0.0001;
  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;

    for (let j = 0; j < cashflows.length; j++) {
      const discountFactor = Math.pow(1 + rate, j);
      npv += cashflows[j] / discountFactor;
      if (j > 0) {
        npvDerivative -= (j * cashflows[j]) / Math.pow(1 + rate, j + 1);
      }
    }

    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    if (npvDerivative === 0) {
      break;
    }

    rate = rate - npv / npvDerivative;
  }

  return rate;
}

/**
 * Calculate NPV
 */
export function calculateNPV(cashflows: number[], discountRate: number): number {
  return cashflows.reduce((npv, cf, period) => {
    return npv + cf / Math.pow(1 + discountRate, period);
  }, 0);
}

/**
 * Development appraisal profit calculations
 */
export function calculateDevelopmentProfit(
  gdv: number,
  totalCost: number
): { profitOnCost: number; profitOnGdv: number; profit: number } {
  const profit = gdv - totalCost;
  return {
    profit,
    profitOnCost: totalCost > 0 ? profit / totalCost : 0,
    profitOnGdv: gdv > 0 ? profit / gdv : 0,
  };
}

/**
 * Yield on cost calculation
 */
export function calculateYieldOnCost(
  annualRent: number,
  totalCost: number
): number {
  return totalCost > 0 ? annualRent / totalCost : 0;
}

// ============================================
// KPI CALCULATIONS
// ============================================

/**
 * Schedule Performance Index
 */
export function calculateSPI(earnedValue: number, plannedValue: number): number {
  return plannedValue > 0 ? earnedValue / plannedValue : 0;
}

/**
 * Cost Performance Index
 */
export function calculateCPI(earnedValue: number, actualCost: number): number {
  return actualCost > 0 ? earnedValue / actualCost : 0;
}

/**
 * Estimate at Completion
 */
export function calculateEAC(
  budgetAtCompletion: number,
  cpi: number
): number {
  return cpi > 0 ? budgetAtCompletion / cpi : budgetAtCompletion;
}

/**
 * Estimate to Complete
 */
export function calculateETC(eac: number, actualCost: number): number {
  return Math.max(0, eac - actualCost);
}

/**
 * Variance at Completion
 */
export function calculateVAC(budgetAtCompletion: number, eac: number): number {
  return budgetAtCompletion - eac;
}

/**
 * Cost variance
 */
export function calculateCostVariance(
  currentBudget: number,
  forecastFinal: number
): { variance: number; variancePercent: number; status: 'under' | 'on-budget' | 'over' } {
  const variance = currentBudget - forecastFinal;
  const variancePercent = currentBudget > 0 ? variance / currentBudget : 0;

  let status: 'under' | 'on-budget' | 'over' = 'on-budget';
  if (variancePercent < -0.02) {
    status = 'over';
  } else if (variancePercent > 0.02) {
    status = 'under';
  }

  return { variance, variancePercent, status };
}

/**
 * Schedule variance in days
 */
export function calculateScheduleVariance(
  plannedEnd: string,
  forecastEnd: string
): { varianceDays: number; status: 'ahead' | 'on-track' | 'delayed' } {
  const planned = new Date(plannedEnd);
  const forecast = new Date(forecastEnd);
  const varianceDays = Math.ceil(
    (planned.getTime() - forecast.getTime()) / (1000 * 60 * 60 * 24)
  );

  let status: 'ahead' | 'on-track' | 'delayed' = 'on-track';
  if (varianceDays > 7) {
    status = 'ahead';
  } else if (varianceDays < -7) {
    status = 'delayed';
  }

  return { varianceDays, status };
}
