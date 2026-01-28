import { ExtractionResult } from '../ingestion/pdfSchema';

export const extractedPdfHistory: ExtractionResult[] = [
  {
    document: {
      source: 'pdf',
      docType: 'quote',
      vendorName: 'Vasco Painters',
      customerName: 'Van Dijk',
      jobTitle: 'Exterior repaint',
      issueDate: '2025-11-12',
      lineItems: [
        {
          description: 'Prep & masking',
          quantity: 1,
          unitPrice: 200,
          totalPrice: 200,
        },
        {
          description: 'Primer coat',
          quantity: 1,
          unitPrice: 420,
          totalPrice: 420,
        },
      ],
      subtotal: 620,
      taxTotal: 130.2,
      total: 750.2,
      currency: 'EUR',
    },
    confidence: 0.9,
  },
  {
    document: {
      source: 'pdf',
      docType: 'invoice',
      vendorName: 'Vasco Painters',
      customerName: 'De Jong',
      jobTitle: 'Interior repaint',
      issueDate: '2025-10-22',
      lineItems: [
        {
          description: 'Prep & masking',
          quantity: 1,
          unitPrice: 220,
          totalPrice: 220,
        },
        {
          description: 'Finish coat',
          quantity: 1,
          unitPrice: 420,
          totalPrice: 420,
        },
      ],
      subtotal: 640,
      taxTotal: 134.4,
      total: 774.4,
      currency: 'EUR',
    },
    confidence: 0.86,
  },
];
