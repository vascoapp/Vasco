/**
 * How long a contractor must keep issued invoices — THEIR duty, not Vasco's.
 *
 * Shown before account deletion (export, then delete — user's decision
 * 2026-09-24): Vasco deletes everything with the account, so the contractor
 * must have their records first.
 *
 * ONE source: src/data/retentionPeriods.ts (the per-market statutory table the
 * Profile screen already shows, built from src/types/*-compliance.ts). A
 * market without its own figure → null: say "the period your tax law
 * requires", never a number borrowed from another country.
 */
import type { Country } from '../context/AuthContext';
import { retentionPeriodsFor } from '../data/retentionPeriods';

export function invoiceRetentionYears(country: string | null | undefined): number | null {
  if (!country) return null;
  const row = retentionPeriodsFor(country.toUpperCase() as Country).find((r) => r.labelKey === 'invoices');
  return row ? row.years : null;
}
