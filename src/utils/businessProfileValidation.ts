// =============================================================================
// BUSINESS PROFILE VALIDATION
// =============================================================================
// Returns the list of fields a contractor MUST fill before they can legally
// send an invoice in their country. Use this before any send-invoice flow
// to block non-compliant invoices going out.
// =============================================================================

import type { BusinessProfile } from '../domain/business';

type Country = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';

export interface ProfileReadiness {
  ready: boolean;
  missing: string[];        // Translation keys (use with i18n.t)
  missingLabels: string[];  // Fallback English labels
}

function has(value: string | undefined | null): boolean {
  return Boolean(value && value.trim().length > 0);
}

/**
 * Fields required by law for invoicing in each EU6 country.
 * Source: national tax authority invoicing rules.
 */
export function getRequiredFields(country: Country | undefined): Array<{ key: string; label: string; get: (p: BusinessProfile) => string | undefined }> {
  const base: Array<{ key: string; label: string; get: (p: BusinessProfile) => string | undefined }> = [
    { key: 'profile.businessName',        label: 'Business name',        get: (p) => p.businessName },
    { key: 'profile.address',             label: 'Business address',     get: (p) => p.address },
  ];
  switch (country) {
    case 'NL':
      return [
        ...base,
        { key: 'profile.kvkNumber',       label: 'KvK number',           get: (p) => p.kvkNumber ?? p.registrationNumber },
        { key: 'profile.vatNumberBtw',    label: 'BTW number',           get: (p) => p.vatNumber },
      ];
    case 'DE':
      return [
        ...base,
        { key: 'profile.registrationHrb', label: 'HRB number',           get: (p) => p.registrationNumber ?? p.kvkNumber },
        { key: 'profile.vatNumberUst',    label: 'USt-IdNr',             get: (p) => p.vatNumber },
      ];
    case 'FR':
      return [
        ...base,
        { key: 'profile.registrationSiret', label: 'SIRET',              get: (p) => p.registrationNumber ?? p.kvkNumber },
        { key: 'profile.vatNumberTva',    label: 'TVA number',           get: (p) => p.vatNumber },
      ];
    case 'ES':
      return [
        ...base,
        { key: 'profile.vatNumberNif',    label: 'NIF/CIF',              get: (p) => p.vatNumber },
      ];
    case 'IT':
      return [
        ...base,
        { key: 'profile.vatNumberPiva',   label: 'Partita IVA',          get: (p) => p.vatNumber },
      ];
    case 'UK':
      return [
        ...base,
        { key: 'profile.registrationCoNo', label: 'Company number',      get: (p) => p.registrationNumber ?? p.kvkNumber },
        { key: 'profile.vatNumber',       label: 'VAT number',           get: (p) => p.vatNumber },
      ];
    default:
      return base;
  }
}

/** Evaluate whether the profile can legally invoice in its country. */
export function checkInvoiceReadiness(profile: BusinessProfile): ProfileReadiness {
  const fields = getRequiredFields(profile.country);
  const missing: string[] = [];
  const missingLabels: string[] = [];
  for (const f of fields) {
    if (!has(f.get(profile))) {
      missing.push(f.key);
      missingLabels.push(f.label);
    }
  }
  return { ready: missing.length === 0, missing, missingLabels };
}
