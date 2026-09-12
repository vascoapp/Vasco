/**
 * Statutory record-retention periods, per market.
 *
 * The Profil screen used to render ONE hardcoded sentence —
 * "Invoices 7 years · Contracts 7 years · Customer data 2 years · Personnel
 * data 5 years" — translated into all six languages. Those are the DUTCH
 * figures, so every other market was told the wrong period **in its own
 * language**, by a product that sells itself on compliance:
 *
 *   DE  invoices 10 years (§14b UStG, §257 HGB) — shown as 7
 *   FR  invoices 10 years (Code de commerce L123-22) — shown as 7
 *   IT  invoices 10 years (Codice Civile art. 2220) — shown as 7
 *   ES  invoices 6 years (Código de Comercio art. 30) — shown as 7
 *   NL  invoices 7 years — the only one that was right
 *
 * The correct numbers already existed in `src/types/*-compliance.ts`; the
 * notice simply never read them.
 *
 * ⚠️ Each market lists only the categories ITS OWN law defines. Germany's set
 * has no customer-data period, so the German notice does not claim one —
 * inventing a figure is exactly the failure this file exists to fix. Markets
 * with no retention constants at all (UK, US) render no notice rather than a
 * borrowed one.
 */
import type { Country } from '../context/AuthContext';
import { DUTCH_RETENTION_PERIODS } from '../types/dutch-compliance';
import { GERMAN_RETENTION_PERIODS } from '../types/german-compliance';
import { FRENCH_RETENTION_PERIODS } from '../types/french-compliance';
import { ITALIAN_RETENTION_PERIODS } from '../types/italian-compliance';
import { SPANISH_RETENTION_PERIODS } from '../types/spanish-compliance';

/** A retention row: which i18n label, and how many YEARS. */
export interface RetentionEntry {
  /** i18n key under `profile.retention.*`. */
  labelKey: string;
  years: number;
}

const days = (d: number) => Math.round(d / 365);

const NL: RetentionEntry[] = [
  { labelKey: 'invoices', years: days(DUTCH_RETENTION_PERIODS.invoices) },
  { labelKey: 'contracts', years: days(DUTCH_RETENTION_PERIODS.contracts) },
  { labelKey: 'customerData', years: days(DUTCH_RETENTION_PERIODS.customerData) },
  { labelKey: 'personnel', years: days(DUTCH_RETENTION_PERIODS.employeeRecords) },
];

const DE: RetentionEntry[] = [
  { labelKey: 'invoices', years: days(GERMAN_RETENTION_PERIODS.rechnungen) },
  { labelKey: 'contracts', years: days(GERMAN_RETENTION_PERIODS.vertraege) },
  { labelKey: 'businessLetters', years: days(GERMAN_RETENTION_PERIODS.geschaeftsbriefe) },
  { labelKey: 'personnel', years: days(GERMAN_RETENTION_PERIODS.lohnunterlagen) },
];

const FR: RetentionEntry[] = [
  { labelKey: 'invoices', years: days(FRENCH_RETENTION_PERIODS.invoices) },
  { labelKey: 'contracts', years: days(FRENCH_RETENTION_PERIODS.contracts) },
  { labelKey: 'customerData', years: days(FRENCH_RETENTION_PERIODS.customerData) },
  { labelKey: 'personnel', years: days(FRENCH_RETENTION_PERIODS.employeeRecords) },
];

const IT: RetentionEntry[] = [
  { labelKey: 'invoices', years: days(ITALIAN_RETENTION_PERIODS.invoices) },
  { labelKey: 'contracts', years: days(ITALIAN_RETENTION_PERIODS.contracts) },
  { labelKey: 'customerData', years: days(ITALIAN_RETENTION_PERIODS.customerData) },
  { labelKey: 'personnel', years: days(ITALIAN_RETENTION_PERIODS.employeeRecords) },
];

const ES: RetentionEntry[] = [
  { labelKey: 'invoices', years: days(SPANISH_RETENTION_PERIODS.invoices) },
  { labelKey: 'contracts', years: days(SPANISH_RETENTION_PERIODS.contracts) },
  { labelKey: 'customerData', years: days(SPANISH_RETENTION_PERIODS.customerData) },
  { labelKey: 'personnel', years: days(SPANISH_RETENTION_PERIODS.employeeRecords) },
];

const BY_COUNTRY: Partial<Record<Country, RetentionEntry[]>> = {
  NL, DE, FR, IT, ES,
};

/**
 * Retention rows for a market, or `[]` where this codebase holds no statutory
 * figures for it. An empty list means render nothing — a borrowed period is
 * worse than no claim.
 */
export function retentionPeriodsFor(country: Country | undefined): RetentionEntry[] {
  if (!country) return [];
  return BY_COUNTRY[country] ?? [];
}
