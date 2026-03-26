import { QuoteLineItem } from '../domain/lineItems';

export const quoteLineItems: Record<string, QuoteLineItem[]> = {
  'q-seed-1': [
    { id: 'ls1', description: 'Lekkage opsporing', quantity: 1, unitPrice: 95 },
    { id: 'ls2', description: 'Inspectie rapport', quantity: 1, unitPrice: 85 },
  ],
  'q-seed-2': [
    { id: 'ls3', description: 'CV-ketel inspectie', quantity: 1, unitPrice: 150 },
    { id: 'ls4', description: 'Filter vervanging', quantity: 1, unitPrice: 45 },
    { id: 'ls5', description: 'Waterdruk controle', quantity: 1, unitPrice: 75 },
    { id: 'ls6', description: 'Voorrijkosten', quantity: 1, unitPrice: 35 },
    { id: 'ls7', description: 'Onderhoudscertificaat', quantity: 1, unitPrice: 145 },
  ],
  'q-seed-3': [
    { id: 'ls8', description: 'Sanitair demontage', quantity: 1, unitPrice: 480 },
    { id: 'ls9', description: 'Leidingwerk aanpassen', quantity: 1, unitPrice: 1200 },
    { id: 'ls10', description: 'Tegels plaatsen', quantity: 12, unitPrice: 85 },
    { id: 'ls11', description: 'Sanitair installatie', quantity: 1, unitPrice: 750 },
    { id: 'ls12', description: 'Afwerking en kitwerk', quantity: 1, unitPrice: 350 },
    { id: 'ls13', description: 'Materiaalkosten', quantity: 1, unitPrice: 400 },
  ],
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
