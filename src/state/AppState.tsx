// React
import { formatMoney } from '../i18n/formatting';
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Libraries
import AsyncStorage from '@react-native-async-storage/async-storage';

// Domain types
import { BusinessProfile, isSmallBusinessExempt, getEffectiveVatRate } from '../domain/business';
import { Customer } from '../domain/customers';
import type { Lead, LeadStatus } from '../domain/lead';
import type { Worker, WorkerRole } from '../domain/worker';
import { Invoice, Quote } from '../domain/documents';
import { Job, JobStatus, JobPriority } from '../domain/jobs';
import { Material, JobMaterial, JobMaterialStatus, PriceObservation } from '../domain/materials';
import { Supplier } from '../domain/suppliers';
import { PriceRiskSignal } from '../domain/insights';
import { QuoteLineItem } from '../domain/lineItems';
import type { Project, ProjectPnL } from '../types/project';
import { ExtractedDocument } from '../ingestion/pdfSchema';
import type { BudgetExtractionResult } from '../ingestion/budgetExtractor';

// Services / intelligence
import { upsertEntity, addRelation, propagateJobCompletion, propagatePayment } from '../intelligence/ontology';
import {
  attributeLeadFollowupOutcome,
  attributeCrewCapacityOutcome,
  attributeLicenseRenewalOutcome,
} from '../intelligence/generatorOutcomeAttributor';
import {
  emitQuoteCreated,
  emitQuoteAccepted,
  emitInvoiceSent,
  emitPaymentReceived,
  emitJobStarted,
  emitJobCompleted,
  emitMaterialPurchased,
  recordPricingData,
  emitQuoteRejected,
  recordPricingOutcome,
  emitLeadCreated,
  emitLeadStatusChanged,
  emitLeadConverted,
  emitWorkerAdded,
  emitLicenseAdded,
  emitLicenseRenewed,
} from '../intelligence/dataCollector';
import { validateQuoteBeforeSend, validateInvoiceBeforeCreate, validateJobStatusChange } from '../services/workflowValidatorService';
import { schedulePaymentReminder, scheduleQuoteFollowUp } from '../services/pushNotificationService';
import { addBreadcrumb } from '../lib/errorReporting';
import { exportInvoiceToMoneybird } from '../integrations/moneybird';
import { createMolliePayment } from '../integrations/mollie';
import { buildPriceRiskSignals } from '../logic/priceRisk';
import { ingestPdfStub } from '../ingestion/ingestionStub';
import { rowToExtractedDocument } from '../ingestion/extractionBridge';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId, getCurrentCountry, getCurrentTrade, setCurrentUser, subscribeUserChange } from '../lib/currentUser';
import { isTempIdFast, isUuid } from '../lib/idShape';
import { jobUpdatesToRowPayload } from '../lib/mappers';
import { USE_SEED_DATA } from '../config/demo';
import {
  loadQuotes,
  loadInvoices,
  loadLeads,
  loadWorkers,
  loadBusinessProfile,
  loadLineItems,
  loadJobs,
  updateDocument,
  deleteDocument,
  createDocument,
  upsertLineItems,
  nextDocumentNumber,
  upsertBusinessSettings,
  loadCustomers,
  createCustomer as dbCreateCustomer,
  updateCustomer as dbUpdateCustomer,
  deleteCustomer as dbDeleteCustomer,
  createJob as dbCreateJob,
  updateJob as dbUpdateJob,
  deleteJob as dbDeleteJob,
  loadMaterials,
  loadSuppliers,
  loadJobMaterials,
  loadPriceObservations,
  createMaterial as dbCreateMaterial,
  deleteMaterial as dbDeleteMaterial,
  createSupplier as dbCreateSupplier,
  deleteSupplier as dbDeleteSupplier,
  createJobMaterial as dbCreateJobMaterial,
  updateJobMaterial as dbUpdateJobMaterial,
  deleteJobMaterial as dbDeleteJobMaterial,
} from '../lib/dataProvider';
import {
  listExtractedDocuments,
  saveExtractedDocument,
  saveExtractedLineItems,
} from '../lib/intelligenceDataProvider';

// Data / mocks
import { MS_PER_DAY } from '../utils/timeConstants';
import { logWarn } from '../utils/errorHandler';
import { withTimeout } from '../utils/withTimeout';
import { trackEvent } from '../services/eventTrackingService';
import { fireNotification } from '../services/notificationService';
import { markStepComplete } from '../services/onboardingTrackerService';
import { subscribeDocNumberRemap, type DocNumberRemapEvent } from '../services/docNumberRemapBus';
import { businessProfile as initialBusinessProfile, US_BUSINESS_PROFILE } from '../data/mockBusiness';
import { invoices as initialInvoices, quotes as initialQuotes } from '../data/mockDocuments';
import { quoteLineItems as initialLineItems } from '../data/mockLineItems';
import { localDateKey, todayKey } from '../utils/dateKey';

export type ContractorMetrics = {
  revenueThisMonth: number;
  invoicesOutstandingValue: number;
  overdueInvoices: number;
  scheduledJobsCount: number;
  quotesOutstanding: number;
  activeJobsCount: number;
};

type AppState = {
  isLoading: boolean;
  refreshData: () => Promise<void>;
  businessProfile: BusinessProfile;
  quotes: Quote[];
  invoices: Invoice[];
  jobs: Job[];
  metrics: ContractorMetrics;
  priceRisks: PriceRiskSignal[];
  extractedDocs: ExtractedDocument[];
  lineItems: Record<string, QuoteLineItem[]>;
  customers: Customer[];
  // R81 US Phase 4: sales-pipeline leads. Pre-customer entities until
  // status flips to 'won' (then a real Customer + Job is created and
  // customerId is back-linked).
  leads: Lead[];
  // R86 crew dispatch lite: contractor's crew roster. Empty for solo
  // contractors. Drives Job.assignedWorkerId assignment + per-tech
  // swimlanes in the schedule view.
  workers: Worker[];
  materials: Material[];
  suppliers: Supplier[];
  jobMaterials: Record<string, JobMaterial[]>;
  priceObservations: Record<string, PriceObservation[]>;
  addCustomer: (name: string, email?: string, phone?: string, address?: string) => Promise<string>;
  // R45: customer mutability — was a feature gap (no edit/delete path).
  updateCustomer: (id: string, updates: { name?: string; email?: string; phone?: string; address?: string }) => Promise<void>;
  removeCustomer: (id: string) => Promise<void>;
  // R81 US Phase 4: lead CRUD. Demo-mode persists to AsyncStorage only;
  // production writes to the `leads` table (migration 20260520000002).
  addLead: (input: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  removeLead: (id: string) => Promise<void>;
  moveLeadStatus: (id: string, status: LeadStatus) => Promise<void>;
  // R86 crew dispatch lite: worker CRUD. Migration 20260520000004.
  addWorker: (input: Omit<Worker, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateWorker: (id: string, updates: Partial<Worker>) => Promise<void>;
  removeWorker: (id: string) => Promise<void>;
  addJob: (title: string, customerId?: string | null, description?: string | null, extra?: {
    address_street?: string;
    address_city?: string;
    address_postcode?: string;
    address_country?: string;
    scheduled_date?: string;
    estimated_duration?: number;
    quoted_amount?: number;
    agreed_amount?: number;
    trade?: string;
    priority?: string;
  }) => Promise<string>;
  updateJobStatus: (id: string, status: JobStatus) => { warnings: string[] };
  updateJob: (id: string, updates: Partial<Job>) => void;
  removeJob: (id: string) => void;
  moneybirdConnected: boolean;
  lastMoneybirdExport: Record<string, string>;
  mollieConnected: boolean;
  lastMolliePayment: Record<string, string>;
  stripeConnected: boolean;
  lastStripePayment: Record<string, string>;
  ingestPdfHistory: () => void;
  addExtractedDoc: (doc: ExtractedDocument) => void;
  applySuggestedPrice: (quoteId: string, description: string, unitPrice: number) => void;
  markQuoteSent: (id: string) => void;
  markInvoiceSent: (id: string) => void;
  markInvoicePaid: (id: string) => void;
  addQuote: (customer: string, job: string, items: QuoteLineItem[]) => Promise<string>;
  addInvoice: (sourceQuoteId: string) => Promise<string>;
  removeQuote: (id: string) => void;
  removeInvoice: (id: string) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  updateBusinessProfile: (updates: Partial<BusinessProfile>) => Promise<void>;
  connectMoneybird: () => void;
  exportInvoice: (invoiceId: string) => Promise<void>;
  addMaterial: (material: Omit<Material, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  removeMaterial: (id: string) => void;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  removeSupplier: (id: string) => void;
  addJobMaterial: (jm: Omit<JobMaterial, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateJobMaterialStatus: (id: string, jobId: string, status: JobMaterialStatus) => void;
  removeJobMaterial: (id: string, jobId: string) => void;
  connectMollie: () => void;
  connectStripe: () => void;
  disconnectMollie: () => Promise<void>;
  disconnectStripe: () => Promise<void>;
  createPaymentLink: (invoiceId: string, amount: number) => Promise<void>;
  // R309: mint a deposit/payment checkout link for a decision tracker and store
  // it on the tracker (by access_code) so the customer portal shows the pay CTA.
  // Returns the checkout URL. Throws on provider failure (caller shows an error).
  requestTrackerDeposit: (accessCode: string, amount: number) => Promise<string>;
  addInvoiceFromJob: (jobId: string) => Promise<string>;
  /** Raise the invoice for one project billing term (termijnfactuur). */
  addTermInvoice: (projectId: string, termId: string) => Promise<string>;
  /** Bill one meerwerk/minderwerk item on its own invoice. */
  addChangeOrderInvoice: (projectId: string, changeOrderId: string) => Promise<string>;
  /** Release the retentie held on a project as a single invoice. */
  addRetentionReleaseInvoice: (projectId: string) => Promise<string>;
  convertQuoteToJob: (quoteId: string) => Promise<string>;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  // Project mode (aannemer)
  projects: Project[];
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'totalInvoiced' | 'totalPaid'>) => string;
  updateProject: (id: string, updates: Partial<Project>) => void;
  addJobToProject: (projectId: string, jobId: string) => void;
  getProjectPnL: (projectId: string) => ProjectPnL;
  pendingBudgetExtraction: BudgetExtractionResult | null;
  setPendingBudgetExtraction: (e: BudgetExtractionResult | null) => void;
};

const AppStateContext = createContext<AppState | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION: Provider & State Initialization (seeds, defaults)
// ═══════════════════════════════════════════════════════════════════════════════

// Seed data flag — controlled by src/config/demo.ts (true in __DEV__ or when EXPO_PUBLIC_DEMO_MODE=true)
const useSeedData = USE_SEED_DATA;

// Seed jobs — defined outside component to avoid Babel parse issues with inline ternaries
const SEED_JOBS: Job[] = [
  { id: 'j-seed-1', customerId: 'cust-004', title: 'Lekkage inspectie — Fam. Bakker', description: null, status: 'lead', trade: 'plumbing', priority: 'normal', quotedAmount: 180, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 1).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-seed-2', customerId: 'cust-001', title: 'CV-ketel onderhoud — Fam. de Vries', description: null, status: 'scheduled', trade: 'plumbing', priority: 'normal', scheduledDate: todayKey(), scheduledStartTime: '09:00', scheduledEndTime: '12:00', estimatedDuration: 3, quotedAmount: 450, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 3).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-seed-3', customerId: 'cust-002', title: 'Badkamer renovatie — Fam. Jansen', description: null, status: 'in-progress', trade: 'plumbing', priority: 'normal', scheduledDate: todayKey(), scheduledStartTime: '13:30', scheduledEndTime: '17:00', estimatedDuration: 24, quotedAmount: 4200, agreedAmount: 4200, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 7).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-seed-4', customerId: 'cust-003', title: 'Lekkage reparatie — Bakkerij Smit', description: null, status: 'completed', trade: 'plumbing', priority: 'normal', estimatedDuration: 2, quotedAmount: 280, agreedAmount: 280, actualHours: 2.5, actualCost: 85, completedAt: new Date(Date.now() - MS_PER_DAY * 12).toISOString(), photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 14).toISOString(), updatedAt: new Date(Date.now() - MS_PER_DAY * 12).toISOString() },
  { id: 'j-seed-5', customerId: 'cust-005', title: 'Vloerverwarming check — Hotel NH', description: null, status: 'invoiced', trade: 'plumbing', priority: 'normal', estimatedDuration: 2, quotedAmount: 350, agreedAmount: 350, invoiceId: 'inv-seed-1', completedAt: new Date(Date.now() - MS_PER_DAY * 20).toISOString(), photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 25).toISOString(), updatedAt: new Date(Date.now() - MS_PER_DAY * 20).toISOString() },
];

const SEED_CUSTOMERS: Customer[] = [
  { id: 'cust-001', name: 'Fam. de Vries', email: 'devries@gmail.com', phone: '+31 6 12345678' },
  { id: 'cust-002', name: 'Fam. Jansen', email: 'jansen@hotmail.com', phone: '+31 6 87654321' },
  { id: 'cust-003', name: 'Bakkerij Smit', email: 'info@bakkerijsmit.nl', phone: '+31 20 1234567' },
  { id: 'cust-004', name: 'Fam. Bakker', email: 'bakker@gmail.com', phone: '+31 6 55512345' },
  { id: 'cust-005', name: 'Hotel NH', email: 'facilitair@nh-hotels.nl', phone: '+31 20 5551234' },
  // The seeded invoices/quotes in mockDocuments bill these three, but they
  // were never seeded as contacts — so the demo invoiced customers who did
  // not exist. Visible effect: Klanten reported "No revenue yet · €0,00"
  // while Geld showed €760 paid, because the paid invoice (i-1044, Van Dijk)
  // could not be attributed to any contact. Demo-gated data (useSeedData).
  { id: 'cust-006', name: 'Van Dijk', email: 'info@vandijkbv.nl', phone: '+31 6 44556677' },
  { id: 'cust-007', name: 'De Jong', email: 'dejong@ziggo.nl', phone: '+31 6 33221100' },
  { id: 'cust-008', name: 'Bouwgroep Atlas', email: 'projecten@bouwgroepatlas.nl', phone: '+31 30 7654321' },
];

// Demo material catalog + suppliers. The catalog resolves jobMaterial.materialId
// → a human name (job detail previously leaked the raw 'mat-cvfilter' id) and
// gives the reorder / purchasing flows real rows to work against. Demo-gated
// (useSeedData); production populates these from the backend.
const SEED_SUPPLIERS: Supplier[] = [
  { id: 'sup-warmteservice', name: 'Warmteservice', accountStatus: 'active', avgLeadTimeDays: 2, totalSpend: 0, totalOrders: 0, apiEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'sup-gamma', name: 'Gamma', accountStatus: 'active', avgLeadTimeDays: 1, totalSpend: 0, totalOrders: 0, apiEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const SEED_MATERIALS: Material[] = [
  { id: 'mat-cvfilter', name: 'CV-filter', category: 'verwarming', baseUnit: 'stuk', aliases: ['cv filter', 'ketelfilter'], demandPattern: 'steady', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'mat-expansievat', name: 'Expansievat 8L', category: 'verwarming', baseUnit: 'stuk', aliases: ['expansievat'], demandPattern: 'steady', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'mat-koperbuis', name: 'Koperbuis 15mm', category: 'leidingwerk', baseUnit: 'meter', aliases: ['koperen buis', 'cu buis'], demandPattern: 'steady', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'mat-thermostaat', name: 'Thermostaatknop', category: 'verwarming', baseUnit: 'stuk', aliases: ['thermostaatkop'], demandPattern: 'steady', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

const SEED_JOB_MATERIALS: Record<string, JobMaterial[]> = {
  'j-seed-2': [
    { id: 'jm-s2-1', jobId: 'j-seed-2', materialId: 'mat-cvfilter', quantity: 2, unit: 'stuk', unitPrice: 8.50, totalPrice: 17, supplierId: 'sup-warmteservice', status: 'planned', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'jm-s2-2', jobId: 'j-seed-2', materialId: 'mat-expansievat', quantity: 1, unit: 'stuk', unitPrice: 65, totalPrice: 65, supplierId: 'sup-warmteservice', status: 'planned', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  'j-seed-3': [
    { id: 'jm-s3-1', jobId: 'j-seed-3', materialId: 'mat-koperbuis', quantity: 6, unit: 'meter', unitPrice: 12.50, totalPrice: 75, supplierId: 'sup-gamma', status: 'delivered', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'jm-s3-2', jobId: 'j-seed-3', materialId: 'mat-thermostaat', quantity: 3, unit: 'stuk', unitPrice: 42, totalPrice: 126, supplierId: 'sup-warmteservice', status: 'ordered', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
};

// R78 US foundation: US-flavoured seed jobs + customers for the US demo
// contractor (Mike Reynolds, Reynolds Heating & Cooling). HVAC service
// calls + remodel-adjacent retrofit work + a paid commercial RTU swap —
// covers the lead / scheduled / in-progress / completed / invoiced
// states so every screen demoes real data.
const US_SEED_JOBS: Job[] = [
  { id: 'j-us-1', customerId: 'cust-us-001', title: 'AC not cooling — Williams residence', description: null, status: 'lead', trade: 'gas-hvac', priority: 'high', quotedAmount: 385, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 1).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-us-2', customerId: 'cust-us-002', title: 'Annual HVAC service — Chen', description: null, status: 'scheduled', trade: 'gas-hvac', priority: 'normal', scheduledDate: todayKey(), scheduledStartTime: '09:00', scheduledEndTime: '11:00', estimatedDuration: 2, quotedAmount: 295, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 3).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-us-3', customerId: 'cust-us-003', title: 'Full system replacement — Garcia kitchen remodel', description: null, status: 'in-progress', trade: 'gas-hvac', priority: 'normal', scheduledDate: todayKey(), scheduledStartTime: '13:00', scheduledEndTime: '17:30', estimatedDuration: 32, quotedAmount: 8750, agreedAmount: 8750, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 7).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-us-4', customerId: 'cust-us-004', title: 'Capacitor replacement — Patel HOA clubhouse', description: null, status: 'completed', trade: 'gas-hvac', priority: 'normal', estimatedDuration: 1.5, quotedAmount: 240, agreedAmount: 240, actualHours: 1.25, actualCost: 65, completedAt: new Date(Date.now() - MS_PER_DAY * 9).toISOString(), photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 11).toISOString(), updatedAt: new Date(Date.now() - MS_PER_DAY * 9).toISOString() },
  { id: 'j-us-5', customerId: 'cust-us-005', title: 'Commercial RTU swap — Lone Star Diner', description: null, status: 'invoiced', trade: 'gas-hvac', priority: 'normal', estimatedDuration: 12, quotedAmount: 4200, agreedAmount: 4200, invoiceId: 'inv-us-1', completedAt: new Date(Date.now() - MS_PER_DAY * 18).toISOString(), photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 22).toISOString(), updatedAt: new Date(Date.now() - MS_PER_DAY * 18).toISOString() },
];

const US_SEED_CUSTOMERS: Customer[] = [
  { id: 'cust-us-001', name: 'Sarah Williams', email: 'swilliams@gmail.com', phone: '+1 512 555 0167' },
  { id: 'cust-us-002', name: 'David Chen', email: 'dchen@gmail.com', phone: '+1 512 555 0148' },
  { id: 'cust-us-003', name: 'Garcia Family', email: 'mgarcia@hotmail.com', phone: '+1 512 555 0193' },
  { id: 'cust-us-004', name: 'Cedar Park HOA', email: 'manager@cedarparkhoa.com', phone: '+1 512 555 0211' },
  { id: 'cust-us-005', name: 'Lone Star Diner', email: 'ops@lonestardiner.com', phone: '+1 512 555 0356' },
];

export function AppStateProvider({ children }: PropsWithChildren) {
  // R58: was `const aiUserId = getCurrentUserId()` captured at render-time
  // and baked into the useMemo'd action functions. The useMemo deps array
  // doesn't include aiUserId, so for accounts with no initial state arrays
  // changing post-login, every emit fired under the stale 'current-user'
  // placeholder forever — corrupting cohort attribution on the very first
  // session. Replaced all 17 references with inline `getCurrentUserId()`
  // calls inside each action body so each invocation reads the live ref.
  // Module-level `currentUser.ts` is the source of truth, kept in sync by
  // AuthContext on login/logout.
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(
    useSeedData ? initialBusinessProfile : { isComplete: false, completenessPercent: 0 },
  );
  const [quotes, setQuotes] = useState<Quote[]>(useSeedData ? initialQuotes : []);
  const [invoices, setInvoices] = useState<Invoice[]>(useSeedData ? initialInvoices : []);
  const [jobs, setJobs] = useState(useSeedData ? SEED_JOBS : [] as Job[]);
  const [extractedDocs, setExtractedDocs] = useState<ExtractedDocument[]>([]);
  const [lineItems, setLineItems] = useState<Record<string, QuoteLineItem[]>>(
    useSeedData ? initialLineItems : {},
  );
  const [customers, setCustomers] = useState(useSeedData ? SEED_CUSTOMERS : [] as Customer[]);
  // R81 US Phase 4: lead pipeline. Empty by default — leads accumulate
  // from auto-create on rejected quotes (R81b) + manual entry +
  // lead-capture widget. Persisted to AsyncStorage and (in prod) to the
  // `leads` table.
  const [leads, setLeads] = useState<Lead[]>([]);
  // R86 crew dispatch lite: contractor's roster. Empty for solo
  // contractors. Persisted to AsyncStorage and (in prod) to `workers`.
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [materials, setMaterials] = useState<Material[]>(useSeedData ? SEED_MATERIALS : []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(useSeedData ? SEED_SUPPLIERS : []);
  const [jobMaterialsMap, setJobMaterialsMap] = useState(useSeedData ? SEED_JOB_MATERIALS : {} as Record<string, JobMaterial[]>);
  const [priceObsMap, setPriceObsMap] = useState<Record<string, PriceObservation[]>>({});
  const [moneybirdConnected, setMoneybirdConnected] = useState(false);
  const [lastMoneybirdExport, setLastMoneybirdExport] = useState<Record<string, string>>({});
  const [mollieConnected, setMollieConnected] = useState(false);
  const [lastMolliePayment, setLastMolliePayment] = useState<Record<string, string>>({});
  const [stripeConnected, setStripeConnected] = useState(false);
  const [lastStripePayment, setLastStripePayment] = useState<Record<string, string>>({});
  const [pendingBudgetExtraction, setPendingBudgetExtraction] = useState<BudgetExtractionResult | null>(null);
  // Seed projects for aannemer demo
  const SEED_PROJECTS: Project[] = [
    {
      id: 'proj-seed-1', title: 'Badkamer renovatie — Fam. Jansen', customerId: 'cust-002', customerName: 'Fam. Jansen',
      status: 'active', totalBudget: 12500, totalQuoted: 12500, totalInvoiced: 0, totalPaid: 0,
      jobIds: ['j-seed-3'], quoteIds: [], invoiceIds: [], subcontractorIds: [], milestones: [], billingTerms: [], retentionPercent: 0, changeOrders: [],
      startDate: localDateKey(new Date(Date.now() - MS_PER_DAY * 7)),
      targetEndDate: localDateKey(new Date(Date.now() + MS_PER_DAY * 21)),
      createdAt: new Date(Date.now() - MS_PER_DAY * 14).toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-seed-2', title: 'Keuken verbouwing — Bakkerij Smit', customerId: 'cust-003', customerName: 'Bakkerij Smit',
      status: 'planning', totalBudget: 18000, totalQuoted: 16500, totalInvoiced: 0, totalPaid: 0,
      jobIds: ['j-seed-4'], quoteIds: [], invoiceIds: [], subcontractorIds: [], milestones: [], billingTerms: [], retentionPercent: 0, changeOrders: [],
      targetEndDate: localDateKey(new Date(Date.now() + MS_PER_DAY * 45)),
      createdAt: new Date(Date.now() - MS_PER_DAY * 3).toISOString(), updatedAt: new Date().toISOString(),
    },
  ];
  const [projects, setProjects] = useState<Project[]>(useSeedData ? SEED_PROJECTS : []);

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION: Data Hydration (refreshData, AsyncStorage persistence)
  // ═══════════════════════════════════════════════════════════════════════════

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [q, inv, bp, li, cust, j, mat, sup, jm, po, ld, wk] = await Promise.all([
        loadQuotes(),
        loadInvoices(),
        loadBusinessProfile(),
        loadLineItems(),
        loadCustomers(),
        loadJobs(),
        loadMaterials(),
        loadSuppliers(),
        loadJobMaterials(),
        loadPriceObservations(),
        loadLeads(),
        loadWorkers(),
      ]);
      setQuotes(q);
      setInvoices(inv);
      // R96 — hydrate leads + workers (rule #8 gap fix). Previously these
      // were write-only from the client's perspective; the entity tables
      // existed but nothing READ from them, so every cold-start the
      // pipeline + crew screens looked empty even if rows existed in BE.
      setLeads(ld);
      setWorkers(wk);
      setBusinessProfile(bp);
      // R66r50: push vatScheme into currentUser ref so non-hook consumers
      // (photo-quote preview, spreadsheet extractor) compute KOR-correct VAT.
      if (bp?.vatScheme) {
        const userId = getCurrentUserId();
        if (userId) {
          setCurrentUser({
            id: userId,
            country: getCurrentCountry() ?? bp.country,
            trade: getCurrentTrade() ?? bp.trade,
            vatScheme: bp.vatScheme,
          });
        }
      }
      // R210: once businessProfile.country is known, prime the cohort DSO
      // so the DSO generator + collections insights see the real cohort
      // median instead of the hardcoded 32-day industry average.
      if (bp?.country) {
        import('../services/collectionsAgentService')
          .then(m => m.primeCohortIndustryAverage(bp.country as string))
          .catch(() => {});
      }
      setLineItems(li);
      // R57: preserve temp-id rows on refresh — was overwriting wholesale
      // which made offline-created entities (customer/job/etc. with
      // `c-{ts}`/`j-{ts}` etc.) disappear from the UI between refresh and
      // the next offlineWriteQueue.flushQueue() that promotes them to BE.
      // R49+R54 guarantee the temp row will get re-keyed to its real BE
      // uuid on flush; until then we keep it visible to the user.
      // R59: shape predicate hoisted to src/lib/idShape.ts as `isTempIdFast`.
      setCustomers((prev) => {
        const tempRows = prev.filter((c) => isTempIdFast(c.id));
        return [...tempRows, ...cust];
      });
      setJobs((prev) => {
        const tempRows = prev.filter((row) => isTempIdFast(row.id));
        return [...tempRows, ...j];
      });
      setMaterials((prev) => {
        const tempRows = prev.filter((row) => isTempIdFast(row.id));
        return [...tempRows, ...mat];
      });
      setSuppliers((prev) => {
        const tempRows = prev.filter((row) => isTempIdFast(row.id));
        return [...tempRows, ...sup];
      });
      // Quotes use docNumber as id (not a temp-id pattern), so wholesale
      // replace at the top of refreshData is correct — addQuote already
      // calls nextDocumentNumber() which produces a stable string the BE
      // persists verbatim. No re-merge needed here.
      setJobMaterialsMap(jm);
      setPriceObsMap(po);

      // Load extracted documents from Supabase (if configured)
      if (isSupabaseConfigured) {
        try {
          const rows = await listExtractedDocuments();
          if (rows.length > 0) {
            const docs = rows.map((r) => rowToExtractedDocument(r, []));
            setExtractedDocs(docs);
          }
        } catch (err) {
          logWarn('AppState', `loadExtractedDocs failed: ${err}`);
        }

        // R275: load projects from BE (promoted from AsyncStorage-only)
        try {
          const { listProjects } = await import('../lib/dataProvider');
          const projectRows = await listProjects();
          if (projectRows.length > 0) {
            const mapped: Project[] = projectRows.map((r: any) => ({
              id: r.id,
              title: r.name,
              description: r.description ?? undefined,
              customerId: r.customer_id ?? '',
              customerName: undefined,
              status: r.status,
              address: r.address ?? undefined,
              startDate: r.start_date ?? undefined,
              targetEndDate: r.target_end_date ?? undefined,
              actualEndDate: r.actual_end_date ?? undefined,
              totalBudget: r.total_budget ?? 0,
              totalQuoted: r.total_quoted ?? 0,
              totalInvoiced: r.total_invoiced ?? 0,
              totalPaid: r.total_paid ?? 0,
              milestones: Array.isArray(r.milestones) ? r.milestones : [],
              // Progress billing. Rule #8 step 5 — without these the terms a
              // contractor set up vanish on cold start.
              billingTerms: Array.isArray(r.billing_terms) ? r.billing_terms : [],
              retentionPercent: Number(r.retention_percent ?? 0),
              changeOrders: Array.isArray(r.change_orders) ? r.change_orders : [],
              jobIds: [],
              quoteIds: [],
              invoiceIds: [],
              subcontractorIds: [],
              createdAt: r.created_at,
              updatedAt: r.updated_at,
            }));
            setProjects(mapped);
          }
        } catch (err) {
          logWarn('AppState', `loadProjects failed: ${err}`);
        }
      }
    } catch (err) {
      logWarn('AppState', `refreshData failed: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load from Supabase on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // R46: reset in-memory contractor state on logout so the next user signing
  // in on the same device doesn't see the previous user's customers / jobs /
  // quotes / invoices in the React tree until refreshData() re-hydrates.
  // Listens to the currentUser pub/sub set by AuthContext.setCurrentUser.
  useEffect(() => {
    const unsub = subscribeUserChange((userId) => {
      if (userId === null) {
        // Logged out — wipe in-memory arrays. AsyncStorage already cleared
        // by sessionCleanup.clearUserScopedStorage() in AuthContext.logout.
        setQuotes([]);
        setInvoices([]);
        setJobs([]);
        setCustomers([]);
        setLineItems({});
        setMaterials([]);
        setSuppliers([]);
        setJobMaterialsMap({});
        setProjects([]);
        setLeads([]);
        setWorkers([]);
        setBusinessProfile({ isComplete: false, completenessPercent: 0 });
        setExtractedDocs([]);
        setPriceObsMap({});
        setMoneybirdConnected(false);
        setMollieConnected(false);
        setLastMoneybirdExport({});
        setLastMolliePayment({});
      } else {
        // R78 US foundation, R119 fix: when a US contractor logs in
        // SEED them with the Reynolds HVAC sample pipeline ONLY in
        // demo mode (DEV builds + EXPO_PUBLIC_DEMO_MODE=true). Pre-R119
        // this branch said "demo or otherwise" with no gate, so every
        // real US contractor's first sign-in clobbered their empty
        // BE-hydrated state with "Reynolds Heating & Cooling /
        // 2847 Burnet Road, Austin TX / mike@reynoldshvac.com" +
        // Garcia Family + David Chen customers + 32-hour HVAC jobs.
        // Multiple TF reports showed this leaking into the Werk tab,
        // Profile, Business Details, and Notifications.
        if (useSeedData && getCurrentCountry() === 'US') {
          setBusinessProfile(US_BUSINESS_PROFILE);
          setCustomers(US_SEED_CUSTOMERS);
          setJobs(US_SEED_JOBS);
        }
        // New user signed in — re-hydrate from BE for the new auth context.
        refreshData();
      }
    });
    return unsub;
  }, [refreshData]);

  // R66r62: subscribe to docNumberRemapBus. When the offline write queue
  // flushes a document insert whose `document_number` was an offline
  // placeholder (Q-OFF-XXXXXX), it calls the canonical RPC, swaps the
  // payload, and emits a remap event here so the local Quote / Invoice
  // row displayed in the UI updates to the canonical Q0008/I0008.
  // Closes R66.36 cross-device counter collision.
  useEffect(() => {
    const unsub = subscribeDocNumberRemap((event: DocNumberRemapEvent) => {
      if (event.docType === 'quote') {
        setQuotes((prev) =>
          prev.map((q) =>
            q.id === event.placeholderNumber
              ? { ...q, id: event.realNumber, updatedAt: new Date().toISOString() }
              : q,
          ),
        );
      } else {
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === event.placeholderNumber
              ? { ...inv, id: event.realNumber, updatedAt: new Date().toISOString() }
              : inv,
          ),
        );
      }
    });
    return unsub;
  }, []);

  // Hydrate from AsyncStorage when offline (no Supabase)
  // persistReady uses state (not ref) to trigger re-render and guard persist effects
  const SEED_VERSION = '2026-03-25-v4';
  const [persistReady, setPersistReady] = useState(false);
  const hydrated = useRef(false);
  useEffect(() => {
    if (useSeedData && !hydrated.current) {
      hydrated.current = true;
      (async () => {
        try {
          const storedVersion = await AsyncStorage.getItem('@vasco_seed_version');
          if (storedVersion !== SEED_VERSION) {
            // New seed version — wipe ALL stale data, use fresh seeds from useState
            await AsyncStorage.multiRemove([
              '@vasco_jobs', '@vasco_invoices', '@vasco_quotes',
              '@vasco_customers', '@vasco_projects', '@vasco_decision_trackers',
              '@vasco_business_profile', '@vasco_leads', '@vasco_workers',
            ]);
            await AsyncStorage.setItem('@vasco_seed_version', SEED_VERSION);
          } else {
            // Same version — load persisted user data (only if non-empty)
            const pairs: [string, (v: any) => void][] = [
              ['@vasco_jobs', setJobs], ['@vasco_invoices', setInvoices],
              ['@vasco_quotes', setQuotes], ['@vasco_customers', setCustomers],
              ['@vasco_projects', setProjects], ['@vasco_leads', setLeads],
              ['@vasco_workers', setWorkers],
            ];
            for (const [key, setter] of pairs) {
              const raw = await AsyncStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) setter(parsed);
              }
            }
            // Hydrate business profile (non-array)
            const bpRaw = await AsyncStorage.getItem('@vasco_business_profile');
            if (bpRaw) {
              try {
                const bpParsed = JSON.parse(bpRaw);
                if (bpParsed && typeof bpParsed === 'object') setBusinessProfile(prev => ({ ...prev, ...bpParsed }));
              } catch {}
            }
          }
        } catch {}
        // NOW allow persistence — uses setState so persist effects re-evaluate
        setPersistReady(true);
      })();
    }
  }, []);

  // Persist to AsyncStorage — ONLY after hydration completes (persistReady=true)
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_jobs', JSON.stringify(jobs)).catch(() => {});
    }
  }, [jobs, persistReady]);
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_invoices', JSON.stringify(invoices)).catch(() => {});
    }
  }, [invoices, persistReady]);
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_quotes', JSON.stringify(quotes)).catch(() => {});
    }
  }, [quotes, persistReady]);
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_customers', JSON.stringify(customers)).catch(() => {});
    }
  }, [customers, persistReady]);
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_projects', JSON.stringify(projects)).catch(() => {});
    }
  }, [projects, persistReady]);
  // R81 US Phase 4: persist leads alongside the other entity arrays.
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_leads', JSON.stringify(leads)).catch(() => {});
    }
  }, [leads, persistReady]);
  // R86 crew dispatch lite: persist workers.
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_workers', JSON.stringify(workers)).catch(() => {});
    }
  }, [workers, persistReady]);
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_business_profile', JSON.stringify(businessProfile)).catch(() => {});
    }
  }, [businessProfile, persistReady]);

  const recalcQuoteTotal = (quoteId: string, items: QuoteLineItem[]) => {
    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    setQuotes((prev) =>
      prev.map((quote) => (quote.id === quoteId ? { ...quote, amount: total } : quote))
    );
  };

  const metrics = useMemo<ContractorMetrics>(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const paidThisMonth = invoices.filter(
      (i) => i.status === 'paid' && i.dueInDays !== undefined,
    );
    const revenueThisMonth = paidThisMonth.reduce((sum, i) => sum + i.amount, 0);

    const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue');
    const invoicesOutstandingValue = outstanding.reduce((sum, i) => sum + i.amount, 0);
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue').length;

    const scheduledJobsCount = jobs.filter((j) => j.status === 'scheduled').length;
    const quotesOutstanding = quotes.filter((q) => q.status === 'sent').length;
    const activeJobsCount = jobs.filter(
      (j) => j.status === 'in-progress' || j.status === 'scheduled',
    ).length;

    return {
      revenueThisMonth,
      invoicesOutstandingValue,
      overdueInvoices,
      scheduledJobsCount,
      quotesOutstanding,
      activeJobsCount,
    };
  }, [invoices, jobs, quotes]);

  const value = useMemo<AppState>(
    () => ({
      isLoading,
      refreshData,
      businessProfile,
      quotes,
      invoices,
      jobs,
      metrics,
      extractedDocs,
      lineItems,
      customers,
      materials,
      suppliers,
      jobMaterials: jobMaterialsMap,
      priceObservations: priceObsMap,
      addCustomer: async (name, email, phone, address) => {
        const tempId = `c-${Date.now()}`;
        const newCustomer: Customer = { id: tempId, name, email, phone, address };
        setCustomers((prev) => [newCustomer, ...prev]);

        // R52: split BE-persist from post-create housekeeping. Was a real
        // bug — the BE-success branch returned the row id early, skipping
        // markStepComplete('first_customer_added') AND the customer
        // embedding for semantic search. Online users never got the
        // first-customer activation milestone fired, and their first
        // customer was never indexed cohort-wide.
        let finalId = tempId;
        if (isSupabaseConfigured) {
          try {
            const row = await withTimeout(dbCreateCustomer({ name, email, phone, address }), 3000, 'addCustomer');
            setCustomers((prev) =>
              prev.map((c) => (c.id === tempId ? { ...c, id: (row as any).id } : c))
            );
            finalId = (row as any).id as string;
          } catch (err) {
            logWarn('AppState', `addCustomer persist failed or timed out: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({
                table: 'customers',
                op: 'insert',
                payload: { id: tempId, user_id: getCurrentUserId(), name, email, phone, address },
              });
            } catch {}
          }
        }

        // Post-create housekeeping — uniform across BE-success / offline /
        // unconfigured paths.
        markStepComplete('first_customer_added').catch(() => {});
        // R243: fire-and-forget embedding under the FINAL id (real uuid
        // when BE succeeded, tempId otherwise). Was always under tempId,
        // which left BE-persisted customers with embeddings keyed to a
        // throwaway id — semantic search by real id would miss.
        const embedText = [name, email, phone, address].filter(Boolean).join(' ');
        if (embedText.length > 3) {
          import('../services/embeddingService').then((m) =>
            m.embedCustomer({ customerId: finalId, text: embedText }),
          ).catch(() => {});
        }
        return finalId;
      },
      // R45: customer mutability — was a feature gap. Both wrap persistOrQueue
      // for offline durability + re-fire embeddings on edits so semantic
      // search stays in sync.
      updateCustomer: async (id, updates) => {
        setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
        // R56: removed `!id.startsWith('c-')` gate. Pre-R56 it skipped BE
        // calls for temp-id rows entirely, meaning offline-edit-then-flush
        // silently lost the edit (the queued INSERT carried the original
        // payload only). Now persistOrQueue's temp-id fast path queues the
        // update directly; R49's rewriter resolves the rowId on flush.
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('customers', 'update', () => dbUpdateCustomer(id, updates), { rowId: id, payload: updates }),
          ).catch((err) => logWarn('AppState', `updateCustomer persist failed: ${err}`));
        }
        // Re-embed on contact-change so semantic-search reflects the edit.
        const merged = customers.find((c) => c.id === id);
        const embedText = [updates.name ?? merged?.name, updates.email ?? merged?.email, updates.phone ?? merged?.phone, updates.address ?? merged?.address]
          .filter(Boolean).join(' ');
        if (embedText.length > 3) {
          import('../services/embeddingService').then((m) =>
            m.embedCustomer({ customerId: id, text: embedText }),
          ).catch(() => {});
        }
      },
      removeCustomer: async (id) => {
        setCustomers((prev) => prev.filter((c) => c.id !== id));
        // R56: gate removed — see updateCustomer note. persistOrQueue's
        // temp-id path queues the delete; on flush R49 either drops it
        // (parent insert never ran) or rewrites the rowId (parent did).
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('customers', 'delete', () => dbDeleteCustomer(id), { rowId: id }),
          ).catch((err) => logWarn('AppState', `removeCustomer persist failed: ${err}`));
        }
      },

      // ═════════════════════════════════════════════════════════════════════
      // SECTION: Lead CRUD (R81 US Phase 4)
      // Pre-customer pipeline entities. Demo mode: AsyncStorage only.
      // Production: leads table (migration 20260520000002) + offline queue.
      // ═════════════════════════════════════════════════════════════════════

      leads,
      addLead: async (input) => {
        const tempId = `lead-${Date.now()}`;
        const now = new Date().toISOString();
        const newLead: Lead = { ...input, id: tempId, createdAt: now, updatedAt: now };
        setLeads((prev) => [newLead, ...prev]);
        // R95 breadcrumb. Sentry no-ops when DSN unset; once activated
        // we get session traces showing the lead-flow through.
        trackEvent('lead_created', { source: input.source, hasValue: input.estimatedValue ? 1 : 0 }).catch(() => {});
        // Intelligence loop: register entity + emit business event so
        // generators (leadFollowup, source-acceptance cohort) + ML
        // (quote-win predictor) can read this. ID-remap to real BE uuid
        // happens via R54 idRemapBus (TABLE_TO_ENTITY_TYPE.leads='lead').
        upsertEntity({
          id: tempId,
          type: 'lead',
          name: newLead.customerName || newLead.jobDescription || 'New lead',
          attributes: {
            source: newLead.source,
            status: newLead.status,
            estimatedValue: newLead.estimatedValue,
            customerId: newLead.customerId,
          },
          scores: { reliability: 50, quality: 50, value: newLead.estimatedValue ?? 0, frequency: 1 },
          lastUpdated: now,
        }).catch(() => {});
        emitLeadCreated(getCurrentUserId(), tempId, {
          source: newLead.source,
          estimatedValue: newLead.estimatedValue,
          customerId: newLead.customerId,
          hasJobDescription: !!newLead.jobDescription,
        }).catch(() => {});
        // Stage 4 semantic embedding: index the lead's text so future
        // "similar past leads" lookups can surface it. Fire-and-forget;
        // failures are silent (semantic search degrades, business state
        // unaffected).
        const leadEmbedText = [newLead.customerName, newLead.jobDescription, newLead.notes]
          .filter(Boolean)
          .join(' — ')
          .trim();
        if (leadEmbedText.length >= 3) {
          import('../services/embeddingService').then(({ embedLead }) =>
            embedLead({
              leadId: tempId,
              text: leadEmbedText,
              metadata: { source: newLead.source, status: newLead.status, estimatedValue: newLead.estimatedValue },
            }),
          ).catch(() => {});
        }
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('leads', 'insert', async () => {
              // Direct supabase insert — no dedicated db wrapper yet, mirrors
              // the customers/quotes pattern but inline since the table is
              // brand new. Replace with src/integrations/db/leads.ts when
              // that lands.
              const { supabase } = await import('../lib/supabase');
              // R81: `leads` table is brand new — supabase generated types
              // don't include it yet. Cast through `as any` until
              // `supabase gen types typescript --linked` runs in prod.
              const { data, error } = await (supabase.from('leads') as any)
                .insert({
                  user_id: getCurrentUserId(),
                  status: newLead.status,
                  source: newLead.source,
                  customer_name: newLead.customerName,
                  customer_phone: newLead.customerPhone,
                  customer_email: newLead.customerEmail,
                  customer_id: isUuid(newLead.customerId) ? newLead.customerId : null,
                  job_description: newLead.jobDescription,
                  estimated_value: newLead.estimatedValue,
                  notes: newLead.notes,
                  source_quote_id: isUuid(newLead.sourceQuoteId) ? newLead.sourceQuoteId : null,
                })
                .select('id')
                .single();
              if (error) throw error;
              if (data?.id) {
                setLeads((prev) =>
                  prev.map((l) => (l.id === tempId ? { ...l, id: data.id as string } : l))
                );
                // Online path: rekey any tempId-keyed housekeeping (ontology /
                // embeddings / events). Offline path gets this automatically via
                // the insert→select→mapping in flushQueue.
                const { emitIdRemap } = await import('../services/idRemapBus');
                emitIdRemap({ table: 'leads', tempId, realId: data.id as string, payload: { name: newLead.customerName } });
              }
              return data;
            }, {
              rowId: tempId,
              // Carry the full row so an OFFLINE insert actually persists — was
              // `{ rowId: tempId }` with no payload, so a lead created without
              // signal flushed as `insert(undefined)` and was lost. id:tempId
              // makes flush emit the temp→real idRemap.
              payload: {
                id: tempId,
                user_id: getCurrentUserId(),
                status: newLead.status,
                source: newLead.source,
                customer_name: newLead.customerName,
                customer_phone: newLead.customerPhone,
                customer_email: newLead.customerEmail,
                customer_id: isUuid(newLead.customerId) ? newLead.customerId : null,
                job_description: newLead.jobDescription,
                estimated_value: newLead.estimatedValue,
                notes: newLead.notes,
                source_quote_id: isUuid(newLead.sourceQuoteId) ? newLead.sourceQuoteId : null,
              },
            }),
          ).catch((err) => logWarn('AppState', `addLead persist failed: ${err}`));
        }
        return tempId;
      },
      updateLead: async (id, updates) => {
        const now = new Date().toISOString();
        // Snapshot previous state BEFORE the optimistic update so we can
        // emit status-transition events with from/to and elapsed-time
        // metadata for the quote-win ML predictor.
        const prevLead = leads.find((l) => l.id === id);
        // R301 audit fix: capture the post-mutation snapshot via the
        // setLeads callback (which sees the current `prev` regardless of
        // closure freshness) so Stage 6 attribution grades the generator
        // against the actual post-mutation state, not a stale-closure
        // reconstruction.
        let updatedLeadsSnapshot: Lead[] = leads;
        setLeads((prev) => {
          const next = prev.map((l) => (l.id === id ? { ...l, ...updates, updatedAt: now } : l));
          updatedLeadsSnapshot = next;
          return next;
        });
        if (prevLead && updates.status && updates.status !== prevLead.status) {
          // Stage 6 attribution: grade the lead-followup generator against
          // the freshly-mutated leads array (status transition is the
          // outcome signal). Best-effort, never blocks.
          attributeLeadFollowupOutcome(updatedLeadsSnapshot);
          const hoursInPrev = Math.round(
            (Date.now() - new Date(prevLead.updatedAt ?? prevLead.createdAt).getTime()) / 3_600_000,
          );
          emitLeadStatusChanged(getCurrentUserId(), id, {
            fromStatus: prevLead.status,
            toStatus: updates.status,
            source: prevLead.source,
            estimatedValue: updates.estimatedValue ?? prevLead.estimatedValue,
            hoursInPreviousStatus: hoursInPrev,
            sourceQuoteId: updates.sourceQuoteId ?? prevLead.sourceQuoteId,
          }).catch(() => {});
          if (updates.status === 'won' || updates.status === 'lost') {
            const hoursTotal = Math.round(
              (Date.now() - new Date(prevLead.createdAt).getTime()) / 3_600_000,
            );
            emitLeadConverted(getCurrentUserId(), id, {
              source: prevLead.source,
              outcome: updates.status,
              estimatedValue: prevLead.estimatedValue,
              actualQuoteAmount: updates.estimatedValue,
              sourceQuoteId: updates.sourceQuoteId ?? prevLead.sourceQuoteId,
              hoursFromCreatedToConverted: hoursTotal,
            }).catch(() => {});
            // If won and a customerId got linked, materialize the
            // lead→customer "converted_from" edge so the ontology can
            // attribute lifetime value back to the lead source.
            const linkedCustomerId = updates.customerId ?? prevLead.customerId;
            if (updates.status === 'won' && linkedCustomerId) {
              addRelation({
                fromId: linkedCustomerId,
                fromType: 'customer',
                toId: id,
                toType: 'lead',
                relationType: 'converted_from',
                metadata: { source: prevLead.source, value: prevLead.estimatedValue },
              }).catch(() => {});
            }
          }
        }
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('leads', 'update', async () => {
              const { supabase } = await import('../lib/supabase');
              const payload: Record<string, unknown> = {};
              if (updates.status !== undefined) payload.status = updates.status;
              if (updates.customerName !== undefined) payload.customer_name = updates.customerName;
              if (updates.customerPhone !== undefined) payload.customer_phone = updates.customerPhone;
              if (updates.customerEmail !== undefined) payload.customer_email = updates.customerEmail;
              if (updates.jobDescription !== undefined) payload.job_description = updates.jobDescription;
              if (updates.estimatedValue !== undefined) payload.estimated_value = updates.estimatedValue;
              if (updates.notes !== undefined) payload.notes = updates.notes;
              if (updates.customerId !== undefined) payload.customer_id = updates.customerId;
              const { error } = await (supabase.from('leads') as any).update(payload).eq('id', id);
              if (error) throw error;
            }, { rowId: id }),
          ).catch((err) => logWarn('AppState', `updateLead persist failed: ${err}`));
        }
      },
      removeLead: async (id) => {
        setLeads((prev) => prev.filter((l) => l.id !== id));
        trackEvent('lead_deleted', {}).catch(() => {});
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('leads', 'delete', async () => {
              const { supabase } = await import('../lib/supabase');
              const { error } = await (supabase.from('leads') as any).delete().eq('id', id);
              if (error) throw error;
            }, { rowId: id }),
          ).catch((err) => logWarn('AppState', `removeLead persist failed: ${err}`));
        }
      },
      // R86 crew dispatch lite — Worker CRUD. Same R52/R54 pattern as
      // leads: optimistic tempId → BE id swap, offlineWriteQueue fallback.
      workers,
      addWorker: async (input) => {
        const tempId = `worker-${Date.now()}`;
        const now = new Date().toISOString();
        const newWorker: Worker = { ...input, id: tempId, createdAt: now, updatedAt: now };
        setWorkers((prev) => [newWorker, ...prev]);
        trackEvent('worker_added', { role: input.role }).catch(() => {});
        // Intelligence loop: register worker as an ontology entity so the
        // worked_on / certified_by edges from job-completion and licenses
        // can attach. ID-remap on persist is handled by the idRemapBus
        // (TABLE_TO_ENTITY_TYPE.workers='worker').
        upsertEntity({
          id: tempId,
          type: 'worker',
          name: newWorker.name,
          attributes: {
            role: newWorker.role,
            trade: newWorker.trade,
            hourlyCost: newWorker.hourlyCost,
            isActive: newWorker.isActive,
          },
          scores: { reliability: 50, quality: 50, value: 0, frequency: 0 },
          lastUpdated: now,
        }).catch(() => {});
        emitWorkerAdded(getCurrentUserId(), tempId, {
          role: newWorker.role,
          trade: newWorker.trade,
          hourlyCost: newWorker.hourlyCost,
        }).catch(() => {});
        // Stage 4 semantic embedding: skill-profile text that future
        // worker-matching lookups can search. "Bas, lead_tech, plumbing"
        // becomes searchable so "who handles plumbing leak repairs" can
        // be answered with cosine similarity.
        const workerEmbedText = [newWorker.name, newWorker.role, newWorker.trade]
          .filter(Boolean)
          .join(' — ')
          .trim();
        if (workerEmbedText.length >= 3) {
          import('../services/embeddingService').then(({ embedWorker }) =>
            embedWorker({
              workerId: tempId,
              text: workerEmbedText,
              metadata: { role: newWorker.role, trade: newWorker.trade, hourlyCost: newWorker.hourlyCost },
            }),
          ).catch(() => {});
        }
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('workers', 'insert', async () => {
              const { supabase } = await import('../lib/supabase');
              // R86: workers is brand new — generated types don't include
              // it yet. Cast to any until `supabase gen types typescript
              // --linked` runs in prod.
              const { data, error } = await (supabase.from('workers') as any)
                .insert({
                  user_id: getCurrentUserId(),
                  name: newWorker.name,
                  role: newWorker.role,
                  email: newWorker.email,
                  phone: newWorker.phone,
                  trade: newWorker.trade,
                  hourly_cost: newWorker.hourlyCost,
                  is_active: newWorker.isActive,
                  color: newWorker.color,
                })
                .select('id')
                .single();
              if (error) throw error;
              if (data?.id) {
                setWorkers((prev) =>
                  prev.map((w) => (w.id === tempId ? { ...w, id: data.id as string } : w))
                );
                const { emitIdRemap } = await import('../services/idRemapBus');
                emitIdRemap({ table: 'workers', tempId, realId: data.id as string, payload: { name: newWorker.name } });
              }
              return data;
            }, {
              rowId: tempId,
              // Full row so an OFFLINE-created worker actually persists on flush
              // (was `{ rowId: tempId }` → insert(undefined) → worker lost).
              payload: {
                id: tempId,
                user_id: getCurrentUserId(),
                name: newWorker.name,
                role: newWorker.role,
                email: newWorker.email,
                phone: newWorker.phone,
                trade: newWorker.trade,
                hourly_cost: newWorker.hourlyCost,
                is_active: newWorker.isActive,
                color: newWorker.color,
              },
            }),
          ).catch((err) => logWarn('AppState', `addWorker persist failed: ${err}`));
        }
        return tempId;
      },
      updateWorker: async (id, updates) => {
        const now = new Date().toISOString();
        // R301 audit fix: capture post-mutation snapshot via setWorkers
        // callback for Stage 6 attribution — see updateLead for rationale.
        let updatedWorkersSnapshot: Worker[] = workers;
        setWorkers((prev) => {
          const next = prev.map((w) => (w.id === id ? { ...w, ...updates, updatedAt: now } : w));
          updatedWorkersSnapshot = next;
          return next;
        });
        // Stage 6: re-score worker-capacity generator with the post-update
        // crew state. Active flag flips + role changes both affect the
        // problem count, so resolve on any worker mutation.
        attributeCrewCapacityOutcome(updatedWorkersSnapshot, jobs as any);
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('workers', 'update', async () => {
              const { supabase } = await import('../lib/supabase');
              const payload: Record<string, unknown> = {};
              if (updates.name !== undefined) payload.name = updates.name;
              if (updates.role !== undefined) payload.role = updates.role;
              if (updates.email !== undefined) payload.email = updates.email;
              if (updates.phone !== undefined) payload.phone = updates.phone;
              if (updates.trade !== undefined) payload.trade = updates.trade;
              if (updates.hourlyCost !== undefined) payload.hourly_cost = updates.hourlyCost;
              if (updates.isActive !== undefined) payload.is_active = updates.isActive;
              if (updates.color !== undefined) payload.color = updates.color;
              const { error } = await (supabase.from('workers') as any).update(payload).eq('id', id);
              if (error) throw error;
            }, { rowId: id }),
          ).catch((err) => logWarn('AppState', `updateWorker persist failed: ${err}`));
        }
      },
      removeWorker: async (id) => {
        // R301 audit fix: post-mutation snapshot via setWorkers callback.
        let remainingWorkersSnapshot: Worker[] = workers;
        setWorkers((prev) => {
          const next = prev.filter((w) => w.id !== id);
          remainingWorkersSnapshot = next;
          return next;
        });
        trackEvent('worker_removed', {}).catch(() => {});
        // Stage 6: shrinking the crew changes the per-worker job load —
        // grade worker-capacity against the post-removal state.
        attributeCrewCapacityOutcome(remainingWorkersSnapshot, jobs as any);
        // Also unassign any jobs that pointed at this worker (FK cascade
        // does this on the server; do it client-side too so the optimistic
        // state stays consistent).
        setJobs((prev) =>
          prev.map((j) => (j.assignedWorkerId === id ? { ...j, assignedWorkerId: undefined } : j))
        );
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('workers', 'delete', async () => {
              const { supabase } = await import('../lib/supabase');
              const { error } = await (supabase.from('workers') as any).delete().eq('id', id);
              if (error) throw error;
            }, { rowId: id }),
          ).catch((err) => logWarn('AppState', `removeWorker persist failed: ${err}`));
        }
      },

      moveLeadStatus: async (id, status) => {
        trackEvent('lead_status_changed', { newStatus: status }).catch(() => {});
        const now = new Date().toISOString();
        setLeads((prev) =>
          prev.map((l) => {
            if (l.id !== id) return l;
            const updates: Partial<Lead> = { status, updatedAt: now };
            // BE trigger handles converted_at/contacted_at; mirror client-side
            // so the optimistic update matches what the server would write.
            if ((status === 'won' || status === 'lost') && l.status !== 'won' && l.status !== 'lost') {
              updates.convertedAt = now;
            }
            if (status !== 'new' && l.status === 'new' && !l.contactedAt) {
              updates.contactedAt = now;
            }
            return { ...l, ...updates };
          }),
        );
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('leads', 'update', async () => {
              const { supabase } = await import('../lib/supabase');
              const { error } = await (supabase.from('leads') as any).update({ status }).eq('id', id);
              if (error) throw error;
            }, { rowId: id }),
          ).catch((err) => logWarn('AppState', `moveLeadStatus persist failed: ${err}`));
        }
      },

      // ═════════════════════════════════════════════════════════════════════
      // SECTION: Job CRUD (addJob, updateJobStatus, updateJob, removeJob)
      // ═════════════════════════════════════════════════════════════════════

      addJob: async (title, customerId, description, extra) => {
        const tempId = `j-${Date.now()}`;
        const now = new Date().toISOString();
        const hasAddress = extra?.address_street || extra?.address_city;
        const newJob: Job = {
          id: tempId,
          customerId: customerId ?? null,
          title,
          description: description ?? null,
          status: 'lead',
          address: hasAddress
            ? {
                street: extra?.address_street ?? '',
                city: extra?.address_city ?? '',
                postcode: extra?.address_postcode ?? '',
                country: extra?.address_country ?? 'NL',
              }
            : undefined,
          scheduledDate: extra?.scheduled_date ?? undefined,
          estimatedDuration: extra?.estimated_duration ?? undefined,
          quotedAmount: extra?.quoted_amount ?? undefined,
          agreedAmount: extra?.agreed_amount ?? undefined,
          trade: extra?.trade ?? undefined,
          priority: (extra?.priority as JobPriority) ?? 'normal',
          photos: [],
          notes: [],
          timeEntries: [],
          materials: [],
          createdAt: now,
          updatedAt: now,
        };
        setJobs((prev) => [newJob, ...prev]);

        // ML prefill: if the caller didn't supply estimated_duration, ask the
        // predictor. Non-blocking so the optimistic row already rendered.
        if (!newJob.estimatedDuration && newJob.trade) {
          import('../services/jobPrefillService').then(async (mod) => {
            try {
              const pref = await mod.prefillJob({ trade: newJob.trade as string, title });
              setJobs((prev) => prev.map((j) =>
                j.id === tempId && !j.estimatedDuration
                  ? { ...j, estimatedDuration: pref.suggestedHours, quotedAmount: j.quotedAmount ?? pref.suggestedPriceLow }
                  : j,
              ));
            } catch {}
          }).catch(() => {});
        }

        // R52: split BE-persist from post-create housekeeping. Was a real
        // bug — the BE-success branch returned early after id-rewrite,
        // skipping ontology, trackEvent, markStepComplete('first_job_created'),
        // and calendar sync. Online users never got the first-job activation
        // milestone fired, so the activation/onboarding rail under-reported.
        let finalId = tempId;
        if (isSupabaseConfigured) {
          try {
            // Hard 3s timeout: on flaky signal the UI button shouldn't appear hung
            const row = await withTimeout(dbCreateJob({
              title,
              customer_id: customerId,
              description,
              ...extra,
            }), 3000, 'addJob');
            setJobs((prev) =>
              prev.map((j) => (j.id === tempId ? { ...j, id: row.id } : j)),
            );
            finalId = row.id;
          } catch (err) {
            // Was log-only — an offline / timed-out job was NEVER queued, so it
            // stayed a temp row in local storage and never reached the backend
            // (invisible cross-device + on reinstall). Queue it like every other
            // creator. user_id is REQUIRED (jobs.user_id NOT NULL; createJob
            // injects it on the online path, the raw queued insert must too).
            // Housekeeping keyed on tempId gets rekeyed by the idRemap emitted
            // when this insert flushes.
            logWarn('AppState', `addJob persist failed or timed out, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({
                table: 'jobs',
                op: 'insert',
                payload: {
                  id: tempId,
                  user_id: getCurrentUserId(),
                  title,
                  customer_id: customerId ?? null,
                  description: description ?? null,
                  ...extra,
                },
              });
            } catch {}
          }
        }

        // Post-create housekeeping — runs regardless of BE persistence so
        // the activation milestone, ontology, and calendar sync stay
        // consistent across online + offline contractors.
        import('../intelligence/semanticSearch').then(({ indexJobForSearch }) =>
          indexJobForSearch({ id: finalId, title, trade: extra?.trade, description: description ?? null }),
        ).catch(() => {});
        upsertEntity({ id: finalId, type: 'job', name: title, attributes: { trade: extra?.trade, status: 'lead' }, scores: { reliability: 50, quality: 50, value: extra?.quoted_amount ?? 0, frequency: 0 }, lastUpdated: new Date().toISOString() }).catch(() => {});
        if (customerId) {
          addRelation({ fromId: customerId, fromType: 'customer', toId: finalId, toType: 'job', relationType: 'owns', metadata: {} }).catch(() => {});
        }
        trackEvent('job_created', { jobId: finalId }).catch(() => {});
        markStepComplete('first_job_created').catch(() => {});
        if (extra?.scheduled_date) {
          import('../services/calendarSyncService').then(({ syncJobToCalendar, getCalendarSyncSettings }) => {
            getCalendarSyncSettings().then((settings) => {
              if (settings.enabled) syncJobToCalendar({ ...newJob, id: finalId }).catch(() => {});
            }).catch(() => {});
          }).catch(() => {});
        }
        return finalId;
      },
      updateJobStatus: (id, status) => {
        const job = jobs.find(j => j.id === id);
        const collectedWarnings: string[] = [];

        // Validator layer: check transition is valid
        if (job) {
          const validation = validateJobStatusChange(job.status, status, job);
          if (!validation.valid) {
            logWarn('Validator', 'Job status change invalid: ' + validation.errors.map(e => e.message).join(', '));
            collectedWarnings.push(...validation.errors.map(e => e.message));
          }
          if (validation.warnings.length > 0) {
            logWarn('Validator', 'Job status warnings: ' + validation.warnings.map(w => w.message).join(', '));
            collectedWarnings.push(...validation.warnings.map(w => w.message));
          }
        }

        setJobs((prev) =>
          prev.map((j) =>
            j.id === id ? { ...j, status, updatedAt: new Date().toISOString() } : j,
          ),
        );
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('jobs', 'update', () => dbUpdateJob(id, { status }), { rowId: id, payload: { status } }),
          ).catch(() => {});
        }
        // AI data collector — track job lifecycle events
        if (job && status === 'in-progress') {
          emitJobStarted(getCurrentUserId(), id, {
            trade: job.trade ?? 'general',
            jobType: job.title,
            estimatedHours: job.estimatedDuration ?? 0,
            crewSize: 1,
          }).catch(() => {});
        }
        if (job && status === 'completed') {
          const actualHours = (job as any).timeEntries?.reduce((s: number, e: any) => s + (e.hours ?? 0), 0) ?? 0;
          const materialCost = (job as any).materials?.reduce((s: number, m: any) => s + (m.totalCost ?? 0), 0) ?? 0;
          const estimatedCost = job.quotedAmount ?? job.agreedAmount ?? 0;
          const actualCost = materialCost + (actualHours * 45); // rough labor estimate
          emitJobCompleted(getCurrentUserId(), id, {
            trade: job.trade ?? 'general',
            jobType: job.title,
            estimatedHours: job.estimatedDuration ?? 0,
            actualHours,
            estimatedCost,
            actualCost,
            marginPercent: estimatedCost > 0 ? Math.round(((estimatedCost - actualCost) / estimatedCost) * 100) : 0,
            scopeChanges: 0,
            materialDelays: false,
          }).catch(() => {});
          // R300: queue a job_quality_feedback prompt so the contractor
          // captures paid_on_time / review / referral / rebook signals.
          // Without this, get_customer_quality_weight defaults to 1.0 for
          // every customer and the quote_win retrain trains uniformly.
          import('../services/aiActionQueueService').then(({ addToQueue }) =>
            addToQueue({
              type: 'job_quality_feedback',
              title: `${job.title} — quality feedback`,
              description: `Capture paid-on-time, review, referral, and rebook signals so quote-win training picks them up.`,
              preparedData: { jobId: id, customerId: job.customerId },
              actionLabel: 'Rate job',
              estimatedImpact: 'Improves model accuracy',
              expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              entityKey: `job_quality:${id}`,
              sourceGeneratorId: 'job_completion',
            }),
          ).catch(() => {});
          // Calibrate the duration predictor: feed estimated vs actual hours
          // so future quotes get personalized coefficients.
          if (job.estimatedDuration && actualHours > 0) {
            import('../intelligence/mlModels').then((ml) =>
              ml.recordModelPrediction('duration', job.estimatedDuration as number, actualHours),
            ).catch(() => {});
          }
          // Ontology: propagate job completion
          propagateJobCompletion(id, {
            actualCost,
            estimatedCost,
            actualHours,
            estimatedHours: job.estimatedDuration ?? 0,
            customerPaidOnTime: false,
            defectCount: 0,
          }).catch(() => {});
          // Record pricing outcome for calibration
          if (job.quoteId) {
            recordPricingOutcome(getCurrentUserId(), job.quoteId, {
              wasAccepted: true,
              actualCost,
              actualHours,
              marginPercent: estimatedCost > 0 ? Math.round(((estimatedCost - actualCost) / estimatedCost) * 100) : 0,
            }).catch(() => {});
          }
          // Record job outcome for intelligence calibration
          import('../intelligence/learningStorage').then(({ recordJobOutcome }) => {
            recordJobOutcome({
              jobId: id,
              jobType: job.trade ?? 'general',
              estimatedHours: job.estimatedDuration ?? 0,
              actualHours,
              estimatedCost,
              actualCost,
              marginPercent: estimatedCost > 0 ? Math.round(((estimatedCost - actualCost) / estimatedCost) * 100) : 0,
              completedAt: new Date().toISOString(),
            }).catch(() => {});
          }).catch(() => {});
          // EVE pattern: auto-queue invoice draft for approval
          import('../services/aiActionQueueService').then(({ addToQueue }) => {
            addToQueue({
              type: 'draft_invoice',
              title: `Factuur voor ${job.title}`,
              description: `Klus afgerond · ${formatMoney((estimatedCost))}`,
              preparedData: { jobId: id, amount: estimatedCost, customer: job.customerId },
              actionLabel: 'Factuur aanmaken',
              estimatedImpact: `${formatMoney((estimatedCost))} omzet`,
              expiresAt: new Date(Date.now() + 7 * MS_PER_DAY).toISOString(),
            });
          }).catch(() => {});
        }
        if (status === 'completed') {
          trackEvent('job_completed', { jobId: id }).catch(() => {});
          const completedJob = jobs.find(j => j.id === id);
          fireNotification('schedule_change', 'medium', 'Job completed', `"${completedJob?.title || id}" marked as completed. Create invoice next.`, `/contractor/job/${id}`);
        }
        return { warnings: collectedWarnings };
      },
      removeJob: (id) => {
        setJobs((prev) => prev.filter((j) => j.id !== id));
        // R56: gate removed — persistOrQueue handles temp ids.
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('jobs', 'delete', () => dbDeleteJob(id), { rowId: id }),
          ).catch(() => {});
        }
        // Remove from device calendar
        import('../services/calendarSyncService').then(({ removeJobFromCalendar }) => {
          removeJobFromCalendar(id).catch(() => {});
        }).catch(() => {});
      },
      updateJob: (id, updates) => {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j,
          ),
        );
        // R56: gate removed — persistOrQueue handles temp ids.
        if (isSupabaseConfigured) {
          // R304: full camelCase → snake_case mapping via jobUpdatesToRowPayload.
          // Was inline R301 mapping which only covered signatureSvg +
          // customerSignoffAt — every other field (scheduledDate,
          // estimatedDuration, quotedAmount, agreedAmount, …) silently
          // dropped on BE sync. Drag-schedule edits, timesheet completions,
          // address changes — all silently lost. Now full mapping.
          const payload = jobUpdatesToRowPayload(updates);
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue(
              'jobs',
              'update',
              () => dbUpdateJob(id, payload),
              { rowId: id, payload },
            ),
          ).catch(() => {});
        }
        if (updates.status === 'completed') {
          trackEvent('job_completed', { jobId: id }).catch(() => {});
        }
        // Auto-sync to device calendar when scheduledDate changes
        if (updates.scheduledDate) {
          import('../services/calendarSyncService').then(({ syncJobToCalendar, getCalendarSyncSettings }) => {
            getCalendarSyncSettings().then((settings) => {
              if (settings.enabled) {
                const updated = jobs.find(j => j.id === id);
                if (updated) syncJobToCalendar({ ...updated, ...updates } as Job).catch(() => {});
              }
            }).catch(() => {});
          }).catch(() => {});
        }
      },

      moneybirdConnected,
      lastMoneybirdExport,
      mollieConnected,
      lastMolliePayment,
      stripeConnected,
      lastStripePayment,
      priceRisks: buildPriceRiskSignals(quotes, lineItems, extractedDocs),
      ingestPdfHistory: () => {
        setExtractedDocs((prev) => [...prev, ...ingestPdfStub()]);
      },
      addExtractedDoc: (doc) => setExtractedDocs((prev) => [...prev, doc]),
      applySuggestedPrice: (quoteId, description, unitPrice) => {
        setLineItems((prev) => {
          const items = prev[quoteId] ?? [];
          const updated = items.map((item) =>
            item.description === description ? { ...item, unitPrice } : item
          );
          recalcQuoteTotal(quoteId, updated);
          return { ...prev, [quoteId]: updated };
        });
      },
      // ═════════════════════════════════════════════════════════════════════
      // SECTION: Quote & Invoice Management
      // ═════════════════════════════════════════════════════════════════════

      markQuoteSent: (id) => {
        setQuotes((prev) =>
          prev.map((quote) =>
            quote.id === id ? { ...quote, status: 'sent', lastUpdated: 'Just now' } : quote
          )
        );
        const now = new Date();
        if (isSupabaseConfigured) {
          // R52: was fire-and-forget log — offline contractors marking a
          // quote as sent saw it stuck in `draft` on BE forever. Now wraps
          // persistOrQueue so the status update flushes on reconnect.
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue(
              'documents',
              'update',
              () => updateDocument(id, { status: 'sent', sent_at: now.toISOString() }),
              { rowId: id, payload: { status: 'sent', sent_at: now.toISOString() } },
            ),
          ).catch((err) =>
            logWarn('AppState', `markQuoteSent persist failed: ${err}`),
          );
          // R255: time-of-day capture into pricing_intelligence so the
          // cohort RPC can slice acceptance rate by hour-of-day × day-of-week.
          import('../lib/supabase').then(({ supabase }) => {
            (supabase.from as any)('pricing_intelligence')
              .update({
                sent_at: now.toISOString(),
                sent_at_hour: now.getHours(),
                sent_at_dow: now.getDay(),
              })
              .eq('quote_id', id)
              .eq('user_id', getCurrentUserId())
              .then(() => {})
              .catch(() => {});
          }).catch(() => {});
        }
        scheduleQuoteFollowUp({ quoteId: id, customerName: 'Klant', daysAfterSent: 3 }).catch(() => {});
        trackEvent('quote_sent', { quoteId: id }).catch(() => {});
        markStepComplete('first_quote_sent').catch(() => {});
        const sentQuote = quotes.find(q => q.id === id);
        fireNotification('approval_request', 'medium', 'Quote sent', `Quote for ${sentQuote?.customer || id} sent. Follow-up scheduled in 3 days.`, `/(contractor)/facturen`);
      },
      markInvoiceSent: (id) => {
        const invoice = invoices.find((inv) => inv.id === id);
        setInvoices((prev) =>
          prev.map((inv) =>
            inv.id === id ? { ...inv, status: 'sent', dueInDays: 14 } : inv
          )
        );
        if (isSupabaseConfigured) {
          // R44: was fire-and-forget catch — offline contractors who marked an
          // invoice sent saw status flip locally but BE never received it.
          // Now queues for retry via offlineWriteQueue when offline.
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('documents', 'update', () => updateDocument(id, { status: 'sent', sent_at: new Date().toISOString() }), { rowId: id, payload: { status: 'sent' } }),
          ).catch((err) =>
            logWarn('AppState', `markInvoiceSent persist failed: ${err}`)
          );
        }
        schedulePaymentReminder({ invoiceId: id, customerName: 'Klant', amount: invoice?.amount ?? 0, daysUntilDue: 14 }).catch(() => {});
        // R25: queue customer-facing invoice_sent notice (closes R3 deferral —
        // markInvoiceSent previously fired only the contractor-side push
        // reminder, no draft for the customer). Approve → opens Share sheet.
        if (invoice) {
          const customerRow = customers.find((c) => c.id === invoice.customer);
          import('../services/aiActionQueueService').then(({ queueInvoiceSentNotice }) =>
            queueInvoiceSentNotice({
              invoiceId: id,
              customerId: invoice.customer,
              customerName: customerRow?.name,
              amount: invoice.amount ?? 0,
              dueInDays: 14,
            }),
          ).catch(() => {});
        }
        // AI data collector
        const sentDue = new Date();
        sentDue.setDate(sentDue.getDate() + 14);
        emitInvoiceSent(getCurrentUserId(), id, {
          customerId: invoice?.customer ?? '',
          amount: invoice?.amount ?? 0,
          dueDate: sentDue.toISOString(),
        }).catch(() => {});
        trackEvent('invoice_sent', { invoiceId: id }).catch(() => {});
        markStepComplete('first_invoice_sent').catch(() => {});
        addBreadcrumb({ category: 'user', message: 'invoice_sent', data: { invoiceId: id, amount: invoice?.amount } });
        // R66 round 49: ask for push permission *here* — this is the
        // earliest clear value moment (contractor just sent their first
        // invoice, the obvious benefit "get notified when X pays" is
        // top-of-mind). Pre-R49 the prompt fired at app cold-start
        // immediately after sign-in, before the user had seen any value;
        // NL contractors deny strangers' notification asks. The helper
        // is idempotent (gated by AsyncStorage flag) so subsequent
        // markInvoiceSent calls no-op.
        import('../services/pushNotificationService')
          .then((m) => m.maybeAskForPushPermission())
          .catch(() => {});
        // R66r49 #6: pack discovery hook — first invoice sent is the
        // moment to suggest the Incasso automation pack ("get auto-
        // reminders when this customer goes 3/7/14/30 days overdue?").
        // Idempotent — fires once per contractor.
        Promise.all([
          import('../services/workflowPackService'),
          import('../i18n/i18n'),
        ]).then(([m, i18nMod]) => {
          const t = i18nMod.default.t.bind(i18nMod.default);
          return m.suggestPackIfFirstTime({
            packId: 'incasso_auto',
            title: t('packDiscovery.incasso.title', 'Auto-remind overdue customers?'),
            body: t('packDiscovery.incasso.body', 'Vasco can chase this invoice automatically at +3, +7, +14 and +30 days.'),
          });
        }).catch(() => {});
        fireNotification('overdue_invoice', 'medium', 'Invoice sent', `Invoice marked as sent. Share the PDF with your customer.`, `/(contractor)/facturen`);
      },
      markInvoicePaid: (id) => {
        const paidInv = invoices.find((i) => i.id === id);
        addBreadcrumb({ category: 'user', message: 'invoice_paid', data: { invoiceId: id, amount: paidInv?.amount } });
        // Activation funnel — the value moment. Fires for BOTH manual mark-paid
        // and Mollie/Stripe webhook-driven payments (both route through here).
        trackEvent('payment_received', {
          invoiceId: id,
          amount: paidInv?.amount ?? 0,
          wasOverdue: (paidInv?.dueInDays ?? 0) < 0,
        }).catch(() => {});
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === id ? { ...invoice, status: 'paid', dueInDays: 0 } : invoice
          )
        );
        if (isSupabaseConfigured) {
          // R44: was fire-and-forget catch — offline payments never reached BE.
          // Mollie/Stripe webhooks fire markInvoicePaid in real-time, but
          // manual mark-paid via the contractor UI was missing the queue path.
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('documents', 'update', () => updateDocument(id, { status: 'paid', paid_at: new Date().toISOString() }), { rowId: id, payload: { status: 'paid' } }),
          ).catch((err) =>
            logWarn('AppState', `markInvoicePaid persist failed: ${err}`)
          );
        }
        // R251: GoBD audit-trail entry for invoice payment.
        import('../services/gobdAuditTrailService').then((m) =>
          m.appendAudit({
            type: 'invoice_paid',
            ref: id,
            payload: { amount: paidInv?.amount, paidAt: new Date().toISOString() },
          }),
        ).catch(() => {});
        // AI data collector
        emitPaymentReceived(getCurrentUserId(), id, {
          customerId: paidInv?.customer ?? '',
          amount: paidInv?.amount ?? 0,
          daysToPayment: 0,
          paymentMethod: 'unknown',
          wasOverdue: (paidInv?.dueInDays ?? 0) < 0,
        }).catch(() => {});
        // Close the payment-prediction calibration loop: record predicted vs
        // actual days-to-pay so future DSO forecasts get more accurate.
        const predictedDays = 14;
        const actualDays = Math.max(0, 14 - (paidInv?.dueInDays ?? 0));
        import('../intelligence/mlModels').then((ml) =>
          ml.recordModelPrediction('payment', predictedDays, actualDays),
        ).catch(() => {});
        // Ontology: propagate payment
        propagatePayment(id, 0).catch(() => {});
        // R25: queue customer-facing thank-you (closes R3 deferral —
        // payment_received was a defined MessageTrigger but never fired).
        // The eveLiveActionService daily scheduler also queues this for
        // catchup, but firing here gives instant feedback for contractors
        // watching the app when a payment lands.
        if (paidInv) {
          const customerRow = customers.find((c) => c.id === paidInv.customer);
          import('../services/aiActionQueueService').then(({ queuePaymentReceivedThanks }) =>
            queuePaymentReceivedThanks({
              invoiceId: id,
              customerId: paidInv.customer,
              customerName: customerRow?.name,
              amount: paidInv.amount ?? 0,
            }),
          ).catch(() => {});
        }
      },
      addQuote: async (customer, job, items) => {
        const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

        // Validator layer: catch fail states before committing
        const validation = validateQuoteBeforeSend(
          { customer, amount: total, lineItems: items },
          quotes,
        );
        if (!validation.valid) {
          logWarn('Validator', 'Quote validation failed: ' + validation.errors.map(e => e.message).join(', '));
          // Still allow creation — contractors may have valid reasons for zero-amount quotes
        }

        const docNumber = await nextDocumentNumber('quote');
        const newQuote: Quote = {
          id: docNumber,
          customer,
          job,
          amount: total,
          status: 'draft',
          lastUpdated: 'Just now',
        };

        // Optimistic local update
        setQuotes((prev) => [newQuote, ...prev]);
        setLineItems((prev) => ({ ...prev, [docNumber]: items }));

        // Persist to Supabase — moat-critical (cohort signal). Offline → queue.
        if (isSupabaseConfigured) {
          // R66 round 18: customer + job arrive as FE display strings on the
          // empty-state path (e.g. tiered-quote.tsx fallback to t('customer')
          // localized "Klant"/"Customer"/"Kunde"). Both columns are uuid FKs.
          // Without this guard the BE rejected every fresh-contractor quote
          // (UUID format violation), the offline queue retried 5× and
          // dropped, the cohort moat lost the signal, and on cold start the
          // quote vanished. Now: null out non-UUIDs so the row lands; FE
          // Quote.customer keeps the display string locally.
          const docPayload = {
            doc_type: 'quote' as const,
            status: 'draft' as const,
            document_number: docNumber,
            customer_id: isUuid(customer) ? customer : null,
            job_id: isUuid(job) ? job : null,
            total_amount: total,
          };
          // R66 round 47: persist per-line VAT rate. Closes the R38 deferred
          // gap — pre-R47 only AutoInvoice in-memory carried the rate, mixed-
          // rate quotes (NL plumbing 9% labor + 21% materials) lost the
          // distinction across cold start. Honors KOR scheme uniformly.
          const lineItemVatRate = getEffectiveVatRate(businessProfile);
          const lineItemPayload = items.map((item, idx) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.unitPrice * item.quantity,
            position: idx,
            vat_rate: (item as any).vatRate ?? lineItemVatRate,
          }));
          try {
            const row = await withTimeout(createDocument(docPayload), 3000, 'addQuote');
            await withTimeout(upsertLineItems(row.id, lineItemPayload), 3000, 'addQuote.lineItems');
          } catch (err) {
            logWarn('AppState', `addQuote persist failed, queueing document: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              // Queue the document insert. Line items can't queue without the
              // BE-generated doc_id; the moat signal lives in pricing_intelligence
              // (per-line) which has its own write path below — no data loss for
              // training. Customer-facing portal lines re-upsert next time the
              // user opens the quote online.
              await queueWrite({ table: 'documents', op: 'insert', payload: { ...docPayload, user_id: getCurrentUserId() } });
            } catch {}
          }
        }

        // AI data collector — quote event + per-line pricing intelligence
        // R188: real trade/country from businessProfile (was hardcoded 'general'/'NL')
        // so cohort aggregation works for non-Dutch/non-generalist contractors.
        // R265: also pass the job-site postcode so the postcode-level cohort
        // RPC (R246, get_postcode_cohort_stats) actually has data to read.
        const profTrade = businessProfile.trade ?? 'general';
        const profCountry = businessProfile.country ?? 'NL';
        const jobPostcode = job
          ? (jobs.find((j) => j.id === job) as any)?.address?.postcode
            ?? (jobs.find((j) => j.id === job) as any)?.address_postcode
          : undefined;
        emitQuoteCreated(getCurrentUserId(), docNumber, {
          customerId: customer,
          totalAmount: total,
          lineItemCount: items.length,
          trade: profTrade,
        }).catch(() => {});
        for (const item of items) {
          recordPricingData(getCurrentUserId(), {
            trade: profTrade,
            country: profCountry,
            lineDescription: item.description,
            quotedUnitPrice: item.unitPrice,
            quotedQuantity: item.quantity,
            // R66 round 38: honor vatScheme. Pre-R38 hardcoded 21% even for
            // KOR / Kleinunternehmer contractors → cohort moat ingested
            // wrong vatRate metadata for the small-business segment.
            vatRate: (item as any).vatRate ?? (getEffectiveVatRate(businessProfile)),
            postcode: jobPostcode,
          }).catch(() => {});
        }

        trackEvent('quote_created', { quoteId: docNumber }).catch(() => {});
        return docNumber;
      },

      addInvoice: async (sourceQuoteId) => {
        const sourceQuote = quotes.find((q) => q.id === sourceQuoteId);
        if (!sourceQuote) throw new Error(`Quote ${sourceQuoteId} not found`);

        const docNumber = await nextDocumentNumber('invoice');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        // R287: validator-layer duplicate-invoice protection. Catches "same
        // customer + same amount within 7 days" — a frequent source of
        // double-billing, especially when a contractor accidentally taps
        // "Create invoice" twice on the same quote.
        const invValidation = validateInvoiceBeforeCreate(
          { customer: sourceQuote.customer, amount: sourceQuote.amount, jobId: sourceQuote.job, dueDate: dueDate.toISOString() },
          invoices,
          jobs,
        );
        if (!invValidation.valid) {
          // Hard block: the only way to land here is the duplicate detection
          // (R287) — which is real money risk. Caller must surface this.
          const summary = invValidation.errors.map(e => e.message).join(', ');
          throw new Error(summary || 'Invoice validation failed');
        }
        if (invValidation.warnings.length > 0) {
          logWarn('Validator', 'Invoice warnings: ' + invValidation.warnings.map(w => w.message).join(', '));
        }

        const newInvoice: Invoice = {
          id: docNumber,
          customer: sourceQuote.customer,
          job: sourceQuote.job,
          amount: sourceQuote.amount,
          status: 'draft',
          dueInDays: 14,
        };

        // Optimistic local update
        setInvoices((prev) => [newInvoice, ...prev]);

        // R251: GoBD audit-trail — record invoice creation
        import('../services/gobdAuditTrailService').then((m) =>
          m.appendAudit({
            type: 'invoice_created',
            ref: docNumber,
            payload: { amount: newInvoice.amount, customer: newInvoice.customer, sourceQuoteId },
          }),
        ).catch(() => {});

        // Copy line items from source quote
        const sourceItems = lineItems[sourceQuoteId] ?? [];
        if (sourceItems.length > 0) {
          setLineItems((prev) => ({ ...prev, [docNumber]: sourceItems }));
        }

        // Persist to Supabase
        if (isSupabaseConfigured) {
          // R66 round 18: same uuid guard as addQuote — sourceQuote.customer /
          // .job are FE display strings when the quote was created via the
          // empty-state path. customer_id / job_id are uuid FK columns; the
          // BE rejected and the converted invoice was lost.
          const safeCustomerId = isUuid(sourceQuote.customer) ? sourceQuote.customer : null;
          const safeJobId = isUuid(sourceQuote.job) ? sourceQuote.job : null;
          try {
            const row = await createDocument({
              doc_type: 'invoice',
              status: 'draft',
              document_number: docNumber,
              customer_id: safeCustomerId,
              job_id: safeJobId,
              total_amount: sourceQuote.amount,
              due_date: dueDate.toISOString(),
              // documents has `source_document_id` (uuid FK), NOT `source_quote_id`
              // — the wrong name made createDocument throw "column does not exist",
              // so EVERY quote→invoice conversion failed to persist. sourceQuoteId
              // is usually the document_number (not a uuid), so guard the FK.
              source_document_id: isUuid(sourceQuoteId) ? sourceQuoteId : null,
            });
            if (sourceItems.length > 0) {
              // R66 round 47: persist per-line VAT on invoice line items
              // (cloned from quote line items). KOR contractors get 0%;
              // others 21% default unless caller explicitly set vatRate.
              const invoiceLineVatRate = getEffectiveVatRate(businessProfile);
              await upsertLineItems(
                row.id,
                sourceItems.map((item, idx) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unitPrice,
                  total_price: item.unitPrice * item.quantity,
                  position: idx,
                  vat_rate: (item as any).vatRate ?? invoiceLineVatRate,
                })),
              );
            }
          } catch (err) {
            // R44: was fire-and-forget log — offline-created invoices never
            // reached BE on reconnect. Now queue both the doc create + line
            // items so the offlineWriteQueue drains on next online tick.
            logWarn('AppState', `addInvoice persist failed, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({
                table: 'documents',
                op: 'insert',
                payload: {
                  user_id: getCurrentUserId(),
                  doc_type: 'invoice',
                  status: 'draft',
                  document_number: docNumber,
                  customer_id: safeCustomerId,
                  job_id: safeJobId,
                  total_amount: sourceQuote.amount,
                  due_date: dueDate.toISOString(),
                  source_document_id: isUuid(sourceQuoteId) ? sourceQuoteId : null,
                },
              });
            } catch {}
          }
        }

        // AI data collector
        emitInvoiceSent(getCurrentUserId(), docNumber, {
          customerId: sourceQuote.customer,
          amount: sourceQuote.amount,
          dueDate: dueDate.toISOString(),
        }).catch(() => {});

        trackEvent('invoice_created', { invoiceId: docNumber }).catch(() => {});
        return docNumber;
      },

      removeQuote: (id) => {
        setQuotes((prev) => prev.filter((quote) => quote.id !== id));
        if (isSupabaseConfigured) {
          // R44: was fire-and-forget — offline deletes ghosted (local row gone,
          // BE row still there). Now queues for retry.
          // R66 round 8: thread docType so deleteDocument hard-deletes the
          // quote (pre-acceptance quotes aren't tax records).
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('documents', 'delete', () => deleteDocument(id, 'quote'), { rowId: id }),
          ).catch((err) =>
            logWarn('AppState', `removeQuote persist failed: ${err}`)
          );
        }
      },
      removeInvoice: (id) => {
        setInvoices((prev) => prev.filter((invoice) => invoice.id !== id));
        if (isSupabaseConfigured) {
          // R44: same offline-queue fix as removeQuote.
          // R66 round 8: docType='invoice' triggers soft-delete (Belastingdienst
          // Art. 52 AWR + GoBD §147 HGB require 7-10y retention of tax records).
          // Row stays in BE with deleted_at set; FE queries filter via RLS.
          // R66 round 9: queue as 'update' with deleted_at payload (NOT 'delete')
          // so the offline-then-flushed replay path also soft-deletes. The
          // generic queue's op==='delete' branch hard-deletes; we don't want
          // that for tax records. The live attempt still calls deleteDocument
          // with docType='invoice' (which soft-deletes) — only the offline
          // replay path needed the explicit op=update steering.
          const deletedAt = new Date().toISOString();
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue(
              'documents',
              'update',
              () => deleteDocument(id, 'invoice'),
              { rowId: id, payload: { deleted_at: deletedAt } },
            ),
          ).catch((err) =>
            logWarn('AppState', `removeInvoice persist failed: ${err}`)
          );
        }
      },
      updateInvoice: (id, updates) => {
        const prev = invoices.find(inv => inv.id === id);
        setInvoices((p) =>
          p.map((inv) => inv.id === id ? { ...inv, ...updates } : inv)
        );
        // R56: was missing BE persistence entirely — invoice edits (amount,
        // due date, customer, status) lived in memory only and were
        // overwritten on the next refreshData(). Permanent data loss for
        // anyone who edits an existing invoice. Now wraps persistOrQueue
        // with snake_case mapping so the documents row stays in sync.
        if (isSupabaseConfigured) {
          const dbUpdates: Record<string, unknown> = {};
          if (updates.amount !== undefined) dbUpdates.total_amount = updates.amount;
          if (updates.status !== undefined) dbUpdates.status = updates.status;
          // R66 round 13: dropped `customer` mapping — caller passed the
          // customer's display NAME (string) but the column is a UUID FK.
          // The BE rejected every save with an FK / format violation,
          // local React state retained a phantom `customer` field that
          // reverted on next BE refresh. Customer-edit affordance on the
          // invoice screen is removed in the same round; renaming a
          // customer is a customer-record edit, not a per-invoice edit.
          if ((updates as any).dueDate !== undefined) dbUpdates.due_date = (updates as any).dueDate;
          if ((updates as any).paidAt !== undefined) dbUpdates.paid_at = (updates as any).paidAt;
          // R66 round 13: persist internal notes (was the silent-loss bug
          // matching the R12 timeEntries pattern — full UI flow, no DB
          // column, no mapper coverage). Migration 20260507000003 adds
          // documents.notes; mapper now wires it through.
          if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
          if (Object.keys(dbUpdates).length > 0) {
            import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
              persistOrQueue('documents', 'update', () => updateDocument(id, dbUpdates), { rowId: id, payload: dbUpdates }),
            ).catch((err) => logWarn('AppState', `updateInvoice persist failed: ${err}`));
          }
        }
        // R251: GoBD audit-trail — capture every status transition + edit.
        import('../services/gobdAuditTrailService').then((m) => {
          if (updates.status === 'sent' && prev?.status !== 'sent') {
            return m.appendAudit({ type: 'invoice_sent', ref: id, payload: { amount: prev?.amount, sentAt: new Date().toISOString() } });
          }
          return m.appendAudit({ type: 'invoice_modified', ref: id, payload: updates });
        }).catch(() => {});
        // R213: on invoice status -> sent, run predictPaymentTiming and
        // enqueue a VascoCard when the model flags the invoice as high
        // risk of late payment. Mirror of R209 low-win-alert for quotes.
        if (updates.status === 'sent' && prev?.status !== 'sent') {
          const current = prev ? { ...prev, ...updates } : null;
          if (current) {
            const cust = customers.find((c: any) => c.id === current.customer || c.name === current.customer);
            Promise.all([
              import('../services/lateRiskAlertGenerator'),
              import('../services/aiActionQueueService'),
            ]).then(async ([gen, queueMod]) => {
              const draft = await gen.generateLateRiskAlert({
                invoiceId: id,
                customerName: cust?.name ?? null,
                customerId: cust?.id,
                country: businessProfile.country ?? 'NL',
                amount: current.amount,
              });
              if (draft) await queueMod.addToQueue(draft);
            }).catch(() => {});
          }
        }
      },
      updateBusinessProfile: async (updates) => {
        // Snapshot the previous licenses array BEFORE the optimistic update
        // so we can diff and emit per-license business events
        // (license_added / license_renewed). The synthesized entityId is
        // `${type}_${state||country}_${number}` so the same license has a
        // stable identity across renewals and devices.
        const prevLicenses = businessProfile.licenses ?? [];
        const nextLicenses = updates.licenses;
        setBusinessProfile((prev) => ({
          ...prev,
          ...updates,
          completenessPercent: (() => {
            const merged = { ...prev, ...updates };
            const fields = [merged.businessName, merged.kvkNumber, merged.vatNumber, merged.address, merged.email, merged.phone];
            const filled = fields.filter(Boolean).length;
            return Math.round((filled / fields.length) * 100);
          })(),
          isComplete: (() => {
            const merged = { ...prev, ...updates };
            return !!(merged.businessName && merged.kvkNumber && merged.vatNumber && merged.address && merged.email && merged.phone);
          })(),
        }));
        // Intelligence loop: diff licenses to emit license_added /
        // license_renewed. Stable entityId lets renewal events attribute
        // back to the original add. Skipped when `updates.licenses` is
        // undefined (this update isn't touching licenses).
        if (nextLicenses !== undefined) {
          const licenseKey = (l: { type: string; state?: string; number: string }) =>
            `${l.type}_${l.state ?? (updates.country ?? businessProfile.country ?? 'XX')}_${l.number}`;
          const prevByKey = new Map(prevLicenses.map((l) => [licenseKey(l), l]));
          for (const l of nextLicenses) {
            const key = licenseKey(l);
            const prior = prevByKey.get(key);
            const userId = getCurrentUserId();
            if (!prior) {
              emitLicenseAdded(userId, key, {
                type: l.type,
                state: l.state,
                number: l.number,
                expiryDate: l.expiryDate,
                issuingAuthority: l.issuingAuthority,
              }).catch(() => {});
            } else if (prior.expiryDate !== l.expiryDate) {
              const daysBeforeOld =
                (new Date(prior.expiryDate).getTime() - Date.now()) / 86_400_000;
              emitLicenseRenewed(userId, key, {
                type: l.type,
                state: l.state,
                oldExpiryDate: prior.expiryDate,
                newExpiryDate: l.expiryDate,
                daysBeforeOldExpiry: Math.round(daysBeforeOld),
              }).catch(() => {});
            }
          }
          // Stage 6: grade license-renewal-action against the post-update
          // license set. If a previously-flagged license got its expiryDate
          // moved forward (i.e. renewed), the count of "expiring within 30d"
          // drops and the generator earns confidence weight.
          attributeLicenseRenewalOutcome(nextLicenses);
        }
        // R282: if the profile edit changes country or trade, sync the
        // module-level currentUser ref so subsequent emit paths read the
        // new specialty/market without waiting for a re-login. Without
        // this, a contractor switching from NL → DE would keep tagging
        // every business event and material write to the old market.
        if (updates.country !== undefined || updates.trade !== undefined || updates.vatScheme !== undefined) {
          const userId = getCurrentUserId();
          if (userId) {
            setCurrentUser({
              id: userId,
              country: updates.country ?? getCurrentCountry() ?? undefined,
              trade: updates.trade ?? getCurrentTrade() ?? undefined,
              vatScheme: updates.vatScheme ?? businessProfile.vatScheme,
            });
          }
        }
        if (isSupabaseConfigured) {
          // R83: widened from `Record<string, string | number | null>` so the
          // JSONB `licenses` array can ride along without an `as any` cast.
          const dbUpdates: Record<string, unknown> = {};
          if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName || null;
          if (updates.kvkNumber !== undefined) dbUpdates.kvk_number = updates.kvkNumber || null;
          if (updates.vatNumber !== undefined) dbUpdates.vat_number = updates.vatNumber || null;
          if (updates.address !== undefined) dbUpdates.address = updates.address || null;
          if (updates.email !== undefined) dbUpdates.email = updates.email || null;
          if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
          // R66 NL launch: payment + locale fields written to BE so the
          // invoice PDF can render bank details. Without these, the NL
          // customer has no way to pay an invoice they receive.
          if (updates.iban !== undefined) dbUpdates.iban = updates.iban || null;
          if (updates.bic !== undefined) dbUpdates.bic = updates.bic || null;
          if (updates.country !== undefined) dbUpdates.country = updates.country || null;
          if (updates.postcode !== undefined) dbUpdates.postcode = updates.postcode || null;
          if (updates.city !== undefined) dbUpdates.city = updates.city || null;
          if (updates.website !== undefined) dbUpdates.website = updates.website || null;
          if (updates.invoicePrefix !== undefined) dbUpdates.invoice_prefix = updates.invoicePrefix || null;
          if (updates.quotePrefix !== undefined) dbUpdates.quote_prefix = updates.quotePrefix || null;
          if (updates.defaultPaymentTerms !== undefined) dbUpdates.default_payment_terms = updates.defaultPaymentTerms ?? null;
          // R66 round 24: 5 fields previously silent-dropped — onboarding
          // wrote them into AppState but they never reached BE. Cold start
          // → BE reload → fields revert to undefined. Specific impact:
          // vatScheme reverting silently flipped KOR/Kleinunternehmer
          // contractors back to 21% VAT on their first post-onboard invoice.
          // Migration 20260507000007 adds the columns; mapper now persists.
          if (updates.vatScheme !== undefined) dbUpdates.vat_scheme = updates.vatScheme || null;
          if (updates.businessType !== undefined) dbUpdates.business_type = updates.businessType || null;
          if (updates.teamSize !== undefined) dbUpdates.team_size = updates.teamSize || null;
          if (updates.trade !== undefined) dbUpdates.trade = updates.trade || null;
          if (updates.registrationNumber !== undefined) dbUpdates.registration_number = updates.registrationNumber || null;
          // R83 US Phase 5 audit fix: 4 fields previously silent-dropped on
          // the BE write. Same R66r24-class bug — onboarding writes them
          // into AppState, cold start reloads from BE without them, US
          // invoice PDFs ship with empty Routing # / Account # fields,
          // license-expiry warning loses track of expired licenses. Migration
          // 20260520000001 (licenses) + 20260520000003 (state/ACH columns +
          // 'US' added to country CHECK) match the wire format here.
          if (updates.state !== undefined) dbUpdates.state = updates.state || null;
          if (updates.routingNumber !== undefined) dbUpdates.routing_number = updates.routingNumber || null;
          if (updates.bankAccountNumber !== undefined) dbUpdates.bank_account_number = updates.bankAccountNumber || null;
          if (updates.licenses !== undefined) dbUpdates.licenses = updates.licenses ?? [];
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            // R83: cast is to the BusinessSettingsRow Partial expected by
            // upsertBusinessSettings — the row type now includes the 4
            // new fields, so the licenses array doesn't need a structural
            // override anymore. `Record<string, string | number | null>` is
            // a soft compatibility shim from the original mapper; the cast
            // satisfies it without sacrificing the real type contract above.
            persistOrQueue('business_settings', 'upsert', () => upsertBusinessSettings(dbUpdates as Parameters<typeof upsertBusinessSettings>[0]), { payload: dbUpdates as Record<string, string | number | null> }),
          ).catch(() => {});
        }
      },
      // ═════════════════════════════════════════════════════════════════════
      // SECTION: Materials & Suppliers
      // ═════════════════════════════════════════════════════════════════════

      addMaterial: async (material) => {
        const tempId = `mat-${Date.now()}`;
        const now = new Date().toISOString();
        const newMaterial: Material = { ...material, id: tempId, createdAt: now, updatedAt: now };
        setMaterials((prev) => [newMaterial, ...prev]);

        if (isSupabaseConfigured) {
          const payload = {
            name: material.name,
            category: material.category,
            brand: material.brand,
            base_unit: material.baseUnit,
          };
          try {
            const row = await dbCreateMaterial(payload);
            setMaterials((prev) =>
              prev.map((m) => (m.id === tempId ? { ...m, id: (row as any).id } : m)),
            );
            const persistedId = (row as any).id as string;
            // Fire-and-forget cohort-wide index (R279). Materials write user_id=null
            // inside indexItem so other contractors can match against them.
            import('../intelligence/semanticSearch').then(({ indexMaterialForSearch }) =>
              indexMaterialForSearch({
                id: persistedId,
                name: material.name,
                category: material.category,
                brand: material.brand,
              }),
            ).catch(() => {});
            return persistedId;
          } catch (err) {
            logWarn('AppState', `addMaterial persist failed: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'material_catalog', op: 'insert', payload: { id: tempId, user_id: getCurrentUserId(), ...payload } });
            } catch {}
          }
        }
        // Offline path: index by tempId so keyword fallback works locally.
        import('../intelligence/semanticSearch').then(({ indexMaterialForSearch }) =>
          indexMaterialForSearch({
            id: tempId,
            name: material.name,
            category: material.category,
            brand: material.brand,
          }),
        ).catch(() => {});
        return tempId;
      },
      removeMaterial: (id) => {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        // R56: gate removed — persistOrQueue handles temp ids.
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('materials', 'delete', () => dbDeleteMaterial(id), { rowId: id }),
          ).catch(() => {});
        }
      },
      addSupplier: async (supplier) => {
        const tempId = `sup-${Date.now()}`;
        const now = new Date().toISOString();
        const newSupplier: Supplier = { ...supplier, id: tempId, createdAt: now, updatedAt: now };
        setSuppliers((prev) => [newSupplier, ...prev]);

        if (isSupabaseConfigured) {
          const payload = {
            name: supplier.name,
            account_status: supplier.accountStatus,
          };
          try {
            const row = await dbCreateSupplier(payload);
            setSuppliers((prev) =>
              prev.map((s) => (s.id === tempId ? { ...s, id: (row as any).id } : s)),
            );
            return (row as any).id as string;
          } catch (err) {
            logWarn('AppState', `addSupplier persist failed: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'suppliers', op: 'insert', payload: { id: tempId, user_id: getCurrentUserId(), ...payload } });
            } catch {}
          }
        }
        return tempId;
      },
      removeSupplier: (id) => {
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        // R56: gate removed — persistOrQueue handles temp ids.
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('suppliers', 'delete', () => dbDeleteSupplier(id), { rowId: id }),
          ).catch(() => {});
        }
      },
      addJobMaterial: async (jm) => {
        const tempId = `jm-${Date.now()}`;
        const now = new Date().toISOString();
        const newJm: JobMaterial = { ...jm, id: tempId, createdAt: now, updatedAt: now };
        setJobMaterialsMap((prev) => ({
          ...prev,
          [jm.jobId]: [...(prev[jm.jobId] ?? []), newJm],
        }));

        // R52: split BE-persist from moat housekeeping. Was a real bug —
        // the BE-success branch returned early, skipping emitMaterialPurchased
        // (the load-bearing cohort pricing-moat signal that writes both
        // business_events AND material_price_history per R241/R275/R283),
        // resolveOutcomesFromMaterialPurchase (calibration learning), AND
        // embedMaterial (semantic search). Online users' material purchases
        // simply did not feed the moat — every online contractor's material
        // signal went to /dev/null until they added a material offline.
        let finalId = tempId;
        if (isSupabaseConfigured) {
          try {
            const row = await dbCreateJobMaterial({
              job_id: jm.jobId,
              material_id: jm.materialId,
              quantity: jm.quantity,
              unit: jm.unit,
              unit_price: jm.unitPrice,
              total_price: jm.totalPrice,
              supplier_id: jm.supplierId,
              status: jm.status,
              notes: jm.notes,
            });
            setJobMaterialsMap((prev) => ({
              ...prev,
              [jm.jobId]: (prev[jm.jobId] ?? []).map((item) =>
                item.id === tempId ? { ...item, id: (row as any).id } : item,
              ),
            }));
            finalId = (row as any).id as string;
          } catch (err) {
            logWarn('AppState', `addJobMaterial persist failed: ${err}`);
            // R54: was a bare log — material insert never reached BE if the
            // parent job was still on a temp id (FK violation on offline-
            // created job). Queue the insert so the offline queue's R49
            // temp→real rewriter resolves the FK on flush.
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({
                table: 'job_materials',
                op: 'insert',
                payload: {
                  id: tempId,
                  user_id: getCurrentUserId(),
                  job_id: jm.jobId,
                  material_id: jm.materialId,
                  quantity: jm.quantity,
                  unit: jm.unit,
                  unit_price: jm.unitPrice,
                  total_price: jm.totalPrice,
                  supplier_id: jm.supplierId,
                  status: jm.status,
                  notes: jm.notes,
                },
              });
            } catch {}
          }
        }

        // R279/R281: resolve real trade + country from currentUser (was
        // hardcoded 'general'/'NL', collapsing all material data into a
        // single bucket and breaking the material-drift moat's per-(trade,
        // country) cohort slicing — a painter in DE and FR are different
        // markets entirely). Falls through to 'general'/'NL' only when unset.
        const trade = getCurrentTrade() || 'general';
        const country = getCurrentCountry() || 'NL';
        // R279: look up the actual material name + supplier name from the
        // catalog so the moat ingests human-readable text instead of opaque
        // IDs. Falls back to the ID if the catalog miss is somehow unresolved.
        const matRow = materials.find((m) => m.id === jm.materialId);
        const matName = (matRow?.name ?? String(jm.materialId ?? '')).trim();
        const supRow = jm.supplierId ? suppliers.find((s) => s.id === jm.supplierId) : undefined;
        // AI data collector — material purchase event. R66 round 23: only
        // emit when there's a real price. Pre-R23 the `?? 0` fallback
        // landed phantom price=0 rows in `material_price_history` (R241/R283
        // single-write path) for every "contractor forgot the price field"
        // entry, dragging the cohort price stats toward zero. The R22 price
        // input made the contributing path explicit, so no-price entries
        // should now stay out of the moat entirely. The qualityObservation
        // resolution already gated on >0, just align the emit.
        if ((jm.unitPrice ?? 0) > 0) {
          emitMaterialPurchased(getCurrentUserId(), {
            materialName: matName || 'unknown',
            supplierId: jm.supplierId ?? 'unknown',
            supplierName: supRow?.name ?? jm.supplierId ?? 'unknown',
            price: jm.unitPrice ?? 0,
            quantity: jm.quantity ?? 1,
            unit: jm.unit ?? 'stuk',
            trade,
            country,
            jobId: jm.jobId,
          }).catch(() => {});
          import('../intelligence/learningStorage').then((m) =>
            m.resolveOutcomesFromMaterialPurchase(jm.unitPrice ?? 0),
          ).catch(() => {});
        }
        if (matName.length > 2) {
          import('../services/embeddingService').then((m) =>
            m.embedMaterial({ trade, materialName: matName, text: matName }),
          ).catch(() => {});
        }
        return finalId;
      },
      updateJobMaterialStatus: (id, jobId, status) => {
        setJobMaterialsMap((prev) => ({
          ...prev,
          [jobId]: (prev[jobId] ?? []).map((item) =>
            item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
          ),
        }));
        // R56: gate removed — persistOrQueue handles temp ids.
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('job_materials', 'update', () => dbUpdateJobMaterial(id, { status }), { rowId: id, payload: { status } }),
          ).catch(() => {});
        }
      },
      removeJobMaterial: (id, jobId) => {
        setJobMaterialsMap((prev) => ({
          ...prev,
          [jobId]: (prev[jobId] ?? []).filter((item) => item.id !== id),
        }));
        // R56: gate removed — persistOrQueue handles temp ids.
        if (isSupabaseConfigured) {
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('job_materials', 'delete', () => dbDeleteJobMaterial(id), { rowId: id }),
          ).catch(() => {});
        }
      },
      // ═════════════════════════════════════════════════════════════════════
      // SECTION: Integration State (Moneybird, Mollie)
      // ═════════════════════════════════════════════════════════════════════

      connectMoneybird: () => setMoneybirdConnected(true),
      exportInvoice: async (invoiceId) => {
        // R307: tier gate — accounting integrations are paid-tier only.
        // Was completely ungated; free users could export to Moneybird/etc
        // unlimited times. Caller still gets a return value (success: false)
        // so existing UI doesn't break.
        try {
          const { loadSubscription, canUseFeature } = await import('../services/subscriptionService');
          const sub = await loadSubscription();
          const gate = canUseFeature(sub, 'hasAccountingIntegrations');
          if (!gate.allowed) {
            logWarn('AppState', `exportInvoice blocked: ${gate.reason ?? 'tier gate'}`);
            return;
          }
        } catch {}
        const inv = invoices.find((i) => i.id === invoiceId);
        const cust = customers.find((c) => c.id === inv?.customer);
        const invLineItems = (lineItems[invoiceId] ?? []) as QuoteLineItem[];
        const payload = inv
          ? {
              customerEmail: cust?.email,
              customerName: cust?.name ?? inv.customer,
              reference: (inv as any).reference ?? inv.id,
              dueDate: (inv as any).dueDate,
              lineItems: invLineItems.map((li) => ({
                description: li.description,
                price: li.unitPrice,
                quantity: li.quantity,
                // R66 round 38: honor vatScheme on Moneybird export. KOR/
                // Kleinunternehmer contractors must export at 0% VAT —
                // hardcoded 21% would corrupt their bookkeeping the moment
                // they exported their first invoice.
                vatRate: getEffectiveVatRate(businessProfile),
              })),
            }
          : undefined;
        const result = await exportInvoiceToMoneybird(invoiceId, payload);
        if (!result.success) {
          // R66 round 9: was logging the error and silently returning. Caller
          // (`app/invoices/[id].tsx:handleExportMoneybird`) wraps in try/catch
          // expecting a throw on failure — without it, contractor sees success
          // haptic on a Moneybird auth/network failure. Same bug class as
          // R66.45 (createPaymentLink). Now throws so the caller's error
          // surface fires.
          if (result.error) logWarn('AppState', `Moneybird export failed: ${result.error}`);
          throw new Error(result.error ?? 'Moneybird export failed');
        }
        setLastMoneybirdExport((prev) => ({
          ...prev,
          [invoiceId]: result.exportedAt,
        }));
      },
      addInvoiceFromJob: async (jobId: string) => {
        const job = jobs.find((j) => j.id === jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);

        const amount = job.agreedAmount ?? job.quotedAmount ?? 0;
        if (amount <= 0) {
          throw new Error(`Cannot create invoice: job "${job.title}" has no amount (€0). Set a quoted or agreed amount first.`);
        }
        const docNumber = await nextDocumentNumber('invoice');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        // R287: same duplicate-protection as addInvoice. addInvoiceFromJob
        // skips the validator-on-quote path so we re-run the invoice check.
        const invValidation = validateInvoiceBeforeCreate(
          { customer: job.customerId ?? '', amount, jobId, dueDate: dueDate.toISOString() },
          invoices,
          jobs,
        );
        if (!invValidation.valid) {
          const summary = invValidation.errors.map(e => e.message).join(', ');
          throw new Error(summary || 'Invoice validation failed');
        }
        if (invValidation.warnings.length > 0) {
          logWarn('Validator', 'Invoice warnings: ' + invValidation.warnings.map(w => w.message).join(', '));
        }

        // Resolve the customer so the invoice carries a human-readable name
        // rather than the raw id. Without this, job-sourced invoices never
        // set `customerName`, and the Facturen list (which renders
        // `invoice.customerName`) showed the bare id e.g. "cust-003" instead
        // of "Bakkerij Smit". Mirror the quote-source path's intent.
        const invCustomer = customers.find((c) => c.id === job.customerId);
        // `customer` holds a NAME on every other invoice ("Hotel NH",
        // "Bouwgroep Atlas") — writing job.customerId here put a raw id in a
        // name field and surfaced as "cust-003" in the Facturen list. The
        // dedicated id lives in `customerId`. Fall back to '' rather than the
        // id, so a missing customer renders blank instead of leaking one.
        const invCustomerName = invCustomer?.name ?? '';
        const newInvoice: Invoice = {
          id: docNumber,
          customer: invCustomerName,
          customerId: job.customerId ?? undefined,
          customerName: invCustomerName,
          job: job.title,
          amount,
          status: 'draft',
          dueInDays: 14,
        };

        setInvoices((prev) => [newInvoice, ...prev]);

        // #5: carry the originating quote's line items onto the invoice so the
        // bill is auditable against the estimate (was total-only). Reuses the
        // same document_number-keyed map the quote→invoice + Moneybird-export
        // paths already read from — no new field, no migration.
        const jobInvSourceItems = job.quoteId ? (lineItems[job.quoteId] ?? []) : [];
        if (jobInvSourceItems.length > 0) {
          setLineItems((prev) => ({ ...prev, [docNumber]: jobInvSourceItems }));
        }

        if (isSupabaseConfigured) {
          // R66 round 47: persist leveringsdatum from the linked job's
          // completedAt. Pre-R47 R34 derived this FE-side at PDF render
          // time; if the job was deleted post-invoice the date was lost.
          // Now: snapshot at invoice-create so it survives the linked-job
          // lifecycle.
          const deliveryDateIso = job.completedAt
            ? localDateKey(new Date(job.completedAt))
            : null;
          const invPayload = {
            doc_type: 'invoice' as const,
            status: 'draft' as const,
            document_number: docNumber,
            // R83+: documents.customer_id / job_id are uuid FKs. job.customerId
            // (and a not-yet-flushed jobId) can be a non-uuid seed/temp id →
            // 22P02 → createDocument throws → the catch queues the SAME payload
            // → flush also fails → the invoice-from-job silently never persists.
            // Guard like every sibling documents write (isUuid → null).
            customer_id: isUuid(job.customerId) ? job.customerId : null,
            job_id: isUuid(jobId) ? jobId : null,
            total_amount: amount,
            due_date: dueDate.toISOString(),
            delivery_date: deliveryDateIso,
          };
          try {
            const row = await withTimeout(createDocument(invPayload), 3000, 'addInvoiceFromJob');
            // Persist the carried-over quote lines (mirrors the quote→invoice
            // path). Per-line VAT honors KOR/Kleinunternehmer (0%) via the profile.
            if (jobInvSourceItems.length > 0) {
              const invoiceLineVatRate = getEffectiveVatRate(businessProfile);
              await withTimeout(
                upsertLineItems(
                  row.id,
                  jobInvSourceItems.map((item, idx) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total_price: item.unitPrice * item.quantity,
                    position: idx,
                    vat_rate: (item as any).vatRate ?? invoiceLineVatRate,
                  })),
                ),
                3000,
                'addInvoiceFromJob.lineItems',
              );
            }
          } catch (err) {
            logWarn('AppState', `addInvoiceFromJob persist failed, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'documents', op: 'insert', payload: { ...invPayload, user_id: getCurrentUserId() } });
            } catch {}
          }
        }

        // R55: was missing emitInvoiceSent + trackEvent — addInvoice() (the
        // quote-source variant) fires both, but the job-source variant
        // skipped them. Job→invoice creations were silently absent from
        // the funnel signal in business_events. GoBD audit trail also
        // missing here. Fix: parity with addInvoice's post-create block.
        import('../services/gobdAuditTrailService').then((m) =>
          m.appendAudit({
            type: 'invoice_created',
            ref: docNumber,
            payload: { amount, customer: job.customerId ?? null, sourceJobId: jobId },
          }),
        ).catch(() => {});
        emitInvoiceSent(getCurrentUserId(), docNumber, {
          customerId: job.customerId ?? '',
          amount,
          dueDate: dueDate.toISOString(),
        }).catch(() => {});
        trackEvent('invoice_created', { invoiceId: docNumber }).catch(() => {});
        return docNumber;
      },

      // ── Progress billing (termijnfacturen) ────────────────────────────────
      // Raise the invoice for one instalment of a project.
      //
      // The retentie split is the part to be careful with: `total_amount` is
      // the FULL term value so VAT is charged on the whole of it, and
      // `retention_amount` separately records what is withheld from payment.
      // What the customer pays now is derived from the two (see
      // progressBillingService.payableNow) and never stored, so it cannot
      // drift.
      addTermInvoice: async (projectId: string, termId: string) => {
        const project = projects.find((p) => p.id === projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);
        const term = (project.billingTerms ?? []).find((t) => t.id === termId);
        if (!term) throw new Error(`Billing term ${termId} not found on project ${projectId}`);
        if (term.status === 'invoiced' || term.status === 'paid') {
          throw new Error(`Term "${term.title}" has already been invoiced`);
        }

        const {
          validateBillingSchedule,
          termAmount,
          retentionForTerm,
        } = await import('../services/progressBillingService');

        // Refuse to bill against a schedule that does not add up. Billing past
        // 100% of a contract is the failure that costs real money, and it is
        // cheaper to stop here than to credit-note it later.
        const scheduleErrors = validateBillingSchedule(project);
        if (scheduleErrors.length > 0) {
          throw new Error(`Billing schedule is invalid: ${scheduleErrors[0].message}`);
        }

        const amount = termAmount(project, term);
        if (amount <= 0) {
          throw new Error(`Term "${term.title}" bills nothing`);
        }
        const retention = retentionForTerm(project, term);

        const docNumber = await nextDocumentNumber('invoice');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const customer = customers.find((c) => c.id === project.customerId);
        const customerName = customer?.name ?? '';

        const newInvoice: Invoice = {
          id: docNumber,
          customer: customerName,
          customerId: project.customerId || undefined,
          customerName,
          job: `${project.title} — ${term.title}`,
          amount,
          status: 'draft',
          dueInDays: 14,
          projectId,
          billingTermId: termId,
          retentionAmount: retention,
        };
        setInvoices((prev) => [newInvoice, ...prev]);

        // Mark the term invoiced optimistically, so the UI cannot offer the
        // same instalment twice while the write is in flight.
        const invoicedAt = new Date().toISOString();
        setProjects((prev) =>
          prev.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  billingTerms: (p.billingTerms ?? []).map((t) =>
                    t.id === termId
                      ? { ...t, status: 'invoiced' as const, invoiceId: docNumber, invoicedAt }
                      : t,
                  ),
                },
          ),
        );

        if (isSupabaseConfigured) {
          const invPayload = {
            doc_type: 'invoice' as const,
            status: 'draft' as const,
            document_number: docNumber,
            customer_id: isUuid(project.customerId) ? project.customerId : null,
            job_id: null,
            total_amount: amount,
            due_date: dueDate.toISOString(),
            // Rule #8 step 4 — the write mappers for the document-side
            // progress-billing columns.
            project_id: isUuid(projectId) ? projectId : null,
            billing_term_id: termId,
            retention_amount: retention,
            is_retention_release: false,
          };
          try {
            await withTimeout(createDocument(invPayload), 3000, 'addTermInvoice');
          } catch (err) {
            logWarn('AppState', `addTermInvoice persist failed, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'documents', op: 'insert', payload: { ...invPayload, user_id: getCurrentUserId() } });
            } catch {}
          }
          // Persist the term-status change through the same project patch path
          // every other project edit uses.
          try {
            const { updateProject: updateProjectRow } = await import('../lib/dataProvider');
            const patched = (projects.find((p) => p.id === projectId)?.billingTerms ?? []).map((t) =>
              t.id === termId ? { ...t, status: 'invoiced' as const, invoiceId: docNumber, invoicedAt } : t,
            );
            await withTimeout(
              updateProjectRow(projectId, { billing_terms: patched }),
              3000,
              'addTermInvoice.terms',
            );
          } catch (err) {
            logWarn('AppState', `addTermInvoice term-status persist failed: ${err}`);
          }
        }

        // Post-create housekeeping runs regardless of which branch persisted
        // (rule #7): an offline instalment must still reach the audit trail
        // and the funnel.
        import('../services/gobdAuditTrailService').then((m) =>
          m.appendAudit({
            type: 'invoice_created',
            ref: docNumber,
            payload: { amount, customer: project.customerId ?? null, projectId, billingTermId: termId, retention },
          }),
        ).catch(() => {});
        emitInvoiceSent(getCurrentUserId(), docNumber, {
          customerId: project.customerId ?? '',
          amount,
          dueDate: dueDate.toISOString(),
        }).catch(() => {});
        trackEvent('invoice_created', { invoiceId: docNumber, projectId, billingTermId: termId }).catch(() => {});
        return docNumber;
      },

      // Bill one meerwerk / minderwerk item on its own invoice.
      //
      // Kept off the term schedule on purpose: re-spreading approved changes
      // across the remaining percentage terms under-bills the project (see
      // types/project.ts). Total billed stays contract + changes exactly.
      addChangeOrderInvoice: async (projectId: string, changeOrderId: string) => {
        const project = projects.find((p) => p.id === projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);
        const order = (project.changeOrders ?? []).find((c) => c.id === changeOrderId);
        if (!order) throw new Error(`Change order ${changeOrderId} not found on project ${projectId}`);

        const { canInvoiceChangeOrder } = await import('../services/progressBillingService');
        const gate = canInvoiceChangeOrder(order);
        if (!gate.allowed) {
          // Includes the art. 7:755 warning check: billing meerwerk the
          // customer was never warned about is how a contractor ends up unable
          // to collect it.
          throw new Error(gate.reason ?? 'This change order cannot be billed');
        }

        const amount = Number(order.amount);
        const docNumber = await nextDocumentNumber('invoice');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const customer = customers.find((c) => c.id === project.customerId);
        const customerName = customer?.name ?? '';
        const invoicedAt = new Date().toISOString();

        const newInvoice: Invoice = {
          id: docNumber,
          customer: customerName,
          customerId: project.customerId || undefined,
          customerName,
          job: `${project.title} — ${order.title}`,
          amount,
          status: 'draft',
          dueInDays: 14,
          projectId,
          changeOrderId,
        };
        setInvoices((prev) => [newInvoice, ...prev]);

        setProjects((prev) =>
          prev.map((p) =>
            p.id !== projectId
              ? p
              : {
                  ...p,
                  changeOrders: (p.changeOrders ?? []).map((c) =>
                    c.id === changeOrderId
                      ? { ...c, status: 'invoiced' as const, invoiceId: docNumber, invoicedAt }
                      : c,
                  ),
                },
          ),
        );

        if (isSupabaseConfigured) {
          const invPayload = {
            doc_type: 'invoice' as const,
            status: 'draft' as const,
            document_number: docNumber,
            customer_id: isUuid(project.customerId) ? project.customerId : null,
            job_id: null,
            total_amount: amount,
            due_date: dueDate.toISOString(),
            project_id: isUuid(projectId) ? projectId : null,
            change_order_id: changeOrderId,
            retention_amount: 0,
            is_retention_release: false,
          };
          try {
            await withTimeout(createDocument(invPayload), 3000, 'addChangeOrderInvoice');
          } catch (err) {
            logWarn('AppState', `addChangeOrderInvoice persist failed, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'documents', op: 'insert', payload: { ...invPayload, user_id: getCurrentUserId() } });
            } catch {}
          }
          try {
            const { updateProject: updateProjectRow } = await import('../lib/dataProvider');
            const patched = (projects.find((p) => p.id === projectId)?.changeOrders ?? []).map((c) =>
              c.id === changeOrderId ? { ...c, status: 'invoiced' as const, invoiceId: docNumber, invoicedAt } : c,
            );
            await withTimeout(
              updateProjectRow(projectId, { change_orders: patched }),
              3000,
              'addChangeOrderInvoice.orders',
            );
          } catch (err) {
            logWarn('AppState', `addChangeOrderInvoice status persist failed: ${err}`);
          }
        }

        import('../services/gobdAuditTrailService').then((m) =>
          m.appendAudit({
            type: 'invoice_created',
            ref: docNumber,
            payload: { amount, customer: project.customerId ?? null, projectId, changeOrderId, warnedAt: order.warnedAt ?? null },
          }),
        ).catch(() => {});
        emitInvoiceSent(getCurrentUserId(), docNumber, {
          customerId: project.customerId ?? '',
          amount,
          dueDate: dueDate.toISOString(),
        }).catch(() => {});
        trackEvent('invoice_created', { invoiceId: docNumber, projectId, changeOrderId }).catch(() => {});
        return docNumber;
      },

      // Release the retentie held on a project: one invoice for everything
      // withheld across its instalments.
      //
      // The gate is the point of this mutator. Releasing early hands back the
      // contractor's only leverage before the work is signed off, so it refuses
      // unless the project is complete AND every term has been billed -- a
      // project can be marked complete with an instalment still outstanding.
      addRetentionReleaseInvoice: async (projectId: string) => {
        const project = projects.find((p) => p.id === projectId);
        if (!project) throw new Error(`Project ${projectId} not found`);

        const [{ retentionHeld, canReleaseRetention }, i18nMod] = await Promise.all([
          import('../services/progressBillingService'),
          // AppState imports i18n lazily elsewhere too (see the queue-item
          // notice path) rather than at module scope.
          import('../i18n/i18n'),
        ]);
        const held = retentionHeld(projectId, invoices);
        const gate = canReleaseRetention(project, held);
        if (!gate.allowed) throw new Error(gate.reason ?? 'Retention cannot be released yet');

        const docNumber = await nextDocumentNumber('invoice');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const customer = customers.find((c) => c.id === project.customerId);
        const customerName = customer?.name ?? '';

        const newInvoice: Invoice = {
          id: docNumber,
          customer: customerName,
          customerId: project.customerId || undefined,
          customerName,
          job: `${project.title} — ${i18nMod.default.t('projectBilling.retentionRelease', 'Retention release')}`,
          amount: held,
          status: 'draft',
          dueInDays: 14,
          projectId,
          // Withholds nothing itself, and is what retentionHeld nets off so a
          // released project stops reporting a balance.
          retentionAmount: 0,
          isRetentionRelease: true,
        };
        setInvoices((prev) => [newInvoice, ...prev]);

        if (isSupabaseConfigured) {
          const invPayload = {
            doc_type: 'invoice' as const,
            status: 'draft' as const,
            document_number: docNumber,
            customer_id: isUuid(project.customerId) ? project.customerId : null,
            job_id: null,
            total_amount: held,
            due_date: dueDate.toISOString(),
            project_id: isUuid(projectId) ? projectId : null,
            retention_amount: 0,
            is_retention_release: true,
          };
          try {
            await withTimeout(createDocument(invPayload), 3000, 'addRetentionReleaseInvoice');
          } catch (err) {
            logWarn('AppState', `addRetentionReleaseInvoice persist failed, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'documents', op: 'insert', payload: { ...invPayload, user_id: getCurrentUserId() } });
            } catch {}
          }
        }

        import('../services/gobdAuditTrailService').then((m) =>
          m.appendAudit({
            type: 'invoice_created',
            ref: docNumber,
            payload: { amount: held, customer: project.customerId ?? null, projectId, retentionRelease: true },
          }),
        ).catch(() => {});
        emitInvoiceSent(getCurrentUserId(), docNumber, {
          customerId: project.customerId ?? '',
          amount: held,
          dueDate: dueDate.toISOString(),
        }).catch(() => {});
        trackEvent('invoice_created', { invoiceId: docNumber, projectId, retentionRelease: true }).catch(() => {});
        return docNumber;
      },

      convertQuoteToJob: async (quoteId: string) => {
        const quote = quotes.find((q) => q.id === quoteId);
        if (!quote) throw new Error(`Quote ${quoteId} not found`);

        const tempId = `j-${Date.now()}`;
        const now = new Date().toISOString();

        // Look for a customer-submitted preferred date in the moat
        // (customer_interactions entries with type='decision' + data.preferredDate).
        let scheduledDate: string | undefined;
        try {
          const raw = await AsyncStorage.getItem('@vasco_customer_interactions');
          const interactions: any[] = raw ? JSON.parse(raw) : [];
          const related = interactions.filter((i) => i.quoteId === quoteId);
          const preferred = related
            .map((i) => i.data?.preferredDate || i.data?.value)
            .find((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
          if (preferred) {
            const d = new Date(preferred);
            if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now() - 86400000) {
              scheduledDate = d.toISOString();
            }
          }
        } catch {}

        const newJob: Job = {
          id: tempId,
          customerId: quote.customer ?? null,
          quoteId: quoteId,
          title: quote.job || `Klus van offerte ${quoteId}`,
          description: null,
          status: 'scheduled',
          quotedAmount: quote.amount,
          agreedAmount: quote.amount,
          priority: 'normal',
          photos: [],
          notes: [],
          timeEntries: [],
          materials: [],
          scheduledDate,
          createdAt: now,
          updatedAt: now,
        };

        setJobs((prev) => [newJob, ...prev]);
        // Mark quote as accepted
        setQuotes((prev) =>
          prev.map((q) => (q.id === quoteId ? { ...q, status: 'accepted' as Quote['status'] } : q)),
        );

        // AI data collector — quote accepted + pricing outcome
        const sentAtMsAcc = quote.sentAt ? new Date(quote.sentAt).getTime() : null;
        const ttdHoursAcc = sentAtMsAcc
          ? Math.max(0, Math.round((Date.now() - sentAtMsAcc) / (1000 * 60 * 60)))
          : undefined;
        emitQuoteAccepted(getCurrentUserId(), quoteId, {
          customerId: quote.customer ?? '',
          quotedAmount: quote.amount,
          acceptedAmount: quote.amount,
          daysToAccept: ttdHoursAcc !== undefined ? Math.round(ttdHoursAcc / 24) : 0,
        }).catch(() => {});
        // Activation-funnel analytics counterpart (signup→quote_sent→quote_accepted
        // →invoice_sent→payment_received). Was declared-but-unfired; wire it here
        // alongside the intelligence emit so the funnel's middle rung populates.
        trackEvent('quote_accepted', { quoteId, amount: quote.amount }).catch(() => {});
        recordPricingOutcome(getCurrentUserId(), quoteId, {
          wasAccepted: true,
          acceptedPrice: quote.amount,
          timeToDecisionHours: ttdHoursAcc,
        }).catch(() => {});
        // Close the quote-win calibration loop: feed the predictor with the
        // actual outcome so future win-chance badges get more accurate.
        import('../intelligence/mlModels').then((ml) =>
          ml.recordModelPrediction('quote_win', 0.5, 1),
        ).catch(() => {});
        // R237: also resolve quote-outcome calibration predictions for
        // generators that predicted likelihood-of-acceptance.
        import('../intelligence/learningStorage').then((m) =>
          m.resolveOutcomesFromQuoteOutcome(true, ttdHoursAcc !== undefined ? Math.round(ttdHoursAcc / 24) : undefined),
        ).catch(() => {});

        // R55: split BE-persist from post-create housekeeping (R52 contract).
        // Pre-R55 this had the SAME early-return bug as addJob — when BE
        // succeeded it `return row.id`'d, skipping every job-side signal:
        // ontology upsertEntity, customer↔job relation, semantic search
        // index, trackEvent('job_created'), markStepComplete('first_job_created'),
        // and calendar sync. Quote→job conversions silently bypassed the
        // entire job-creation moat path while addJob() flowed through it.
        let finalJobId = tempId;
        if (isSupabaseConfigured) {
          // R66 round 18: same uuid guard — quote.customer is a FE display
          // string when the source quote was created via the empty-state
          // path (tiered-quote.tsx fallback to t('customer')). jobs.customer_id
          // is a uuid FK; non-uuid value would reject the insert and the
          // quote→job conversion would silently fail.
          const jobPayload = {
            title: newJob.title,
            customer_id: isUuid(quote.customer) ? quote.customer : null,
            quoted_amount: quote.amount,
            agreed_amount: quote.amount,
          };
          try {
            const row = await dbCreateJob(jobPayload);
            setJobs((prev) =>
              prev.map((j) => (j.id === tempId ? { ...j, id: row.id } : j)),
            );
            finalJobId = row.id;
            // R52: was `.catch(() => {})` — silenced quote-status-update
            // failures left the quote stuck in `draft` on BE while the job
            // existed. Now queues the update on failure so reconnect drains.
            try {
              await updateDocument(quoteId, { status: 'accepted' });
            } catch {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'documents', op: 'update', rowId: quoteId, payload: { status: 'accepted' } }).catch(() => {});
            }
          } catch (err) {
            // R44: was fire-and-forget log — offline-converted quotes never
            // reached BE. Now queues both the job insert + the quote
            // status update for retry on reconnect.
            logWarn('AppState', `convertQuoteToJob persist failed, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'jobs', op: 'insert', payload: { id: tempId, user_id: getCurrentUserId(), ...jobPayload } });
              await queueWrite({ table: 'documents', op: 'update', rowId: quoteId, payload: { status: 'accepted' } });
            } catch {}
          }
        }

        // Post-create housekeeping — uniform across BE-success / offline /
        // unconfigured. Mirrors addJob's R52 block.
        import('../intelligence/semanticSearch').then(({ indexJobForSearch }) =>
          indexJobForSearch({ id: finalJobId, title: newJob.title, trade: undefined, description: null }),
        ).catch(() => {});
        upsertEntity({
          id: finalJobId,
          type: 'job',
          name: newJob.title,
          attributes: { status: 'scheduled', sourceQuoteId: quoteId },
          scores: { reliability: 50, quality: 50, value: quote.amount, frequency: 0 },
          lastUpdated: new Date().toISOString(),
        }).catch(() => {});
        if (quote.customer) {
          addRelation({
            fromId: quote.customer,
            fromType: 'customer',
            toId: finalJobId,
            toType: 'job',
            relationType: 'owns',
            metadata: {},
          }).catch(() => {});
        }
        trackEvent('job_created', { jobId: finalJobId, sourceQuoteId: quoteId }).catch(() => {});
        markStepComplete('first_job_created').catch(() => {});
        if (scheduledDate) {
          import('../services/calendarSyncService').then(({ syncJobToCalendar, getCalendarSyncSettings }) => {
            getCalendarSyncSettings().then((settings) => {
              if (settings.enabled) syncJobToCalendar({ ...newJob, id: finalJobId }).catch(() => {});
            }).catch(() => {});
          }).catch(() => {});
        }
        return finalJobId;
      },

      updateQuote: (id, updates) => {
        const quote = quotes.find(q => q.id === id);
        setQuotes((prev) =>
          prev.map((q) => (q.id === id ? { ...q, ...updates } : q)),
        );
        // R56: gate removed — persistOrQueue handles temp ids.
        if (isSupabaseConfigured) {
          const dbUpdates: Record<string, unknown> = {};
          if (updates.amount !== undefined) dbUpdates.total_amount = updates.amount;
          if (updates.status !== undefined) dbUpdates.status = updates.status;
          // R66 round 21: apply the R18 uuid guard. Quote.customer / Quote.job
          // can hold the FE display string ("Klant"/"Customer") on the empty-
          // state path; the BE columns are uuid FKs. Was latent today (no
          // caller passed customer/job updates) but the guard prevents future
          // bug reintroductions.
          if (updates.customer !== undefined) dbUpdates.customer_id = isUuid(updates.customer) ? updates.customer : null;
          if (updates.job !== undefined) dbUpdates.job_id = isUuid(updates.job) ? updates.job : null;
          // R66 round 21: description → scope_text was missing — `tiered-quote.tsx`
          // worked around it with a direct `updateDocument({ scope_text })` call
          // and an `as any` updateQuote mirror. Now updateQuote persists SOW
          // text directly via the standard mapper path. Quote.description is
          // already a typed field on the domain type; no cast needed.
          if (updates.description !== undefined) dbUpdates.scope_text = updates.description;
          if (Object.keys(dbUpdates).length > 0) {
            import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
              persistOrQueue('documents', 'update', () => updateDocument(id, dbUpdates), { rowId: id, payload: dbUpdates }),
            ).catch(() => {});
          }
        }
        // Track quote sent
        if (updates.status === 'sent') {
          trackEvent('quote_sent', { quoteId: id }).catch(() => {});
          markStepComplete('first_quote_sent').catch(() => {});
          // R209: run the trained quote-win model on the sent quote — when
          // it returns a confident low probability, enqueue an EVE nudge.
          // Fire-and-forget; the queue generator is null-safe on cold-start.
          if (quote) {
            const cust = customers.find((c: any) => c.id === quote.customer);
            Promise.all([
              import('../services/lowWinAlertGenerator'),
              import('../services/aiActionQueueService'),
            ]).then(async ([gen, queueMod]) => {
              const draft = await gen.generateLowWinAlert({
                quoteId: id,
                customerName: cust?.name ?? null,
                trade: businessProfile.trade ?? 'general',
                country: businessProfile.country ?? 'NL',
                amount: quote.amount,
              });
              if (draft) await queueMod.addToQueue(draft);
            }).catch(() => {});
          }
        }
        // Auto-create job when quote is accepted (EVE pattern: quote → job)
        // Delegates to convertQuoteToJob which handles job creation, AI events, and persistence
        if (updates.status === 'accepted' && quote) {
          // convertQuoteToJob is defined on `value` — call it via a self-contained closure
          // that replicates the same logic to avoid circular reference issues with useMemo
          const tempId = `j-${Date.now()}`;
          const nowTs = new Date().toISOString();
          const autoJob: Job = {
            id: tempId,
            customerId: quote.customer ?? null,
            quoteId: id,
            title: quote.job || (quote as any).description || `Job from quote ${id}`,
            description: null,
            status: 'scheduled',
            trade: (quote as any).trade,
            quotedAmount: quote.amount,
            agreedAmount: quote.amount,
            priority: 'normal',
            photos: [],
            notes: [],
            timeEntries: [],
            materials: [],
            createdAt: nowTs,
            updatedAt: nowTs,
          };
          setJobs((prev) => [autoJob, ...prev]);
          const sentAtMsUp = quote.sentAt ? new Date(quote.sentAt).getTime() : null;
          const ttdHoursUp = sentAtMsUp
            ? Math.max(0, Math.round((Date.now() - sentAtMsUp) / (1000 * 60 * 60)))
            : undefined;
          emitQuoteAccepted(getCurrentUserId(), id, {
            customerId: quote.customer ?? '',
            quotedAmount: quote.amount,
            acceptedAmount: quote.amount,
            daysToAccept: ttdHoursUp !== undefined ? Math.round(ttdHoursUp / 24) : 0,
          }).catch(() => {});
          // Activation-funnel analytics counterpart (mirrors convertQuoteToJob).
          trackEvent('quote_accepted', { quoteId: id, amount: quote.amount }).catch(() => {});
          recordPricingOutcome(getCurrentUserId(), id, {
            wasAccepted: true,
            acceptedPrice: quote.amount,
            timeToDecisionHours: ttdHoursUp,
          }).catch(() => {});
          // Stage 2 bridge: if a lead was the upstream source of this quote
          // (lead.sourceQuoteId === id), auto-transition it to 'won' so the
          // pipeline view reflects reality and the source-conversion training
          // signal lands in business_events. Single-shot — skips if the lead
          // is already 'won' (idempotent on retries).
          const sourceLeadAccept = leads.find((l) => l.sourceQuoteId === id && l.status !== 'won');
          if (sourceLeadAccept) {
            const hoursTotalA = Math.round(
              (Date.now() - new Date(sourceLeadAccept.createdAt).getTime()) / 3_600_000,
            );
            setLeads((prev) =>
              prev.map((l) =>
                l.id === sourceLeadAccept.id
                  ? { ...l, status: 'won', convertedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
                  : l,
              ),
            );
            emitLeadConverted(getCurrentUserId(), sourceLeadAccept.id, {
              source: sourceLeadAccept.source,
              outcome: 'won',
              estimatedValue: sourceLeadAccept.estimatedValue,
              actualQuoteAmount: quote.amount,
              sourceQuoteId: id,
              hoursFromCreatedToConverted: hoursTotalA,
            }).catch(() => {});
            // Persist the status flip so the win sticks across cold-start.
            if (isSupabaseConfigured) {
              import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
                persistOrQueue('leads', 'update', async () => {
                  const { supabase } = await import('../lib/supabase');
                  const { error } = await (supabase.from('leads') as any)
                    .update({ status: 'won' })
                    .eq('id', sourceLeadAccept.id);
                  if (error) throw error;
                }, { rowId: sourceLeadAccept.id }),
              ).catch(() => {});
            }
          }
          if (isSupabaseConfigured) {
            // R66 round 18: same uuid guard — see updateQuote acceptance path.
            dbCreateJob({
              title: autoJob.title,
              customer_id: isUuid(quote.customer) ? quote.customer : null,
              quoted_amount: quote.amount,
              agreed_amount: quote.amount,
            }).then((row) => {
              setJobs((prev) => prev.map((j) => (j.id === tempId ? { ...j, id: row.id } : j)));
            }).catch((err) => logWarn('AppState', `auto-create job from updateQuote failed: ${err}`));
          }
        }

        // AI data collector — track quote rejection
        if (updates.status === 'rejected' && quote) {
          const declineReason = updates.declineReason ?? 'customer_declined';
          const counterOffer = updates.counterOfferAmount;
          const sentAtMs = quote.sentAt ? new Date(quote.sentAt).getTime() : null;
          const timeToDecisionHours = sentAtMs
            ? Math.max(0, Math.round((Date.now() - sentAtMs) / (1000 * 60 * 60)))
            : undefined;
          emitQuoteRejected(getCurrentUserId(), id, {
            customerId: quote.customer ?? '',
            quotedAmount: quote.amount,
            reason: declineReason,
          }).catch(() => {});
          recordPricingOutcome(getCurrentUserId(), id, {
            wasAccepted: false,
            declineReason,
            counterOfferAmount: counterOffer,
            timeToDecisionHours,
          }).catch(() => {});
          // R237: resolve quote-outcome calibration predictions for the
          // generators that predicted likelihood-of-acceptance.
          import('../intelligence/learningStorage').then((m) =>
            m.resolveOutcomesFromQuoteOutcome(false, timeToDecisionHours !== undefined ? Math.round(timeToDecisionHours / 24) : undefined),
          ).catch(() => {});

          // Stage 2 bridge: if a lead already pointed at this quote
          // (lead.sourceQuoteId === id), don't double-create — flip the
          // existing lead to 'lost' and emit lead_converted with the
          // decline reason. Only if no such lead exists do we fall
          // through to the auto-create-from-rejection path (below).
          const sourceLeadReject = leads.find((l) => l.sourceQuoteId === id && l.status !== 'lost');
          if (sourceLeadReject) {
            const hoursTotalR = Math.round(
              (Date.now() - new Date(sourceLeadReject.createdAt).getTime()) / 3_600_000,
            );
            setLeads((prev) =>
              prev.map((l) =>
                l.id === sourceLeadReject.id
                  ? { ...l, status: 'lost', convertedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: declineReason ? `${l.notes ?? ''}\nLost: ${declineReason}`.trim() : l.notes }
                  : l,
              ),
            );
            emitLeadConverted(getCurrentUserId(), sourceLeadReject.id, {
              source: sourceLeadReject.source,
              outcome: 'lost',
              estimatedValue: sourceLeadReject.estimatedValue,
              actualQuoteAmount: quote.amount,
              sourceQuoteId: id,
              hoursFromCreatedToConverted: hoursTotalR,
            }).catch(() => {});
            if (isSupabaseConfigured) {
              import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
                persistOrQueue('leads', 'update', async () => {
                  const { supabase } = await import('../lib/supabase');
                  const { error } = await (supabase.from('leads') as any)
                    .update({ status: 'lost' })
                    .eq('id', sourceLeadReject.id);
                  if (error) throw error;
                }, { rowId: sourceLeadReject.id }),
              ).catch(() => {});
            }
          }

          // R81 US Phase 4: auto-create a 'lost' lead so the rejected
          // quote surfaces in the pipeline for re-engagement. Customer
          // name resolved via the customers lookup (quote.customer is
          // the customer id, not name). Skipped silently if name lookup
          // fails — pipeline still works, just without an entry for
          // this rejection.
          //
          // R96: previously did a raw setLeads with no BE persist, so
          // the auto-created lead disappeared on cold-start (rule #8
          // violation). Now mirrors the full addLead path — optimistic
          // insert + BE persist via offlineWriteQueue + temp-id remap.
          // Stage 2: skip the auto-create when an existing lead was
          // already flipped above — avoids duplicate pipeline rows.
          const customer = !sourceLeadReject ? customers.find((c) => c.id === quote.customer) : null;
          if (customer) {
            const tempId = `lead-rej-${Date.now()}`;
            const now = new Date().toISOString();
            const newLead: Lead = {
              id: tempId,
              status: 'lost',
              source: 'rejected_estimate',
              customerName: customer.name,
              customerPhone: customer.phone,
              customerEmail: customer.email,
              customerId: customer.id,
              jobDescription: quote.job ?? quote.description ?? 'Rejected estimate',
              estimatedValue: quote.amount,
              notes: declineReason ? `Reason: ${declineReason}` : undefined,
              sourceQuoteId: id,
              createdAt: now,
              updatedAt: now,
              convertedAt: now,
            };
            setLeads((prev) => [newLead, ...prev]);
            trackEvent('lead_created', { source: 'rejected_estimate', hasValue: newLead.estimatedValue ? 1 : 0 }).catch(() => {});
            // Intelligence loop: same emit path as manual addLead so the
            // auto-rejected lead lands in business_events + ontology +
            // is immediately a `lead_converted` (outcome='lost') for the
            // source-conversion-rate trainer.
            upsertEntity({
              id: tempId,
              type: 'lead',
              name: newLead.customerName,
              attributes: { source: newLead.source, status: newLead.status, estimatedValue: newLead.estimatedValue, customerId: newLead.customerId },
              scores: { reliability: 50, quality: 50, value: newLead.estimatedValue ?? 0, frequency: 1 },
              lastUpdated: now,
            }).catch(() => {});
            emitLeadCreated(getCurrentUserId(), tempId, {
              source: newLead.source,
              estimatedValue: newLead.estimatedValue,
              customerId: newLead.customerId,
              hasJobDescription: !!newLead.jobDescription,
            }).catch(() => {});
            emitLeadConverted(getCurrentUserId(), tempId, {
              source: newLead.source,
              outcome: 'lost',
              estimatedValue: newLead.estimatedValue,
              actualQuoteAmount: quote.amount,
              sourceQuoteId: id,
              hoursFromCreatedToConverted: 0,
            }).catch(() => {});
            if (isSupabaseConfigured) {
              import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
                persistOrQueue('leads', 'insert', async () => {
                  const { supabase } = await import('../lib/supabase');
                  const { data, error } = await (supabase.from('leads') as any)
                    .insert({
                      user_id: getCurrentUserId(),
                      status: newLead.status,
                      source: newLead.source,
                      customer_name: newLead.customerName,
                      customer_phone: newLead.customerPhone,
                      customer_email: newLead.customerEmail,
                      customer_id: isUuid(newLead.customerId) ? newLead.customerId : null,
                      job_description: newLead.jobDescription,
                      estimated_value: newLead.estimatedValue,
                      notes: newLead.notes,
                      source_quote_id: isUuid(newLead.sourceQuoteId) ? newLead.sourceQuoteId : null,
                    })
                    .select('id')
                    .single();
                  if (error) throw error;
                  if (data?.id) {
                    setLeads((prev) =>
                      prev.map((l) => (l.id === tempId ? { ...l, id: data.id as string } : l))
                    );
                    const { emitIdRemap } = await import('../services/idRemapBus');
                    emitIdRemap({ table: 'leads', tempId, realId: data.id as string, payload: { name: newLead.customerName } });
                  }
                  return data;
                }, {
                  rowId: tempId,
                  // Full row so an OFFLINE auto-lead (quote rejected without signal)
                  // actually persists on flush — was `{ rowId: tempId }` → lead lost.
                  payload: {
                    id: tempId,
                    user_id: getCurrentUserId(),
                    status: newLead.status,
                    source: newLead.source,
                    customer_name: newLead.customerName,
                    customer_phone: newLead.customerPhone,
                    customer_email: newLead.customerEmail,
                    customer_id: isUuid(newLead.customerId) ? newLead.customerId : null,
                    job_description: newLead.jobDescription,
                    estimated_value: newLead.estimatedValue,
                    notes: newLead.notes,
                    source_quote_id: isUuid(newLead.sourceQuoteId) ? newLead.sourceQuoteId : null,
                  },
                }),
              ).catch((err) => logWarn('AppState', `auto-lead-on-reject persist failed: ${err}`));
            }
          }
        }
      },

      // ═════════════════════════════════════════════════════════════════════
      // SECTION: Project Management (aannemer mode)
      // ═════════════════════════════════════════════════════════════════════

      projects,
      addProject: (project) => {
        // R275: BE-backed via projects table. Optimistic insert with temp id;
        // dataProvider returns real uuid which replaces it. Offline → queued.
        const tempId = `proj-${Date.now()}`;
        const now = new Date().toISOString();
        const newProject: Project = {
          ...project,
          id: tempId,
          totalInvoiced: 0,
          totalPaid: 0,
          createdAt: now,
          updatedAt: now,
        };
        setProjects(prev => [newProject, ...prev]);

        if (isSupabaseConfigured) {
          (async () => {
            try {
              const { createProject: dbCreateProject } = await import('../lib/dataProvider');
              const row = await withTimeout(dbCreateProject({
                name: project.title,
                description: project.description,
                customer_id: isUuid(project.customerId) ? project.customerId : null,
                status: project.status,
                start_date: project.startDate ?? null,
                target_end_date: project.targetEndDate ?? null,
                total_budget: project.totalBudget,
                address: project.address ?? null,
                milestones: project.milestones ?? [],
                billing_terms: project.billingTerms ?? [],
                retention_percent: project.retentionPercent ?? 0,
                change_orders: project.changeOrders ?? [],
              }), 3000, 'addProject');
              setProjects(prev => prev.map(p => p.id === tempId ? { ...p, id: (row as any).id } : p));
            } catch (err) {
              logWarn('AppState', `addProject persist failed or timed out: ${err}`);
              try {
                const { queueWrite } = await import('../services/offlineWriteQueue');
                await queueWrite({
                  table: 'projects',
                  op: 'insert',
                  payload: {
                    id: tempId,
                    user_id: getCurrentUserId(),
                    name: project.title,
                    description: project.description,
                    customer_id: isUuid(project.customerId) ? project.customerId : null,
                    status: project.status,
                    start_date: project.startDate ?? null,
                    target_end_date: project.targetEndDate ?? null,
                    total_budget: project.totalBudget,
                    address: project.address ?? null,
                    milestones: project.milestones ?? [],
                billing_terms: project.billingTerms ?? [],
                retention_percent: project.retentionPercent ?? 0,
                change_orders: project.changeOrders ?? [],
                  },
                });
              } catch {}
            }
          })();
        }
        return tempId;
      },
      updateProject: (id, updates) => {
        setProjects(prev => prev.map(p =>
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        ));

        // R56: was gated by `!id.startsWith('proj-')` — offline-created
        // project edits silently lost. Now: build the patch first, then
        // for temp ids queue directly (BE call would no-op since the row
        // doesn't exist yet); for real ids try BE then queue on failure.
        if (isSupabaseConfigured) {
          (async () => {
            const patch: Record<string, unknown> = {};
            if (updates.title !== undefined) patch.name = updates.title;
            if (updates.description !== undefined) patch.description = updates.description;
            if (updates.status !== undefined) patch.status = updates.status;
            if (updates.startDate !== undefined) patch.start_date = updates.startDate;
            if (updates.targetEndDate !== undefined) patch.target_end_date = updates.targetEndDate;
            if (updates.actualEndDate !== undefined) patch.actual_end_date = updates.actualEndDate;
            if (updates.totalBudget !== undefined) patch.total_budget = updates.totalBudget;
            if (updates.address !== undefined) patch.address = updates.address;
            if (updates.milestones !== undefined) patch.milestones = updates.milestones;
            // Rule #8 step 4 — write mappers for progress billing.
            if (updates.billingTerms !== undefined) patch.billing_terms = updates.billingTerms;
            if (updates.retentionPercent !== undefined) patch.retention_percent = updates.retentionPercent;
            if (updates.changeOrders !== undefined) patch.change_orders = updates.changeOrders;
            if (Object.keys(patch).length === 0) return;

            if (id.startsWith('proj-')) {
              // Temp id — queue directly. R49 will rewrite rowId on flush
              // once the parent insert lands.
              try {
                const { queueWrite } = await import('../services/offlineWriteQueue');
                await queueWrite({ table: 'projects', op: 'update', rowId: id, payload: patch });
              } catch {}
              return;
            }
            try {
              const { updateProject: dbUpdateProject } = await import('../lib/dataProvider');
              await withTimeout(dbUpdateProject(id, patch), 3000, 'updateProject');
            } catch (err) {
              logWarn('AppState', `updateProject persist failed: ${err}`);
              try {
                const { queueWrite } = await import('../services/offlineWriteQueue');
                await queueWrite({ table: 'projects', op: 'update', rowId: id, payload: patch });
              } catch {}
            }
          })();
        }
      },
      addJobToProject: (projectId, jobId) => {
        setProjects(prev => prev.map(p =>
          p.id === projectId ? { ...p, jobIds: [...p.jobIds, jobId], updatedAt: new Date().toISOString() } : p
        ));
      },
      getProjectPnL: (projectId): ProjectPnL => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return { projectId, revenue: 0, materialCosts: 0, laborCosts: 0, subcontractorCosts: 0, otherCosts: 0, grossProfit: 0, grossMargin: 0, budgetVariance: 0, budgetVariancePct: 0 };
        const projectJobs = jobs.filter(j => project.jobIds.includes(j.id));
        // Match on EITHER linkage. `invoiceIds` is the original denormalised
        // array; `invoice.projectId` is the column progress billing added, and
        // term/change-order invoices carry it. Filtering on invoiceIds alone
        // left every instalment out of project revenue, because the billing
        // mutators link the other way round.
        const projectInvoices = invoices.filter(
          (i: any) => project.invoiceIds?.includes(i.id) || i.projectId === project.id,
        );
        const revenue = projectInvoices.reduce((s: number, i: any) => s + (i.amount || 0), 0);
        const materialCosts = projectJobs.reduce((s, j) => {
          const mats = jobMaterialsMap[j.id] ?? [];
          return s + mats.reduce((ms, m) => ms + (m.totalPrice ?? 0), 0);
        }, 0);
        const laborCosts = projectJobs.reduce((s, j) => {
          const hours = (j as any).timeEntries?.reduce((h: number, e: any) => h + (e.hours ?? 0), 0) ?? 0;
          return s + hours * 45;
        }, 0);
        const totalCosts = materialCosts + laborCosts;
        const grossProfit = revenue - totalCosts;
        const grossMargin = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;
        return {
          projectId,
          revenue,
          materialCosts,
          laborCosts,
          subcontractorCosts: 0,
          otherCosts: 0,
          grossProfit,
          grossMargin,
          budgetVariance: project.totalBudget - totalCosts,
          budgetVariancePct: project.totalBudget > 0 ? Math.round(((project.totalBudget - totalCosts) / project.totalBudget) * 100) : 0,
        };
      },

      pendingBudgetExtraction,
      setPendingBudgetExtraction,
      connectMollie: () => setMollieConnected(true),
      connectStripe: () => setStripeConnected(true),
      disconnectMollie: async () => {
        // SecureStore purge + state reset. Same pattern the sign-out flow
        // will fire on logout via singletonReset, but exposed as a user-
        // facing action in the Mollie modal too.
        const { clearMollieConfig } = await import('../integrations/mollie');
        await clearMollieConfig().catch(() => {});
        setMollieConnected(false);
        setLastMolliePayment({});
      },
      disconnectStripe: async () => {
        const { clearStripeConfig } = await import('../integrations/stripe');
        await clearStripeConfig().catch(() => {});
        setStripeConnected(false);
        setLastStripePayment({});
      },
      createPaymentLink: async (invoiceId, amount) => {
        // Route by contractor country:
        //   UK → Stripe (GBP) — bacs_debit + card + klarna
        //   US → Stripe (USD) — card + us_bank_account + klarna  (R79)
        //   EU6 → Mollie (EUR) — iDEAL/Bancontact/SEPA/card
        // R66 round 8: was silently swallowing failures (`if result.success`
        // with no `else`). Caller (`app/invoices/[id].tsx:handleCreatePayment`)
        // wraps in try/catch and fires `hapticError` on throw, but nothing
        // ever threw — contractor pressed button, got success haptic, no link.
        // Now throws on provider failure so the caller's error path fires.
        const country = getCurrentCountry();
        if (country === 'UK' || country === 'US') {
          const { createStripePayment } = await import('../integrations/stripe');
          const result = await createStripePayment(invoiceId, amount, country);
          if (!result.success) {
            throw new Error(result.error ?? 'Stripe payment link creation failed');
          }
          setLastStripePayment((prev) => ({ ...prev, [invoiceId]: result.paymentId ?? invoiceId }));
          return;
        }
        const result = await createMolliePayment(invoiceId, amount);
        if (!result.success) {
          throw new Error(result.error ?? 'Mollie payment link creation failed');
        }
        setLastMolliePayment((prev) => ({ ...prev, [invoiceId]: result.paymentId }));
      },
      // R309: deposit/payment link for a decision tracker. Same country routing
      // as createPaymentLink, but returns the checkout URL and persists it onto
      // the tracker row (keyed by access_code) via setTrackerPayment so the
      // customer portal's pay CTA lights up. Contractor-initiated (EVE-safe).
      requestTrackerDeposit: async (accessCode, amount) => {
        const country = getCurrentCountry();
        let checkoutUrl = '';
        // R311: must use createPaymentLink (returns a shareable URL) — NOT the
        // legacy createStripePayment/createMolliePayment stubs. Stripe's stub
        // mints a PaymentIntent which has NO checkout URL (returned ''), so
        // UK/US deposits always failed. Both links carry trackerAccessCode
        // metadata so the webhook can flip decision_trackers.payment_status.
        if (country === 'UK' || country === 'US') {
          const { createPaymentLink } = await import('../integrations/stripe');
          const res = await createPaymentLink({
            invoiceId: `deposit-${accessCode}`,
            amount,
            description: `Aanbetaling — ${accessCode}`,
            currency: country === 'US' ? 'USD' : 'GBP',
            metadata: { trackerAccessCode: accessCode },
          });
          if (!res?.url) throw new Error('Stripe payment link creation failed');
          checkoutUrl = res.url;
        } else {
          const { createPaymentLink } = await import('../integrations/mollie');
          const res = await createPaymentLink({
            invoiceId: `deposit-${accessCode}`,
            amount,
            description: `Aanbetaling — ${accessCode}`,
            customerCountry: country,
            metadata: { trackerAccessCode: accessCode },
          });
          if (!res?.url) throw new Error('Mollie payment link creation failed');
          checkoutUrl = res.url;
        }
        const { setTrackerPayment } = await import('../services/decisionTrackerService');
        const stored = await setTrackerPayment({ accessCode, paymentLink: checkoutUrl, paymentStatus: 'pending', depositAmount: amount });
        if (!stored) {
          throw new Error('Payment link created but could not be saved to the tracker. Try again.');
        }
        return checkoutUrl;
      },
    }),
    [
      isLoading,
      refreshData,
      businessProfile,
      customers,
      extractedDocs,
      invoices,
      jobs,
      lineItems,
      materials,
      suppliers,
      jobMaterialsMap,
      priceObsMap,
      metrics,
      moneybirdConnected,
      mollieConnected,
      stripeConnected,
      quotes,
      lastMoneybirdExport,
      lastMolliePayment,
      lastStripePayment,
      pendingBudgetExtraction,
      projects,
      leads,
      workers,
    ]
  );

  // Register real side-effect bindings so actionExecutor can actually execute
  // create_invoice / create_payment_link / etc instead of returning a route hint.
  useEffect(() => {
    // Import here to keep this optional and avoid a circular dep
    import('../intelligence/actionExecutor').then((mod) => {
      mod.registerExecutorBindings({
        createInvoiceFromJob: async (jobId: string) => {
          try {
            const id = await (value as any).addInvoiceFromJob(jobId);
            return id as string;
          } catch { return null; }
        },
        createPaymentLink: async (invoiceId: string, amount: number) => {
          try {
            await (value as any).createPaymentLink(invoiceId, amount);
            return 'ok';
          } catch { return null; }
        },
        scheduleJob: async (jobId: string, when: Date) => {
          try {
            (value as any).updateJob?.(jobId, { scheduledDate: when.toISOString() });
          } catch {}
        },
        updateQuoteAmount: async (quoteId: string, newAmount: number) => {
          try {
            (value as any).updateQuote?.(quoteId, { amount: newAmount });
          } catch {}
        },
        createPurchaseOrder: async (materialName: string, supplier?: string) => {
          try {
            // AppState doesn't own POs directly; delegate to purchaseOrderService
            const { purchaseOrderService } = await import('../services/purchaseOrderService');
            const supplierName = supplier ?? 'Preferred supplier';
            const po = purchaseOrderService.createOrder(
              supplierName.toLowerCase().replace(/\s+/g, '-'),
              supplierName,
              [{ description: materialName, quantity: 1, unitPrice: 0 } as any],
            );
            return po?.id ?? null;
          } catch { return null; }
        },
      });
    }).catch(() => {});
  }, [value]);

  // Keep a module-level snapshot so non-hook consumers (scheduler, AI queue
  // populator, eveAgentService.getWorkforceStatus) always see fresh state.
  useEffect(() => {
    import('./appStateSnapshot').then((mod) => {
      mod.setAppStateSnapshot({ jobs, quotes, invoices, customers });
    }).catch(() => {});
  }, [jobs, quotes, invoices, customers]);

  // R66 round 37: expose the imperative mutators non-hook consumers need
  // (realtime watchers in app/_layout.tsx) so webhook → BE update → realtime
  // event → FE state refresh actually closes. Pre-R37 the watcher fired but
  // the noop callback meant the UI stayed stale until manual pull-to-refresh.
  useEffect(() => {
    import('./appStateSnapshot').then((mod) => {
      mod.setAppStateMutators({
        markInvoicePaid: value.markInvoicePaid,
        refreshData: value.refreshData,
      });
    }).catch(() => {});
  }, [value.markInvoicePaid, value.refreshData]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
