// =============================================================================
// INPUT VALIDATION — Utilities for user-facing forms
// =============================================================================
// Validates emails, phones, amounts, tax IDs, and IBANs for EU6 markets.
// All functions are pure and side-effect free.
// =============================================================================

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  // EU phone formats: +31, +49, +33, +34, +39, +44 etc.
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return /^\+?\d{8,15}$/.test(cleaned);
}

export function isValidAmount(amount: string): boolean {
  // Accepts: 123, 123.45, 123,45 (EU format), 1.234,56
  const cleaned = amount.replace(/[.\s]/g, '').replace(',', '.');
  return /^\d+(\.\d{1,2})?$/.test(cleaned) && parseFloat(cleaned) > 0;
}

export function parseAmount(amount: string): number {
  // Handle EU format (1.234,56) and US format (1,234.56)
  const hasCommaDecimal = /,\d{1,2}$/.test(amount);
  if (hasCommaDecimal) {
    return parseFloat(amount.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(amount.replace(/,/g, ''));
}

export function sanitizeInput(input: string): string {
  // Remove control characters and trim
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

export function isValidKvKNumber(kvk: string): boolean {
  // Dutch KvK number: 8 digits
  return /^\d{8}$/.test(kvk.trim());
}

// R66 round 3: country-specific VAT format. Was too lax — `NL12` passed.
// Real Dutch VAT: NL + 9 digits + B + 2 digits (e.g., NL123456789B01).
// Falls through to a permissive EU shape for unknown country codes so we
// don't reject countries we haven't enumerated (BE/AT/etc).
const VAT_FORMATS: Record<string, RegExp> = {
  NL: /^NL\d{9}B\d{2}$/,
  DE: /^DE\d{9}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  IT: /^IT\d{11}$/,
  GB: /^GB(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
  BE: /^BE0\d{9}$/,
  AT: /^ATU\d{8}$/,
};

/**
 * Luhn, shared by SIRET/SIREN and the Italian partita IVA check digit.
 * Both are mod-10 with the same doubling rule; only the length differs.
 */
function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (d < 0 || d > 9) return false;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/**
 * FRENCH SIRET — 14 digits, Luhn-checked. SIREN (the first 9) is accepted too:
 * a sole trader quotes either, and refusing a valid SIREN would block a real
 * contractor from invoicing.
 *
 * `checkInvoiceReadiness` REQUIRES a SIRET for France and, until 2026-08-29,
 * never looked at it — the format half of that gate ran `isValidKvKNumber`
 * behind `country === 'NL'`, so every non-Dutch registration number was
 * accepted as long as it was non-empty. R66r39 added format checking precisely
 * because "non-empty" let a malformed BTW reach a customer's accountant; the
 * same reasoning had simply never been applied outside the Netherlands.
 *
 * ⚠️ La Poste is the documented exception: SIRET 356 000 000 xxxxx does not
 * satisfy Luhn. Accepted explicitly rather than failing a real company.
 */
export function isValidSIRET(value: string): boolean {
  const v = value.trim().replace(/[\s.-]/g, '');
  if (!/^\d+$/.test(v)) return false;
  if (v.length === 9) return luhnValid(v);
  if (v.length !== 14) return false;
  if (v.startsWith('356000000')) return true;
  return luhnValid(v);
}

/**
 * ITALIAN partita IVA — 11 digits, mod-10 check digit (the Luhn rule applied
 * from the left, which for a fixed 11-digit length is the same computation).
 * Accepts an optional `IT` prefix because that is how the app stores it.
 */
export function isValidPartitaIVA(value: string): boolean {
  const v = value.trim().toUpperCase().replace(/[\s.-]/g, '').replace(/^IT/, '');
  if (!/^\d{11}$/.test(v)) return false;
  return luhnValid(v);
}

/**
 * SPANISH NIF / NIE / CIF control character.
 *
 * Spain's required invoicing field is the NIF/CIF and only its SHAPE was
 * checked (`ES[A-Z0-9]\d{7}[A-Z0-9]`), which accepts any typo that keeps the
 * shape. Completes the set alongside SIRET and Partita IVA.
 *
 *  · DNI  — 8 digits + letter from "TRWAGMYFPDXBNJZSQVHLCKE"[n % 23]
 *  · NIE  — X/Y/Z + 7 digits + the same letter, with X→0, Y→1, Z→2
 *  · CIF  — org letter + 7 digits + a control that is a DIGIT for A/B/E/H,
 *           a LETTER for P/Q/R/S/N/W, and either for the rest. Accepting
 *           either where the law allows either is deliberate: a validator that
 *           rejects a valid identifier stops a contractor invoicing.
 *
 * Accepts an optional `ES` prefix because that is how the app stores it.
 */
export function isValidSpanishTaxId(value: string): boolean {
  const v = value.trim().toUpperCase().replace(/[\s.-]/g, '').replace(/^ES/, '');
  const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

  if (/^\d{8}[A-Z]$/.test(v)) {
    return v[8] === LETTERS[parseInt(v.slice(0, 8), 10) % 23];
  }
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const lead = { X: '0', Y: '1', Z: '2' }[v[0] as 'X' | 'Y' | 'Z'];
    return v[8] === LETTERS[parseInt(lead + v.slice(1, 8), 10) % 23];
  }
  if (/^[A-HJ-NP-SUVW]\d{7}[0-9A-J]$/.test(v)) {
    let sum = 0;
    for (let i = 0; i < 7; i += 1) {
      let d = v.charCodeAt(i + 1) - 48;
      if (i % 2 === 0) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    const c = (10 - (sum % 10)) % 10;
    const org = v[0];
    const asLetter = 'JABCDEFGHI'[c];
    if ('PQRSNW'.includes(org)) return v[8] === asLetter;
    if ('ABEH'.includes(org)) return v[8] === String(c);
    return v[8] === String(c) || v[8] === asLetter;
  }
  return false;
}

export function isValidVATNumber(vat: string): boolean {
  const cleaned = vat.trim().replace(/\s/g, '').toUpperCase();
  const country = cleaned.slice(0, 2);
  const rule = VAT_FORMATS[country];
  if (rule) return rule.test(cleaned);
  // Permissive fallback for unenumerated EU country codes.
  return /^[A-Z]{2}\w{2,12}$/.test(cleaned);
}

// R66 round 3: country-specific IBAN length + mod-97 checksum. Was a shape-
// only regex — `NL12ABCD12345678` (invalid checksum) used to pass, so
// contractors could persist garbage and only learn it was wrong at the
// customer's first failed transfer.
const IBAN_LENGTHS: Record<string, number> = {
  NL: 18, DE: 22, FR: 27, ES: 24, IT: 27, GB: 22, BE: 16, AT: 20,
  CH: 21, IE: 22, LU: 20, PT: 25, SE: 24, NO: 15, DK: 18, FI: 18, PL: 28,
};

function ibanMod97(rearranged: string): number {
  // Numeric string can be larger than 64-bit; chunk through to avoid overflow.
  let remainder = 0;
  for (let i = 0; i < rearranged.length; i += 9) {
    const chunk = String(remainder) + rearranged.slice(i, i + 9);
    remainder = parseInt(chunk, 10) % 97;
  }
  return remainder;
}

export function isValidIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned)) return false;
  const country = cleaned.slice(0, 2);
  const expectedLen = IBAN_LENGTHS[country];
  if (expectedLen && cleaned.length !== expectedLen) return false;
  // Move first 4 chars to end, convert letters to digits (A=10 ... Z=35).
  const rearranged = (cleaned.slice(4) + cleaned.slice(0, 4))
    .replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return ibanMod97(rearranged) === 1;
}
