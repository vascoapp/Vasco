// =============================================================================
// VIES VAT VALIDATION (R245)
// =============================================================================
// EU Commission's VAT Information Exchange System — public, no auth required.
// Validates a VAT number is registered for cross-border B2B transactions.
// Spec: https://ec.europa.eu/taxation_customs/vies/
// REST endpoint: https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number
// =============================================================================

const ENDPOINT = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

export interface VatValidationResult {
  valid: boolean;
  countryCode: string;
  vatNumber: string;
  name?: string;          // Company name as registered
  address?: string;       // Registered address
  requestDate: string;
  consultationNumber?: string;  // Audit trail per Council Reg. 904/2010
  error?: string;
}

/**
 * Validate a VAT number against VIES. Input formats accepted:
 *   - "NL123456789B01"
 *   - "NL 123456789 B01"
 *   - "{ countryCode: 'NL', vatNumber: '123456789B01' }"
 *
 * Returns valid=true with company name + address when registered.
 * Returns valid=false with the request timestamp when not registered.
 * Network failures return valid=false + error string — caller decides whether
 * to block the invoice or proceed.
 */
export async function validateVat(input: string | { countryCode: string; vatNumber: string }): Promise<VatValidationResult> {
  const { countryCode, vatNumber } = typeof input === 'string' ? parseVatString(input) : input;

  if (!countryCode || !vatNumber) {
    return {
      valid: false,
      countryCode: countryCode ?? '',
      vatNumber: vatNumber ?? '',
      requestDate: new Date().toISOString(),
      error: 'Invalid VAT format — expected e.g. NL123456789B01',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode, vatNumber }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        valid: false,
        countryCode,
        vatNumber,
        requestDate: new Date().toISOString(),
        error: `VIES ${res.status}`,
      };
    }
    const json = await res.json();
    return {
      valid: Boolean(json.valid),
      countryCode,
      vatNumber,
      name: json.name && json.name !== '---' ? json.name : undefined,
      address: json.address && json.address !== '---' ? json.address : undefined,
      requestDate: json.requestDate ?? new Date().toISOString(),
      consultationNumber: json.requestIdentifier ?? undefined,
    };
  } catch (err) {
    clearTimeout(timeout);
    return {
      valid: false,
      countryCode,
      vatNumber,
      requestDate: new Date().toISOString(),
      error: String(err),
    };
  }
}

function parseVatString(raw: string): { countryCode: string; vatNumber: string } {
  const cleaned = raw.replace(/[\s.-]/g, '').toUpperCase();
  if (cleaned.length < 4) return { countryCode: '', vatNumber: '' };
  return { countryCode: cleaned.slice(0, 2), vatNumber: cleaned.slice(2) };
}
