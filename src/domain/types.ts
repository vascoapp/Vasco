export type DocumentStatus = 'draft' | 'sent' | 'paid';
export type DocumentType = 'quote' | 'invoice';

export type Money = {
  amount: number;
  currency: 'EUR';
};

export type DocumentSummary = {
  id: string;
  docType: DocumentType;
  status: DocumentStatus;
  customerName: string;
  jobTitle: string;
  total: Money;
  dueDate?: string;
};
