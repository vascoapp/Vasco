// =============================================================================
// UK COMPLIANCE - Types
// =============================================================================
// United Kingdom-specific compliance automation: Companies House, VAT, Gas Safe,
// Part P, CSCS, and trade certifications
// a16z Sphere pattern: "Compliance as executable workflow logic"
// =============================================================================

// ============================================
// COMPANIES HOUSE (Business Registration)
// ============================================

export interface CompaniesHouseRegistration {
  companyNumber: string;         // 8-digit company number
  companyName: string;
  tradingName?: string;
  companyType: UKCompanyType;

  // Address
  registeredAddress: UKAddress;
  serviceAddress?: UKAddress;

  // Status
  companyStatus: 'active' | 'dissolved' | 'liquidation' | 'receivership' | 'converted-closed' | 'voluntary-arrangement' | 'insolvency-proceedings';
  incorporationDate: string;
  lastAccountsDate?: string;
  nextAccountsDue?: string;
  lastConfirmationStatementDate?: string;
  nextConfirmationStatementDue?: string;

  // SIC codes (industry classification)
  sicCodes: SICCode[];

  // Officers
  directors: CompanyOfficer[];
  secretaries?: CompanyOfficer[];
  personsWithSignificantControl?: PSCEntry[];

  // Verification
  verificationStatus: 'verified' | 'pending' | 'failed' | 'stale';
  lastVerified: string;
  alerts?: CompaniesHouseAlert[];
}

export type UKCompanyType =
  | 'private-limited-company'           // Ltd
  | 'public-limited-company'            // PLC
  | 'limited-liability-partnership'     // LLP
  | 'scottish-limited-partnership'
  | 'limited-partnership'
  | 'sole-trader'                       // Not registered but tracked
  | 'general-partnership'
  | 'community-interest-company'
  | 'charitable-incorporated-organisation'
  | 'other';

export interface SICCode {
  code: string;
  description: string;
}

export interface CompanyOfficer {
  name: string;
  role: 'director' | 'secretary' | 'llp-member' | 'llp-designated-member';
  appointedOn: string;
  resignedOn?: string;
  nationality?: string;
  dateOfBirth?: { month: number; year: number };
  occupation?: string;
  address?: Partial<UKAddress>;
}

export interface PSCEntry {
  name: string;
  naturesOfControl: string[];
  notifiedOn: string;
  ceasedOn?: string;
}

export interface CompaniesHouseAlert {
  type: 'accounts-overdue' | 'confirmation-statement-overdue' | 'officer-change' | 'status-change' | 'filing-due';
  message: string;
  detectedAt: string;
  deadline?: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface UKAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: 'England' | 'Wales' | 'Scotland' | 'Northern Ireland' | 'UK';
}

// ============================================
// UK VAT (VALUE ADDED TAX)
// ============================================

export interface UKVATRegistration {
  vatNumber: string;              // GB123456789 format
  isActive: boolean;
  registrationDate: string;
  lastVerified: string;

  // VIES (for EU trade)
  viesVerified?: boolean;
  viesVerificationDate?: string;

  // MTD (Making Tax Digital)
  mtdEnrolled: boolean;
  mtdSoftwareConnected: boolean;
  mtdSoftwareName?: string;

  // Filing Requirements
  filingFrequency: 'monthly' | 'quarterly' | 'annual';
  accountingPeriodEnd: string;    // Month-day, e.g., "03-31" for March year-end
  nextFilingDeadline: string;

  // Schemes
  flatRateScheme: boolean;
  flatRatePercentage?: number;
  cashAccountingScheme: boolean;
  annualAccountingScheme: boolean;

  // Thresholds
  currentTurnover?: number;
  vatThreshold: number;           // Currently £90,000
}

export type UKVATRate = 0 | 5 | 20;

export interface UKVATRateRule {
  rate: UKVATRate;
  description: string;
  applicableTo: string[];
  exceptions?: string[];
}

// Standard UK VAT rates
export const UK_VAT_RATES: UKVATRateRule[] = [
  {
    rate: 20,
    description: 'Standard rate',
    applicableTo: ['Most goods and services', 'Construction work on commercial buildings', 'New build housing (to developer)'],
  },
  {
    rate: 5,
    description: 'Reduced rate',
    applicableTo: [
      'Energy-saving materials installation (residential)',
      'Renovation of empty residential properties',
      'Converting residential to different use',
      'Installing mobility aids for elderly',
    ],
  },
  {
    rate: 0,
    description: 'Zero rate',
    applicableTo: [
      'New build residential (to buyer)',
      'Approved alterations to protected buildings',
      'Certain energy-saving materials',
      'Building services to charities (qualifying)',
    ],
  },
];

export interface UKVATPeriod {
  periodType: 'month' | 'quarter' | 'year';
  periodStart: string;
  periodEnd: string;
  filingDeadline: string;         // 1 month + 7 days after period end
  paymentDeadline: string;
  status: 'upcoming' | 'due' | 'filed' | 'paid' | 'overdue';
}

export interface UKVATCalculation {
  // Outputs (Sales)
  salesStandardRate: number;
  salesReducedRate: number;
  salesZeroRate: number;
  vatOwedStandard: number;
  vatOwedReduced: number;
  totalVatOwed: number;

  // Inputs (Purchases)
  purchasesExclVat: number;
  vatReclaimed: number;

  // Reverse Charge (Construction Industry)
  reverseChargeOutputs?: number;
  reverseChargeInputs?: number;

  // Balance
  vatBalance: number;             // Positive = owe, Negative = refund

  // EC Sales (if applicable post-Brexit for NI)
  ecSales?: number;
  ecPurchases?: number;
}

export interface UKVATReturn {
  id: string;
  period: UKVATPeriod;
  calculation: UKVATCalculation;

  // 9 boxes format
  box1: number;    // VAT due on sales
  box2: number;    // VAT due on EC acquisitions
  box3: number;    // Total VAT due (box 1 + 2)
  box4: number;    // VAT reclaimed on purchases
  box5: number;    // Net VAT (box 3 - 4)
  box6: number;    // Total sales excluding VAT
  box7: number;    // Total purchases excluding VAT
  box8: number;    // Total EC supplies
  box9: number;    // Total EC acquisitions

  // Filing
  status: 'draft' | 'generated' | 'submitted' | 'confirmed';
  generatedAt?: string;
  submittedAt?: string;
  hmrcReceiptId?: string;

  // Payment
  paymentStatus: 'pending' | 'paid' | 'refund-requested' | 'refund-received' | 'direct-debit-scheduled';
  paidAt?: string;
  paymentReference?: string;

  // Audit Trail
  invoicesIncluded: string[];
  expensesIncluded: string[];
}

// ============================================
// CIS (CONSTRUCTION INDUSTRY SCHEME)
// ============================================

export interface CISRegistration {
  utr: string;                    // Unique Taxpayer Reference
  companyUtr?: string;            // If company vs individual
  registrationStatus: 'registered' | 'not-registered' | 'gross-payment-status';
  verificationNumber?: string;
  deductionRate: 0 | 20 | 30;     // 0% = gross, 20% = registered, 30% = not registered

  // For contractors (those who pay subcontractors)
  isContractor: boolean;
  contractorVerificationActive: boolean;
  monthlyReturnDue?: string;

  // For subcontractors (those receiving payment)
  isSubcontractor: boolean;
  lastVerified?: string;
  verificationExpiry?: string;    // Must re-verify every 2 years
}

export interface CISPayment {
  id: string;
  contractorUtr: string;
  subcontractorUtr: string;
  subcontractorName: string;

  paymentDate: string;
  grossAmount: number;
  materialsDeduction: number;     // Materials not subject to CIS
  cisDeduction: number;
  netPayment: number;

  // Verification at time of payment
  verificationNumber: string;
  deductionRateApplied: 0 | 20 | 30;

  // Reporting
  includedInReturn?: string;      // Return period
}

export interface CISMonthlyReturn {
  id: string;
  taxMonth: string;               // YYYY-MM
  dueDate: string;                // 19th of following month
  status: 'draft' | 'submitted' | 'nil-return' | 'overdue';

  payments: CISPayment[];
  totalGross: number;
  totalDeductions: number;
  totalNet: number;

  submittedAt?: string;
  hmrcReceiptId?: string;
}

// ============================================
// GAS SAFE REGISTER
// ============================================

export interface GasSafeRegistration {
  id: string;
  registrationNumber: string;     // 7-digit number
  cardNumber?: string;            // ID card number

  // Holder details
  holderType: 'individual' | 'business';
  businessName?: string;
  businessTradingName?: string;
  employerRegistrationNumber?: string;

  // Individual (for engineer cards)
  engineerName?: string;
  photoUri?: string;

  // Competencies
  competencies: GasSafeCompetency[];
  appliances: GasSafeApplianceCategory[];

  // Validity
  status: 'valid' | 'expired' | 'suspended' | 'revoked';
  issueDate: string;
  expiryDate: string;
  daysUntilExpiry: number;

  // Verification
  lastVerified: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
  publicRegisterUrl?: string;

  // Alerts
  alerts?: GasSafeAlert[];
}

export interface GasSafeCompetency {
  code: string;
  description: string;
  category: 'domestic' | 'commercial' | 'industrial' | 'lpg';
}

export type GasSafeApplianceCategory =
  | 'cooker-hob-domestic'
  | 'space-heater-domestic'
  | 'water-heater-domestic'
  | 'central-heating-domestic'
  | 'lpg-domestic'
  | 'meters-domestic'
  | 'pipework-domestic'
  | 'commercial-catering'
  | 'commercial-heating'
  | 'industrial';

export interface GasSafeAlert {
  type: 'expiry-approaching' | 'competency-expiring' | 'verification-failed' | 'suspended';
  message: string;
  detectedAt: string;
  deadline?: string;
}

// Gas Safe required for these job types
export const GAS_SAFE_REQUIRED_WORK = [
  'Boiler installation',
  'Boiler servicing',
  'Boiler repair',
  'Gas cooker installation',
  'Gas fire installation',
  'Gas pipe installation',
  'Gas safety inspection',
  'Landlord gas safety certificate (CP12)',
  'Gas meter relocation',
];

// ============================================
// PART P (ELECTRICAL SELF-CERTIFICATION)
// ============================================

export interface PartPRegistration {
  id: string;
  schemeProvider: PartPSchemeProvider;
  schemeProviderRef: string;      // Membership number with scheme

  // Holder
  holderType: 'individual' | 'business';
  businessName?: string;
  tradeName?: string;

  // Competencies
  competencies: PartPCompetency[];

  // Validity
  status: 'valid' | 'expired' | 'suspended';
  memberSince: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  daysUntilRenewal: number;

  // Verification
  lastVerified: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
  publicRegisterUrl?: string;

  // Insurance (usually required by schemes)
  hasRequiredInsurance: boolean;
  insuranceExpiryDate?: string;
}

export type PartPSchemeProvider =
  | 'niceic'                      // National Inspection Council for Electrical Installation Contracting
  | 'napit'                       // National Association of Professional Inspectors and Testers
  | 'elecsa'                      // Electrical Self-Assessment
  | 'besca'                       // Building Engineering Services Competence Assessment
  | 'stroma'
  | 'other';

export interface PartPCompetency {
  category: 'domestic' | 'commercial' | 'industrial';
  scope: PartPScope[];
  restrictions?: string[];
}

export type PartPScope =
  | 'installation'
  | 'testing-inspection'
  | 'design'
  | 'periodic-inspection'
  | 'emergency-lighting'
  | 'fire-alarm'
  | 'ev-charging'
  | 'solar-pv';

// Part P notifiable work (requires certificate)
export const PART_P_NOTIFIABLE_WORK = [
  'New circuits in kitchens',
  'New circuits in bathrooms',
  'New circuits in gardens/outdoors',
  'New consumer unit installation',
  'Addition to existing circuits in special locations',
  'Electric floor heating',
  'Solar PV installation',
  'EV charger installation (certain types)',
];

// ============================================
// CSCS (CONSTRUCTION SKILLS CERTIFICATION SCHEME)
// ============================================

export interface CSCSCard {
  id: string;
  cardNumber: string;
  cardType: CSCSCardType;
  cardColour: CSCSCardColour;

  // Holder
  holderName: string;
  photoUri?: string;
  dateOfBirth?: string;

  // Qualifications
  occupation: string;
  qualifications: CSCSQualification[];
  healthAndSafetyTest: {
    testType: 'citb' | 'other';
    passDate: string;
    expiryDate: string;
  };

  // Validity
  status: 'valid' | 'expired' | 'suspended' | 'revoked';
  issueDate: string;
  expiryDate: string;
  daysUntilExpiry: number;

  // Additional endorsements
  endorsements?: string[];

  // Verification
  lastVerified: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
}

export type CSCSCardType =
  | 'labourer'
  | 'trainee'
  | 'apprentice'
  | 'skilled-worker'
  | 'advanced-craft'
  | 'supervisor'
  | 'manager'
  | 'academically-qualified'
  | 'professionally-qualified'
  | 'visitor';

export type CSCSCardColour =
  | 'green'      // Labourer
  | 'red'        // Trainee / Apprentice
  | 'blue'       // Skilled worker
  | 'gold'       // Advanced craft / Supervisor
  | 'black'      // Manager
  | 'white'      // Professionally qualified
  | 'yellow';    // Visitor

export interface CSCSQualification {
  title: string;
  level: string;
  awardingBody: string;
  achievedDate: string;
}

// ============================================
// OFTEC (OIL FIRING TECHNICAL ASSOCIATION)
// ============================================

export interface OFTECRegistration {
  id: string;
  registrationNumber: string;

  // Holder
  holderType: 'individual' | 'business';
  businessName?: string;
  tradeName?: string;
  engineerName?: string;

  // Competencies
  scopes: OFTECScope[];

  // Validity
  status: 'valid' | 'expired' | 'suspended';
  issueDate: string;
  expiryDate: string;
  daysUntilExpiry: number;

  // Verification
  lastVerified: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
  publicRegisterUrl?: string;
}

export type OFTECScope =
  | 'OFT10-105'   // Oil-fired pressure jet domestic boiler installation
  | 'OFT10-105E'  // Including oil-fired cookers
  | 'OFT10-600A'  // Oil storage tanks - plastic
  | 'OFT10-600B'  // Oil storage tanks - steel
  | 'OFT50-101'   // Domestic solid fuel appliances
  | 'OFT15-102'   // Oil-fired warm air heaters
  | 'OFT101'      // Commercial/industrial
  | 'other';

// ============================================
// F-GAS (FLUORINATED GASES)
// ============================================

export interface FGasRegistration {
  id: string;
  companyRegistrationNumber: string;
  certificationType: FGasCertificationType;

  // Holder (company)
  companyName: string;
  tradeName?: string;

  // Certified personnel
  certifiedPersonnel: FGasPersonnel[];

  // Validity
  status: 'valid' | 'expired' | 'suspended';
  issueDate: string;
  expiryDate: string;
  daysUntilExpiry: number;

  // Certification body
  certificationBody: string;      // e.g., 'REFCOM', 'Besa', 'Quidos'

  // Verification
  lastVerified: string;
  verificationStatus: 'verified' | 'pending' | 'failed';
}

export type FGasCertificationType =
  | 'category-1'    // Full access (all equipment)
  | 'category-2'    // Recovery only (>3kg)
  | 'category-3'    // Recovery only (<3kg)
  | 'category-4';   // Leak checking only

export interface FGasPersonnel {
  name: string;
  certificateNumber: string;
  category: FGasCertificationType;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expired';
}

// ============================================
// UK INSURANCE REQUIREMENTS
// ============================================

export interface UKInsurance {
  id: string;

  type: UKInsuranceType;
  provider: string;
  policyNumber: string;

  // Coverage
  coverageDescription: string;
  coverageAmount: number;
  indemnityLimit?: number;
  excessAmount: number;

  // Term
  startDate: string;
  endDate: string;
  status: 'active' | 'expiring-soon' | 'expired' | 'cancelled';
  daysUntilExpiry: number;

  // Premium
  premiumAmount: number;
  premiumFrequency: 'monthly' | 'annually';
  nextPaymentDate?: string;

  // Certificate
  certificateUri?: string;
  certificateNumber?: string;

  // Contact
  claimPhone?: string;
  claimEmail?: string;
  brokerName?: string;
  brokerContact?: string;
}

export type UKInsuranceType =
  | 'public-liability'              // PL insurance
  | 'employers-liability'           // Required if you have employees
  | 'professional-indemnity'        // PI insurance
  | 'contractors-all-risk'          // CAR insurance
  | 'tools-plant'                   // Tools & equipment
  | 'motor-fleet'                   // Vehicle insurance
  | 'legal-expenses'
  | 'personal-accident'
  | 'income-protection'
  | 'other';

// Minimum requirements for construction work
export const UK_INSURANCE_REQUIREMENTS = {
  publicLiability: {
    minimum: 1000000,             // £1m minimum
    recommended: 5000000,         // £5m for most commercial work
    mainContractor: 10000000,     // £10m often required
  },
  employersLiability: {
    required: true,               // Legal requirement with employees
    minimum: 5000000,             // £5m statutory minimum
  },
  professionalIndemnity: {
    requiredFor: ['design', 'project-management', 'cdm-coordination'],
    minimum: 250000,
  },
};

// ============================================
// UK COMPLIANCE DASHBOARD
// ============================================

export interface UKComplianceDashboard {
  overallScore: number;           // 0-100
  status: 'compliant' | 'action-required' | 'critical';

  // Companies House
  companiesHouseStatus: 'verified' | 'needs-verification' | 'filings-overdue' | 'not-applicable';
  companiesHouseLastVerified?: string;
  nextFilingDue?: string;

  // VAT
  vatStatus: 'up-to-date' | 'return-due' | 'payment-due' | 'overdue' | 'not-registered';
  nextVatDeadline?: string;
  vatBalance?: number;

  // CIS
  cisStatus: 'up-to-date' | 'return-due' | 'overdue' | 'not-applicable';
  nextCisDeadline?: string;

  // Trade Certifications
  gasSafeStatus: 'valid' | 'expiring-soon' | 'expired' | 'not-applicable';
  partPStatus: 'valid' | 'expiring-soon' | 'expired' | 'not-applicable';
  cscsStatus: 'valid' | 'expiring-soon' | 'expired' | 'not-applicable';
  oftecStatus: 'valid' | 'expiring-soon' | 'expired' | 'not-applicable';
  fgasStatus: 'valid' | 'expiring-soon' | 'expired' | 'not-applicable';

  // Insurance
  insuranceValid: number;
  insuranceExpiringSoon: number;
  insuranceExpired: number;
  employersLiabilityValid: boolean;

  // Alerts
  alerts: UKComplianceAlert[];

  // Upcoming
  upcomingDeadlines: UKComplianceDeadline[];
}

export interface UKComplianceAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: 'companies-house' | 'vat' | 'cis' | 'gas-safe' | 'part-p' | 'cscs' | 'oftec' | 'fgas' | 'insurance' | 'other';
  title: string;
  message: string;
  actionRequired: boolean;
  actionLabel?: string;
  actionUrl?: string;
  dueDate?: string;
  createdAt: string;
}

export interface UKComplianceDeadline {
  id: string;
  type: 'vat-return' | 'vat-payment' | 'cis-return' | 'accounts-filing' | 'confirmation-statement' | 'certification-renewal' | 'insurance-renewal' | 'card-renewal';
  title: string;
  deadline: string;
  daysUntil: number;
  status: 'upcoming' | 'due-soon' | 'overdue';
  linkedEntityId?: string;
  linkedEntityType?: string;
}

// ============================================
// UK INVOICE COMPLIANCE
// ============================================

export interface UKInvoiceComplianceCheck {
  invoiceId: string;
  isCompliant: boolean;
  issues: UKInvoiceComplianceIssue[];
  checkedAt: string;
}

export interface UKInvoiceComplianceIssue {
  field: string;
  issue: 'missing' | 'invalid' | 'format-error';
  message: string;
  severity: 'error' | 'warning';
  legalReference?: string;
}

// Required fields for UK VAT invoices
export const UK_VAT_INVOICE_REQUIREMENTS = [
  { field: 'invoiceNumber', required: true, description: 'Unique sequential invoice number' },
  { field: 'invoiceDate', required: true, description: 'Date of issue' },
  { field: 'supplyDate', required: true, description: 'Date of supply (if different from invoice date)' },
  { field: 'sellerName', required: true, description: 'Seller business name' },
  { field: 'sellerAddress', required: true, description: 'Seller address' },
  { field: 'sellerVat', required: true, description: 'Seller VAT number' },
  { field: 'buyerName', required: true, description: 'Buyer name' },
  { field: 'buyerAddress', required: true, description: 'Buyer address' },
  { field: 'buyerVat', required: false, description: 'Buyer VAT number (if reverse charge applies)' },
  { field: 'description', required: true, description: 'Description of goods/services' },
  { field: 'quantity', required: true, description: 'Quantity' },
  { field: 'unitPrice', required: true, description: 'Unit price excluding VAT' },
  { field: 'vatRate', required: true, description: 'VAT rate for each item' },
  { field: 'totalExclVat', required: true, description: 'Total excluding VAT' },
  { field: 'vatAmount', required: true, description: 'Total VAT' },
  { field: 'totalInclVat', required: true, description: 'Total including VAT' },
];

// Required statement for domestic reverse charge
export const UK_REVERSE_CHARGE_STATEMENT = 'Domestic Reverse Charge - Customer to account for VAT to HMRC';

// ============================================
// COMPLIANCE GATES (Work Blocking)
// ============================================

export interface UKComplianceGate {
  gateId: string;
  tradeType: string;
  workType: string;
  requirements: UKComplianceRequirement[];
  passedAll: boolean;
  blockedReasons: string[];
}

export interface UKComplianceRequirement {
  id: string;
  name: string;
  type: 'gas-safe' | 'part-p' | 'cscs' | 'oftec' | 'fgas' | 'insurance';
  required: boolean;
  currentStatus: 'valid' | 'expired' | 'missing';
  details?: string;
  renewalUrl?: string;
}

// Compliance gate rules by work type
export const UK_COMPLIANCE_GATES: Record<string, UKComplianceRequirement[]> = {
  'gas-work': [
    { id: 'gs1', name: 'Gas Safe Registration', type: 'gas-safe', required: true, currentStatus: 'missing' },
    { id: 'gs2', name: 'Public Liability Insurance', type: 'insurance', required: true, currentStatus: 'missing' },
  ],
  'electrical-notifiable': [
    { id: 'el1', name: 'Part P Registration', type: 'part-p', required: true, currentStatus: 'missing' },
    { id: 'el2', name: 'Public Liability Insurance', type: 'insurance', required: true, currentStatus: 'missing' },
  ],
  'oil-heating': [
    { id: 'oh1', name: 'OFTEC Registration', type: 'oftec', required: true, currentStatus: 'missing' },
    { id: 'oh2', name: 'Public Liability Insurance', type: 'insurance', required: true, currentStatus: 'missing' },
  ],
  'refrigeration-ac': [
    { id: 'fg1', name: 'F-Gas Certification', type: 'fgas', required: true, currentStatus: 'missing' },
    { id: 'fg2', name: 'Public Liability Insurance', type: 'insurance', required: true, currentStatus: 'missing' },
  ],
  'construction-site': [
    { id: 'cs1', name: 'CSCS Card', type: 'cscs', required: true, currentStatus: 'missing' },
    { id: 'cs2', name: 'Public Liability Insurance', type: 'insurance', required: true, currentStatus: 'missing' },
  ],
};
