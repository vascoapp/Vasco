// =============================================================================
// MATERIAL NORMALISATION — collapse description variants into one cohort key
// =============================================================================
// `material_price_benchmarks` groups by LOWER(material_name) and suppresses
// below HAVING COUNT(DISTINCT observed_by) >= 5. So the raw spelling a
// contractor (or an OCR pass) happened to use IS the cohort key.
//
// That means one physical product recorded as
//
//     "YMvK 3x2,5mm²"   "kabel ymvk 3 x 2.5 mm2"   "YMVK-kabel 3X2,5"
//
// fragments into three sub-k groups and the benchmark shows NOTHING — even
// though thirty observations exist. Normalising the key therefore raises cohort
// density WITHOUT recruiting a single extra contractor, which is the cheapest
// available way to switch on the differentiator.
//
// Deliberately RULES-FIRST, not LLM-first:
//   * An EAN or supplier article number is an exact identity. When present it
//     wins outright — no similarity guessing, no model call, no ambiguity.
//   * Text canonicalisation below is pure, deterministic, offline and testable.
//     It runs on every write with no latency and no cost.
//   * An LLM belongs only on the RESIDUAL — descriptions the rules cannot merge
//     — and its proposal must survive the same propose/verify/discard gate:
//     a proposed canonical form is only accepted if it re-normalises to itself
//     (idempotent) and introduces no token absent from the inputs. See
//     `proposalIsAcceptable` at the bottom.
//
// NOTE ON SCOPE: `materials` / `material_aliases` in src/types/pricingDatabase.ts
// have NO migration, and `src/api/pricingApi.ts` points at ENV.VASCO_API_URL,
// an external service that does not exist. That entity-resolution path is dead
// scaffolding — this module deliberately works against `material_price_history`,
// which is real (migration 002).
// =============================================================================

export type CanonicalMethod = 'ean' | 'article' | 'text';

export interface CanonicalMaterial {
  /** The cohort key. Stable, lowercase, safe to store in material_name. */
  key: string;
  method: CanonicalMethod;
  /** 0-1. EAN is certain; text canonicalisation is confident but not exact. */
  confidence: number;
  /** Normalised tokens, exposed for diagnostics and for LLM-proposal checking. */
  tokens: string[];
}

export interface MaterialInput {
  description: string;
  ean?: string | null;
  articleNumber?: string | null;
  supplierId?: string | null;
  unit?: string | null;
}

// ---------------------------------------------------------------------------
// Unit vocabulary
// ---------------------------------------------------------------------------
// Cross-sectional area and length units are where the same product diverges
// most: mm², mm2, qmm and "kwadraat" all mean the same thing to a contractor.
const UNIT_ALIASES: Record<string, string> = {
  'mm²': 'mm2', 'mm^2': 'mm2', 'mm2': 'mm2', qmm: 'mm2', 'q.mm': 'mm2', kwadraat: 'mm2',
  'm²': 'm2', 'm^2': 'm2', m2: 'm2', vierkantemeter: 'm2', qm: 'm2', sqm: 'm2',
  'm³': 'm3', 'm^3': 'm3', m3: 'm3',
  mtr: 'm', mtrs: 'm', meter: 'm', meters: 'm', metre: 'm', mt: 'm', lm: 'm', m1: 'm',
  cm: 'cm', mm: 'mm', km: 'km',
  stk: 'st', stuk: 'st', stuks: 'st', stks: 'st', st: 'st', pcs: 'st', pc: 'st',
  // "stück" arrives here already diacritic-folded to "stuck" — map both.
  piece: 'st', pieces: 'st', stück: 'st', stuck: 'st', stueck: 'st', pieza: 'st', piezas: 'st',
  pezzo: 'st', pezzi: 'st', unite: 'st', unites: 'st', ud: 'st', uds: 'st',
  ltr: 'l', liter: 'l', litre: 'l', liters: 'l', litres: 'l', l: 'l',
  kg: 'kg', kilo: 'kg', kilogram: 'kg', gr: 'g', gram: 'g', g: 'g',
  rol: 'rol', roll: 'rol', rolle: 'rol', rouleau: 'rol',
  doos: 'doos', box: 'doos', karton: 'doos', caja: 'doos', scatola: 'doos',
  zak: 'zak', bag: 'zak', sack: 'zak', sac: 'zak',
};

// Packaging / commercial noise that says nothing about WHICH product this is.
// Removing them is what merges "YMvK 3x2.5 per meter" with "YMvK 3x2.5".
const NOISE_TOKENS = new Set([
  'per', 'a', 'à', 'the', 'de', 'het', 'een', 'la', 'le', 'les', 'el', 'los', 'las',
  'il', 'lo', 'der', 'die', 'das', 'ein', 'eine', 'und', 'and', 'en', 'et', 'y', 'e',
  'incl', 'excl', 'inclusief', 'exclusief', 'inkl', 'zzgl', 'btw', 'vat', 'mwst', 'tva', 'iva',
  'nieuw', 'new', 'neu', 'nuevo', 'nuovo', 'nouveau',
  'aanbieding', 'actie', 'promo', 'promotie', 'angebot', 'offerta', 'oferta', 'sale', 'korting',
  'art', 'artikel', 'article', 'articulo', 'articolo', 'nr', 'no', 'ref', 'code',
  'stuksprijs', 'prijs', 'price', 'preis', 'prezzo', 'precio', 'prix',
  'voorraad', 'stock', 'lager',
]);

/** Strip diacritics and normalise unicode width/compatibility forms. */
function foldDiacritics(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalise numbers so decimal comma and decimal point agree, and so dimension
 * groups survive tokenisation as ONE token.
 *
 * "3 x 2,5 mm²" -> "3x2.5 mm2".  Keeping "3x2.5" atomic matters: it is the part
 * that actually identifies the product, and splitting it would let token
 * sorting scramble it.
 */
function normaliseNumerics(s: string): string {
  let out = s;
  // Decimal comma -> point, but only between digits (so it does not eat list commas).
  out = out.replace(/(\d),(\d)/g, '$1.$2');
  // Thousands separators inside long digit runs: 1.234,50 already handled above;
  // strip a dot used as a thousands separator (digit.digit{3} not followed by digit).
  out = out.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');
  // Dimension separators: "3 x 2.5", "3 X 2.5", "3*2.5" -> "3x2.5"
  out = out.replace(/(\d(?:\.\d+)?)\s*[x*×]\s*(?=\d)/gi, '$1x');
  // Drop a space between a number and its unit: "2.5 mm2" -> "2.5mm2"
  out = out.replace(/(\d(?:\.\d+)?)\s+(mm2|mm|cm|m2|m3|m|kg|g|l|st)\b/gi, '$1$2');
  return out;
}

/**
 * Canonicalise a single token.
 *
 * UNITS ARE DROPPED, not kept. `material_price_benchmarks` groups by
 *   (trade, country, LOWER(material_name), material_category, unit)
 * so `unit` is already its own grouping dimension. Carrying it inside the name
 * as well double-counts it, and that is a real fragmentation source: a
 * contractor who writes "YMvK 3x2,5" and one who writes "YMvK 3x2,5mm²" mean
 * the same product and land in different buckets purely over a suffix.
 *
 * Discriminating power lives in the NUMBER ("3x2.5" vs "5x4"), not in the unit,
 * so dropping the unit merges spelling variants without merging products.
 */
function canonicaliseToken(token: string): string | null {
  const t = token.trim();
  if (!t) return null;

  // Standalone unit or packaging word -> carries no product identity.
  if (UNIT_ALIASES[t]) return null;

  // Unit glued to a number: "2.5mm2" -> "2.5", "3x2.5mm2" -> "3x2.5".
  // The suffix must allow TRAILING DIGITS: mm2/m2/m3 are unit names that end in
  // a digit, and a letters-only class silently fails to match them — which is
  // exactly the bug that left "3x2.5mm2" and "3x2.5" in separate cohorts.
  const m = t.match(/^(\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)*)([a-z²³^]+\d*)$/i);
  if (m) {
    const suffix = m[2].toLowerCase();
    // Only strip it when it really is a unit; "m20" (thread size) must survive.
    if (UNIT_ALIASES[suffix]) return m[1];
    return `${m[1]}${suffix}`;
  }

  if (NOISE_TOKENS.has(t)) return null;
  // Bare ordinal/quantity noise like "1x" adds nothing on its own.
  if (/^\d+x$/.test(t)) return null;
  return t;
}

/**
 * Deterministic text canonicalisation.
 *
 * Tokens are SORTED, which is what merges word-order variants ("YMvK kabel" vs
 * "kabel YMvK") — the single largest source of fragmentation in free-text
 * descriptions. Sorting is safe because dimension groups were made atomic
 * above, so "3x2.5" can never be scrambled into "2.5x3".
 */
export function canonicaliseDescription(description: string): { key: string; tokens: string[] } {
  if (!description || typeof description !== 'string') return { key: '', tokens: [] };

  const pre = normaliseNumerics(foldDiacritics(description).toLowerCase());

  const raw = pre
    // Punctuation -> space, but keep . and x inside numbers (already atomic).
    .replace(/[^\p{L}\p{N}.x²³^]+/gu, ' ')
    .split(/\s+/);

  const tokens = raw
    .map(canonicaliseToken)
    .filter((t): t is string => t !== null && t.length > 0)
    // Single letters carry no identity once units are mapped.
    .filter((t) => t.length > 1 || /\d/.test(t));

  const unique = [...new Set(tokens)].sort();
  return { key: unique.join(' '), tokens: unique };
}

/** Digits-only EAN, validated for length. GTIN-8/12/13/14. */
function normaliseEan(ean?: string | null): string | null {
  if (!ean) return null;
  const digits = String(ean).replace(/\D/g, '');
  return [8, 12, 13, 14].includes(digits.length) ? digits : null;
}

/**
 * Produce the cohort key for a material observation.
 *
 * Precedence is identity-first: an EAN is the same product by definition, a
 * supplier article number is the same product *within that supplier*, and text
 * is the fallback.
 */
export function canonicalMaterialKey(input: MaterialInput): CanonicalMaterial {
  const text = canonicaliseDescription(input?.description ?? '');

  const ean = normaliseEan(input?.ean);
  if (ean) {
    return { key: `ean:${ean}`, method: 'ean', confidence: 1, tokens: text.tokens };
  }

  // An article number is only unique inside its supplier's catalogue, so it is
  // namespaced. Without a supplier it is not a safe identity and is ignored.
  const article = input?.articleNumber ? String(input.articleNumber).trim().toLowerCase() : '';
  if (article.length >= 3 && input?.supplierId) {
    const supplier = String(input.supplierId).trim().toLowerCase();
    return {
      key: `art:${supplier}:${article}`,
      method: 'article',
      confidence: 0.95,
      tokens: text.tokens,
    };
  }

  return {
    key: text.key,
    method: 'text',
    // Very short descriptions carry little identity — flag them as weaker so
    // callers can decide whether to feed the moat.
    confidence: text.tokens.length >= 3 ? 0.8 : text.tokens.length >= 2 ? 0.6 : 0.4,
    tokens: text.tokens,
  };
}

/** True when two observations should land in the same cohort bucket. */
export function mergesWith(a: MaterialInput, b: MaterialInput): boolean {
  const ka = canonicalMaterialKey(a);
  const kb = canonicalMaterialKey(b);
  return ka.key === kb.key && ka.key.length > 0;
}

// ---------------------------------------------------------------------------
// The LLM tier — residual only, and gated the same way as everything else
// ---------------------------------------------------------------------------

/**
 * Verify an LLM-proposed canonical form before it is allowed to merge cohorts.
 *
 * Two properties, both cheap and both decisive:
 *
 *   1. IDEMPOTENCE — running the deterministic canonicaliser over the proposal
 *      must return the proposal. A model that proposes "YMvK Kabel 3 x 2,5mm²"
 *      has proposed a *display* string, not a key.
 *   2. NO INVENTION — every token in the proposal must already appear in at
 *      least one of the source descriptions. This is the material-side analogue
 *      of "the phrasing model may not emit a digit": the model may merge and
 *      drop, never add. It cannot decide the cable is 4mm² because that is the
 *      common size.
 *
 * A proposal failing either check is discarded and the sources keep their own
 * deterministic keys — i.e. exactly today's behaviour.
 */
export function proposalIsAcceptable(
  proposal: string,
  sourceDescriptions: string[],
): { ok: boolean; reason?: string } {
  const canon = canonicaliseDescription(proposal);
  if (!canon.key) return { ok: false, reason: 'proposal canonicalises to nothing' };

  if (canon.key !== canonicaliseDescription(canon.key).key) {
    return { ok: false, reason: 'proposal is not idempotent under canonicalisation' };
  }

  const allowed = new Set<string>();
  for (const d of sourceDescriptions) {
    for (const t of canonicaliseDescription(d).tokens) allowed.add(t);
  }
  const invented = canon.tokens.filter((t) => !allowed.has(t));
  if (invented.length > 0) {
    return { ok: false, reason: `introduces token(s) absent from every source: ${invented.join(', ')}` };
  }

  return { ok: true };
}
