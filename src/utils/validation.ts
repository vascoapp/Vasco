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

export function isValidVATNumber(vat: string): boolean {
  // EU VAT: 2-letter country code + 2-12 alphanumeric
  return /^[A-Z]{2}\w{2,12}$/i.test(vat.trim().replace(/\s/g, ''));
}

export function isValidIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned);
}
