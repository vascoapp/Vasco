// =============================================================================
// PRICEBOOK — the services a contractor sells, priced once and reused
// =============================================================================
// Quoting today starts from an empty line item every time: type a description,
// type a price, hope it matches what you charged the last customer for the same
// work. A pricebook is the contractor's own catalogue — "wall prep, €12/m²",
// "boiler service, €95 fixed" — so a quote is assembled by picking rather than
// by remembering. ServiceTitan ships one at its entry tier; it is the cheapest
// thing on the competitive gap list and the one a solo contractor touches most.
//
// This replaces a screen that was fed entirely by MOCK_PRICEBOOK: twelve
// invented painting services belonging to "contractor-001", with an add button
// that had no handler. The UI was real; nothing behind it was.
//
// Storage mirrors jobFormService / quoteTemplateService: AsyncStorage,
// contractor-local. A pricebook is configuration — what I charge — not shared
// data, and it must be readable with no signal on a customer's driveway.
//
// -----------------------------------------------------------------------------
// TWO DESIGN RULES, both learned the expensive way
// -----------------------------------------------------------------------------
//
// 1. COST AND MARGIN ARE DERIVED, NEVER STORED. The old PricebookItem carried
//    `totalCost` and `margin` as fields alongside the inputs they come from,
//    and in the mock they had already drifted apart: 15 min at €55/h plus €2.50
//    of materials is €16.25, sitting next to a stored totalCost of €12. Two
//    numbers that disagree, one of them shown to the contractor as fact. Same
//    class as project.totalInvoiced (progress billing) — a denormalised field
//    nothing maintains. Here they are functions of the entry, so they cannot
//    drift.
//
// 2. NO COST INPUTS ⇒ MARGIN IS null, NOT A GUESS. If the contractor has not
//    told us what the work costs them, we do not know their margin, and the UI
//    must show nothing rather than a plausible number. The quote optimizer's
//    "margin" was `unitPrice * 0.7`, which made every line exactly 30% and its
//    `margin < 15` warning unreachable — a safeguard that checked nothing.
//    See learnings #103.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PRICEBOOK_KEY = '@vasco_pricebook';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A superset of the legacy painting-shop categories, which were the mock
 * author's trade rather than a taxonomy: "preparation / painting / finishing"
 * gives a plumber nowhere to put a boiler service. The old members are kept so
 * existing typed data stays assignable. The filter row derives its pills from
 * the categories actually in use, so the unused ones never render.
 */
export type PricebookCategory =
  // legacy
  | 'preparation'
  | 'painting'
  | 'repairs'
  | 'finishing'
  | 'specialty'
  | 'consultation'
  // trade-neutral
  | 'callout'
  | 'installation'
  | 'maintenance'
  | 'inspection'
  | 'other';

/** How `basePrice` should be read. */
export type PricebookPricingType = 'fixed' | 'per-unit' | 'hourly';

/**
 * Good-better-best. The old shape stored `priceModifier` (a multiplier) AND
 * `price`, which is the same drift trap as totalCost — two fields for one fact.
 * Only the price survives.
 */
export interface PricebookVariantEntry {
  id: string;
  tier: 'good' | 'better' | 'best';
  name: string;
  price: number;
  features: string[];
  isRecommended?: boolean;
}

export interface PricebookEntry {
  id: string;
  name: string;
  description: string;
  category: PricebookCategory;

  pricingType: PricebookPricingType;
  /** What the customer pays, per `unit` when pricingType is not 'fixed'. */
  basePrice: number;
  /** "m²", "m", "hour", "each". Meaningless for 'fixed'. */
  unit?: string;

  // --- Cost inputs. All optional: a contractor who only knows their price is
  // --- a normal contractor, and we would rather show no margin than a fake one.
  /** Minutes of labour in one unit of this service. */
  laborMinutes?: number;
  /** What an hour of that labour COSTS the business — not the charge-out rate. */
  laborCostRate?: number;
  /** What the materials for one unit cost, before any markup. */
  materialsCost?: number;

  variants?: PricebookVariantEntry[];

  isActive: boolean;
  /** Incremented when the entry is pulled into a quote. Real telemetry — it is
   *  observed, not derivable, so unlike cost and margin it is genuinely stored. */
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Arithmetic — pure, so the numbers that decide what a customer is charged are
// testable without a database or a rendered screen.
// ---------------------------------------------------------------------------

/**
 * What one unit of this service costs to deliver, or null if the contractor
 * has given us nothing to compute it from.
 *
 * Note `laborCostRate` is a COST rate. Feeding a charge-out rate in here
 * produces a margin near zero, which is why the field is named for what it is
 * and the editor labels it "what this hour costs you".
 */
export function costOf(entry: Pick<PricebookEntry, 'laborMinutes' | 'laborCostRate' | 'materialsCost'>): number | null {
  const hasLabour = typeof entry.laborMinutes === 'number' && typeof entry.laborCostRate === 'number';
  const hasMaterials = typeof entry.materialsCost === 'number';
  if (!hasLabour && !hasMaterials) return null;

  const labour = hasLabour ? (entry.laborMinutes! / 60) * entry.laborCostRate! : 0;
  const materials = hasMaterials ? entry.materialsCost! : 0;
  const total = labour + materials;
  return Number.isFinite(total) ? total : null;
}

/**
 * Gross margin as a percentage of price, or null when unknowable.
 *
 * Null — rather than 0 or 100 — for a zero/negative price: a free or
 * placeholder line has no meaningful margin, and dividing by it would print
 * Infinity next to real money. A NEGATIVE result is returned as-is and is the
 * point: a service that costs more than it charges is exactly what a contractor
 * needs to see.
 */
export function marginOf(entry: Pick<PricebookEntry, 'basePrice' | 'laborMinutes' | 'laborCostRate' | 'materialsCost'>): number | null {
  const cost = costOf(entry);
  if (cost === null) return null;
  if (!(entry.basePrice > 0)) return null;
  return ((entry.basePrice - cost) / entry.basePrice) * 100;
}

/**
 * The price that would hit a target margin, for the editor's "price this for
 * me" affordance. Returns null when there is no cost to mark up, and for a
 * target of 100% or more, which has no finite solution.
 */
export function suggestPrice(
  entry: Pick<PricebookEntry, 'laborMinutes' | 'laborCostRate' | 'materialsCost'>,
  targetMarginPercent: number,
): number | null {
  const cost = costOf(entry);
  if (cost === null || cost <= 0) return null;
  if (!(targetMarginPercent < 100) || targetMarginPercent < 0) return null;
  return cost / (1 - targetMarginPercent / 100);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface PricebookError {
  field: 'name' | 'basePrice' | 'unit' | 'variants';
  message: string;
}

/**
 * Blocks only what would produce a wrong number on a customer's quote. A
 * missing cost breakdown is not an error — see design rule 2.
 */
export function validateEntry(entry: Partial<PricebookEntry>): PricebookError[] {
  const errors: PricebookError[] = [];

  if (!entry.name || !entry.name.trim()) {
    errors.push({ field: 'name', message: 'pricebook.error.nameRequired' });
  }
  if (typeof entry.basePrice !== 'number' || !Number.isFinite(entry.basePrice) || entry.basePrice < 0) {
    errors.push({ field: 'basePrice', message: 'pricebook.error.priceRequired' });
  }
  // "€12" with no unit is not a price a customer can check. Only 'fixed'
  // escapes this, because "€95 to service the boiler" is complete on its own.
  if (entry.pricingType && entry.pricingType !== 'fixed' && !entry.unit?.trim()) {
    errors.push({ field: 'unit', message: 'pricebook.error.unitRequired' });
  }
  if (entry.variants?.some((v) => !(v.price >= 0))) {
    errors.push({ field: 'variants', message: 'pricebook.error.variantPrice' });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Filtering — used by the list screen and the quote picker alike
// ---------------------------------------------------------------------------

export function searchEntries(entries: PricebookEntry[], query: string, category?: PricebookCategory | null): PricebookEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter((e) => {
    if (!e.isActive) return false;
    if (category && e.category !== category) return false;
    if (!q) return true;
    return e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q);
  });
}

/** Categories actually in use, so the filter row never offers an empty pill. */
export function categoriesInUse(entries: PricebookEntry[]): PricebookCategory[] {
  return [...new Set(entries.filter((e) => e.isActive).map((e) => e.category))];
}

export function newEntry(): PricebookEntry {
  const now = new Date().toISOString();
  return {
    id: `pb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    description: '',
    category: 'other',
    pricingType: 'fixed',
    basePrice: 0,
    isActive: true,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function loadPricebook(): Promise<PricebookEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(PRICEBOOK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePricebook(entries: PricebookEntry[]): Promise<void> {
  await AsyncStorage.setItem(PRICEBOOK_KEY, JSON.stringify(entries)).catch(() => {});
}

/**
 * Called when an entry is pulled into a quote. Read-modify-write against
 * storage rather than against a component's copy: the quote screen holds a
 * snapshot from whenever it mounted, and writing that back would silently
 * revert an edit made in the editor in between.
 */
export async function recordUsage(id: string): Promise<void> {
  const all = await loadPricebook();
  const now = new Date().toISOString();
  await savePricebook(all.map((e) => (e.id === id ? { ...e, usageCount: e.usageCount + 1, lastUsed: now } : e)));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePricebook() {
  const [entries, setEntries] = useState<PricebookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPricebook()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const refresh = useCallback(async () => {
    setEntries(await loadPricebook());
  }, []);

  const persist = useCallback(async (next: PricebookEntry[]) => {
    setEntries(next);
    await savePricebook(next);
  }, []);

  const upsert = useCallback(
    async (entry: PricebookEntry) => {
      const now = new Date().toISOString();
      // Re-read rather than trusting this hook's snapshot: recordUsage writes
      // to the same blob from the quote screen, and a stale copy here would
      // roll its counter back.
      const all = await loadPricebook();
      const exists = all.some((e) => e.id === entry.id);
      const next = exists
        ? all.map((e) => (e.id === entry.id ? { ...entry, usageCount: e.usageCount, lastUsed: e.lastUsed, createdAt: e.createdAt, updatedAt: now } : e))
        : [...all, { ...entry, createdAt: now, updatedAt: now }];
      await persist(next);
    },
    [persist],
  );

  const remove = useCallback(
    async (id: string) => {
      const all = await loadPricebook();
      await persist(all.filter((e) => e.id !== id));
    },
    [persist],
  );

  return { entries, loading, refresh, upsert, remove };
}
