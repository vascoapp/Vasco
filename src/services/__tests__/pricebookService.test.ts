// =============================================================================
// PRICEBOOK
// =============================================================================
// The properties worth pinning are the ones that put a wrong number in front of
// a customer, or a made-up one in front of the contractor. Chiefly: margin is
// null when it is unknowable, and it is never quietly invented from the price.
// =============================================================================

import {
  costOf,
  marginOf,
  suggestPrice,
  validateEntry,
  searchEntries,
  categoriesInUse,
  type PricebookEntry,
} from '../pricebookService';

const entry = (over: Partial<PricebookEntry> = {}): PricebookEntry => ({
  id: 'pb1',
  name: 'Wandvoorbereiding',
  description: 'Gaten vullen, schuren, gronden',
  category: 'preparation',
  pricingType: 'per-unit',
  basePrice: 20,
  unit: 'm²',
  isActive: true,
  usageCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('cost', () => {
  it('adds labour time at the cost rate to materials', () => {
    // 30 min at €40/h = €20, plus €5 of materials.
    expect(costOf(entry({ laborMinutes: 30, laborCostRate: 40, materialsCost: 5 }))).toBe(25);
  });

  it('is null when the contractor has told us nothing about cost', () => {
    // The whole point: no inputs means we do not know, and the UI must show
    // nothing rather than a plausible figure.
    expect(costOf(entry())).toBeNull();
  });

  it('needs BOTH labour fields — minutes alone price nothing', () => {
    expect(costOf(entry({ laborMinutes: 30 }))).toBeNull();
    expect(costOf(entry({ laborCostRate: 40 }))).toBeNull();
  });

  it('counts materials alone as a cost', () => {
    expect(costOf(entry({ materialsCost: 5 }))).toBe(5);
  });

  it('treats a zero cost as known, not missing', () => {
    // €0 materials is a statement ("this service uses none"), not an absence.
    expect(costOf(entry({ materialsCost: 0 }))).toBe(0);
  });
});

describe('margin', () => {
  it('is a percentage of price, not of cost', () => {
    // €20 price, €5 cost → €15 of €20 = 75%. Reading it as a markup on cost
    // would give 300% and overstate every service in the book.
    expect(marginOf(entry({ basePrice: 20, materialsCost: 5 }))).toBe(75);
  });

  it('is null when cost is unknown — never derived from the price', () => {
    // Guards learnings #103 directly: quoteOptimizer synthesised cost as
    // `unitPrice * 0.7`, so every line was exactly 30% and its own
    // `margin < 15` warning could never fire.
    expect(marginOf(entry({ basePrice: 20 }))).toBeNull();
  });

  it('is null for a zero or negative price rather than Infinity', () => {
    expect(marginOf(entry({ basePrice: 0, materialsCost: 5 }))).toBeNull();
    expect(marginOf(entry({ basePrice: -10, materialsCost: 5 }))).toBeNull();
  });

  it('goes negative when the service loses money, and says so', () => {
    // This is the number a contractor most needs; clamping it at zero would
    // hide the only entry in the book that matters.
    expect(marginOf(entry({ basePrice: 10, materialsCost: 25 }))).toBe(-150);
  });
});

describe('suggested price', () => {
  it('hits the target margin exactly', () => {
    const e = entry({ materialsCost: 30 });
    const price = suggestPrice(e, 40)!;
    expect(price).toBeCloseTo(50);
    // Round-trip: pricing at the suggestion must reproduce the target.
    expect(marginOf({ ...e, basePrice: price })).toBeCloseTo(40);
  });

  it('refuses targets with no finite solution', () => {
    // 100% margin needs an infinite price; over 100% is incoherent.
    expect(suggestPrice(entry({ materialsCost: 30 }), 100)).toBeNull();
    expect(suggestPrice(entry({ materialsCost: 30 }), 120)).toBeNull();
    expect(suggestPrice(entry({ materialsCost: 30 }), -5)).toBeNull();
  });

  it('is null with no cost to mark up', () => {
    expect(suggestPrice(entry(), 40)).toBeNull();
    expect(suggestPrice(entry({ materialsCost: 0 }), 40)).toBeNull();
  });
});

describe('validation', () => {
  it('accepts an entry with no cost breakdown at all', () => {
    // A contractor who knows their price but not their cost is a normal
    // contractor. Demanding a breakdown would push them to invent one.
    expect(validateEntry(entry())).toEqual([]);
  });

  it('requires a unit for per-unit pricing', () => {
    // "€12" with no unit is not a price a customer can check.
    expect(validateEntry(entry({ unit: undefined })).map((e) => e.field)).toEqual(['unit']);
  });

  it('does not require a unit for a fixed price', () => {
    expect(validateEntry(entry({ pricingType: 'fixed', unit: undefined }))).toEqual([]);
  });

  it('rejects a nameless or negatively-priced service', () => {
    expect(validateEntry(entry({ name: '   ' })).map((e) => e.field)).toContain('name');
    expect(validateEntry(entry({ basePrice: -1 })).map((e) => e.field)).toContain('basePrice');
  });

  it('allows a free line', () => {
    // €0 is legitimate — a callout waived, an inspection bundled in.
    expect(validateEntry(entry({ basePrice: 0 }))).toEqual([]);
  });
});

describe('search and filtering', () => {
  const book = [
    entry({ id: 'a', name: 'Wandvoorbereiding', category: 'preparation' }),
    entry({ id: 'b', name: 'CV-ketel onderhoud', description: 'Jaarlijkse beurt', category: 'maintenance' }),
    entry({ id: 'c', name: 'Oud werk', category: 'repairs', isActive: false }),
  ];

  it('hides deactivated entries everywhere', () => {
    expect(searchEntries(book, '').map((e) => e.id)).toEqual(['a', 'b']);
    expect(categoriesInUse(book)).not.toContain('repairs');
  });

  it('matches description as well as name, case-insensitively', () => {
    expect(searchEntries(book, 'JAARLIJKSE').map((e) => e.id)).toEqual(['b']);
  });

  it('combines query and category', () => {
    expect(searchEntries(book, 'ketel', 'preparation')).toEqual([]);
    expect(searchEntries(book, 'ketel', 'maintenance').map((e) => e.id)).toEqual(['b']);
  });
});
