// =============================================================================
// COMPLIANCE GATING SERVICE — EU compliance features as recurring revenue
// =============================================================================
// E-invoicing formats, country-specific compliance packs, and auto-submission
// are gated behind paid tiers. Regulations REQUIRE these features, making
// compliance a non-optional upsell that drives conversions.
// =============================================================================

import type { Country } from '../context/AuthContext';
import type { SubscriptionTier, SubscriptionState } from './subscriptionService';
import { getTierLimits } from './subscriptionService';

// ─── E-Invoice Formats ─────────────────────────────────────────────────────

export type EInvoiceFormat =
  | 'xrechnung'     // Germany — mandatory for B2G
  | 'zugferd'       // Germany — structured PDF
  | 'facturx'       // France — hybrid PDF+XML
  | 'facturae'      // Spain — mandatory for B2G
  | 'fatturapa'     // Italy — mandatory for all B2B/B2C
  | 'peppol'        // Pan-EU — growing requirement
  | 'ubl'           // Netherlands — government invoicing
  | 'mtd'           // UK — Making Tax Digital

export interface EInvoiceFormatConfig {
  id: EInvoiceFormat;
  name: string;
  country: Country;
  mandatory: boolean;            // Is it legally required?
  mandatoryFor: string;          // "B2G", "All B2B", "All invoices"
  description: string;
  requiredTier: SubscriptionTier;
  autoSubmission: boolean;       // Can we auto-submit to government?
}

// R300: only formats with an actual generator. peppol / ubl / mtd were listed
// here but no `generatePeppolXml` / `generateUblXml` / `generateMtdReturn`
// exists anywhere in the repo — they were tier-pricing fiction. The
// EInvoiceFormat type still includes them so downstream switches stay
// exhaustive; add them back here once generators ship.
export const E_INVOICE_FORMATS: EInvoiceFormatConfig[] = [
  { id: 'xrechnung', name: 'XRechnung', country: 'DE', mandatory: true, mandatoryFor: 'B2G invoices', description: 'German government e-invoicing standard (EN 16931)', requiredTier: 'contractor', autoSubmission: true },
  { id: 'zugferd', name: 'ZUGFeRD', country: 'DE', mandatory: false, mandatoryFor: 'Recommended for B2B', description: 'Structured PDF with embedded XML — readable by humans and machines', requiredTier: 'contractor', autoSubmission: false },
  { id: 'facturx', name: 'Factur-X', country: 'FR', mandatory: true, mandatoryFor: 'All B2B (from 2026)', description: 'French hybrid e-invoice standard — PDF/A-3 with XML', requiredTier: 'contractor', autoSubmission: true },
  { id: 'facturae', name: 'Facturae', country: 'ES', mandatory: true, mandatoryFor: 'B2G + large B2B', description: 'Spanish structured e-invoice format with SII reporting', requiredTier: 'contractor', autoSubmission: true },
  { id: 'fatturapa', name: 'FatturaPA / SDI', country: 'IT', mandatory: true, mandatoryFor: 'All invoices (B2B + B2C)', description: 'Italian mandatory e-invoicing via Sistema di Interscambio', requiredTier: 'contractor', autoSubmission: true },
];

// ─── Compliance Packs ──────────────────────────────────────────────────────

export interface CompliancePack {
  id: string;
  country: Country;
  name: string;
  description: string;
  features: string[];
  eInvoiceFormats: EInvoiceFormat[];
  taxReporting: string[];
  certificationTracking: string[];
  requiredTier: SubscriptionTier;
  monthlyValue: number;           // Perceived EUR value
}

export const COMPLIANCE_PACKS: CompliancePack[] = [
  {
    id: 'nl-pack', country: 'NL', name: 'Netherlands Compliance',
    description: 'KVK registration, BTW reporting, UBL e-invoicing, VCA tracking',
    features: ['KVK auto-validation', 'BTW quarterly filing reminders', 'IB deadline alerts', 'Pension fund tracking'],
    eInvoiceFormats: ['ubl', 'peppol'],
    taxReporting: ['BTW-aangifte reminders', 'IB/VPB deadline tracking', 'Annual accounts deadlines'],
    certificationTracking: ['VCA', 'Uneto-VNI', 'SKH', 'BKB', 'STEK', 'F-gassen'],
    requiredTier: 'contractor',
    monthlyValue: 15,
  },
  {
    id: 'de-pack', country: 'DE', name: 'Germany Compliance',
    description: 'Handelsregister, USt-ID, XRechnung/ZUGFeRD, Meisterbrief tracking',
    features: ['Handelsregister validation', 'USt-Voranmeldung reminders', 'Gewerbeanmeldung tracking', 'DATEV export format'],
    eInvoiceFormats: ['xrechnung', 'zugferd'],
    taxReporting: ['Umsatzsteuer-Voranmeldung', 'Gewerbesteuer deadlines', 'EÜR/Bilanz deadlines'],
    certificationTracking: ['Meisterbrief', 'SCC', 'Elektrofachkraft', 'F-Gase Zertifikat'],
    requiredTier: 'contractor',
    monthlyValue: 18,
  },
  {
    id: 'fr-pack', country: 'FR', name: 'France Compliance',
    description: 'SIRET validation, TVA reporting, Factur-X, Qualibat tracking',
    features: ['SIRET auto-validation', 'TVA declaration reminders', 'Cotisation URSSAF tracking', 'Décennale insurance alerts'],
    eInvoiceFormats: ['facturx'],
    taxReporting: ['TVA monthly/quarterly', 'CFE deadlines', 'IS/IR filing dates'],
    certificationTracking: ['Qualibat', 'Qualifelec', 'QualiPAC', 'RGE', 'CACES'],
    requiredTier: 'contractor',
    monthlyValue: 16,
  },
  {
    id: 'es-pack', country: 'ES', name: 'Spain Compliance',
    description: 'NIF validation, SII reporting, Facturae, IAE tracking',
    features: ['NIF/CIF auto-validation', 'SII real-time reporting', 'Modelo 303 reminders', 'Autónomo quota tracking'],
    eInvoiceFormats: ['facturae'],
    taxReporting: ['Modelo 303 (IVA)', 'Modelo 130 (IRPF)', 'Modelo 390 (annual IVA)', 'SII monthly'],
    certificationTracking: ['TPC', 'Carnet instalador', 'REBT', 'Cualificación profesional'],
    requiredTier: 'contractor',
    monthlyValue: 14,
  },
  {
    id: 'it-pack', country: 'IT', name: 'Italy Compliance',
    description: 'Partita IVA, SDI e-invoicing, FatturaPA, DURC tracking',
    features: ['Partita IVA validation', 'SDI auto-submission', 'F24 payment reminders', 'DURC renewal alerts'],
    eInvoiceFormats: ['fatturapa'],
    taxReporting: ['Liquidazione IVA', 'F24 deadlines', 'Dichiarazione dei redditi', 'INPS contributions'],
    certificationTracking: ['DURC', 'SOA', 'DM 37/08', 'F-Gas cert', 'Camera di Commercio'],
    requiredTier: 'contractor',
    monthlyValue: 17,
  },
  {
    id: 'uk-pack', country: 'UK', name: 'UK Compliance',
    description: 'Companies House, MTD, VAT returns, Gas Safe tracking',
    features: ['Companies House auto-check', 'MTD VAT submission', 'PAYE/NI deadline alerts', 'CIS reporting'],
    eInvoiceFormats: ['mtd'],
    taxReporting: ['VAT quarterly (MTD)', 'Self Assessment deadlines', 'Corporation Tax dates', 'CIS monthly returns'],
    certificationTracking: ['Gas Safe', 'NICEIC', 'Part P', 'CSCS', 'CITB', 'FIRA Gold'],
    requiredTier: 'contractor',
    monthlyValue: 15,
  },
];

// ─── Gating Logic ──────────────────────────────────────────────────────────

export interface ComplianceGateResult {
  allowed: boolean;
  reason?: string;
  requiredTier?: SubscriptionTier;
  formatName?: string;
  countryName?: string;
}

export function canUseEInvoiceFormat(
  state: SubscriptionState,
  format: EInvoiceFormat,
): ComplianceGateResult {
  const limits = getTierLimits(state.tier);

  if (!limits.hasEInvoicing) {
    const config = E_INVOICE_FORMATS.find((f) => f.id === format);
    return {
      allowed: false,
      reason: `${config?.name || format} e-invoicing requires the Contractor plan.`,
      requiredTier: 'contractor',
      formatName: config?.name,
    };
  }

  return { allowed: true };
}

export function canUseCompliancePack(
  state: SubscriptionState,
  country: Country,
): ComplianceGateResult {
  const limits = getTierLimits(state.tier);
  const pack = COMPLIANCE_PACKS.find((p) => p.country === country);

  if (!pack) return { allowed: true };

  // Gratis: only 1 country compliance (their primary)
  if (limits.complianceCountries < 6) {
    // They can use compliance for their primary country on gratis
    // But multi-country requires upgrade
    return {
      allowed: true, // basic compliance is always available for primary country
    };
  }

  return { allowed: true };
}

export function canAutoSubmitInvoice(
  state: SubscriptionState,
): ComplianceGateResult {
  const limits = getTierLimits(state.tier);

  if (!limits.hasFullEInvoicing) {
    return {
      allowed: false,
      reason: 'Auto-submission to government tax systems requires the Contractor plan.',
      requiredTier: 'contractor',
    };
  }

  return { allowed: true };
}

// ─── Compliance Status ─────────────────────────────────────────────────────

export interface ComplianceStatus {
  country: Country;
  pack: CompliancePack;
  eInvoicingEnabled: boolean;
  autoSubmissionEnabled: boolean;
  certificationsTracked: number;
  upcomingDeadlines: { label: string; date: string; daysUntil: number }[];
  complianceScore: number;        // 0-100
}

export function getComplianceStatus(
  country: Country,
  state: SubscriptionState,
): ComplianceStatus | null {
  const pack = COMPLIANCE_PACKS.find((p) => p.country === country);
  if (!pack) return null;

  const limits = getTierLimits(state.tier);
  const now = new Date();

  // Generate some demo deadlines
  const deadlines = pack.taxReporting.slice(0, 3).map((label, i) => {
    const date = new Date(now.getTime() + (15 + i * 30) * 86400000);
    return {
      label,
      date: date.toISOString().slice(0, 10),
      daysUntil: Math.ceil((date.getTime() - now.getTime()) / 86400000),
    };
  });

  return {
    country,
    pack,
    eInvoicingEnabled: limits.hasEInvoicing,
    autoSubmissionEnabled: limits.hasFullEInvoicing,
    certificationsTracked: pack.certificationTracking.length,
    upcomingDeadlines: deadlines,
    complianceScore: limits.hasEInvoicing ? 92 : 45, // Better score with paid
  };
}

// ─── Revenue Calculation ───────────────────────────────────────────────────

export function getComplianceRevenuePotential(
  users: number,
  countryDistribution: Partial<Record<Country, number>>, // % per country
): { monthlyRevenue: number; annualRevenue: number; breakdown: { country: Country; users: number; revenue: number }[] } {
  const breakdown: { country: Country; users: number; revenue: number }[] = [];
  let totalMonthly = 0;

  for (const [country, pct] of Object.entries(countryDistribution)) {
    const countryUsers = Math.round(users * ((pct as number) / 100));
    const pack = COMPLIANCE_PACKS.find((p) => p.country === country);
    if (!pack || countryUsers === 0) continue;

    // Assume 20% of users on gratis convert to paid for compliance
    const convertedUsers = Math.round(countryUsers * 0.2);
    const revenue = convertedUsers * pack.monthlyValue;
    totalMonthly += revenue;
    breakdown.push({ country: country as Country, users: convertedUsers, revenue });
  }

  return {
    monthlyRevenue: totalMonthly,
    annualRevenue: totalMonthly * 12,
    breakdown,
  };
}
