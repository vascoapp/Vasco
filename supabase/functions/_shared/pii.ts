// =============================================================================
// PII — tokenize / scrub / rehydrate personal data before it leaves for a
//       third-party LLM (data-residency "Option A": no customer PII to Moonshot)
// =============================================================================
// The scope-of-work text stage runs on Kimi, but the customer is a third party
// who never consented to Moonshot processing their name. So we:
//   1. replace identifying names with stable placeholder tokens in the prompt,
//   2. scrub free-text carried into the prompt (tone examples, dossier) of the
//      usual PII shapes (email / phone / IBAN / postcode) + the known names,
//   3. rehydrate the real names into the model's output afterwards.
// The model only ever sees `[CUSTOMER_NAME]` / `[BUSINESS_NAME]` and generic
// scrubbed prose — the real values are re-inserted here, inside our own edge fn.
// =============================================================================

const CUSTOMER_TOKEN = '[CUSTOMER_NAME]';
const BUSINESS_TOKEN = '[BUSINESS_NAME]';

export interface TokenizedIdentities {
  /** What to interpolate into the prompt for the customer's name. Either the
   *  placeholder token (when a real name was supplied) or a generic noun. */
  customerRef: string;
  businessRef: string;
  /** Re-inserts the real names into model output. No-op when none supplied. */
  rehydrate: (text: string) => string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAll(text: string, needle: string, replacement: string): string {
  if (!needle) return text;
  return text.split(needle).join(replacement);
}

/**
 * Turn real names into placeholder tokens for the prompt, and return a
 * rehydrator that swaps them back. When a name is absent we fall back to a
 * neutral noun so the prompt still reads naturally and no rehydration is needed.
 */
export function tokenizeIdentities(customerName?: string, businessName?: string): TokenizedIdentities {
  const cust = (customerName ?? '').trim();
  const biz = (businessName ?? '').trim();

  return {
    customerRef: cust ? CUSTOMER_TOKEN : 'the customer',
    businessRef: biz ? BUSINESS_TOKEN : 'the contractor',
    rehydrate: (text: string) => {
      let out = text;
      if (cust) out = replaceAll(out, CUSTOMER_TOKEN, cust);
      if (biz) out = replaceAll(out, BUSINESS_TOKEN, biz);
      return out;
    },
  };
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// 7+ digits with optional +, spaces, dashes, parens, dots between groups.
const PHONE_RE = /(?<!\w)\+?[\d][\d\s().-]{6,}\d(?!\w)/g;
// Country(2) + check(2) + BBAN(11-30 alphanumerics, optionally space-grouped).
// BBAN length is NOT a fixed multiple of 4 (NL is 14), so match on total length.
const IBAN_RE = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g;
// EU postcode-ish: NL "1234 AB", UK "SW1A 1AA"-style, generic 4-6 digit.
const NL_POSTCODE_RE = /\b\d{4}\s?[A-Z]{2}\b/g;
const UK_POSTCODE_RE = /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g;

/**
 * Scrub free-text (tone examples, dossier brief) before it reaches a
 * third-party model. Replaces PII shapes with neutral placeholders and masks
 * any supplied names (current customer / business) that might appear verbatim
 * in historical prose.
 */
export function scrubFreeText(text: string, names: Array<string | undefined> = []): string {
  if (!text) return text;
  let out = text;

  // Mask known names first (before generic patterns, so a name that looks
  // like a word isn't left behind). Only mask reasonably-specific names
  // (length >= 3) to avoid nuking short common words.
  for (const raw of names) {
    const name = (raw ?? '').trim();
    if (name.length < 3) continue;
    out = out.replace(new RegExp(escapeRegExp(name), 'gi'), CUSTOMER_TOKEN);
  }

  out = out.replace(EMAIL_RE, '[email]');
  out = out.replace(IBAN_RE, '[iban]');
  out = out.replace(NL_POSTCODE_RE, '[postcode]');
  out = out.replace(UK_POSTCODE_RE, '[postcode]');
  out = out.replace(PHONE_RE, '[phone]');
  return out;
}
