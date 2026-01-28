import { ExtractedDocument } from '../ingestion/pdfSchema';
import { Quote } from '../domain/documents';
import { QuoteLineItem } from '../domain/lineItems';
import { PriceRiskSignal } from '../domain/insights';

type LineItemMap = Record<string, QuoteLineItem[]>;

const normalize = (value: string) => value.trim().toLowerCase();

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

export function buildPriceRiskSignals(
  quotes: Quote[],
  quoteLineItems: LineItemMap,
  extractedDocs: ExtractedDocument[]
): PriceRiskSignal[] {
  const historicalPrices: Record<string, number[]> = {};

  extractedDocs.forEach((doc) => {
    doc.lineItems.forEach((item) => {
      const key = normalize(item.description);
      if (!historicalPrices[key]) {
        historicalPrices[key] = [];
      }
      historicalPrices[key].push(item.unitPrice);
    });
  });

  const signals: PriceRiskSignal[] = [];

  quotes.forEach((quote) => {
    if (quote.status !== 'draft') return;
    const items = quoteLineItems[quote.id] ?? [];

    items.forEach((item) => {
      const key = normalize(item.description);
      const history = historicalPrices[key] ?? [];
      const typical = median(history);
      if (!typical || item.unitPrice <= typical * 1.2) return;

      const savings = (item.unitPrice - typical) * item.quantity;
      if (savings <= 0) return;

      signals.push({
        quoteId: quote.id,
        customer: quote.customer,
        estimatedSavings: Math.round(savings),
        reason: `Typical ${item.description.toLowerCase()} is lower.`,
        lineItem: item.description,
        suggestedUnitPrice: Math.round(typical),
      });
    });
  });

  return signals.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}
