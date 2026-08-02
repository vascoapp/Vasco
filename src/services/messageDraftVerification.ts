// =============================================================================
// MESSAGE DRAFT VERIFICATION — machine check under the human approval gate
// =============================================================================
// Tier 4 of the LLM ladder: free text, about a real customer, containing real
// figures. The strongest tier and the riskiest, and it is only safe here
// because THE VERIFIER ALREADY EXISTS AND IS A HUMAN — `aiActionQueueService`
// never auto-sends. Every draft surfaces in the EVE queue, the contractor reads
// it, and `approveItem(id, { editedText })` lets them correct it first.
//
// So why check anything by machine at all? Because "a human will catch it" is a
// weak guarantee for the failure mode that matters most here: a WRONG NUMBER.
// A contractor skimming a plausible reminder on a phone will catch a weird
// sentence instantly and a wrong euro amount almost never — and a message that
// tells a customer they owe the wrong sum is worse than sending nothing.
//
// THE "CANNOT INVENT" RULE FOR THIS TIER:
//   every number in the draft must appear in the facts we supplied.
//
// The model may select, omit, reorder and phrase. It may not originate a
// quantity. That is the same principle as the phrasing tier ("emit no digits")
// and the material tier ("introduce no token"), applied to the one tier where
// the model legitimately needs to handle real values.
//
// Pure and synchronous. No network — this is the referee.
// =============================================================================

export type DraftSeverity = 'fatal' | 'warning';

export interface DraftIssue {
  severity: DraftSeverity;
  code: string;
  detail: string;
}

export interface DraftFacts {
  /**
   * Every value the model was given, verbatim, e.g. ['€ 1.234,50', '14'].
   *
   * ⚠️ KNOWN AND DELIBERATE LIMITATION — a date widens the allowlist.
   * Passing '2026-08-19' contributes 2026, 8 and 19, so a draft saying
   * "binnen 8 dagen" would pass even though 8 was never a fact about days.
   *
   * Kept this way on purpose: the alternative (stripping date components)
   * REJECTS a draft that legitimately writes "voor 19 augustus", and a false
   * positive that blocks a correct message is worse here than a false negative
   * that reaches a human reviewer. Callers who care should pass the RENDERED
   * date ("19 augustus 2026") rather than the ISO form, so the numbers in the
   * allowlist are the ones a reader would actually see.
   */
  allowedValues: string[];
  /** Names the draft is allowed to mention (customer, business, job title). */
  allowedNames?: string[];
  /** PII placeholder tokens that MUST have been rehydrated before this runs. */
  tokens?: string[];
}

export interface DraftVerification {
  ok: boolean;
  issues: DraftIssue[];
  /** Numbers found in the draft that were not in the facts. */
  unsupportedNumbers: string[];
}

const MAX_DRAFT_CHARS = 1200;
const MIN_DRAFT_CHARS = 15;

/**
 * Numeric tokens in a text, normalised for comparison.
 *
 * Currency and thousands separators vary by locale and by how the model chooses
 * to render a figure — "1.234,50", "1234.50" and "1 234,50" are the same number
 * and must compare equal, or the check produces false positives on every
 * correctly-drafted Dutch message.
 */
export function extractNumbers(text: string): string[] {
  // A separator must be IMMEDIATELY followed by digits. The first version used
  // `\d[\d.,\s]*\d`, whose class included ", " — so "€ 1.234,50, 14 dagen"
  // matched as ONE token and normalised to 123450.14, meaning two real figures
  // silently became one nonsense figure that matched nothing.
  //
  // Two alternatives, longest first: space-grouped thousands ("1 234,50"), then
  // the ordinary form ("1.234,50" / "1234.50" / "14").
  const re = /\d{1,3}(?: \d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)*/g;
  const raw = String(text ?? '').match(re) ?? [];
  return raw.map(normaliseNumber).filter(Boolean);
}

export function normaliseNumber(token: string): string {
  let t = String(token).replace(/\s/g, '');
  // Strip a thousands separator: a dot or comma followed by exactly 3 digits
  // that is not the last separator in the token.
  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  const decimalPos = Math.max(lastDot, lastComma);
  if (decimalPos > -1) {
    const decimals = t.length - decimalPos - 1;
    const intPartRaw = t.slice(0, decimalPos).replace(/[.,]/g, '');
    // "0.500" is NOT thousands — nothing is 0 thousand. Treating it as such
    // produced 500, a 1000x error that would let a draft claim "500" against a
    // fact of "0.500" and pass. A leading integer part of 0 always means a
    // decimal fraction.
    const looksLikeThousands = decimals === 3 && intPartRaw !== '' && intPartRaw !== '0';
    if (looksLikeThousands) {
      // Genuinely ambiguous: "1.234" is thousands in NL, decimal in EN. Treat as
      // thousands — far more common in an invoice amount, and the comparison is
      // symmetric so both sides normalise the same way.
      t = t.replace(/[.,]/g, '');
    } else {
      const intPart = t.slice(0, decimalPos).replace(/[.,]/g, '');
      const frac = t.slice(decimalPos + 1);
      t = frac ? `${intPart}.${frac}` : intPart;
    }
  }
  // Drop trailing zeros in the fraction so 12.50 == 12.5, and a bare ".00".
  if (t.includes('.')) t = t.replace(/0+$/, '').replace(/\.$/, '');
  return t.replace(/^0+(?=\d)/, '');
}

/**
 * Verify a drafted customer-facing message against the facts it was built from.
 */
export function verifyMessageDraft(
  draft: string | null | undefined,
  facts: DraftFacts,
): DraftVerification {
  const issues: DraftIssue[] = [];
  const unsupportedNumbers: string[] = [];
  const text = typeof draft === 'string' ? draft.trim() : '';

  if (!text) {
    return {
      ok: false,
      issues: [{ severity: 'fatal', code: 'empty', detail: 'draft is empty' }],
      unsupportedNumbers,
    };
  }
  if (text.length < MIN_DRAFT_CHARS) {
    issues.push({ severity: 'fatal', code: 'too_short', detail: `${text.length} chars is not a message` });
  }
  if (text.length > MAX_DRAFT_CHARS) {
    issues.push({ severity: 'fatal', code: 'too_long', detail: `${text.length} chars exceeds ${MAX_DRAFT_CHARS}` });
  }

  // A leaked placeholder means rehydration did not run — the customer would
  // receive a literal "[CUSTOMER_NAME]". Fatal, and it is the specific failure
  // the pii.ts tokenise/rehydrate round trip can produce if a caller forgets.
  const leaked = text.match(/\[[A-Z_]{3,}\]/g);
  if (leaked) {
    issues.push({
      severity: 'fatal',
      code: 'unrehydrated_token',
      detail: `contains PII placeholder(s) ${[...new Set(leaked)].join(', ')} — rehydration did not run`,
    });
  }
  for (const t of facts.tokens ?? []) {
    if (text.includes(t)) {
      issues.push({ severity: 'fatal', code: 'unrehydrated_token', detail: `contains the token ${t}` });
    }
  }

  // THE core rule.
  const allowed = new Set<string>();
  for (const v of facts.allowedValues ?? []) {
    for (const n of extractNumbers(v)) allowed.add(n);
  }
  for (const n of extractNumbers(text)) {
    if (!allowed.has(n)) unsupportedNumbers.push(n);
  }
  if (unsupportedNumbers.length > 0) {
    issues.push({
      severity: 'fatal',
      code: 'unsupported_number',
      detail: `contains ${[...new Set(unsupportedNumbers)].join(', ')} — every figure must come from the supplied facts`,
    });
  }

  // Markup would render literally in WhatsApp/SMS/email-plain.
  if (/<[a-z/][^>]*>/i.test(text)) {
    issues.push({ severity: 'warning', code: 'markup', detail: 'contains HTML' });
  }
  // A model that starts "Subject:" or "Here is a draft" has replied to the
  // prompt rather than written the message.
  if (/^\s*(subject|betreft|here('s| is)|hier is|voici|aqui|ecco)\b/i.test(text)) {
    issues.push({ severity: 'warning', code: 'meta_preamble', detail: 'looks like a reply to the prompt, not the message' });
  }

  return { ok: !issues.some((i) => i.severity === 'fatal'), issues, unsupportedNumbers };
}

/** One-line summary for the queue item and the logs. */
export function summariseDraftVerification(v: DraftVerification): string {
  const fatal = v.issues.filter((i) => i.severity === 'fatal');
  if (fatal.length > 0) return `Draft rejected: ${fatal[0].detail}`;
  const warn = v.issues.filter((i) => i.severity === 'warning');
  return warn.length > 0 ? `Draft ready, with warnings: ${warn[0].detail}` : 'Draft ready for review';
}
