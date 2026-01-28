export type PriceRiskSignal = {
  quoteId: string;
  customer: string;
  estimatedSavings: number;
  reason: string;
  lineItem?: string;
  suggestedUnitPrice?: number;
};
