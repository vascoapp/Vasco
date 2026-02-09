// BuildOS Europe - Core Type Definitions
// Canonical schema: project → parcels → permits → contracts → budget → commitments → invoices → schedule → risks

export type Country = 'UK' | 'NL' | 'DE';

export type Currency = 'GBP' | 'EUR';

// Project lifecycle stages
export type ProjectPhase =
  | 'feasibility'
  | 'planning'
  | 'pre-construction'
  | 'construction'
  | 'practical-completion'
  | 'defects-liability'
  | 'completed';

// ============================================
// PROJECTS
// ============================================

export interface Project {
  id: string;
  name: string;
  country: Country;
  currency: Currency;
  phase: ProjectPhase;
  address: Address;
  parcels: Parcel[];
  permits: Permit[];
  contracts: Contract[];
  budgetLines: BudgetLine[];
  invoices: Invoice[];
  scheduleActivities: ScheduleActivity[];
  risks: Risk[];
  changeOrders: ChangeOrder[];
  siteEvents: SiteEvent[];
  // Financial summary
  totalBudget: number;
  committedCosts: number;
  actualSpent: number;
  contingency: number;
  contingencyUsed: number;
  // Schedule summary
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  forecastEndDate?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  region: string; // State for DE, County for UK, Province for NL
  postalCode: string;
  country: Country;
}

// ============================================
// PARCELS & LAND
// ============================================

export interface Parcel {
  id: string;
  projectId: string;
  reference: string; // Land registry reference
  areaSqm: number;
  acquisitionDate?: string;
  acquisitionPrice?: number;
  transferTaxPaid?: number;
  zoning: string;
  constraints: string[];
}

// ============================================
// PERMITS & APPROVALS
// ============================================

export type PermitType =
  | 'planning' // UK
  | 'building-control' // UK
  | 'omgevingsvergunning' // NL
  | 'bouwvergunning' // DE
  | 'environmental'
  | 'heritage'
  | 'other';

export type PermitStatus =
  | 'not-submitted'
  | 'submitted'
  | 'under-review'
  | 'information-requested'
  | 'approved'
  | 'approved-with-conditions'
  | 'rejected'
  | 'appealed';

export interface Permit {
  id: string;
  projectId: string;
  type: PermitType;
  reference?: string;
  authority: string;
  status: PermitStatus;
  submissionDate?: string;
  targetDecisionDate?: string; // Based on statutory clock
  actualDecisionDate?: string;
  conditions: PermitCondition[];
  documents: DocumentRef[];
  // Country-specific
  countryData?: UKPlanningData | NLPermitData | DEPermitData;
}

export interface PermitCondition {
  id: string;
  description: string;
  dischargeRequired: boolean;
  dischargedDate?: string;
  triggerPoint?: string; // e.g., "before commencement", "before occupation"
}

// UK-specific planning data
export interface UKPlanningData {
  applicationClass: 'minor' | 'major' | 'other';
  localAuthority: string;
  s106Required: boolean;
  s106Amount?: number;
  s106Heads?: S106Head[];
  cilRequired: boolean;
  cilAmount?: number;
  cilExemptionApplied?: boolean;
  appealLodged?: boolean;
  appealRef?: string;
}

export interface S106Head {
  category: string; // affordable housing, education, highways, etc.
  obligation: string;
  financialValue?: number;
  triggerPoint: string;
  status: 'pending' | 'discharged';
}

// NL-specific permit data
export interface NLPermitData {
  procedure: 'regular' | 'extended';
  omgevingsloketRef?: string;
  activiteiten: string[]; // Activities covered
  labelCCompliant?: boolean;
  currentEnergyLabel?: string;
  targetEnergyLabel?: string;
}

// DE-specific permit data
export interface DEPermitData {
  bundesland: string; // Federal state
  procedure: 'simplified' | 'full' | 'notification';
  completenessConfirmed?: boolean;
  completenessDate?: string;
  specialistDepartments: string[]; // Fachbehörden involved
  gegCompliant?: boolean;
}

// ============================================
// CONTRACTS & PROCUREMENT
// ============================================

export type ContractType =
  | 'main-contractor'
  | 'design-build'
  | 'subcontract'
  | 'consultant'
  | 'supplier'
  | 'professional-services';

export type ContractStatus =
  | 'tender'
  | 'negotiation'
  | 'executed'
  | 'in-progress'
  | 'practical-completion'
  | 'final-account'
  | 'closed'
  | 'terminated';

export interface Contract {
  id: string;
  projectId: string;
  type: ContractType;
  counterparty: string;
  description: string;
  status: ContractStatus;
  contractSum: number;
  currency: Currency;
  startDate: string;
  endDate: string;
  retentionPercent: number;
  retentionHeld: number;
  variations: Variation[];
  documents: DocumentRef[];
}

export interface Variation {
  id: string;
  contractId: string;
  reference: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  submittedDate: string;
  approvedDate?: string;
  approvedBy?: string;
}

// ============================================
// BUDGET & COST TRACKING
// ============================================

export type CostCategory =
  | 'land'
  | 'construction'
  | 'professional-fees'
  | 'statutory-fees'
  | 'finance-costs'
  | 'marketing'
  | 'contingency'
  | 'other';

export interface BudgetLine {
  id: string;
  projectId: string;
  category: CostCategory;
  costCode: string;
  description: string;
  originalBudget: number;
  currentBudget: number;
  committed: number;
  actualSpent: number;
  forecastFinal: number;
  variance: number; // currentBudget - forecastFinal
}

export interface Invoice {
  id: string;
  projectId: string;
  contractId?: string;
  budgetLineId: string;
  supplierRef: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  grossAmount: number;
  vatAmount: number;
  netAmount: number;
  status: 'received' | 'approved' | 'queried' | 'paid' | 'disputed';
  certifiedAmount?: number;
  paidDate?: string;
  documents: DocumentRef[];
}

// ============================================
// SCHEDULE & MILESTONES
// ============================================

export type ActivityStatus =
  | 'not-started'
  | 'in-progress'
  | 'delayed'
  | 'completed'
  | 'on-hold';

export interface ScheduleActivity {
  id: string;
  projectId: string;
  wbsCode: string;
  name: string;
  description?: string;
  plannedStart: string;
  plannedFinish: string;
  actualStart?: string;
  actualFinish?: string;
  forecastFinish?: string;
  percentComplete: number;
  status: ActivityStatus;
  isMilestone: boolean;
  isCriticalPath: boolean;
  predecessors: string[];
  successors: string[];
  float: number; // days
}

// ============================================
// CHANGE ORDERS
// ============================================

export type ChangeOrderStatus =
  | 'draft'
  | 'submitted'
  | 'under-review'
  | 'approved'
  | 'rejected'
  | 'implemented';

export interface ChangeOrder {
  id: string;
  projectId: string;
  contractId: string;
  reference: string;
  description: string;
  reason: string;
  proposedAmount: number;
  approvedAmount?: number;
  timeImpactDays?: number;
  status: ChangeOrderStatus;
  submittedDate: string;
  submittedBy: string;
  reviewedDate?: string;
  reviewedBy?: string;
  approvedDate?: string;
  approvedBy?: string;
  documents: DocumentRef[];
}

// ============================================
// SITE EVENTS & DAILY LOGS
// ============================================

export type SiteEventType =
  | 'progress'
  | 'delay'
  | 'safety-incident'
  | 'safety-observation'
  | 'quality-issue'
  | 'weather'
  | 'delivery'
  | 'inspection'
  | 'rfi'
  | 'other';

export interface SiteEvent {
  id: string;
  projectId: string;
  date: string;
  type: SiteEventType;
  classification: string;
  description: string;
  location?: string;
  reportedBy: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  resolutionNotes?: string;
  photos: DocumentRef[];
  linkedActivities?: string[];
}

// ============================================
// RISKS
// ============================================

export type RiskCategory =
  | 'planning'
  | 'construction'
  | 'financial'
  | 'market'
  | 'regulatory'
  | 'environmental'
  | 'health-safety'
  | 'reputational';

export interface Risk {
  id: string;
  projectId: string;
  category: RiskCategory;
  description: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  score: number; // likelihood * impact
  mitigation: string;
  owner: string;
  status: 'identified' | 'mitigating' | 'accepted' | 'closed' | 'occurred';
  costExposure?: number;
  scheduleExposureDays?: number;
}

// ============================================
// DOCUMENTS
// ============================================

export interface DocumentRef {
  id: string;
  name: string;
  type: string;
  uri: string;
  uploadedAt: string;
  uploadedBy: string;
  extractedText?: string;
  structured?: Record<string, unknown>;
}

// ============================================
// FINANCIAL CALCULATIONS (CFO)
// ============================================

export interface DevelopmentAppraisal {
  projectId: string;
  // Revenue
  gdv: number; // Gross Development Value
  rentalIncome?: number;
  yieldOnCost: number;
  exitYield?: number;
  // Costs
  landCost: number;
  constructionCost: number;
  professionalFees: number;
  statutoryCosts: number;
  financeCosts: number;
  marketingCosts: number;
  contingency: number;
  totalDevelopmentCost: number;
  // Returns
  profitOnCost: number;
  profitOnGdv: number;
  irr: number;
  equityIrr?: number;
  npv: number;
  equityMultiple?: number;
  // Equity
  peakEquityRequired?: number;
  // Sensitivity
  breakEvenYield?: number;
  maxLandValue?: number;
}

export interface CashflowPeriod {
  period: number; // month number
  date: string;
  landDrawdown: number;
  constructionDrawdown: number;
  otherCosts: number;
  totalCosts: number;
  debtDrawdown: number;
  equityDrawdown: number;
  interestAccrued: number;
  salesReceipts: number;
  netCashflow: number;
  cumulativeCashflow: number;
}

export interface TaxCalculation {
  projectId: string;
  country: Country;
  // Acquisition taxes
  transferTaxRate: number;
  transferTaxAmount: number;
  // For DE: state-specific rate
  bundesland?: string;
  // For UK: SDLT breakdown
  sdltBreakdown?: { band: string; rate: number; amount: number }[];
  // Recurring property taxes
  propertyTaxAnnual?: number;
  // VAT considerations
  vatRecoverable: boolean;
  vatAtRisk?: number;
}

// ============================================
// DELIVERY KPIs (COO)
// ============================================

export interface DeliveryMetrics {
  projectId: string;
  asOfDate: string;
  // Schedule
  plannedDuration: number;
  elapsedDuration: number;
  remainingDuration: number;
  scheduleVarianceDays: number;
  spiSchedulePerformanceIndex: number;
  criticalPathFloat: number;
  // Cost
  budgetAtCompletion: number;
  earnedValue: number;
  actualCost: number;
  costVariance: number;
  cpiCostPerformanceIndex: number;
  estimateAtCompletion: number;
  estimateToComplete: number;
  // Procurement
  contractsAwarded: number;
  contractsPending: number;
  procurementRiskValue: number;
  // Change orders
  changeOrdersSubmitted: number;
  changeOrdersApproved: number;
  changeOrdersValue: number;
  avgChangeOrderCycleTime: number;
}

// ============================================
// SITE METRICS (Site Lead)
// ============================================

export interface SiteMetrics {
  projectId: string;
  asOfDate: string;
  // Progress
  overallPercentComplete: number;
  plannedPercentComplete: number;
  progressVariance: number;
  // Quality
  defectsOpenTotal: number;
  defectsClosedTotal: number;
  defectClosureRate: number;
  reworkCostToDate: number;
  // Safety
  hoursWorked: number;
  incidentsThisPeriod: number;
  incidentsTotal: number;
  nearMissesThisPeriod: number;
  ltir: number; // Lost Time Incident Rate
  // Constraints
  openRfis: number;
  avgRfiResponseDays: number;
  openConstraints: number;
  constraintsClearedThisWeek: number;
}

// ============================================
// ACTIONS & AUDIT TRAIL
// ============================================

export type ActionType =
  | 'generate-permit-packet'
  | 'generate-lender-report'
  | 'propose-reforecast'
  | 'create-change-order'
  | 'draft-s106-response'
  | 'create-compliance-pack'
  | 'escalate-risk'
  | 'notify-stakeholder';

export type ActionStatus =
  | 'draft'
  | 'pending-approval'
  | 'approved'
  | 'executed'
  | 'rejected';

export interface GeneratedAction {
  id: string;
  projectId: string;
  type: ActionType;
  title: string;
  description: string;
  generatedContent?: string;
  generatedAt: string;
  generatedBy: 'system' | string;
  status: ActionStatus;
  approvedBy?: string;
  approvedAt?: string;
  executedAt?: string;
  linkedEntities: { type: string; id: string }[];
}

export interface AuditEntry {
  id: string;
  projectId: string;
  timestamp: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  source: 'user' | 'system' | 'integration';
}
