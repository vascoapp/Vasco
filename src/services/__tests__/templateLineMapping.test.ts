/**
 * @jest-environment node
 *
 * The real mapping functions the quote builder uses — not a replica. They were
 * extracted from TieredQuoteBuilder precisely so this file could import them;
 * as inline closures inside the component, nothing could hold them honest,
 * and both directions cross an `as unknown as PricebookItem` cast that the
 * compiler cannot see through.
 */
import {
  templateItemToBuilderLine,
  builderLinesToTemplateItems,
  TEMPLATE_ITEM_TYPES,
  type BuilderLine,
} from '../templateLineMapping';
import type { QuoteTemplateItem } from '../quoteTemplateService';

const STANDARD = 21;

const line = (over: Partial<QuoteTemplateItem> = {}): QuoteTemplateItem => ({
  description: 'Onderhoud', quantity: 1, unit: 'uur',
  unitPrice: 80, vatRate: 21, type: 'labour', ...over,
});

const roundTrip = (items: QuoteTemplateItem[]): QuoteTemplateItem[] =>
  builderLinesToTemplateItems(
    items.map((i, idx) => templateItemToBuilderLine(i, `id-${idx}`, 'Groep')) as BuilderLine[],
    STANDARD,
  );

describe('template → builder → template', () => {
  it.each(TEMPLATE_ITEM_TYPES)('preserves a %s line', (type) => {
    // The mapping used to collapse this to `labour : materials`, so saving a
    // loaded template rewrote every equipment and other line to materials.
    expect(roundTrip([line({ type })])[0].type).toBe(type);
  });

  it('preserves a reduced VAT rate', () => {
    // The built-in NL maintenance templates carry 9% labour lines; stamping
    // the country standard on save rewrote them to 21% in storage.
    expect(roundTrip([line({ vatRate: 9 })])[0].vatRate).toBe(9);
  });

  it('is stable across two round trips', () => {
    const original = [line({ type: 'equipment', vatRate: 9, quantity: 3, unit: 'dag', unitPrice: 125 })];
    const once = roundTrip(original);
    expect(roundTrip(once)).toEqual(once);
    expect(once).toEqual(original);
  });
});

describe('a line picked from the pricebook', () => {
  // A real PricebookItem: a trade ServiceCategory, and no vatRate at all.
  const picked: BuilderLine[] = [
    { item: { id: 'pb-1', name: 'Kraan vervangen', basePrice: 45, unit: 'stuk', category: 'repairs' }, quantity: 2, unit: 'stuk' },
  ];

  it('falls back to the country standard rate', () => {
    expect(builderLinesToTemplateItems(picked, STANDARD)[0].vatRate).toBe(STANDARD);
    expect(builderLinesToTemplateItems(picked, 19)[0].vatRate).toBe(19);
  });

  it("is typed 'other', not 'materials'", () => {
    // ServiceCategory shares no member with the template type union, so the
    // honest answer is that we do not know — a confident 'materials' would be
    // stored as fact.
    expect(builderLinesToTemplateItems(picked, STANDARD)[0].type).toBe('other');
  });

  it('carries quantity, unit and price through untouched', () => {
    const [out] = builderLinesToTemplateItems(picked, STANDARD);
    expect(out).toMatchObject({ description: 'Kraan vervangen', quantity: 2, unit: 'stuk', unitPrice: 45 });
  });
});
