export type ExtractedLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type ExtractedDocument = {
  source: 'pdf';
  docType: 'quote' | 'invoice';
  vendorName?: string;
  customerName?: string;
  jobTitle?: string;
  issueDate?: string;
  lineItems: ExtractedLineItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  currency: 'EUR';
};

export type ExtractionResult = {
  document: ExtractedDocument;
  confidence: number;
};
