// Vasco Contractor Mode - Types for Individual Trades Contractors
// ServiceTitan-style functionality for painters, plumbers, electricians, etc.

export type TradeType =
  | 'painter'
  | 'plumber'
  | 'electrician'
  | 'hvac'
  | 'carpenter'
  | 'roofer'
  | 'landscaper'
  | 'general-contractor'
  | 'cleaner'
  | 'handyman'
  | 'flooring'
  | 'tiler'
  | 'plasterer'
  | 'locksmith'
  | 'other';

export type JobStatus =
  | 'lead'           // Initial inquiry
  | 'quoted'         // Quote sent
  | 'accepted'       // Customer accepted quote
  | 'scheduled'      // Job scheduled
  | 'in-progress'    // Work started
  | 'completed'      // Work finished
  | 'invoiced'       // Invoice sent
  | 'paid'           // Payment received
  | 'cancelled';     // Job cancelled

export type JobPriority = 'low' | 'normal' | 'high' | 'emergency';

export type PaymentMethod = 'cash' | 'bank-transfer' | 'card' | 'ideal' | 'paypal' | 'invoice';

// ============================================
// CONTRACTOR PROFILE
// ============================================

export interface ContractorProfile {
  id: string;
  userId: string;
  businessName: string;
  tradeName?: string; // "John's Painting" vs legal name
  trade: TradeType;
  secondaryTrades?: TradeType[];
  vatRegistered: boolean;
  vatNumber?: string;
  chamberOfCommerceNumber?: string; // KvK for NL
  insuranceNumber?: string;
  insuranceExpiry?: string;
  certifications: Certification[];
  serviceArea: string[]; // Postcodes or cities
  hourlyRate?: number;
  dayRate?: number;
  currency: 'GBP' | 'EUR';
  bankDetails?: BankDetails;
  branding?: ContractorBranding;
  createdAt: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  number?: string;
  issueDate: string;
  expiryDate?: string;
  documentUri?: string;
}

export interface BankDetails {
  accountHolder: string;
  iban?: string;
  bic?: string;
  accountNumber?: string; // UK sort code + account
  sortCode?: string;
}

export interface ContractorBranding {
  logoUri?: string;
  primaryColor?: string;
  tagline?: string;
  website?: string;
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
  };
}

// ============================================
// CUSTOMERS (CRM)
// ============================================

export interface Customer {
  id: string;
  contractorId: string;
  type: 'residential' | 'commercial' | 'property-manager';
  name: string;
  company?: string;
  email?: string;
  phone: string;
  address: CustomerAddress;
  notes?: string;
  source?: 'referral' | 'website' | 'social' | 'repeat' | 'other';
  referredBy?: string;
  tags?: string[];
  totalJobs: number;
  totalRevenue: number;
  averageRating?: number;
  createdAt: string;
  lastJobDate?: string;
}

export interface CustomerAddress {
  street: string;
  city: string;
  postcode: string;
  country: 'UK' | 'NL' | 'DE';
  accessNotes?: string; // "Key under mat", "Ring doorbell twice"
  parkingNotes?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================
// JOBS
// ============================================

export interface Job {
  id: string;
  contractorId: string;
  customerId: string;
  customer?: Customer; // Populated on fetch

  // Job Details
  title: string;
  description: string;
  trade: TradeType;
  status: JobStatus;
  priority: JobPriority;

  // Location
  address: CustomerAddress;
  siteContact?: string;
  sitePhone?: string;

  // Scheduling
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  estimatedDuration: number; // hours
  actualStartTime?: string;
  actualEndTime?: string;

  // Financial
  quoteId?: string;
  quotedAmount?: number;
  agreedAmount?: number;
  invoiceId?: string;
  invoicedAmount?: number;
  paidAmount?: number;
  paymentMethod?: PaymentMethod;

  // Work Details
  roomsAreas?: string[]; // "Living room", "Kitchen", "Exterior front"
  specifications?: string;
  materialsIncluded: boolean;

  // Documentation
  photos: JobPhoto[];
  notes: JobNote[];
  timeEntries: TimeEntry[];
  materials: MaterialUsage[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface JobPhoto {
  id: string;
  jobId: string;
  uri: string;
  type: 'before' | 'during' | 'after' | 'issue' | 'materials';
  caption?: string;
  takenAt: string;
  latitude?: number;
  longitude?: number;
}

export interface JobNote {
  id: string;
  jobId: string;
  text: string;
  createdAt: string;
  createdBy: string;
  isCustomerVisible: boolean;
}

// ============================================
// QUOTES & ESTIMATES
// ============================================

export interface Quote {
  id: string;
  contractorId: string;
  customerId: string;
  jobId?: string; // Linked if converted to job

  // Quote Details
  reference: string; // "Q-2024-0042"
  title: string;
  description: string;

  // Line Items
  lineItems: QuoteLineItem[];

  // Totals
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: 'GBP' | 'EUR';

  // Terms
  validUntil: string;
  paymentTerms: string; // "50% deposit, 50% on completion"
  estimatedStartDate?: string;
  estimatedDuration?: string;

  // Status
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  sentAt?: string;
  viewedAt?: string;
  respondedAt?: string;
  customerNotes?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLineItem {
  id: string;
  type: 'labour' | 'materials' | 'equipment' | 'other';
  description: string;
  quantity: number;
  unit: string; // "hours", "sqm", "each", "day"
  unitPrice: number;
  total: number;
  notes?: string;
}

// ============================================
// INVOICES
// ============================================

export interface ContractorInvoice {
  id: string;
  contractorId: string;
  customerId: string;
  /** Display name. Without it the payments screen fell back to rendering the
   *  last three characters of `customerId` as "Customer #003". */
  customerName?: string;
  jobId?: string;
  quoteId?: string;

  // Invoice Details
  invoiceNumber: string; // "INV-2024-0089"
  issueDate: string;
  dueDate: string;

  // Line Items
  lineItems: InvoiceLineItem[];

  // Totals
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: 'GBP' | 'EUR';

  // Payment
  status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue';
  amountPaid: number;
  amountDue: number;
  payments: Payment[];

  // Terms
  paymentTerms: string;
  bankDetails?: BankDetails;
  notes?: string;

  // Metadata
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  type: 'labour' | 'materials' | 'equipment' | 'other';
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  receivedAt: string;
  notes?: string;
}

// ============================================
// TIME TRACKING
// ============================================

export interface TimeEntry {
  id: string;
  contractorId: string;
  jobId?: string;

  // Time
  date: string;
  startTime: string;
  endTime?: string;
  breakMinutes: number;
  totalMinutes: number;

  // Details
  description?: string;
  billable: boolean;
  hourlyRate?: number;

  // Location
  clockInLocation?: { latitude: number; longitude: number };
  clockOutLocation?: { latitude: number; longitude: number };

  // Status
  status: 'active' | 'completed' | 'approved';
  createdAt: string;
}

// ============================================
// MATERIALS & INVENTORY
// ============================================

export interface MaterialUsage {
  id: string;
  jobId: string;

  // Material Details
  name: string;
  category: string; // "Paint", "Electrical", "Plumbing"
  sku?: string;
  supplier?: string;

  // Quantity & Cost
  quantity: number;
  unit: string; // "liters", "meters", "each"
  unitCost: number;
  totalCost: number;

  // Billing
  billable: boolean;
  markup?: number; // percentage
  chargeToCustomer?: number;

  // Receipt
  receiptUri?: string;
  purchaseDate?: string;

  createdAt: string;
}

export interface InventoryItem {
  id: string;
  contractorId: string;

  name: string;
  category: string;
  sku?: string;

  quantityInStock: number;
  unit: string;
  reorderLevel?: number;
  preferredSupplier?: string;
  lastPurchasePrice?: number;

  location?: string; // "Van", "Workshop", "Storage unit"

  updatedAt: string;
}

// ============================================
// SCHEDULE & CALENDAR
// ============================================

export interface ScheduleBlock {
  id: string;
  contractorId: string;

  type: 'job' | 'quote-visit' | 'travel' | 'break' | 'personal' | 'unavailable';
  title: string;

  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;

  jobId?: string;
  customerId?: string;
  address?: CustomerAddress;

  color?: string;
  notes?: string;

  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
    endDate?: string;
  };
}

// ============================================
// DASHBOARD METRICS
// ============================================

export interface ContractorDashboardMetrics {
  // This Week
  jobsScheduledThisWeek: number;
  jobsCompletedThisWeek: number;
  revenueThisWeek: number;
  hoursWorkedThisWeek: number;

  // This Month
  jobsCompletedThisMonth: number;
  revenueThisMonth: number;
  expensesThisMonth: number;
  profitThisMonth: number;

  // Outstanding
  quotesOutstanding: number;
  quotesOutstandingValue: number;
  invoicesOutstanding: number;
  invoicesOutstandingValue: number;
  overdueInvoices: number;
  overdueAmount: number;

  // Pipeline
  leadsCount: number;
  scheduledJobsCount: number;
  scheduledJobsValue: number;

  // Performance
  averageJobValue: number;
  quoteConversionRate: number; // percentage
  averagePaymentDays: number;
  repeatCustomerRate: number;

  // Ratings
  averageRating?: number;
  totalReviews?: number;
}

// ============================================
// EXPENSES
// ============================================

export interface Expense {
  id: string;
  contractorId: string;
  jobId?: string;

  date: string;
  category: 'materials' | 'fuel' | 'tools' | 'vehicle' | 'insurance' | 'marketing' | 'software' | 'other';
  description: string;
  amount: number;
  vatAmount?: number;
  currency: 'GBP' | 'EUR';

  supplier?: string;
  receiptUri?: string;

  billable: boolean;
  reimbursed: boolean;

  createdAt: string;
}

// ============================================
// EVIDENCE PACK & HANDOVER
// ============================================

export type EvidenceType =
  | 'photo_before'
  | 'photo_during'
  | 'photo_after'
  | 'checklist'
  | 'warranty'
  | 'certificate'
  | 'material_receipt'
  | 'permit'
  | 'inspection_report'
  | 'customer_signature'
  | 'completion_certificate';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  name: string;
  description?: string;
  uri: string;
  thumbnailUri?: string;
  mimeType: string;
  size: number;
  capturedAt: string;
  capturedBy: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  metadata?: Record<string, unknown>;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface ChecklistCategory {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  photoRequired: boolean;
  photoUri?: string;
}

export interface EvidencePack {
  id: string;
  jobId: string;
  contractorId: string;
  customerId: string;

  // Job reference
  jobTitle: string;
  jobAddress: string;
  completionDate: string;

  // Evidence items
  photos: EvidenceItem[];
  documents: EvidenceItem[];
  checklists: ChecklistCategory[];

  // Warranties & certificates
  warranties: {
    id: string;
    type: string;
    description: string;
    duration: string;
    startDate: string;
    endDate: string;
    documentUri?: string;
    coverage: string[];
  }[];
  certificates: {
    id: string;
    type: string;
    name: string;
    issuer: string;
    issueDate: string;
    documentUri?: string;
  }[];

  // Compliance
  complianceStatus: 'pending' | 'partial' | 'complete' | 'non-compliant';
  complianceChecks: {
    id: string;
    name: string;
    required: boolean;
    passed: boolean;
    checkedAt?: string;
    notes?: string;
  }[];

  // Stats
  totalPhotos: number;
  requiredItemsComplete: number;
  requiredItemsTotal: number;
  completionPercentage: number;

  // Status
  status: 'draft' | 'assembling' | 'ready' | 'delivered' | 'accepted';
  createdAt: string;
  updatedAt: string;
  assembledAt?: string;
}

export interface HandoverPackage {
  id: string;
  evidencePackId: string;
  jobId: string;
  contractorId: string;
  customerId: string;

  // Customer info
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;

  // Handover details
  title: string;
  summary: string;
  completionDate: string;
  handoverDate?: string;

  // Financial summary
  quotedAmount: number;
  finalAmount: number;
  currency: 'GBP' | 'EUR';
  paymentStatus: 'pending' | 'partial' | 'paid';

  // Documents included
  includedDocuments: {
    id: string;
    name: string;
    type: EvidenceType;
    uri: string;
    included: boolean;
  }[];

  // Completion certificate
  completionCertificate?: {
    id: string;
    generatedAt: string;
    documentUri: string;
    signedByContractor: boolean;
    contractorSignatureUri?: string;
    contractorSignedAt?: string;
  };

  // Customer sign-off
  customerSignOff?: {
    signed: boolean;
    signatureUri?: string;
    signedAt?: string;
    signedByName?: string;
    feedback?: string;
    rating?: number; // 1-5
  };

  // Portal access
  portalLink?: string;
  portalLinkExpiresAt?: string;
  portalAccessCount: number;
  portalLastAccessedAt?: string;

  // PDF export
  pdfUri?: string;
  pdfGeneratedAt?: string;

  // Status
  status: 'draft' | 'ready' | 'sent' | 'viewed' | 'signed' | 'complete';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}
