// React
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Libraries
import AsyncStorage from '@react-native-async-storage/async-storage';

// Domain types
import { BusinessProfile } from '../domain/business';
import { Customer } from '../domain/customers';
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
} from '../intelligence/dataCollector';
import { validateQuoteBeforeSend, validateInvoiceBeforeCreate, validateJobStatusChange } from '../services/workflowValidatorService';
import { schedulePaymentReminder, scheduleQuoteFollowUp } from '../services/pushNotificationService';
import { exportInvoiceToMoneybird } from '../integrations/moneybird';
import { createMolliePayment } from '../integrations/mollie';
import { buildPriceRiskSignals } from '../logic/priceRisk';
import { ingestPdfStub } from '../ingestion/ingestionStub';
import { rowToExtractedDocument } from '../ingestion/extractionBridge';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId, getCurrentCountry, getCurrentTrade, setCurrentUser } from '../lib/currentUser';
import { jobUpdatesToRowPayload } from '../lib/mappers';
import { USE_SEED_DATA } from '../config/demo';
import {
  loadQuotes,
  loadInvoices,
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
import { businessProfile as initialBusinessProfile } from '../data/mockBusiness';
import { invoices as initialInvoices, quotes as initialQuotes } from '../data/mockDocuments';
import { quoteLineItems as initialLineItems } from '../data/mockLineItems';

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
  materials: Material[];
  suppliers: Supplier[];
  jobMaterials: Record<string, JobMaterial[]>;
  priceObservations: Record<string, PriceObservation[]>;
  addCustomer: (name: string, email?: string, phone?: string, address?: string) => Promise<string>;
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
  createPaymentLink: (invoiceId: string, amount: number) => Promise<void>;
  addInvoiceFromJob: (jobId: string) => Promise<string>;
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
  { id: 'j-seed-2', customerId: 'cust-001', title: 'CV-ketel onderhoud — Fam. de Vries', description: null, status: 'scheduled', trade: 'plumbing', priority: 'normal', scheduledDate: new Date().toISOString().split('T')[0], scheduledStartTime: '09:00', scheduledEndTime: '12:00', estimatedDuration: 3, quotedAmount: 450, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 3).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-seed-3', customerId: 'cust-002', title: 'Badkamer renovatie — Fam. Jansen', description: null, status: 'in-progress', trade: 'plumbing', priority: 'normal', scheduledDate: new Date().toISOString().split('T')[0], scheduledStartTime: '13:30', scheduledEndTime: '17:00', estimatedDuration: 24, quotedAmount: 4200, agreedAmount: 4200, photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 7).toISOString(), updatedAt: new Date().toISOString() },
  { id: 'j-seed-4', customerId: 'cust-003', title: 'Lekkage reparatie — Bakkerij Smit', description: null, status: 'completed', trade: 'plumbing', priority: 'normal', estimatedDuration: 2, quotedAmount: 280, agreedAmount: 280, actualHours: 2.5, actualCost: 85, completedAt: new Date(Date.now() - MS_PER_DAY * 12).toISOString(), photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 14).toISOString(), updatedAt: new Date(Date.now() - MS_PER_DAY * 12).toISOString() },
  { id: 'j-seed-5', customerId: 'cust-005', title: 'Vloerverwarming check — Hotel NH', description: null, status: 'invoiced', trade: 'plumbing', priority: 'normal', estimatedDuration: 2, quotedAmount: 350, agreedAmount: 350, invoiceId: 'inv-seed-1', completedAt: new Date(Date.now() - MS_PER_DAY * 20).toISOString(), photos: [], notes: [], timeEntries: [], materials: [], createdAt: new Date(Date.now() - MS_PER_DAY * 25).toISOString(), updatedAt: new Date(Date.now() - MS_PER_DAY * 20).toISOString() },
];

const SEED_CUSTOMERS: Customer[] = [
  { id: 'cust-001', name: 'Fam. de Vries', email: 'devries@gmail.com', phone: '+31 6 12345678' },
  { id: 'cust-002', name: 'Fam. Jansen', email: 'jansen@hotmail.com', phone: '+31 6 87654321' },
  { id: 'cust-003', name: 'Bakkerij Smit', email: 'info@bakkerijsmit.nl', phone: '+31 20 1234567' },
  { id: 'cust-004', name: 'Fam. Bakker', email: 'bakker@gmail.com', phone: '+31 6 55512345' },
  { id: 'cust-005', name: 'Hotel NH', email: 'facilitair@nh-hotels.nl', phone: '+31 20 5551234' },
];

const SEED_JOB_MATERIALS: Record<string, JobMaterial[]> = {
  'j-seed-2': [
    { id: 'jm-s2-1', jobId: 'j-seed-2', materialId: 'mat-cvfilter', quantity: 2, unit: 'stuk', unitPrice: 8.50, totalPrice: 17, status: 'planned', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'jm-s2-2', jobId: 'j-seed-2', materialId: 'mat-expansievat', quantity: 1, unit: 'stuk', unitPrice: 65, totalPrice: 65, status: 'planned', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  'j-seed-3': [
    { id: 'jm-s3-1', jobId: 'j-seed-3', materialId: 'mat-koperbuis', quantity: 6, unit: 'meter', unitPrice: 12.50, totalPrice: 75, status: 'delivered', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'jm-s3-2', jobId: 'j-seed-3', materialId: 'mat-thermostaat', quantity: 3, unit: 'stuk', unitPrice: 42, totalPrice: 126, status: 'ordered', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
};

export function AppStateProvider({ children }: PropsWithChildren) {
  // Resolved at each render — currentUser ref is kept in sync by AuthContext.
  const aiUserId = getCurrentUserId();
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
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [jobMaterialsMap, setJobMaterialsMap] = useState(useSeedData ? SEED_JOB_MATERIALS : {} as Record<string, JobMaterial[]>);
  const [priceObsMap, setPriceObsMap] = useState<Record<string, PriceObservation[]>>({});
  const [moneybirdConnected, setMoneybirdConnected] = useState(false);
  const [lastMoneybirdExport, setLastMoneybirdExport] = useState<Record<string, string>>({});
  const [mollieConnected, setMollieConnected] = useState(false);
  const [lastMolliePayment, setLastMolliePayment] = useState<Record<string, string>>({});
  const [pendingBudgetExtraction, setPendingBudgetExtraction] = useState<BudgetExtractionResult | null>(null);
  // Seed projects for aannemer demo
  const SEED_PROJECTS: Project[] = [
    {
      id: 'proj-seed-1', title: 'Badkamer renovatie — Fam. Jansen', customerId: 'cust-002', customerName: 'Fam. Jansen',
      status: 'active', totalBudget: 12500, totalQuoted: 12500, totalInvoiced: 0, totalPaid: 0,
      jobIds: ['j-seed-3'], quoteIds: [], invoiceIds: [], subcontractorIds: [], milestones: [],
      startDate: new Date(Date.now() - MS_PER_DAY * 7).toISOString().split('T')[0],
      targetEndDate: new Date(Date.now() + MS_PER_DAY * 21).toISOString().split('T')[0],
      createdAt: new Date(Date.now() - MS_PER_DAY * 14).toISOString(), updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj-seed-2', title: 'Keuken verbouwing — Bakkerij Smit', customerId: 'cust-003', customerName: 'Bakkerij Smit',
      status: 'planning', totalBudget: 18000, totalQuoted: 16500, totalInvoiced: 0, totalPaid: 0,
      jobIds: ['j-seed-4'], quoteIds: [], invoiceIds: [], subcontractorIds: [], milestones: [],
      targetEndDate: new Date(Date.now() + MS_PER_DAY * 45).toISOString().split('T')[0],
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
      const [q, inv, bp, li, cust, j, mat, sup, jm, po] = await Promise.all([
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
      ]);
      setQuotes(q);
      setInvoices(inv);
      setBusinessProfile(bp);
      // R210: once businessProfile.country is known, prime the cohort DSO
      // so the DSO generator + collections insights see the real cohort
      // median instead of the hardcoded 32-day industry average.
      if (bp?.country) {
        import('../services/collectionsAgentService')
          .then(m => m.primeCohortIndustryAverage(bp.country as string))
          .catch(() => {});
      }
      setLineItems(li);
      setCustomers(cust);
      setJobs(j);
      setMaterials(mat);
      setSuppliers(sup);
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
              '@vasco_business_profile',
            ]);
            await AsyncStorage.setItem('@vasco_seed_version', SEED_VERSION);
          } else {
            // Same version — load persisted user data (only if non-empty)
            const pairs: [string, (v: any) => void][] = [
              ['@vasco_jobs', setJobs], ['@vasco_invoices', setInvoices],
              ['@vasco_quotes', setQuotes], ['@vasco_customers', setCustomers],
              ['@vasco_projects', setProjects],
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
  }, [customers]);
  useEffect(() => {
    if (useSeedData && persistReady) {
      AsyncStorage.setItem('@vasco_projects', JSON.stringify(projects)).catch(() => {});
    }
  }, [projects]);
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

        if (isSupabaseConfigured) {
          try {
            const row = await withTimeout(dbCreateCustomer({ name, email, phone, address }), 3000, 'addCustomer');
            // Update temp ID with real DB ID
            setCustomers((prev) =>
              prev.map((c) => (c.id === tempId ? { ...c, id: (row as any).id } : c))
            );
            return (row as any).id as string;
          } catch (err) {
            logWarn('AppState', `addCustomer persist failed or timed out: ${err}`);
            // Offline-first: queue the insert so it flushes when we're back online
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({
                table: 'customers',
                op: 'insert',
                payload: { id: tempId, name, email, phone, address },
              });
            } catch {}
          }
        }
        markStepComplete('first_customer_added').catch(() => {});
        // R243: fire-and-forget embedding so semantic-customer-search works
        const embedText = [name, email, phone, address].filter(Boolean).join(' ');
        if (embedText.length > 3) {
          import('../services/embeddingService').then((m) =>
            m.embedCustomer({ customerId: tempId, text: embedText }),
          ).catch(() => {});
        }
        return tempId;
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
            // Fire-and-forget index for semantic search (R279 plumbing).
            import('../intelligence/semanticSearch').then(({ indexJobForSearch }) =>
              indexJobForSearch({ id: row.id, title, trade: extra?.trade, description: description ?? null }),
            ).catch(() => {});
            return row.id;
          } catch (err) {
            logWarn('AppState', `addJob persist failed or timed out: ${err}`);
          }
        }
        // Offline / unconfigured path: still index by tempId so keyword fallback works.
        import('../intelligence/semanticSearch').then(({ indexJobForSearch }) =>
          indexJobForSearch({ id: tempId, title, trade: extra?.trade, description: description ?? null }),
        ).catch(() => {});
        // Ontology: create job entity + link to customer
        upsertEntity({ id: tempId, type: 'job', name: title, attributes: { trade: extra?.trade, status: 'lead' }, scores: { reliability: 50, quality: 50, value: extra?.quoted_amount ?? 0, frequency: 0 }, lastUpdated: new Date().toISOString() }).catch(() => {});
        if (customerId) {
          addRelation({ fromId: customerId, fromType: 'customer', toId: tempId, toType: 'job', relationType: 'owns', metadata: {} }).catch(() => {});
        }
        trackEvent('job_created', { jobId: tempId }).catch(() => {});
        markStepComplete('first_job_created').catch(() => {});
        // Auto-sync to device calendar if scheduled
        if (extra?.scheduled_date) {
          import('../services/calendarSyncService').then(({ syncJobToCalendar, getCalendarSyncSettings }) => {
            getCalendarSyncSettings().then((settings) => {
              if (settings.enabled) syncJobToCalendar(newJob).catch(() => {});
            }).catch(() => {});
          }).catch(() => {});
        }
        return tempId;
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
          emitJobStarted(aiUserId, id, {
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
          emitJobCompleted(aiUserId, id, {
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
            recordPricingOutcome(aiUserId, job.quoteId, {
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
              description: `Klus afgerond · €${(estimatedCost).toLocaleString()}`,
              preparedData: { jobId: id, amount: estimatedCost, customer: job.customerId },
              actionLabel: 'Factuur aanmaken',
              estimatedImpact: `€${(estimatedCost).toLocaleString()} omzet`,
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
        if (isSupabaseConfigured && !id.startsWith('j-')) {
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
        if (isSupabaseConfigured && !id.startsWith('j-')) {
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
          updateDocument(id, { status: 'sent', sent_at: now.toISOString() }).catch((err) =>
            logWarn('AppState', `markQuoteSent persist failed: ${err}`)
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
              .eq('user_id', aiUserId)
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
          updateDocument(id, { status: 'sent', sent_at: new Date().toISOString() }).catch((err) =>
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
        emitInvoiceSent(aiUserId, id, {
          customerId: invoice?.customer ?? '',
          amount: invoice?.amount ?? 0,
          dueDate: sentDue.toISOString(),
        }).catch(() => {});
        trackEvent('invoice_sent', { invoiceId: id }).catch(() => {});
        markStepComplete('first_invoice_sent').catch(() => {});
        fireNotification('overdue_invoice', 'medium', 'Invoice sent', `Invoice marked as sent. Share the PDF with your customer.`, `/(contractor)/facturen`);
      },
      markInvoicePaid: (id) => {
        const paidInv = invoices.find((i) => i.id === id);
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === id ? { ...invoice, status: 'paid', dueInDays: 0 } : invoice
          )
        );
        if (isSupabaseConfigured) {
          updateDocument(id, { status: 'paid', paid_at: new Date().toISOString() }).catch((err) =>
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
        emitPaymentReceived(aiUserId, id, {
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
          const docPayload = {
            doc_type: 'quote' as const,
            status: 'draft' as const,
            document_number: docNumber,
            customer_id: customer,
            job_id: job,
            total_amount: total,
          };
          const lineItemPayload = items.map((item, idx) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.unitPrice * item.quantity,
            position: idx,
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
              await queueWrite({ table: 'documents', op: 'insert', payload: docPayload });
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
        emitQuoteCreated(aiUserId, docNumber, {
          customerId: customer,
          totalAmount: total,
          lineItemCount: items.length,
          trade: profTrade,
        }).catch(() => {});
        for (const item of items) {
          recordPricingData(aiUserId, {
            trade: profTrade,
            country: profCountry,
            lineDescription: item.description,
            quotedUnitPrice: item.unitPrice,
            quotedQuantity: item.quantity,
            vatRate: (item as any).vatRate ?? 21,
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
          try {
            const row = await createDocument({
              doc_type: 'invoice',
              status: 'draft',
              document_number: docNumber,
              customer_id: sourceQuote.customer,
              job_id: sourceQuote.job,
              total_amount: sourceQuote.amount,
              due_date: dueDate.toISOString(),
              source_quote_id: sourceQuoteId,
            });
            if (sourceItems.length > 0) {
              await upsertLineItems(
                row.id,
                sourceItems.map((item, idx) => ({
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unitPrice,
                  total_price: item.unitPrice * item.quantity,
                  position: idx,
                })),
              );
            }
          } catch (err) {
            logWarn('AppState', `addInvoice persist failed: ${err}`);
          }
        }

        // AI data collector
        emitInvoiceSent(aiUserId, docNumber, {
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
          deleteDocument(id).catch((err) =>
            logWarn('AppState', `removeQuote persist failed: ${err}`)
          );
        }
      },
      removeInvoice: (id) => {
        setInvoices((prev) => prev.filter((invoice) => invoice.id !== id));
        if (isSupabaseConfigured) {
          deleteDocument(id).catch((err) =>
            logWarn('AppState', `removeInvoice persist failed: ${err}`)
          );
        }
      },
      updateInvoice: (id, updates) => {
        const prev = invoices.find(inv => inv.id === id);
        setInvoices((p) =>
          p.map((inv) => inv.id === id ? { ...inv, ...updates } : inv)
        );
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
        // R282: if the profile edit changes country or trade, sync the
        // module-level currentUser ref so subsequent emit paths read the
        // new specialty/market without waiting for a re-login. Without
        // this, a contractor switching from NL → DE would keep tagging
        // every business event and material write to the old market.
        if (updates.country !== undefined || updates.trade !== undefined) {
          const userId = getCurrentUserId();
          if (userId) {
            setCurrentUser({
              id: userId,
              country: updates.country ?? getCurrentCountry() ?? undefined,
              trade: updates.trade ?? getCurrentTrade() ?? undefined,
            });
          }
        }
        if (isSupabaseConfigured) {
          const dbUpdates: Record<string, string | null> = {};
          if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName || null;
          if (updates.kvkNumber !== undefined) dbUpdates.kvk_number = updates.kvkNumber || null;
          if (updates.vatNumber !== undefined) dbUpdates.vat_number = updates.vatNumber || null;
          if (updates.address !== undefined) dbUpdates.address = updates.address || null;
          if (updates.email !== undefined) dbUpdates.email = updates.email || null;
          if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
          import('../services/offlineWriteQueue').then(({ persistOrQueue }) =>
            persistOrQueue('business_settings', 'upsert', () => upsertBusinessSettings(dbUpdates), { payload: dbUpdates }),
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
              await queueWrite({ table: 'materials', op: 'insert', payload: { id: tempId, ...payload } });
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
        if (isSupabaseConfigured && !id.startsWith('mat-')) {
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
              await queueWrite({ table: 'suppliers', op: 'insert', payload: { id: tempId, ...payload } });
            } catch {}
          }
        }
        return tempId;
      },
      removeSupplier: (id) => {
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        if (isSupabaseConfigured && !id.startsWith('sup-')) {
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
            return (row as any).id as string;
          } catch (err) {
            logWarn('AppState', `addJobMaterial persist failed: ${err}`);
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
        // AI data collector — material purchase event
        emitMaterialPurchased(aiUserId, {
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
        // R237: resolve calibration predictions tied to material/supplier signals.
        if ((jm.unitPrice ?? 0) > 0) {
          import('../intelligence/learningStorage').then((m) =>
            m.resolveOutcomesFromMaterialPurchase(jm.unitPrice ?? 0),
          ).catch(() => {});
        }
        // R243: embed material so cohort-wide similarity search works
        if (matName.length > 2) {
          import('../services/embeddingService').then((m) =>
            m.embedMaterial({ trade, materialName: matName, text: matName }),
          ).catch(() => {});
        }
        return tempId;
      },
      updateJobMaterialStatus: (id, jobId, status) => {
        setJobMaterialsMap((prev) => ({
          ...prev,
          [jobId]: (prev[jobId] ?? []).map((item) =>
            item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
          ),
        }));
        if (isSupabaseConfigured && !id.startsWith('jm-')) {
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
        if (isSupabaseConfigured && !id.startsWith('jm-')) {
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
                vatRate: 21,
              })),
            }
          : undefined;
        const result = await exportInvoiceToMoneybird(invoiceId, payload);
        if (result.success) {
          setLastMoneybirdExport((prev) => ({
            ...prev,
            [invoiceId]: result.exportedAt,
          }));
        } else if (result.error) {
          logWarn('AppState', `Moneybird export failed: ${result.error}`);
        }
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

        const newInvoice: Invoice = {
          id: docNumber,
          customer: job.customerId ?? '',
          job: job.title,
          amount,
          status: 'draft',
          dueInDays: 14,
        };

        setInvoices((prev) => [newInvoice, ...prev]);

        if (isSupabaseConfigured) {
          const invPayload = {
            doc_type: 'invoice' as const,
            status: 'draft' as const,
            document_number: docNumber,
            customer_id: job.customerId ?? undefined,
            job_id: jobId,
            total_amount: amount,
            due_date: dueDate.toISOString(),
          };
          try {
            await withTimeout(createDocument(invPayload), 3000, 'addInvoiceFromJob');
          } catch (err) {
            logWarn('AppState', `addInvoiceFromJob persist failed, queueing: ${err}`);
            try {
              const { queueWrite } = await import('../services/offlineWriteQueue');
              await queueWrite({ table: 'documents', op: 'insert', payload: invPayload });
            } catch {}
          }
        }
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
        emitQuoteAccepted(aiUserId, quoteId, {
          customerId: quote.customer ?? '',
          quotedAmount: quote.amount,
          acceptedAmount: quote.amount,
          daysToAccept: ttdHoursAcc !== undefined ? Math.round(ttdHoursAcc / 24) : 0,
        }).catch(() => {});
        recordPricingOutcome(aiUserId, quoteId, {
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

        if (isSupabaseConfigured) {
          try {
            const row = await dbCreateJob({
              title: newJob.title,
              customer_id: quote.customer,
              quoted_amount: quote.amount,
              agreed_amount: quote.amount,
            });
            setJobs((prev) =>
              prev.map((j) => (j.id === tempId ? { ...j, id: row.id } : j)),
            );
            await updateDocument(quoteId, { status: 'accepted' }).catch(() => {});
            return row.id;
          } catch (err) {
            logWarn('AppState', `convertQuoteToJob persist failed: ${err}`);
          }
        }
        return tempId;
      },

      updateQuote: (id, updates) => {
        const quote = quotes.find(q => q.id === id);
        setQuotes((prev) =>
          prev.map((q) => (q.id === id ? { ...q, ...updates } : q)),
        );
        if (isSupabaseConfigured && !id.startsWith('q-')) {
          const dbUpdates: Record<string, unknown> = {};
          if (updates.amount !== undefined) dbUpdates.total_amount = updates.amount;
          if (updates.status !== undefined) dbUpdates.status = updates.status;
          if (updates.customer !== undefined) dbUpdates.customer_id = updates.customer;
          if (updates.job !== undefined) dbUpdates.job_id = updates.job;
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
          emitQuoteAccepted(aiUserId, id, {
            customerId: quote.customer ?? '',
            quotedAmount: quote.amount,
            acceptedAmount: quote.amount,
            daysToAccept: ttdHoursUp !== undefined ? Math.round(ttdHoursUp / 24) : 0,
          }).catch(() => {});
          recordPricingOutcome(aiUserId, id, {
            wasAccepted: true,
            acceptedPrice: quote.amount,
            timeToDecisionHours: ttdHoursUp,
          }).catch(() => {});
          if (isSupabaseConfigured) {
            dbCreateJob({
              title: autoJob.title,
              customer_id: quote.customer,
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
          emitQuoteRejected(aiUserId, id, {
            customerId: quote.customer ?? '',
            quotedAmount: quote.amount,
            reason: declineReason,
          }).catch(() => {});
          recordPricingOutcome(aiUserId, id, {
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
                customer_id: project.customerId || null,
                status: project.status,
                start_date: project.startDate ?? null,
                target_end_date: project.targetEndDate ?? null,
                total_budget: project.totalBudget,
                address: project.address ?? null,
                milestones: project.milestones ?? [],
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
                    name: project.title,
                    description: project.description,
                    customer_id: project.customerId || null,
                    status: project.status,
                    start_date: project.startDate ?? null,
                    target_end_date: project.targetEndDate ?? null,
                    total_budget: project.totalBudget,
                    address: project.address ?? null,
                    milestones: project.milestones ?? [],
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

        if (isSupabaseConfigured && !id.startsWith('proj-')) {
          (async () => {
            try {
              const { updateProject: dbUpdateProject } = await import('../lib/dataProvider');
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
              if (Object.keys(patch).length > 0) {
                await withTimeout(dbUpdateProject(id, patch), 3000, 'updateProject');
              }
            } catch (err) {
              logWarn('AppState', `updateProject persist failed: ${err}`);
              try {
                const { queueWrite } = await import('../services/offlineWriteQueue');
                const { id: _omit, ...patch } = { id, ...updates } as Record<string, unknown>;
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
        const projectInvoices = invoices.filter((i: any) => project.invoiceIds?.includes(i.id));
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
      createPaymentLink: async (invoiceId, amount) => {
        // Route by contractor country — UK → Stripe (GBP), everyone else → Mollie (EUR).
        const country = getCurrentCountry();
        if (country === 'UK') {
          const { createStripePayment } = await import('../integrations/stripe');
          const result = await createStripePayment(invoiceId, amount, 'UK');
          if (result.success) {
            setLastMolliePayment((prev) => ({ ...prev, [invoiceId]: result.paymentId ?? invoiceId }));
          }
          return;
        }
        const result = await createMolliePayment(invoiceId, amount);
        if (result.success) {
          setLastMolliePayment((prev) => ({ ...prev, [invoiceId]: result.paymentId }));
        }
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
      quotes,
      lastMoneybirdExport,
      lastMolliePayment,
      pendingBudgetExtraction,
      projects,
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

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
