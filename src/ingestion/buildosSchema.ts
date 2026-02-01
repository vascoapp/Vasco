// BuildOS Document Ingestion Schema
// Extended types for CRE development document processing

import type { Country, Currency } from '../types/buildos';

// Base extraction result
export type ExtractionConfidence = 'high' | 'medium' | 'low';

export interface ExtractionMeta {
  extractedAt: string;
  processingTimeMs: number;
  confidence: ExtractionConfidence;
  confidenceScore: number; // 0-1
  warnings: string[];
  sourceFile: string;
  pageCount?: number;
}

// ============================================
// CRE DOCUMENT TYPES
// ============================================

export type CREDocumentType =
  | 'invoice'
  | 'payment-application'
  | 'payment-certificate'
  | 'change-order'
  | 'variation-order'
  | 'contract'
  | 'subcontract'
  | 'professional-appointment'
  | 'permit-application'
  | 'permit-decision'
  | 'site-report'
  | 'qs-valuation'
  | 'insurance-certificate'
  | 'bond'
  | 'unknown';

// ============================================
// PAYMENT APPLICATION / CERTIFICATE
// ============================================

export interface PaymentCertLine {
  costCode: string;
  description: string;
  contractSum: number;
  previousCertified: number;
  thisPeriod: number;
  cumulativeCertified: number;
  percentComplete: number;
}

export interface ExtractedPaymentCert {
  docType: 'payment-certificate' | 'payment-application';
  certNumber: number;
  period: string;
  periodEnd: string;
  contractor: string;
  projectRef: string;
  lines: PaymentCertLine[];
  grossValuation: number;
  lessPreviousCerts: number;
  netPayable: number;
  retentionHeld: number;
  retentionPercent: number;
  vatAmount: number;
  totalDue: number;
  currency: Currency;
  dueDate?: string;
  qsSigned?: boolean;
  clientSigned?: boolean;
}

// ============================================
// CHANGE ORDER / VARIATION ORDER
// ============================================

export interface ExtractedChangeOrder {
  docType: 'change-order' | 'variation-order';
  coNumber: string;
  projectRef: string;
  contractRef: string;
  contractor: string;
  description: string;
  reason: string;
  requestedBy: string;
  dateSubmitted: string;
  proposedCost: number;
  proposedTimeImpact?: number; // days
  currency: Currency;
  status?: 'pending' | 'approved' | 'rejected';
  breakdown?: {
    category: string;
    amount: number;
  }[];
}

// ============================================
// CONTRACT
// ============================================

export interface ExtractedContract {
  docType: 'contract' | 'subcontract' | 'professional-appointment';
  contractRef: string;
  projectName: string;
  employer: string;
  contractor: string;
  contractType: string; // JCT, FIDIC, NEC, etc.
  contractSum: number;
  currency: Currency;
  startDate: string;
  completionDate: string;
  retentionPercent: number;
  defectsLiabilityPeriod: number; // months
  paymentTerms: string;
  liquidatedDamages?: number; // per day/week
  performanceBond?: number;
  insuranceRequirements?: string[];
}

// ============================================
// PERMIT
// ============================================

export interface ExtractedPermit {
  docType: 'permit-application' | 'permit-decision';
  permitType: string;
  reference: string;
  authority: string;
  projectAddress: string;
  applicant: string;
  submissionDate?: string;
  decisionDate?: string;
  decision?: 'approved' | 'approved-with-conditions' | 'rejected' | 'withdrawn';
  conditions?: string[];
  s106Amount?: number; // UK-specific
  cilAmount?: number; // UK-specific
  validUntil?: string;
  country: Country;
}

// ============================================
// INVOICE
// ============================================

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  costCode?: string;
}

export interface ExtractedInvoice {
  docType: 'invoice';
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  supplier: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  project?: string;
  poNumber?: string;
  costCode?: string;
  lines: InvoiceLine[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: Currency;
  paymentDetails?: {
    bankName?: string;
    iban?: string;
    bic?: string;
  };
}

// ============================================
// SITE REPORT
// ============================================

export interface ExtractedSiteReport {
  docType: 'site-report';
  reportDate: string;
  project: string;
  weather: string;
  temperature?: number;
  workforceCount: number;
  hoursWorked: number;
  workCompleted: string[];
  delaysEncountered?: string[];
  safetyObservations?: string[];
  deliveries?: {
    supplier: string;
    description: string;
  }[];
  visitorsOnSite?: string[];
  photos?: number;
  preparedBy: string;
}

// ============================================
// QS VALUATION
// ============================================

export interface ValuationLine {
  element: string;
  contractSum: number;
  variationsApproved: number;
  currentContractSum: number;
  valuedToDate: number;
  percentComplete: number;
}

export interface ExtractedQSValuation {
  docType: 'qs-valuation';
  valuationNumber: number;
  valuationDate: string;
  project: string;
  contractor: string;
  lines: ValuationLine[];
  originalContractSum: number;
  approvedVariations: number;
  currentContractSum: number;
  grossValuation: number;
  materialsOnSite: number;
  lessRetention: number;
  lessPreviousCerts: number;
  amountDue: number;
  currency: Currency;
}

// ============================================
// INSURANCE CERTIFICATE
// ============================================

export interface ExtractedInsurance {
  docType: 'insurance-certificate';
  policyNumber: string;
  insurer: string;
  insured: string;
  project: string;
  coverType: string; // CAR, PI, PL, Employer's Liability
  coverAmount: number;
  excessAmount?: number;
  inceptionDate: string;
  expiryDate: string;
  currency: Currency;
  endorsements?: string[];
}

// ============================================
// UNION TYPE
// ============================================

export type ExtractedCREDocument =
  | ExtractedPaymentCert
  | ExtractedChangeOrder
  | ExtractedContract
  | ExtractedPermit
  | ExtractedInvoice
  | ExtractedSiteReport
  | ExtractedQSValuation
  | ExtractedInsurance;

export interface CREExtractionResult {
  document: ExtractedCREDocument;
  meta: ExtractionMeta;
}

// ============================================
// DOCUMENT CLASSIFIER
// ============================================

export interface ClassificationResult {
  docType: CREDocumentType;
  confidence: number;
  alternativeTypes?: { type: CREDocumentType; confidence: number }[];
}
