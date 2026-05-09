// =============================================================================
// BUSINESS PROFILE VALIDATION
// =============================================================================
// Returns the list of fields a contractor MUST fill before they can legally
// send an invoice in their country. Use this before any send-invoice flow
// to block non-compliant invoices going out.
// =============================================================================

import type { BusinessProfile } from '../domain/business';
import { isValidVATNumber, isValidKvKNumber, isValidIBAN } from './validation';
import i18n from '../i18n/i18n';

type Country = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK';

export interface ProfileReadiness {
  ready: boolean;
  missing: string[];        // Translation keys (use with i18n.t)
  missingLabels: string[];  // Fallback English labels
  // R66 round 39: format errors are distinct from "missing". A contractor
  // who typed "123.456.789.B.01" passed the non-empty check pre-R39 — but
  // that BTW is malformed (correct: "NL123456789B01") and Belastingdienst
  // rejects it. Same shape applies to KvK + IBAN.
  invalid: string[];        // Translation keys for malformed entries
  invalidLabels: string[];  // Fallback English labels with format hint
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
  const invalid: string[] = [];
  const invalidLabels: string[] = [];
  for (const f of fields) {
    if (!has(f.get(profile))) {
      missing.push(f.key);
      missingLabels.push(f.label);
    }
  }
  // R66 round 39: format validation. Pre-R39 only checked non-empty —
  // contractor could persist `123.456.789.B.01` (malformed BTW), pass the
  // gate, ship a non-compliant invoice, and only learn it failed when the
  // customer's accountant rejected the VAT reclaim. Same for IBAN (banks
  // tolerate spaces but Mollie/SEPA require canonical form) and KvK.
  // Country-specific format rules live in src/utils/validation.ts (R66r3
  // mod-97 IBAN + per-country VAT regex).
  const btw = profile.vatNumber?.trim();
  if (btw && !isValidVATNumber(btw)) {
    invalid.push('profile.vatFormatInvalid');
    invalidLabels.push(i18n.t('profile.vatFormatInvalid', {
      defaultValue: 'VAT number format invalid (expected e.g. {{example}})',
      example: vatFormatExample(profile.country),
    }));
  }
  const kvkOrReg = (profile.kvkNumber ?? profile.registrationNumber)?.trim();
  if (kvkOrReg && profile.country === 'NL' && !isValidKvKNumber(kvkOrReg)) {
    invalid.push('profile.kvkFormatInvalid');
    invalidLabels.push(i18n.t('profile.kvkFormatInvalid', { defaultValue: 'KvK number must be 8 digits' }));
  }
  const iban = profile.iban?.trim();
  if (iban && !isValidIBAN(iban)) {
    invalid.push('profile.ibanFormatInvalid');
    invalidLabels.push(i18n.t('profile.ibanFormatInvalid', { defaultValue: 'IBAN checksum invalid (check for typos)' }));
  }
  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    missingLabels,
    invalid,
    invalidLabels,
  };
}

function vatFormatExample(country: Country | undefined): string {
  switch (country) {
    case 'NL': return 'NL123456789B01';
    case 'DE': return 'DE123456789';
    case 'FR': return 'FR12345678901';
    case 'ES': return 'ESA12345678';
    case 'IT': return 'IT12345678901';
    case 'UK': return 'GB123456789';
    default:   return 'XX123456789';
  }
}
