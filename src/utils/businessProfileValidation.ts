// =============================================================================
// BUSINESS PROFILE VALIDATION
// =============================================================================
// Returns the list of fields a contractor MUST fill before they can legally
// send an invoice in their country. Use this before any send-invoice flow
// to block non-compliant invoices going out.
// =============================================================================

import type { BusinessProfile } from '../domain/business';
import { isValidVATNumber, isValidKvKNumber, isValidIBAN, isValidSIRET, isValidPartitaIVA } from './validation';
import i18n from '../i18n/i18n';

// R74: US widened in. Country-specific validation rules (EIN format, no
// VAT field, etc.) added incrementally per the US expansion plan.
type Country = 'NL' | 'DE' | 'FR' | 'ES' | 'IT' | 'UK' | 'US';

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
      // Phone, email, city and post code are required HERE and not elsewhere
      // because XRechnung demands them and Germany is the only market where a
      // structured e-invoice is already the norm: BR-DE-5/6/7 make the seller
      // contact name, telephone and email mandatory (BT-41/42/43), and
      // BR-DE-8/9 the address detail.
      //
      // Without this gate a German contractor completes their profile, exports
      // an XRechnung, and it is rejected at the buyer's gateway for a field the
      // app never asked them for. The rejection arrives days later, from a
      // system they cannot see, phrased as "BR-DE-6".
      return [
        ...base,
        { key: 'profile.registrationHrb', label: 'HRB number',           get: (p) => p.registrationNumber ?? p.kvkNumber },
        { key: 'profile.vatNumberUst',    label: 'USt-IdNr',             get: (p) => p.vatNumber },
        { key: 'profile.city',            label: 'City',                 get: (p) => p.city },
        { key: 'profile.postcode',        label: 'Post code',            get: (p) => p.postcode },
        { key: 'profile.phone',           label: 'Phone',                get: (p) => p.phone },
        { key: 'profile.email',           label: 'Email',                get: (p) => p.email },
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
  // The registration number, per country. This used to run for NL alone, so
  // every other market's number was accepted on "non-empty" — the exact state
  // R66r39 removed for the Dutch BTW after a malformed one reached a customer's
  // accountant. France is the one that mattered: `getRequiredFields` DEMANDS a
  // SIRET and nothing looked at it.
  const kvkOrReg = (profile.kvkNumber ?? profile.registrationNumber)?.trim();
  if (kvkOrReg && profile.country === 'NL' && !isValidKvKNumber(kvkOrReg)) {
    invalid.push('profile.kvkFormatInvalid');
    invalidLabels.push(i18n.t('profile.kvkFormatInvalid', { defaultValue: 'KvK number must be 8 digits' }));
  }
  if (kvkOrReg && profile.country === 'FR' && !isValidSIRET(kvkOrReg)) {
    invalid.push('profile.siretFormatInvalid');
    invalidLabels.push(i18n.t('profile.siretFormatInvalid', {
      defaultValue: 'SIRET must be 14 digits (or a 9-digit SIREN) and pass its checksum',
    }));
  }
  // Italy: the shape check above already enforces IT + 11 digits. This adds the
  // CHECK DIGIT, which is what separates a typo from a real partita IVA — and a
  // wrong one goes out on every FatturaPA, where SDI validates it.
  const piva = profile.vatNumber?.trim();
  if (piva && profile.country === 'IT' && isValidVATNumber(piva) && !isValidPartitaIVA(piva)) {
    invalid.push('profile.partitaIvaChecksumInvalid');
    invalidLabels.push(i18n.t('profile.partitaIvaChecksumInvalid', {
      defaultValue: 'Partita IVA checksum invalid (check for typos)',
    }));
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
