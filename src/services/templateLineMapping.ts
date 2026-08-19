// =============================================================================
// TEMPLATE ↔ QUOTE-LINE MAPPING
// =============================================================================
// The quote builder carries template lines as PricebookItem-shaped objects,
// because that is what the rest of the builder consumes. Two of the fields a
// template needs — the line's `type` and its own `vatRate` — do not exist on
// PricebookItem, so they ride along through an `as unknown as PricebookItem`
// cast. A cast is invisible to the compiler, which is exactly why this pair
// lives in its own module with tests rather than as two closures inside a
// 2000-line component.
//
// Both round-trip losses this prevents were real:
//   - collapsing `type` to labour|materials rewrote every `equipment` and
//     `other` line to `materials` on the first save;
//   - stamping the country standard rate over `vatRate` rewrote the NL 9%
//     reduced-rate lines on the built-in maintenance templates to 21%.
// =============================================================================

import type { QuoteTemplateItem } from './quoteTemplateService';

export const TEMPLATE_ITEM_TYPES: QuoteTemplateItem['type'][] = [
  'labour', 'materials', 'equipment', 'other',
];

/** The shape the builder holds in `selectedServices`. */
export interface BuilderLine {
  item: { id: string; name: string; basePrice: number; unit?: string; category?: string; vatRate?: number };
  quantity: number;
  unit: string;
}

/** A localized template line → the builder's line shape. */
export function templateItemToBuilderLine(
  item: Pick<QuoteTemplateItem, 'description' | 'quantity' | 'unit' | 'unitPrice' | 'vatRate' | 'type'>,
  id: string,
  groupName: string,
): BuilderLine & { item: BuilderLine['item'] & { contractorId: string; description: string; pricingType: string } } {
  return {
    item: {
      id,
      contractorId: '',
      name: item.description,
      description: groupName,
      category: item.type,
      vatRate: item.vatRate,
      pricingType: 'fixed',
      basePrice: item.unitPrice,
      unit: item.unit,
    },
    quantity: item.quantity,
    unit: item.unit,
  };
}

/**
 * Builder lines → template items.
 *
 * `standardVatRate` is the contractor's country standard, used only for a line
 * that carries no rate of its own — a pick from the pricebook. It must never
 * be the QUOTE's effective rate: KOR / Kleinunternehmer status belongs to the
 * quote and is recomputed per quote (R38), so a 0 here would make every future
 * quote built from this template VAT-free.
 */
export function builderLinesToTemplateItems(
  lines: BuilderLine[],
  standardVatRate: number,
): QuoteTemplateItem[] {
  return lines.map((sv) => ({
    description: sv.item.name,
    quantity: sv.quantity,
    unit: sv.unit,
    unitPrice: sv.item.basePrice,
    vatRate: typeof sv.item.vatRate === 'number' ? sv.item.vatRate : standardVatRate,
    // A pricebook item's `category` is a ServiceCategory (painting, repairs,
    // finishing…) which shares no member with this union. Mapping the unknown
    // case to 'materials' would put a confident wrong answer in storage.
    type: TEMPLATE_ITEM_TYPES.includes(sv.item.category as QuoteTemplateItem['type'])
      ? (sv.item.category as QuoteTemplateItem['type'])
      : 'other',
  }));
}
