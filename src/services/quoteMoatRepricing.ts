// =============================================================================
// QUOTE MOAT REPRICING — photo→quote lines get priced from OUR data, not raw AI
// =============================================================================
// The contractor-on-site camera path (AIQuoteFromPhoto) used to display Claude
// Haiku's raw `suggestedPrice` verbatim — a generic first-day guess that never
// touched the pricing moat. This composes the moat into that path so the number
// the contractor sends to a customer reflects:
//
//   1. Cohort adjustments   — what other contractors in the same trade/country
//                             actually edited similar lines to (pricingMoatService,
//                             k-anonymised ≥5 users, ±50% cap).
//   2. Own scanned prices   — for discrete-material lines, the median unit price
//                             THIS contractor last scanned off a supplier invoice
//                             (invoiceScanService), ±40% cap.
//   3. Confidence gate       — low-confidence detections are flagged for review
//                             instead of silently pre-selected into the quote.
//
// Every layer is capped and non-destructive: the pre-moat value is preserved as
// the baseline so downstream delta capture (reasonCodeService) still measures
// the contractor's edit against what we showed them — closing the learning loop.
// =============================================================================

import { applyCohortAdjustments, type AdjustableLine } from './pricingMoatService';
import { getScannedUnitPriceIndex, type ScannedUnitPrice } from './invoiceScanService';
import type { DeltaSource } from './reasonCodeService';

// Below this confidence (0-100) a detected line is flagged needsReview and is
// NOT auto-selected into the quote — the contractor opts it in deliberately.
export const CONFIDENCE_GATE = 60;

// Fuzzy description matches only reprice DISCRETE material units — m²/m/uur/job
// lines bundle labour/area work, so a raw supplier material price is the wrong
// anchor. Exact EAN/article matches bypass this (an identifier means it IS that
// product). stuk/rol/doos/kg/l are material-dominant enough to trust.
const MATERIAL_UNITS = new Set(['stuk', 'stk', 'st', 'pcs', 'rol', 'doos', 'box', 'kg', 'l', 'ltr']);

// Caps on how far a scanned price may move a line. Wider for an exact
// identifier match (trusted), tighter for a fuzzy description match. Both guard
// against a mis-OCR'd/stale scan blowing up a customer quote. Only applies when
// the line has NO material/labour split — with a split we reprice just the
// material portion and leave labour intact, so no cap is needed there.
const SCAN_CAP_PCT = 40;
const SCAN_CAP_EXACT_PCT = 75;

export interface MoatLineInput {
  id: string;
  description: string;
  category?: string;
  unit?: string;
  confidence?: number;
  suggestedQuantity: number;
  suggestedPrice: number;
  // Strong identifiers (#2) — when the vision model reads a visible product
  // label/box, we match the contractor's own scanned price by EAN/article
  // number exactly, instead of fuzzy description overlap.
  ean?: string;
  articleNumber?: string;
  // Material/labour split (edge fn, #2). When present we reprice ONLY the
  // material portion against the scanned price and keep labour — so an EAN
  // match can't silently strip the install labour out of the line.
  materialCostPerUnit?: number;
  laborCostPerUnit?: number;
}

export interface MoatLineOutput extends MoatLineInput {
  // Pre-moat displayed values — seed reasonCodeService baselines from these.
  baselineQuantity: number;
  baselineUnitPrice: number;
  moatSource: 'ai' | 'cohort' | 'scan';
  cohortContractors: number;
  scanSupplier?: string;
  needsReview: boolean;
  // Whether this line should start selected in the quote (confidence-gated).
  selected: boolean;
}

export interface MoatRepriceSummary {
  totalLines: number;
  cohortAdjusted: number;
  scanRepriced: number;
  lowConfidence: number;
  cohortContractors: number;
}

export interface MoatRepriceResult {
  items: MoatLineOutput[];
  summary: MoatRepriceSummary;
  // Convenience for seeding reasonCodeService: id → baseline + attribution.
  baselines: Map<string, { qty: number; price: number; source: DeltaSource }>;
}

function clampPct(pct: number, cap: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(-cap, Math.min(cap, pct));
}

// Secondary lookup maps built once per reprice — exact EAN / article-number
// indexes over the scanned price entries. These are the strong links.
function buildIdIndexes(index: Map<string, ScannedUnitPrice>): {
  byEan: Map<string, ScannedUnitPrice>;
  byArticle: Map<string, ScannedUnitPrice>;
} {
  const byEan = new Map<string, ScannedUnitPrice>();
  const byArticle = new Map<string, ScannedUnitPrice>();
  for (const val of index.values()) {
    if (val.ean) byEan.set(val.ean.replace(/\s+/g, '').toLowerCase(), val);
    if (val.articleNumber) byArticle.set(val.articleNumber.replace(/\s+/g, '').toLowerCase(), val);
  }
  return { byEan, byArticle };
}

// Match a detected line to a scanned price. EAN → article number → fuzzy
// description (exact key, containment either way, or ≥1 shared ≥4-char token).
// The description fallback mirrors invoiceScanService.getFirstScanInsights so
// the surfaces agree on what "the same material" means. Returns the match plus
// how strong it was (exact identifier vs fuzzy) so callers can widen the cap.
function matchScanned(
  line: { description: string; ean?: string; articleNumber?: string },
  index: Map<string, ScannedUnitPrice>,
  ids: { byEan: Map<string, ScannedUnitPrice>; byArticle: Map<string, ScannedUnitPrice> },
): { price: ScannedUnitPrice; exact: boolean } | null {
  const ean = line.ean?.replace(/\s+/g, '').toLowerCase();
  if (ean) {
    const hit = ids.byEan.get(ean);
    if (hit) return { price: hit, exact: true };
  }
  const art = line.articleNumber?.replace(/\s+/g, '').toLowerCase();
  if (art) {
    const hit = ids.byArticle.get(art);
    if (hit) return { price: hit, exact: true };
  }
  const name = line.description.toLowerCase().trim();
  if (!name) return null;
  const exact = index.get(name);
  if (exact) return { price: exact, exact: false };
  const words = name.split(/\s+/).filter((w) => w.length >= 4);
  for (const [key, val] of index) {
    if (name.includes(key) || key.includes(name)) return { price: val, exact: false };
    if (words.some((w) => key.includes(w))) return { price: val, exact: false };
  }
  return null;
}

/**
 * Compose the pricing moat onto raw AI-detected quote lines.
 * Safe to call offline / signed-out / with no scans — layers that have no data
 * are no-ops and the raw AI line falls through unchanged (moatSource: 'ai').
 */
export async function repriceQuoteLinesFromMoat(
  rawItems: MoatLineInput[],
  opts: { trade: string; country: string; userId?: string | null },
): Promise<MoatRepriceResult> {
  const baselines = new Map<string, { qty: number; price: number; source: DeltaSource }>();

  if (!rawItems || rawItems.length === 0) {
    return {
      items: [],
      summary: { totalLines: 0, cohortAdjusted: 0, scanRepriced: 0, lowConfidence: 0, cohortContractors: 0 },
      baselines,
    };
  }

  // Layer 1 — cohort adjustments (qty + price). Never throws; returns input
  // unchanged when the cohort cell is too thin.
  const adjustableLines: AdjustableLine[] = rawItems.map((i) => ({
    id: i.id,
    description: i.description,
    quantity: i.suggestedQuantity,
    unitPrice: i.suggestedPrice,
  }));
  const { lines: cohortLines } = await applyCohortAdjustments(adjustableLines, opts);
  const cohortById = new Map(cohortLines.map((l) => [l.id, l]));

  // Layer 2 — own scanned material prices. EAN/article indexes for exact match.
  const scanIndex = await getScannedUnitPriceIndex().catch(() => new Map<string, ScannedUnitPrice>());
  const scanIds = buildIdIndexes(scanIndex);

  let cohortAdjusted = 0;
  let scanRepriced = 0;
  let lowConfidence = 0;
  let maxContractors = 0;

  const items: MoatLineOutput[] = rawItems.map((raw) => {
    const cohort = cohortById.get(raw.id);
    let qty = cohort ? cohort.quantity : raw.suggestedQuantity;
    let price = cohort ? cohort.unitPrice : raw.suggestedPrice;
    let moatSource: MoatLineOutput['moatSource'] = 'ai';
    let cohortContractors = 0;
    let scanSupplier: string | undefined;

    if (cohort?.adjustmentApplied) {
      cohortAdjusted += 1;
      moatSource = 'cohort';
      cohortContractors = cohort.cohortContractors;
      maxContractors = Math.max(maxContractors, cohort.cohortContractors);
    }

    // Scanned-price reprice. Exact EAN/article match works on any unit; a fuzzy
    // description match only on discrete-material units.
    const unit = (raw.unit || '').toLowerCase().trim();
    if (scanIndex.size > 0) {
      const m = matchScanned(
        { description: raw.description, ean: raw.ean, articleNumber: raw.articleNumber },
        scanIndex,
        scanIds,
      );
      const eligible = m && (m.exact || MATERIAL_UNITS.has(unit));
      if (m && eligible && m.price.unitPrice > 0) {
        const hasSplit = typeof raw.materialCostPerUnit === 'number' && typeof raw.laborCostPerUnit === 'number';
        let repriced: number;
        if (hasSplit) {
          // Reprice ONLY the material portion; labour is preserved exactly.
          repriced = m.price.unitPrice + (raw.laborCostPerUnit as number);
        } else {
          // No split — nudge the whole line toward the scanned price, capped.
          const cap = m.exact ? SCAN_CAP_EXACT_PCT : SCAN_CAP_PCT;
          const deltaPct = clampPct(((m.price.unitPrice - price) / price) * 100, cap);
          repriced = price * (1 + deltaPct / 100);
        }
        if (Number.isFinite(repriced) && repriced > 0 && Math.abs(repriced - price) >= 0.01) {
          price = repriced;
          moatSource = 'scan';
          scanSupplier = m.price.supplier;
          scanRepriced += 1;
        }
      }
    }

    const confidence = typeof raw.confidence === 'number' ? raw.confidence : 100;
    const needsReview = confidence < CONFIDENCE_GATE;
    if (needsReview) lowConfidence += 1;

    // Seed the delta baseline from the DISPLAYED (post-moat) value so downstream
    // capture measures the contractor's edit against what we actually showed.
    baselines.set(raw.id, {
      qty,
      price,
      source: moatSource === 'cohort' ? 'cohort' : 'ai_draft',
    });

    return {
      ...raw,
      suggestedQuantity: qty,
      suggestedPrice: price,
      baselineQuantity: qty,
      baselineUnitPrice: price,
      moatSource,
      cohortContractors,
      scanSupplier,
      needsReview,
      // Confidence gate: a low-confidence line is never auto-added to the quote.
      selected: !needsReview,
    };
  });

  return {
    items,
    summary: {
      totalLines: rawItems.length,
      cohortAdjusted,
      scanRepriced,
      lowConfidence,
      cohortContractors: maxContractors,
    },
    baselines,
  };
}
