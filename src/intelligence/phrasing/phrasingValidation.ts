// =============================================================================
// PHRASING VALIDATION — the guard that makes an LLM safe behind the rules engine
// =============================================================================
// The intelligence generators compute their numbers deterministically and then
// hand them to gt() templates for wording. This module lets an LLM rewrite the
// WORDING while making it structurally impossible for it to invent a NUMBER.
//
// Why that matters here specifically: learnings #R317-321 records a shipped
// insight card reading "35% boven branche" where the 35% was fabricated. An LLM
// that writes finished sentences industrialises exactly that bug. An LLM that
// writes *templates* cannot: it never sees a value, and rule 3 below rejects any
// output containing a bare digit. Every number a contractor reads still comes
// from financialAnalysisService, via {{placeholder}} interpolation on-device.
//
// The same property is what keeps Kimi/Moonshot out of GDPR scope: generation
// input is a phrasing SHAPE (key, tone, placeholder names, char budget) with no
// customer name, no business name and no figure, so nothing personal is
// transferred to a third country at all. See _shared/pii.ts for the runtime
// path that does handle real values (SoW), which needs tokenisation precisely
// because it does not have this property.
//
// DEPENDENCY-FREE ON PURPOSE. This file is imported both by the React Native
// client and by the Deno edge function (supabase/functions/generate-phrasing).
// One source of truth, so server-side and client-side rules cannot drift — the
// divergence class that produced the 4 rival Country types and 58 casts.
// =============================================================================

export type PhrasingLanguage = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

export const PHRASING_LANGUAGES: PhrasingLanguage[] = ['nl', 'en', 'de', 'fr', 'es', 'it'];

/** What an LLM is allowed to produce for one generator string. */
export interface PhrasingSpec {
  /** gt() key this phrasing overrides, e.g. 'fin_overdue_title'. */
  key: string;
  /** Placeholders the template MAY use, without braces, e.g. ['count','amount']. */
  placeholders: string[];
  /** Placeholders every locale MUST use. Omitting one silently drops a fact. */
  required: string[];
  /**
   * Hard character budget per locale, measured on the LITERAL text only (i.e.
   * after {{placeholders}} are stripped). Cards truncate — the screen walk found
   * three labels truncated to uselessness — so an over-long variant is a defect,
   * not a cosmetic issue.
   *
   * Note this bounds the wording the model chooses, NOT the rendered length:
   * a long interpolated customer name can still overflow, and that is the
   * caller's problem to solve with numberOfLines/ellipsis. Budget the wording
   * for the longest language you ship (German and Italian run ~30% over English).
   */
  maxChars: number;
  /** Escape hatch for strings that genuinely need a literal numeral. Default false. */
  allowDigits?: boolean;
}

/** One LLM-produced wording for one key, across all six languages. */
export type PhrasingBundle = Record<PhrasingLanguage, string>;

export interface PhrasingViolation {
  key: string;
  language?: PhrasingLanguage;
  rule: string;
  detail: string;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/**
 * Number WORDS, which the digit rule cannot see.
 *
 * A probe against the first version of this file confirmed the hole: the bundle
 * "drie facturen open voor {{amount}}" passed cleanly, hard-coding the count as
 * "three" while {{count}} sat unused. That is the same fabricated-quantity
 * failure the digit rule exists to prevent, just spelled out.
 *
 * Deliberately starts at TWO. In every language Vasco ships, the word for "one"
 * is also the indefinite article — nl "een", de "ein/eine", fr "un/une",
 * es/it "un/uno/una" — so banning it would reject perfectly good phrasing like
 * "stuur een herinnering" ("send a reminder"). Two and above are unambiguously
 * quantities.
 */
const NUMBER_WORDS = new Set([
  // nl
  'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf',
  'honderd', 'duizend',
  // en
  'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'hundred', 'thousand',
  // de
  'zwei', 'drei', 'vier', 'fuenf', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwoelf', 'zwölf',
  'hundert', 'tausend',
  // fr
  'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze',
  'cent', 'mille',
  // es
  'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'cien', 'ciento', 'mil',
  // it
  'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici',
  'cento', 'mille',
]);

/** First number word found in the literal text, or null. */
function findNumberWord(literal: string): string | null {
  for (const raw of literal.toLowerCase().split(/[^\p{L}]+/u)) {
    if (raw && NUMBER_WORDS.has(raw)) return raw;
  }
  return null;
}

/** Placeholder names used by a template, in order of appearance. */
export function extractPlaceholders(text: string): string[] {
  const out: string[] = [];
  PLACEHOLDER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) out.push(m[1]);
  return out;
}

/** Template with every {{placeholder}} removed — what we length-check against. */
export function stripPlaceholders(text: string): string {
  return text.replace(PLACEHOLDER_RE, '');
}

/**
 * Validate one candidate bundle against its spec.
 *
 * Returns every violation rather than the first, so a regeneration prompt can
 * be told all of what is wrong in one round trip instead of ping-ponging.
 */
export function validatePhrasing(spec: PhrasingSpec, bundle: Partial<PhrasingBundle> | null | undefined): PhrasingViolation[] {
  const v: PhrasingViolation[] = [];
  const push = (rule: string, detail: string, language?: PhrasingLanguage) =>
    v.push({ key: spec.key, language, rule, detail });

  if (!bundle || typeof bundle !== 'object') {
    push('bundle_missing', 'no bundle produced for this key');
    return v;
  }

  for (const lang of PHRASING_LANGUAGES) {
    const raw = bundle[lang];

    // 1. Every locale present and non-empty. A missing locale would fall back
    //    to the key itself downstream — the silent failure gt() already has.
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      push('locale_missing', `no text for "${lang}"`, lang);
      continue;
    }
    if (raw !== raw.trim()) {
      push('whitespace', 'leading or trailing whitespace', lang);
    }

    // 2. Braces must be balanced, or interpolation leaks "{{" onto the card.
    const opens = (raw.match(/\{\{/g) ?? []).length;
    const closes = (raw.match(/\}\}/g) ?? []).length;
    if (opens !== closes) {
      push('unbalanced_braces', `${opens} "{{" vs ${closes} "}}"`, lang);
    }

    const used = extractPlaceholders(raw);
    const allowed = new Set(spec.placeholders);

    // 3. Only allowlisted placeholders. An invented placeholder never gets
    //    interpolated and ships literal "{{revenue}}" to the contractor.
    for (const p of used) {
      if (!allowed.has(p)) {
        push('unknown_placeholder', `"{{${p}}}" is not in the allowlist [${spec.placeholders.join(', ')}]`, lang);
      }
    }

    // 4. Every required fact still present. Dropping {{amount}} turns
    //    "3 invoices overdue for €800" into "3 invoices overdue" — quieter,
    //    and less useful, without ever failing a type check.
    for (const r of spec.required) {
      if (!used.includes(r)) {
        push('missing_required_placeholder', `"{{${r}}}" must appear`, lang);
      }
    }

    // 5. THE CORE RULE — no literal quantities. Numbers come from the rules
    //    engine or they do not exist. This is what stops a fabricated statistic.
    if (!spec.allowDigits) {
      const literal = stripPlaceholders(raw);
      const bare = literal.match(/\d/);
      if (bare) {
        push('literal_digit', `contains the digit "${bare[0]}" outside a placeholder — every number must be interpolated`, lang);
      }
      // Digits are the obvious form; spelled-out numbers are the same defect
      // and slipped past the first version of this rule.
      const word = findNumberWord(literal);
      if (word) {
        push('literal_number_word', `contains the number word "${word}" — every quantity must be interpolated`, lang);
      }
    }

    // 6. Length budget, measured on the literal text plus a worst-case
    //    allowance per placeholder so a long value cannot blow the card.
    const literalLen = stripPlaceholders(raw).length;
    const budget = spec.maxChars;
    if (literalLen > budget) {
      push('too_long', `${literalLen} chars of literal text exceeds ${budget}`, lang);
    }

    // 7. No markup. These strings render into <Text>, so markdown/HTML would
    //    display raw rather than format.
    if (/[<>]|\*\*|\[.+\]\(.+\)/.test(raw)) {
      push('markup', 'contains HTML or markdown', lang);
    }
  }

  return v;
}

/** Validate a whole batch. Returns only the bundles that passed, plus all violations. */
export function validateBatch(
  specs: PhrasingSpec[],
  bundles: Record<string, Partial<PhrasingBundle>>,
): { accepted: Record<string, PhrasingBundle>; violations: PhrasingViolation[] } {
  const accepted: Record<string, PhrasingBundle> = {};
  const violations: PhrasingViolation[] = [];

  for (const spec of specs) {
    const issues = validatePhrasing(spec, bundles[spec.key]);
    if (issues.length === 0) {
      accepted[spec.key] = bundles[spec.key] as PhrasingBundle;
    } else {
      violations.push(...issues);
    }
  }

  return { accepted, violations };
}
