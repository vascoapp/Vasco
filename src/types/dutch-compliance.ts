// =============================================================================
// DUTCH COMPLIANCE - Types
// =============================================================================
// Netherlands-specific compliance automation: BTW, KvK, certifications
// a16z Sphere pattern: "Compliance as executable workflow logic"
// =============================================================================

// ============================================
// KVK (CHAMBER OF COMMERCE)
// ============================================

export interface KvKRegistration {
  kvkNumber: string;
  businessName: string;
  tradeName?: string;
  legalForm: KvKLegalForm;

  // Address
  visitingAddress: DutchAddress;
  postalAddress?: DutchAddress;

  // Status
  status: 'active' | 'inactive' | 'dissolved' | 'unknown';
  registrationDate: string;
  lastVerified: string;

  // Activities (SBI codes)
  mainActivity: SbiActivity;
  secondaryActivities?: SbiActivity[];

  // Representatives
  authorizedRepresentatives: KvKRepresentative[];

  // Flags
  verificationStatus: 'verified' | 'pending' | 'failed' | 'stale';
  alerts?: KvKAlert[];
}

export type KvKLegalForm =
  | 'eenmanszaak'       // Sole proprietorship
  | 'vof'              // General partnership
  | 'bv'               // Private limited company
  | 'nv'               // Public limited company
  | 'stichting'        // Foundation
  | 'vereniging'       // Association
  | 'cv'               // Limited partnership
  | 'maatschap'        // Professional partnership
  | 'other';

export interface SbiActivity {
  code: string;
  description: string;
  isMain: boolean;
}

export interface KvKRepresentative {
  name: string;
  role: 'eigenaar' | 'bestuurder' | 'gevolmachtigde' | 'other';
  authorizedIndividually: boolean;
  restrictions?: string;
}

export interface KvKAlert {
  type: 'registration-changed' | 'address-changed' | 'status-changed' | 'representative-changed' | 'unverified' | 'pending-verification';
  severity?: 'info' | 'warning' | 'critical';
  message: string;
  detectedAt: string;
  previousValue?: string;
  newValue?: string;
}

export interface DutchAddress {
  street: string;
  houseNumber: string;
  houseNumberAddition?: string;
  postalCode: string;
  city: string;
  country: 'NL';
}

// ============================================
// BTW (VAT)
// ============================================

export interface BtwRegistration {
  btwNumber: string;               // NL123456789B01 format
  isActive: boolean;
  registrationDate: string;
  lastVerified: string;

  // VIES Verification
  viesVerified: boolean;
  viesVerificationDate?: string;

  // Filing Requirements
  filingFrequency: 'monthly' | 'quarterly' | 'yearly';
  nextFilingDeadline: string;

  // Schemes
  kleineOndernemersRegeling: boolean;  // Small business scheme
  icpReporting: boolean;               // Intra-community supplies
}

export type BtwRate = 0 | 9 | 21;

export interface BtwRateRule {
  rate: BtwRate;
  description: string;
  applicableTo: string[];
  exceptions?: string[];
}

// Standard Dutch BTW rates
export const BTW_RATES: BtwRateRule[] = [
  {
    rate: 21,
    description: 'Standaard BTW-tarief',
    applicableTo: ['Most goods and services', 'Construction work', 'Painting', 'Renovation'],
  },
  {
    rate: 9,
    description: 'Verlaagd BTW-tarief',
    applicableTo: ['Schilderwerk woningen >2 jaar (arbeidskosten)', 'Renovatie woningen >2 jaar (arbeidskosten)'],
    exceptions: ['Materialen blijven 21%'],
  },
  {
    rate: 0,
    description: 'Vrijgesteld/Nultarief',
    applicableTo: ['Intracommunautaire leveringen', 'Export buiten EU'],
  },
];

export interface BtwPeriod {
  periodType: 'month' | 'quarter' | 'year';
  periodStart: string;
  periodEnd: string;
  filingDeadline: string;
  paymentDeadline: string;
  status: 'upcoming' | 'due' | 'filed' | 'paid' | 'overdue';
}

export interface BtwCalculation {
  // Outputs (Sales)
  salesExclBtw21: number;
  salesExclBtw9: number;
  salesExclBtw0: number;
  btwOwed21: number;
  btwOwed9: number;
  totalBtwOwed: number;

  // Inputs (Purchases)
  purchasesExclBtw: number;
  btwPaid: number;

  // Balance
  btwBalance: number;  // Positive = owe, Negative = refund

  // ICP (if applicable)
  icpSales?: number;
  icpPurchases?: number;
}

export interface BtwFiling {
  id: string;
  period: BtwPeriod;
  calculation: BtwCalculation;

  // Filing
  status: 'draft' | 'generated' | 'submitted' | 'confirmed';
  generatedAt?: string;
  submittedAt?: string;
  referenceNumber?: string;

  // Payment
  paymentStatus: 'pending' | 'paid' | 'refund-requested' | 'refund-received';
  paidAt?: string;
  paymentReference?: string;

  // Audit Trail
  invoicesIncluded: string[];
  expensesIncluded: string[];
  manualAdjustments?: BtwAdjustment[];
}

export interface BtwAdjustment {
  description: string;
  amount: number;
  btwRate: BtwRate;
  reason: 'correction' | 'private-use' | 'non-deductible' | 'other';
}

// ============================================
// CERTIFICATIONS & LICENSES
// ============================================

export interface DutchCertification {
  id: string;

  // Certification Details
  type: DutchCertificationType;
  name: string;
  issuingBody: string;
  certificateNumber: string;

  // Holder
  holderType: 'individual' | 'company';
  holderName: string;

  // Validity
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring-soon' | 'expired' | 'suspended' | 'revoked';
  daysUntilExpiry: number;

  // Renewal
  renewalRequired: boolean;
  renewalLeadTimeDays: number;
  renewalProcess?: RenewalProcess;

  // Document
  documentUri?: string;
  documentVerified: boolean;

  // Compliance
  requiredForTrades: string[];
  legalBasis?: string;
}

export type DutchCertificationType =
  // Construction
  | 'vca-vol'         // VCA VOL (Safety certificate)
  | 'vca-basis'       // VCA Basis
  | 'vca-petrochemie' // VCA Petrochemie
  | 'bhv'             // BHV (Emergency response)
  | 'ehbo'            // First aid

  // Trade-specific
  | 'nen-1010'        // Electrical installations
  | 'nen-3140'        // Working on electrical installations
  | 'f-gassen'        // F-gases (HVAC)
  | 'asbest'          // Asbestos handling
  | 'stek'            // STEK (refrigeration)

  // Business
  | 'kiwa'            // KIWA certification
  | 'iso-9001'        // Quality management
  | 'iso-14001'       // Environmental management
  | 'brl'             // BRL (evaluation guidelines)

  // Insurance required
  | 'aansprakelijkheid' // Liability insurance
  | 'cav'               // Construction all-risk
  | 'waadi'             // WAADI registration (temp workers)

  | 'other';

export interface RenewalProcess {
  steps: RenewalStep[];
  estimatedCost?: number;
  estimatedDuration?: string;
  submissionUrl?: string;
}

export interface RenewalStep {
  order: number;
  description: string;
  deadline?: string;
  documentRequired?: string;
  status: 'pending' | 'completed' | 'skipped';
}

// ============================================
// INSURANCE
// ============================================

export interface DutchInsurance {
  id: string;

  type: DutchInsuranceType;
  provider: string;
  policyNumber: string;

  // Coverage
  coverageDescription: string;
  coverageAmount: number;
  deductible: number;

  // Term
  startDate: string;
  endDate: string;
  status: 'active' | 'expiring-soon' | 'expired' | 'cancelled';
  daysUntilExpiry: number;

  // Premium
  premiumAmount: number;
  premiumFrequency: 'monthly' | 'quarterly' | 'yearly';
  nextPaymentDate: string;

  // Contact
  claimPhone?: string;
  claimEmail?: string;

  // Document
  documentUri?: string;
}

export type DutchInsuranceType =
  | 'aansprakelijkheid'     // Liability (AVB)
  | 'beroepsaansprakelijkheid' // Professional liability
  | 'cav'                   // Construction all-risk
  | 'inventaris'            // Business contents
  | 'wagenpark'             // Vehicle fleet
  | 'rechtsbijstand'        // Legal assistance
  | 'arbeidsongeschiktheid' // Disability (AOV)
  | 'verzuim'               // Sick leave
  | 'other';

// ============================================
// COMPLIANCE DASHBOARD
// ============================================

export interface ComplianceDashboard {
  overallScore: number;  // 0-100
  status: 'compliant' | 'action-required' | 'critical';

  // KvK
  kvkStatus: 'verified' | 'needs-verification' | 'issues-found';
  kvkLastVerified?: string;

  // BTW
  btwStatus: 'up-to-date' | 'filing-due' | 'overdue';
  nextBtwDeadline?: string;
  btwBalance?: number;

  // Certifications
  certificationsValid: number;
  certificationsExpiringSoon: number;
  certificationsExpired: number;

  // Insurance
  insuranceActive: number;
  insuranceExpiringSoon: number;
  insuranceExpired: number;

  // Alerts
  alerts: ComplianceAlert[];

  // Upcoming
  upcomingDeadlines: ComplianceDeadline[];
}

export interface ComplianceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'kvk' | 'btw' | 'certification' | 'insurance' | 'other';
  title: string;
  message: string;
  actionRequired: boolean;
  actionLabel?: string;
  dueDate?: string;
  createdAt: string;
}

export interface ComplianceDeadline {
  id: string;
  type: 'btw-filing' | 'btw-payment' | 'certification-renewal' | 'insurance-renewal' | 'kvk-update';
  title: string;
  deadline: string;
  daysUntil: number;
  status: 'upcoming' | 'due-soon' | 'overdue';
  linkedEntityId?: string;
}

// ============================================
// INVOICE COMPLIANCE (Dutch Requirements)
// ============================================

export interface InvoiceComplianceCheck {
  invoiceId: string;
  isCompliant: boolean;
  issues: InvoiceComplianceIssue[];
  checkedAt: string;
}

export interface InvoiceComplianceIssue {
  field: string;
  issue: 'missing' | 'invalid' | 'format-error';
  message: string;
  severity: 'error' | 'warning';
  legalReference?: string;
}

// Required fields for Dutch invoices
export const DUTCH_INVOICE_REQUIREMENTS = [
  { field: 'invoiceNumber', required: true, description: 'Uniek factuurnummer' },
  { field: 'invoiceDate', required: true, description: 'Factuurdatum' },
  { field: 'sellerName', required: true, description: 'Naam en adres leverancier' },
  { field: 'sellerAddress', required: true, description: 'Adres leverancier' },
  { field: 'sellerKvk', required: true, description: 'KvK-nummer leverancier' },
  { field: 'sellerBtw', required: true, description: 'BTW-nummer leverancier (indien BTW-plichtig)' },
  { field: 'buyerName', required: true, description: 'Naam en adres afnemer' },
  { field: 'buyerAddress', required: true, description: 'Adres afnemer' },
  { field: 'description', required: true, description: 'Omschrijving geleverde goederen/diensten' },
  { field: 'quantity', required: true, description: 'Hoeveelheid' },
  { field: 'unitPrice', required: true, description: 'Prijs per eenheid' },
  { field: 'btwRate', required: true, description: 'BTW-tarief per regel' },
  { field: 'btwAmount', required: true, description: 'BTW-bedrag' },
  { field: 'totalAmount', required: true, description: 'Totaalbedrag inclusief BTW' },
];

// ============================================
// GDPR / AVG COMPLIANCE
// ============================================

export interface GDPRConsent {
  type: 'marketing' | 'analytics' | 'data_processing' | 'third_party';
  granted: boolean;
  grantedAt?: string;
  expiresAt?: string;
}

export interface DataProcessingAgreement {
  id: string;
  counterparty: string; // e.g., Moneybird, Mollie
  purpose: string;
  dataCategories: string[];
  retentionDays: number;
  signedAt?: string;
  expiresAt?: string;
}

export const DUTCH_RETENTION_PERIODS = {
  invoices: 7 * 365, // 7 years (fiscale bewaarplicht)
  contracts: 7 * 365,
  employeeRecords: 5 * 365, // 5 years after end of employment
  customerData: 2 * 365, // 2 years after last contact
  websiteAnalytics: 365, // 1 year
};

// ============================================
// ENVIRONMENTAL CERTIFICATIONS
// ============================================

export type EnergyLabel = 'A++++' | 'A+++' | 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface EnvironmentalCertification {
  type: 'energielabel' | 'breeam' | 'well' | 'gpr' | 'epc';
  label?: EnergyLabel;
  score?: number;
  issuedAt?: string;
  expiresAt?: string;
  registrationNumber?: string;
}

export const BREEAM_LEVELS = ['Pass', 'Good', 'Very Good', 'Excellent', 'Outstanding'] as const;
