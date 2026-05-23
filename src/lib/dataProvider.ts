import { supabase, isSupabaseConfigured } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logWarn } from '../utils/errorHandler';
import { isUuid } from './idShape';
import type { DocumentRow, LineItemRow, BusinessSettingsRow, CustomerRow, MaterialCatalogRow, SupplierRow, JobMaterialRow, PriceObservationRow, ProjectRow, ExpenseRow, QuoteAcceptanceLinkRow, DecisionTrackerRow, DecisionItemRow, LeadRow, WorkerRow } from './database.types';
import { quotes as mockQuotes, invoices as mockInvoices } from '../data/mockDocuments';
import { quoteLineItems as mockLineItems } from '../data/mockLineItems';
import { businessProfile as mockBusinessProfile } from '../data/mockBusiness';
import { jobs as mockJobs } from '../data/mockJobs';
import { customers as mockCustomers } from '../data/mockCustomers';
import { materials as mockMaterialList } from '../data/mockMaterials';
import { suppliers as mockSupplierList } from '../data/mockSuppliers';
import { jobMaterials as mockJobMaterialMap } from '../data/mockJobMaterials';
import { priceObservations as mockPriceObsMap } from '../data/mockPriceObservations';
import {
  documentRowToQuote,
  documentRowToInvoice,
  businessSettingsToProfile,
  customerRowToCustomer,
  jobRowToJob,
  materialCatalogRowToMaterial,
  supplierRowToSupplier,
  jobMaterialRowToJobMaterial,
  priceObservationRowToPriceObservation,
  leadRowToLead,
  workerRowToWorker,
} from './mappers';
import type { Quote, Invoice } from '../domain/documents';
import type { QuoteLineItem } from '../domain/lineItems';
import type { BusinessProfile } from '../domain/business';
import type { Customer } from '../domain/customers';
import type { Job } from '../domain/jobs';
import type { Material, JobMaterial, PriceObservation } from '../domain/materials';
import type { Supplier } from '../domain/suppliers';
import type { Lead } from '../domain/lead';
import type { Worker } from '../domain/worker';
import type { JobRow } from './database.types';

// ── Helpers ──────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error('Not authenticated');
    return data.user.id;
  } catch {
    // Supabase unreachable or user not authenticated — use local fallback
    const profile = await AsyncStorage.getItem('@vasco_user_profile').catch(() => null);
    if (profile) {
      const parsed = JSON.parse(profile);
      if (parsed.id) return parsed.id;
    }
    throw new Error('Not authenticated');
  }
}

// ── Documents ────────────────────────────────────────────────

export async function listDocuments(docType: 'quote' | 'invoice'): Promise<DocumentRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('doc_type', docType)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as DocumentRow[];
}

export async function createDocument(
  doc: { doc_type: 'quote' | 'invoice'; status: 'draft' | 'sent' | 'paid' } & Record<string, unknown>,
): Promise<DocumentRow> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('documents')
    .insert({ ...doc, user_id: userId } as any)
    .select()
    .single();

  if (error) throw error;
  return data as DocumentRow;
}

// R57: shape-detect to route on the right column. addQuote / addInvoice
// expose `docNumber` (e.g. `Q-260001`) as the FE id, but `documents.id` is
// a uuid. Pre-R57 every `.eq('id', docNumber)` matched 0 rows on BE, so
// markQuoteSent / markInvoiceSent / markInvoicePaid / updateQuote /
// updateInvoice / removeQuote / removeInvoice / convertQuoteToJob silently
// failed to persist. The contractor's UI showed the new status; refresh
// from BE wiped it. This is the longest-standing latent bug in the audit.
//
// Dual-route is a non-breaking fix: if the value parses as a uuid, match
// by `id`; otherwise treat it as `document_number` and match by that
// (unique per (user_id, doc_type) under RLS, so the equality is safe).
// R59: UUID_RE moved to src/lib/idShape.ts.

function documentMatchColumn(idOrNumber: string): 'id' | 'document_number' {
  return isUuid(idOrNumber) ? 'id' : 'document_number';
}

export async function updateDocument(
  idOrNumber: string,
  updates: Record<string, unknown>,
): Promise<DocumentRow> {
  const col = documentMatchColumn(idOrNumber);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- types will be regenerated from Supabase CLI
  const { data, error } = await (supabase.from('documents') as any)
    .update(updates)
    .eq(col, idOrNumber)
    .select()
    .single();

  if (error) throw error;
  return data as DocumentRow;
}

// R66 round 8: soft-delete for invoices (Belastingdienst Art. 52 AWR / GoBD
// §147 HGB require 7-10 year retention of tax records). Quotes pre-acceptance
// aren't tax records and may still be hard-deleted. Caller indicates intent
// via the `docType` arg — when omitted, we look up the row first to decide.
// Migration `20260507000001_documents_soft_delete.sql` adds `deleted_at` plus
// updated RLS that filters soft-deleted rows from the SELECT policy.
export async function deleteDocument(
  idOrNumber: string,
  docType?: 'quote' | 'invoice',
): Promise<void> {
  const col = documentMatchColumn(idOrNumber);

  // Resolve docType when caller didn't pass it.
  let resolvedType = docType;
  if (!resolvedType) {
    const { data, error: lookupError } = await supabase
      .from('documents')
      .select('doc_type')
      .eq(col, idOrNumber)
      .maybeSingle();
    if (lookupError) throw lookupError;
    resolvedType = ((data as { doc_type?: 'quote' | 'invoice' } | null)?.doc_type) ?? 'quote';
  }

  if (resolvedType === 'invoice') {
    // Soft delete: set deleted_at, leave row intact for audit / compliance.
    const { error } = await (supabase.from('documents') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq(col, idOrNumber);
    if (error) throw error;
    return;
  }
  // Quotes: hard delete is fine.
  const { error } = await supabase.from('documents').delete().eq(col, idOrNumber);
  if (error) throw error;
}

// ── Line Items ───────────────────────────────────────────────

export async function listLineItems(documentId: string): Promise<LineItemRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('line_items')
    .select('*')
    .eq('document_id', documentId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []) as LineItemRow[];
}

export async function upsertLineItems(
  documentId: string,
  items: { description: string; quantity?: number; unit_price?: number; total_price?: number; position?: number }[],
): Promise<LineItemRow[]> {
  const userId = await getUserId();
  const rows = items.map((item) => ({
    ...item,
    user_id: userId,
    document_id: documentId,
  }));

  const { data, error } = await supabase
    .from('line_items')
    .upsert(rows as any)
    .select();

  if (error) throw error;
  return (data ?? []) as LineItemRow[];
}

// ── Customers ────────────────────────────────────────────────

export async function listCustomers() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(customer: { name: string; email?: string; phone?: string; address?: string }) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('customers')
    .insert({ ...customer, user_id: userId } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCustomer(id: string, updates: { name?: string; email?: string; phone?: string; address?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('customers') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// R45: was missing — AppState had no path to delete a customer. RLS scopes
// to user_id so a contractor can only delete rows they own.
export async function deleteCustomer(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('customers') as any).delete().eq('id', id);
  if (error) throw error;
}

// ── Business Settings ────────────────────────────────────────

export async function getBusinessSettings(): Promise<BusinessSettingsRow | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('business_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as BusinessSettingsRow | null;
}

export async function upsertBusinessSettings(
  settings: Partial<Omit<BusinessSettingsRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<BusinessSettingsRow> {
  const userId = await getUserId();
  const existing = await getBusinessSettings();

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('business_settings') as any)
      .update(settings)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as BusinessSettingsRow;
  }

  const { data, error } = await supabase
    .from('business_settings')
    .insert({ ...settings, user_id: userId } as any)
    .select()
    .single();
  if (error) throw error;
  return data as BusinessSettingsRow;
}

// ── Jobs ─────────────────────────────────────────────────────

export async function listJobs() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getJob(id: string) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createJob(
  job: {
    title: string;
    customer_id?: string | null;
    description?: string | null;
    status?: string;
    address_street?: string | null;
    address_city?: string | null;
    address_postcode?: string | null;
    address_country?: string | null;
    scheduled_date?: string | null;
    estimated_duration?: number | null;
    quoted_amount?: number | null;
    agreed_amount?: number | null;
    trade?: string | null;
    priority?: string | null;
  },
): Promise<JobRow> {
  const userId = await getUserId();
  const { title, customer_id, description, status, ...rest } = job;
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      title,
      customer_id: customer_id ?? null,
      description: description ?? null,
      status: status ?? 'lead',
      user_id: userId,
      ...rest,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as JobRow;
}

export async function updateJob(
  id: string,
  updates: Record<string, unknown>,
): Promise<JobRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('jobs') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as JobRow;
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
}

// ── Projects (R275 — promoted from AsyncStorage to BE-backed) ───────────────

export type { ProjectRow };

export async function listProjects(): Promise<ProjectRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectRow[];
}

export async function createProject(
  project: {
    name: string;
    description?: string | null;
    customer_id?: string | null;
    status?: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
    start_date?: string | null;
    target_end_date?: string | null;
    total_budget?: number | null;
    address?: { street?: string; city?: string; postcode?: string; country?: string } | null;
    milestones?: unknown[];
  },
): Promise<ProjectRow> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('projects')
    .insert({
      ...project,
      status: project.status ?? 'planning',
      user_id: userId,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function updateProject(
  id: string,
  updates: Record<string, unknown>,
): Promise<ProjectRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('projects') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// ── Document Numbering ───────────────────────────────────────

// R66r62: offline-mint placeholder prefix. When Supabase is unreachable we
// can NO LONGER mint a Q0008-style canonical number locally — if two
// devices both mint Q0008 while offline, the BE rejects one with 23505 on
// reconnect (R66.36 audit finding). Instead we mint Q-OFF-<6 hex chars>
// which is distinctly NOT in the BE sequence; the offline write queue
// (offlineWriteQueue.applyWrite) detects this prefix at flush time, calls
// the canonical next_document_number RPC, swaps the placeholder for the
// real number, broadcasts via docNumberRemapBus so the local row updates,
// and only then performs the insert. Net effect: no collision possible,
// numbering stays gap-free + sequential, contractor sees the canonical
// number once back online.
export const OFFLINE_DOC_NUMBER_PREFIX = { quote: 'Q-OFF-', invoice: 'I-OFF-' } as const;

export function isOfflineMintedDocNumber(num: string | undefined): boolean {
  if (!num) return false;
  return num.startsWith('Q-OFF-') || num.startsWith('I-OFF-');
}

function offlineMintedDocNumber(docType: 'quote' | 'invoice'): string {
  // 6 hex chars (24 bits) is enough — collision probability for a single
  // user across their per-device offline session is negligible.
  const hex = Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('').toUpperCase();
  return `${OFFLINE_DOC_NUMBER_PREFIX[docType]}${hex}`;
}

export async function nextDocumentNumber(docType: 'quote' | 'invoice'): Promise<string> {
  if (!isSupabaseConfigured) {
    // Demo / unconfigured — placeholder still distinct from BE sequence
    // so a future BE migration sees these and can resolve.
    return offlineMintedDocNumber(docType);
  }

  // Retry on 23505 (unique_violation) — brief races between two devices can
  // both mint the same next-counter; the RPC or unique index will reject the
  // dupe and we try again up to 3 times.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data, error } = await supabase.rpc('next_document_number', { p_doc_type: docType } as any);
      if (error) {
        if ((error as any).code === '23505' && attempt < 2) continue;
        throw error;
      }
      return data as string;
    } catch (err) {
      if ((err as any)?.code === '23505' && attempt < 2) continue;
      break;
    }
  }
  // Supabase unreachable (paused/offline) — return a Q-OFF-/I-OFF- placeholder.
  // R66r62: pre-r62 we incremented a local @vasco_doc_counter and minted a
  // canonical Q0008-style number; two offline devices could mint the same
  // Q0008 → BE 23505 on reconnect → contractor saw a generic "could not save"
  // error. Now: placeholder distinct from BE sequence; offlineWriteQueue
  // swaps to real number at flush time via the RPC.
  return offlineMintedDocNumber(docType);
}

// ── Aggregate loaders (for AppState) ─────────────────────────

export async function loadQuotes(): Promise<Quote[]> {
  if (!isSupabaseConfigured) return mockQuotes;
  const rows = await listDocuments('quote');
  return rows.map(documentRowToQuote);
}

export async function loadInvoices(): Promise<Invoice[]> {
  if (!isSupabaseConfigured) return mockInvoices;
  const rows = await listDocuments('invoice');
  return rows.map(documentRowToInvoice);
}

export async function loadLineItems(): Promise<Record<string, QuoteLineItem[]>> {
  if (!isSupabaseConfigured) return mockLineItems;

  // Fetch all user's line items in one query, group by document_number
  const { data, error } = await (supabase.from('line_items') as any)
    .select('*, documents!inner(document_number)')
    .order('position', { ascending: true });

  if (error) {
    logWarn('dataProvider', `loadLineItems failed: ${error}`);
    return {};
  }

  const grouped: Record<string, QuoteLineItem[]> = {};
  for (const row of (data ?? []) as any[]) {
    const docNum = row.documents?.document_number ?? row.document_id;
    if (!grouped[docNum]) grouped[docNum] = [];
    grouped[docNum].push({
      id: row.id,
      description: row.description,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    });
  }
  return grouped;
}

export async function loadBusinessProfile(): Promise<BusinessProfile> {
  if (!isSupabaseConfigured) return mockBusinessProfile;
  const row = await getBusinessSettings();
  return businessSettingsToProfile(row);
}

export async function loadCustomers(): Promise<Customer[]> {
  if (!isSupabaseConfigured) return mockCustomers;
  const rows = await listCustomers();
  return (rows as CustomerRow[]).map(customerRowToCustomer);
}

export async function loadJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) return mockJobs;
  const rows = await listJobs();
  return (rows as JobRow[]).map(jobRowToJob);
}

// R96 — leads cold-start hydration. Mirror loadCustomers; demo mode
// returns empty since there's no mockLeads fixture (R81 didn't add one).
export async function loadLeads(): Promise<Lead[]> {
  if (!isSupabaseConfigured) return [];
  // Brand-new table — supabase typegen hasn't picked it up yet, so cast.
  const { data, error } = await (supabase.from('leads') as any)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logWarn('loadLeads', `failed: ${error.message}`);
    return [];
  }
  return (data ?? []).map((row: LeadRow) => leadRowToLead(row));
}

// R96 — workers cold-start hydration. Same shape as leads — RLS handles
// the user_id filter so the SELECT is unfiltered client-side.
export async function loadWorkers(): Promise<Worker[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await (supabase.from('workers') as any)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logWarn('loadWorkers', `failed: ${error.message}`);
    return [];
  }
  return (data ?? []).map((row: WorkerRow) => workerRowToWorker(row));
}

// ── Materials ───────────────────────────────────────────────

export async function listMaterials(): Promise<MaterialCatalogRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('material_catalog')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as MaterialCatalogRow[];
}

export async function createMaterial(
  material: { name: string; category?: string; brand?: string; base_unit?: string } & Record<string, unknown>,
): Promise<MaterialCatalogRow> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('material_catalog')
    .insert({ ...material, user_id: userId } as any)
    .select()
    .single();

  if (error) throw error;
  return data as MaterialCatalogRow;
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('material_catalog').delete().eq('id', id);
  if (error) throw error;
}

export async function loadMaterials(): Promise<Material[]> {
  if (!isSupabaseConfigured) return mockMaterialList;
  const rows = await listMaterials();
  return rows.map(materialCatalogRowToMaterial);
}

// ── Suppliers ───────────────────────────────────────────────

export async function listSuppliers(): Promise<SupplierRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(
  supplier: { name: string; account_status?: string } & Record<string, unknown>,
): Promise<SupplierRow> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ ...supplier, user_id: userId } as any)
    .select()
    .single();

  if (error) throw error;
  return data as SupplierRow;
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);
  if (error) throw error;
}

export async function loadSuppliers(): Promise<Supplier[]> {
  if (!isSupabaseConfigured) return mockSupplierList;
  const rows = await listSuppliers();
  return rows.map(supplierRowToSupplier);
}

// ── Job Materials ───────────────────────────────────────────

export async function listJobMaterials(): Promise<JobMaterialRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('job_materials')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as JobMaterialRow[];
}

export async function createJobMaterial(
  jm: { job_id: string; material_id: string; quantity?: number; unit?: string; unit_price?: number; total_price?: number; supplier_id?: string; status?: string; notes?: string },
): Promise<JobMaterialRow> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('job_materials')
    .insert({ ...jm, user_id: userId } as any)
    .select()
    .single();

  if (error) throw error;
  return data as JobMaterialRow;
}

export async function updateJobMaterial(
  id: string,
  updates: Record<string, unknown>,
): Promise<JobMaterialRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('job_materials') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as JobMaterialRow;
}

export async function deleteJobMaterial(id: string): Promise<void> {
  const { error } = await supabase.from('job_materials').delete().eq('id', id);
  if (error) throw error;
}

export async function loadJobMaterials(): Promise<Record<string, JobMaterial[]>> {
  if (!isSupabaseConfigured) return mockJobMaterialMap;

  const rows = await listJobMaterials();
  const grouped: Record<string, JobMaterial[]> = {};
  for (const row of rows) {
    const jm = jobMaterialRowToJobMaterial(row);
    if (!grouped[jm.jobId]) grouped[jm.jobId] = [];
    grouped[jm.jobId].push(jm);
  }
  return grouped;
}

// ── Price Observations ──────────────────────────────────────

export async function createPriceObservation(
  obs: {
    material_name: string;
    supplier_name?: string;
    price: number;
    unit?: string;
    source?: string;
    confidence?: number;
    observed_at?: string;
  },
): Promise<PriceObservationRow | null> {
  if (!isSupabaseConfigured) return null;

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('price_observations')
    // R54 audit: `material_id` here is a placeholder uuid generated client-side
    // because callers don't pass a catalog link. This breaks any join from
    // `price_observations.material_id ↔ materials.id`. The function is currently
    // dormant (zero non-internal callers) — the canonical pricing-moat path is
    // `emitMaterialPurchased` → `material_price_history` (R241/R275/R283). If
    // resurrecting, accept material_id as input and surface a clear schema
    // contract; do NOT keep the random-uuid fallback.
    .insert({
      user_id: userId,
      material_id: crypto.randomUUID?.() ?? userId,
      material_name: obs.material_name,
      supplier_name: obs.supplier_name ?? null,
      price: obs.price,
      currency: 'EUR',
      unit: obs.unit ?? 'stuk',
      source: obs.source ?? 'job_completion',
      confidence: obs.confidence ?? 1.0,
      observed_at: obs.observed_at ?? new Date().toISOString(),
    } as any)
    .select()
    .single();

  if (error) {
    logWarn('dataProvider', `createPriceObservation failed: ${error}`);
    return null;
  }
  return data as PriceObservationRow;
}

export async function createPriceObservationsBatch(
  observations: Array<{
    material_name: string;
    supplier_name?: string;
    price: number;
    unit?: string;
    source?: string;
    observed_at?: string;
  }>,
): Promise<number> {
  if (!isSupabaseConfigured || observations.length === 0) return 0;

  const userId = await getUserId();
  const rows = observations.map(obs => ({
    user_id: userId,
    material_id: crypto.randomUUID?.() ?? userId,
    material_name: obs.material_name,
    supplier_name: obs.supplier_name ?? null,
    price: obs.price,
    currency: 'EUR',
    unit: obs.unit ?? 'stuk',
    source: obs.source ?? 'job_completion',
    confidence: 1.0,
    observed_at: obs.observed_at ?? new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from('price_observations')
    .insert(rows as any);

  if (error) {
    logWarn('dataProvider', `createPriceObservationsBatch failed: ${error}`);
    return 0;
  }
  return count ?? observations.length;
}

export async function loadPriceObservations(): Promise<Record<string, PriceObservation[]>> {
  if (!isSupabaseConfigured) return mockPriceObsMap;

  const { data, error } = await supabase
    .from('price_observations')
    .select('*')
    .order('observed_at', { ascending: false });

  if (error) {
    logWarn('dataProvider', `loadPriceObservations failed: ${error}`);
    return {};
  }

  const grouped: Record<string, PriceObservation[]> = {};
  for (const row of (data ?? []) as PriceObservationRow[]) {
    const po = priceObservationRowToPriceObservation(row);
    if (!grouped[po.materialId]) grouped[po.materialId] = [];
    grouped[po.materialId].push(po);
  }
  return grouped;
}

/** Loads price history grouped by "materialName|supplierName" key for anomaly detection */
export async function loadPriceHistoryByMaterialSupplier(): Promise<
  Record<string, Array<{ price: number; observedAt: string }>>
> {
  if (!isSupabaseConfigured) {
    // Build from mock data
    const result: Record<string, Array<{ price: number; observedAt: string }>> = {};
    for (const [, observations] of Object.entries(mockPriceObsMap)) {
      for (const obs of observations) {
        const key = `${obs.materialName}|${obs.supplierName ?? 'onbekend'}`;
        if (!result[key]) result[key] = [];
        result[key].push({ price: obs.price, observedAt: obs.observedAt });
      }
    }
    return result;
  }

  const { data, error } = await supabase
    .from('price_observations')
    .select('material_name, supplier_name, price, observed_at')
    .order('observed_at', { ascending: true });

  if (error) {
    logWarn('dataProvider', `loadPriceHistoryByMaterialSupplier failed: ${error}`);
    return {};
  }

  const result: Record<string, Array<{ price: number; observedAt: string }>> = {};
  for (const row of (data ?? []) as any[]) {
    const key = `${row.material_name}|${row.supplier_name ?? 'onbekend'}`;
    if (!result[key]) result[key] = [];
    result[key].push({ price: Number(row.price), observedAt: row.observed_at });
  }
  return result;
}

// ── Expenses ────────────────────────────────────────────────
// R66 round 14: promoted from AsyncStorage-only to BE-backed for NL
// Belastingdienst Art. 52 AWR 7-year retention compliance.

export async function listExpenses(): Promise<ExpenseRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExpenseRow[];
}

export async function createExpense(
  expense: Omit<ExpenseRow, 'id' | 'user_id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<ExpenseRow> {
  const userId = await getUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('expenses') as any)
    .insert({ ...expense, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as ExpenseRow;
}

export async function deleteExpense(id: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('expenses') as any).delete().eq('id', id);
  if (error) throw error;
}

// ── Quote Acceptance Links ──────────────────────────────────
// R66 round 20: capability-URL helpers backing customerQuoteAcceptanceService.
// `getAcceptanceLinkByToken` is the only call the customer (anon) makes —
// the rest are contractor-authenticated. Anon SELECT is enabled by RLS
// `qal_select_by_token`; the token in the eq() filter is the bearer cred.

export async function createAcceptanceLink(payload: {
  token: string;
  quote_id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  quote_amount: number;
  quote_description?: string | null;
  expires_at: string;
}): Promise<QuoteAcceptanceLinkRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('quote_acceptance_links') as any)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as QuoteAcceptanceLinkRow;
}

export async function getAcceptanceLinkByToken(token: string): Promise<QuoteAcceptanceLinkRow | null> {
  const { data, error } = await supabase
    .from('quote_acceptance_links')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error) {
    logWarn('dataProvider', `getAcceptanceLinkByToken failed: ${error.message ?? error}`);
    return null;
  }
  return (data as QuoteAcceptanceLinkRow | null) ?? null;
}

export async function getAcceptanceLinkByQuoteId(quoteId: string): Promise<QuoteAcceptanceLinkRow | null> {
  // Contractor-side: returns the most recent link for a quote. RLS scopes
  // to user_id automatically.
  const { data, error } = await supabase
    .from('quote_acceptance_links')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as QuoteAcceptanceLinkRow | null) ?? null;
}

export async function decideAcceptanceLink(
  token: string,
  decision: 'accepted' | 'rejected',
  declineReason?: string,
): Promise<QuoteAcceptanceLinkRow | null> {
  const patch: Record<string, unknown> = {
    status: decision,
    responded_at: new Date().toISOString(),
  };
  if (decision === 'rejected' && declineReason) patch.decline_reason = declineReason;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('quote_acceptance_links') as any)
    .update(patch)
    .eq('token', token)
    .select()
    .maybeSingle();
  if (error) {
    logWarn('dataProvider', `decideAcceptanceLink failed: ${error.message ?? error}`);
    return null;
  }
  return (data as QuoteAcceptanceLinkRow | null) ?? null;
}

// ── Decision Trackers (customer decision portal) ────────────
// R66 round 32: capability-URL helpers backing decisionTrackerService.
// `getPortalByAccessCode` is the only call the customer (anon) makes —
// it routes through SECURITY DEFINER RPC so no table-level anon SELECT
// is granted. Contractor-side create/list go through standard RLS
// (auth.uid() = user_id).

export async function createDecisionTracker(payload: {
  user_id: string;
  job_id: string;
  customer_id: string;
  access_code: string;
  template_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  project_name?: string | null;
  project_start_date?: string | null;
  quote_amount?: number | null;
  deposit_amount?: number | null;
  expires_at?: string | null;
}): Promise<DecisionTrackerRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('decision_trackers') as any)
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as DecisionTrackerRow;
}

export async function createDecisionItems(rows: Array<{
  tracker_id: string;
  category: string;
  label: string;
  help_text?: string | null;
  input_type?: string | null;
  options?: unknown;
  is_required?: boolean | null;
  due_date?: string | null;
  sort_order?: number | null;
}>): Promise<DecisionItemRow[]> {
  if (rows.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('decision_items') as any)
    .insert(rows)
    .select();
  if (error) throw error;
  return (data ?? []) as DecisionItemRow[];
}

export async function getPortalByAccessCode(accessCode: string): Promise<unknown | null> {
  if (!isSupabaseConfigured) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('get_portal_by_access_code', {
    p_access_code: accessCode,
  });
  if (error) {
    logWarn('dataProvider', `getPortalByAccessCode failed: ${error.message ?? error}`);
    return null;
  }
  return data ?? null;
}
