import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { businessProfile as initialBusinessProfile } from '../data/mockBusiness';
import { invoices as initialInvoices, quotes as initialQuotes } from '../data/mockDocuments';
import { quoteLineItems as initialLineItems } from '../data/mockLineItems';
import { ExtractedDocument } from '../ingestion/pdfSchema';
import type { BudgetExtractionResult } from '../ingestion/budgetExtractor';
import { ingestPdfStub } from '../ingestion/ingestionStub';
import { buildPriceRiskSignals } from '../logic/priceRisk';
import { exportInvoiceToMoneybird } from '../integrations/moneybird';
import { createMolliePayment } from '../integrations/mollie';
import { BusinessProfile } from '../domain/business';
import { Customer } from '../domain/customers';
import { Invoice, Quote } from '../domain/documents';
import { Job, JobStatus, JobPriority } from '../domain/jobs';
import { Material, JobMaterial, JobMaterialStatus, PriceObservation } from '../domain/materials';
import { Supplier } from '../domain/suppliers';
import { PriceRiskSignal } from '../domain/insights';
import { QuoteLineItem } from '../domain/lineItems';
import { isSupabaseConfigured } from '../lib/supabase';
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
import { rowToExtractedDocument } from '../ingestion/extractionBridge';

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
  updateJobStatus: (id: string, status: JobStatus) => void;
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
  pendingBudgetExtraction: BudgetExtractionResult | null;
  setPendingBudgetExtraction: (e: BudgetExtractionResult | null) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(
    isSupabaseConfigured ? { isComplete: false, completenessPercent: 0 } : initialBusinessProfile,
  );
  const [quotes, setQuotes] = useState<Quote[]>(isSupabaseConfigured ? [] : initialQuotes);
  const [invoices, setInvoices] = useState<Invoice[]>(isSupabaseConfigured ? [] : initialInvoices);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [extractedDocs, setExtractedDocs] = useState<ExtractedDocument[]>([]);
  const [lineItems, setLineItems] = useState<Record<string, QuoteLineItem[]>>(
    isSupabaseConfigured ? {} : initialLineItems,
  );
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [jobMaterialsMap, setJobMaterialsMap] = useState<Record<string, JobMaterial[]>>({});
  const [priceObsMap, setPriceObsMap] = useState<Record<string, PriceObservation[]>>({});
  const [moneybirdConnected, setMoneybirdConnected] = useState(false);
  const [lastMoneybirdExport, setLastMoneybirdExport] = useState<Record<string, string>>({});
  const [mollieConnected, setMollieConnected] = useState(false);
  const [lastMolliePayment, setLastMolliePayment] = useState<Record<string, string>>({});
  const [pendingBudgetExtraction, setPendingBudgetExtraction] = useState<BudgetExtractionResult | null>(null);

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
          console.warn('[AppState] loadExtractedDocs failed:', err);
        }
      }
    } catch (err) {
      console.warn('[AppState] refreshData failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load from Supabase on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

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
            const row = await dbCreateCustomer({ name, email, phone, address });
            // Update temp ID with real DB ID
            setCustomers((prev) =>
              prev.map((c) => (c.id === tempId ? { ...c, id: (row as any).id } : c))
            );
            return (row as any).id as string;
          } catch (err) {
            console.warn('[AppState] addCustomer persist failed:', err);
          }
        }
        return tempId;
      },
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

        if (isSupabaseConfigured) {
          try {
            const row = await dbCreateJob({
              title,
              customer_id: customerId,
              description,
              ...extra,
            });
            setJobs((prev) =>
              prev.map((j) => (j.id === tempId ? { ...j, id: row.id } : j)),
            );
            return row.id;
          } catch (err) {
            console.warn('[AppState] addJob persist failed:', err);
          }
        }
        return tempId;
      },
      updateJobStatus: (id, status) => {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id ? { ...j, status, updatedAt: new Date().toISOString() } : j,
          ),
        );
        if (isSupabaseConfigured) {
          dbUpdateJob(id, { status }).catch((err) =>
            console.warn('[AppState] updateJobStatus persist failed:', err),
          );
        }
      },
      removeJob: (id) => {
        setJobs((prev) => prev.filter((j) => j.id !== id));
        if (isSupabaseConfigured) {
          dbDeleteJob(id).catch((err) =>
            console.warn('[AppState] removeJob persist failed:', err),
          );
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
      markQuoteSent: (id) => {
        setQuotes((prev) =>
          prev.map((quote) =>
            quote.id === id ? { ...quote, status: 'sent', lastUpdated: 'Just now' } : quote
          )
        );
        if (isSupabaseConfigured) {
          updateDocument(id, { status: 'sent', sent_at: new Date().toISOString() }).catch((err) =>
            console.warn('[AppState] markQuoteSent persist failed:', err)
          );
        }
      },
      markInvoiceSent: (id) => {
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === id ? { ...invoice, status: 'sent', dueInDays: 14 } : invoice
          )
        );
        if (isSupabaseConfigured) {
          updateDocument(id, { status: 'sent', sent_at: new Date().toISOString() }).catch((err) =>
            console.warn('[AppState] markInvoiceSent persist failed:', err)
          );
        }
      },
      markInvoicePaid: (id) => {
        setInvoices((prev) =>
          prev.map((invoice) =>
            invoice.id === id ? { ...invoice, status: 'paid', dueInDays: 0 } : invoice
          )
        );
        if (isSupabaseConfigured) {
          updateDocument(id, { status: 'paid', paid_at: new Date().toISOString() }).catch((err) =>
            console.warn('[AppState] markInvoicePaid persist failed:', err)
          );
        }
      },
      addQuote: async (customer, job, items) => {
        const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
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

        // Persist to Supabase
        if (isSupabaseConfigured) {
          try {
            const row = await createDocument({
              doc_type: 'quote',
              status: 'draft',
              document_number: docNumber,
              customer_id: customer,
              job_id: job,
              total_amount: total,
            });
            await upsertLineItems(
              row.id,
              items.map((item, idx) => ({
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.unitPrice * item.quantity,
                position: idx,
              })),
            );
          } catch (err) {
            console.warn('[AppState] addQuote persist failed:', err);
          }
        }

        return docNumber;
      },

      addInvoice: async (sourceQuoteId) => {
        const sourceQuote = quotes.find((q) => q.id === sourceQuoteId);
        if (!sourceQuote) throw new Error(`Quote ${sourceQuoteId} not found`);

        const docNumber = await nextDocumentNumber('invoice');
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

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
            console.warn('[AppState] addInvoice persist failed:', err);
          }
        }

        return docNumber;
      },

      removeQuote: (id) => {
        setQuotes((prev) => prev.filter((quote) => quote.id !== id));
        if (isSupabaseConfigured) {
          deleteDocument(id).catch((err) =>
            console.warn('[AppState] removeQuote persist failed:', err)
          );
        }
      },
      removeInvoice: (id) => {
        setInvoices((prev) => prev.filter((invoice) => invoice.id !== id));
        if (isSupabaseConfigured) {
          deleteDocument(id).catch((err) =>
            console.warn('[AppState] removeInvoice persist failed:', err)
          );
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
        if (isSupabaseConfigured) {
          const dbUpdates: Record<string, string | null> = {};
          if (updates.businessName !== undefined) dbUpdates.business_name = updates.businessName || null;
          if (updates.kvkNumber !== undefined) dbUpdates.kvk_number = updates.kvkNumber || null;
          if (updates.vatNumber !== undefined) dbUpdates.vat_number = updates.vatNumber || null;
          if (updates.address !== undefined) dbUpdates.address = updates.address || null;
          if (updates.email !== undefined) dbUpdates.email = updates.email || null;
          if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
          upsertBusinessSettings(dbUpdates).catch((err) =>
            console.warn('[AppState] updateBusinessProfile persist failed:', err)
          );
        }
      },
      addMaterial: async (material) => {
        const tempId = `mat-${Date.now()}`;
        const now = new Date().toISOString();
        const newMaterial: Material = { ...material, id: tempId, createdAt: now, updatedAt: now };
        setMaterials((prev) => [newMaterial, ...prev]);

        if (isSupabaseConfigured) {
          try {
            const row = await dbCreateMaterial({
              name: material.name,
              category: material.category,
              brand: material.brand,
              base_unit: material.baseUnit,
            });
            setMaterials((prev) =>
              prev.map((m) => (m.id === tempId ? { ...m, id: (row as any).id } : m)),
            );
            return (row as any).id as string;
          } catch (err) {
            console.warn('[AppState] addMaterial persist failed:', err);
          }
        }
        return tempId;
      },
      removeMaterial: (id) => {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        if (isSupabaseConfigured) {
          dbDeleteMaterial(id).catch((err) =>
            console.warn('[AppState] removeMaterial persist failed:', err),
          );
        }
      },
      addSupplier: async (supplier) => {
        const tempId = `sup-${Date.now()}`;
        const now = new Date().toISOString();
        const newSupplier: Supplier = { ...supplier, id: tempId, createdAt: now, updatedAt: now };
        setSuppliers((prev) => [newSupplier, ...prev]);

        if (isSupabaseConfigured) {
          try {
            const row = await dbCreateSupplier({
              name: supplier.name,
              account_status: supplier.accountStatus,
            });
            setSuppliers((prev) =>
              prev.map((s) => (s.id === tempId ? { ...s, id: (row as any).id } : s)),
            );
            return (row as any).id as string;
          } catch (err) {
            console.warn('[AppState] addSupplier persist failed:', err);
          }
        }
        return tempId;
      },
      removeSupplier: (id) => {
        setSuppliers((prev) => prev.filter((s) => s.id !== id));
        if (isSupabaseConfigured) {
          dbDeleteSupplier(id).catch((err) =>
            console.warn('[AppState] removeSupplier persist failed:', err),
          );
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
            console.warn('[AppState] addJobMaterial persist failed:', err);
          }
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
        if (isSupabaseConfigured) {
          dbUpdateJobMaterial(id, { status }).catch((err) =>
            console.warn('[AppState] updateJobMaterialStatus persist failed:', err),
          );
        }
      },
      removeJobMaterial: (id, jobId) => {
        setJobMaterialsMap((prev) => ({
          ...prev,
          [jobId]: (prev[jobId] ?? []).filter((item) => item.id !== id),
        }));
        if (isSupabaseConfigured) {
          dbDeleteJobMaterial(id).catch((err) =>
            console.warn('[AppState] removeJobMaterial persist failed:', err),
          );
        }
      },
      connectMoneybird: () => setMoneybirdConnected(true),
      exportInvoice: async (invoiceId) => {
        const result = await exportInvoiceToMoneybird(invoiceId);
        if (result.success) {
          setLastMoneybirdExport((prev) => ({
            ...prev,
            [invoiceId]: result.exportedAt,
          }));
        }
      },
      pendingBudgetExtraction,
      setPendingBudgetExtraction,
      connectMollie: () => setMollieConnected(true),
      createPaymentLink: async (invoiceId, amount) => {
        const result = await createMolliePayment(invoiceId, amount);
        if (result.success) {
          setLastMolliePayment((prev) => ({
            ...prev,
            [invoiceId]: result.paymentId,
          }));
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
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}
