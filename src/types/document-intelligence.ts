// =============================================================================
// DOCUMENT INTELLIGENCE - Types
// =============================================================================
// OCR/VLM extraction for receipts, invoices, contracts, permits
// a16z Reducto pattern: "Documents are the bottleneck"
// =============================================================================

// ============================================
// DOCUMENT TYPES
// ============================================

export type DocumentType =
  | 'receipt'
  | 'supplier-invoice'
  | 'customer-invoice'
  | 'quote'
  | 'contract'
  | 'permit'
  | 'certification'
  | 'warranty'
  | 'insurance'
  | 'photo'
  | 'email'
  | 'unknown';

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'needs-review';

// ============================================
// DOCUMENT ENTITY
// ============================================

export interface IntelligentDocument {
  id: string;

  // Source
  sourceUri: string;
  sourceType: 'camera' | 'gallery' | 'email' | 'upload' | 'scan';
  originalFilename?: string;
  mimeType: string;
  fileSize: number;

  // Classification
  documentType: DocumentType;
  classificationConfidence: number;

  // Processing
  status: ProcessingStatus;
  processedAt?: string;
  processingError?: string;

  // Extracted Data
  extractedData?: ExtractedDocumentData;

  // Linking
  linkedEntityType?: 'job' | 'customer' | 'expense' | 'material' | 'quote' | 'invoice';
  linkedEntityId?: string;
  autoLinked: boolean;
  linkConfidence?: number;

  // Compliance
  complianceFlags?: ComplianceFlag[];

  // Metadata
  createdAt: string;
  createdBy: string;
}

// ============================================
// EXTRACTED DATA BY DOCUMENT TYPE
// ============================================

export type ExtractedDocumentData =
  | ExtractedReceipt
  | ExtractedSupplierInvoice
  | ExtractedContract
  | ExtractedPermit
  | ExtractedCertification
  | ExtractedWarranty;

export interface ExtractedReceipt {
  type: 'receipt';

  // Vendor
  vendorName: string;
  vendorAddress?: string;
  vendorVatNumber?: string;

  // Transaction
  transactionDate: string;
  transactionTime?: string;
  receiptNumber?: string;

  // Line Items
  lineItems: ReceiptLineItem[];

  // Totals
  subtotal?: number;
  vatAmount?: number;
  vatRate?: number;
  total: number;
  currency: 'EUR' | 'GBP';

  // Payment
  paymentMethod?: 'cash' | 'card' | 'pin' | 'contactless' | 'bank-transfer';
  cardLastFour?: string;

  // Category (auto-detected)
  suggestedCategory?: 'materials' | 'fuel' | 'tools' | 'vehicle' | 'other';

  // Raw text for search
  rawText?: string;
}

export interface ReceiptLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
  sku?: string;

  // Material matching
  matchedMaterialId?: string;
  matchedMaterialName?: string;
  matchConfidence?: number;
}

export interface ExtractedSupplierInvoice {
  type: 'supplier-invoice';

  // Supplier
  supplierName: string;
  supplierAddress?: string;
  supplierVatNumber?: string;
  supplierKvkNumber?: string;
  supplierIban?: string;

  // Invoice Details
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  orderReference?: string;
  customerReference?: string;

  // Line Items
  lineItems: InvoiceLineItem[];

  // Totals
  subtotal: number;
  vatBreakdown: VatBreakdown[];
  totalVat: number;
  total: number;
  currency: 'EUR' | 'GBP';

  // Payment
  paymentTerms?: string;
  iban?: string;
  paymentReference?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  vatRate: number;
  total: number;
  articleNumber?: string;
}

export interface VatBreakdown {
  rate: number;
  taxableAmount: number;
  vatAmount: number;
}

export interface ExtractedContract {
  type: 'contract';

  // Parties
  partyA: ContractParty;
  partyB: ContractParty;

  // Contract Details
  contractType: 'service' | 'subcontract' | 'supplier' | 'employment' | 'other';
  contractDate: string;
  startDate?: string;
  endDate?: string;

  // Scope
  scopeDescription: string;
  deliverables?: string[];

  // Financial
  totalValue?: number;
  paymentTerms?: string;
  paymentSchedule?: PaymentMilestone[];

  // Terms
  warrantyPeriod?: string;
  liabilityLimit?: number;
  terminationClause?: string;

  // Key Dates
  keyDates: ContractDate[];

  // Compliance Alerts
  complianceRequirements?: string[];
}

export interface ContractParty {
  name: string;
  role: 'contractor' | 'client' | 'subcontractor' | 'supplier';
  address?: string;
  kvkNumber?: string;
  vatNumber?: string;
  contactPerson?: string;
  contactEmail?: string;
}

export interface PaymentMilestone {
  description: string;
  percentage?: number;
  amount?: number;
  triggerEvent: string;
  dueDate?: string;
}

export interface ContractDate {
  label: string;
  date: string;
  isDeadline: boolean;
  reminderDaysBefore?: number;
}

export interface ExtractedPermit {
  type: 'permit';

  // Permit Details
  permitType: 'building' | 'environmental' | 'planning' | 'fire' | 'other';
  permitNumber: string;
  issueDate: string;
  expiryDate?: string;

  // Authority
  issuingAuthority: string;
  authorityReference?: string;

  // Property/Project
  propertyAddress?: string;
  projectDescription?: string;

  // Conditions
  conditions?: string[];
  restrictions?: string[];

  // Compliance Requirements
  inspectionRequired?: boolean;
  nextInspectionDate?: string;
}

export interface ExtractedCertification {
  type: 'certification';

  // Certification Details
  certificationName: string;
  certificationBody: string;
  certificationNumber: string;

  // Holder
  holderName: string;
  holderType: 'individual' | 'company';

  // Validity
  issueDate: string;
  expiryDate: string;
  isValid: boolean;

  // Scope
  scope?: string[];
  restrictions?: string[];

  // Renewal
  renewalRequired: boolean;
  renewalDeadline?: string;
}

export interface ExtractedWarranty {
  type: 'warranty';

  // Warranty Details
  warrantyProvider: string;
  warrantyNumber?: string;

  // Coverage
  productOrService: string;
  coverageDescription: string;
  startDate: string;
  endDate: string;
  durationMonths: number;

  // Terms
  coverageItems: string[];
  exclusions?: string[];
  claimProcess?: string;

  // Contact
  claimContactPhone?: string;
  claimContactEmail?: string;
  claimPortalUrl?: string;
}

// ============================================
// COMPLIANCE FLAGS
// ============================================

export interface ComplianceFlag {
  type: 'missing-vat' | 'invalid-vat' | 'expiring-soon' | 'expired' | 'missing-field' | 'suspicious';
  severity: 'info' | 'warning' | 'error';
  message: string;
  field?: string;
  suggestedAction?: string;
}

// ============================================
// DOCUMENT PROCESSING REQUEST
// ============================================

export interface DocumentProcessingRequest {
  sourceUri: string;
  sourceType: IntelligentDocument['sourceType'];
  suggestedType?: DocumentType;
  autoLink?: boolean;
  jobId?: string;
  customerId?: string;
}

export interface DocumentProcessingResult {
  document: IntelligentDocument;
  suggestedActions?: DocumentSuggestedAction[];
  timeSavedMinutes: number;
}

export interface DocumentSuggestedAction {
  type: 'create-expense' | 'link-to-job' | 'update-inventory' | 'add-to-compliance' | 'flag-for-review';
  title: string;
  description: string;
  payload: unknown;
  confidence: number;
}

// ============================================
// DOCUMENT SEARCH & FILTER
// ============================================

export interface DocumentFilter {
  documentType?: DocumentType[];
  status?: ProcessingStatus[];
  dateFrom?: string;
  dateTo?: string;
  linkedEntityType?: string;
  hasComplianceFlags?: boolean;
  searchText?: string;
}

export interface DocumentSearchResult {
  document: IntelligentDocument;
  matchedText?: string;
  relevanceScore: number;
}

// ============================================
// DOCUMENT STATS
// ============================================

export interface DocumentStats {
  totalDocuments: number;
  byType: Record<DocumentType, number>;
  byStatus: Record<ProcessingStatus, number>;

  // Processing metrics
  avgProcessingTimeMs: number;
  totalProcessed: number;
  successRate: number;

  // Time saved
  totalTimeSavedMinutes: number;
  avgTimeSavedPerDocument: number;

  // Compliance
  documentsWithFlags: number;
  expiringWithin30Days: number;
}
