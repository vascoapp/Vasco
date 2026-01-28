import { QuoteLineItem } from '../domain/lineItems';

export const quoteLineItems: Record<string, QuoteLineItem[]> = {
  'q-102': [
    { id: 'l1', description: 'Prep & masking', quantity: 1, unitPrice: 320 },
    { id: 'l2', description: 'Primer coat', quantity: 1, unitPrice: 420 },
    { id: 'l3', description: 'Finish coat', quantity: 1, unitPrice: 420 },
  ],
  'q-103': [
    { id: 'l1', description: 'Prep & masking', quantity: 1, unitPrice: 280 },
    { id: 'l2', description: 'Primer coat', quantity: 1, unitPrice: 420 },
    { id: 'l3', description: 'Finish coat', quantity: 1, unitPrice: 420 },
  ],
  'q-104': [
    { id: 'l1', description: 'Surface prep', quantity: 1, unitPrice: 240 },
    { id: 'l2', description: 'Stain coat', quantity: 1, unitPrice: 540 },
  ],
};
