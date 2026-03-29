import { supabase, isSupabaseConfigured } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logWarn } from '../utils/errorHandler';
import type { DocumentRow, LineItemRow, BusinessSettingsRow, CustomerRow, MaterialCatalogRow, SupplierRow, JobMaterialRow, PriceObservationRow } from './database.types';
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
} from './mappers';
import type { Quote, Invoice } from '../domain/documents';
import type { QuoteLineItem } from '../domain/lineItems';
import type { BusinessProfile } from '../domain/business';
import type { Customer } from '../domain/customers';
import type { Job } from '../domain/jobs';
import type { Material, JobMaterial, PriceObservation } from '../domain/materials';
import type { Supplier } from '../domain/suppliers';
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

export async function updateDocument(
  id: string,
  updates: Record<string, unknown>,
): Promise<DocumentRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- types will be regenerated from Supabase CLI
  const { data, error } = await (supabase.from('documents') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as DocumentRow;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('documents').delete().eq('id', id);
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

// ── Document Numbering ───────────────────────────────────────

export async function nextDocumentNumber(docType: 'quote' | 'invoice'): Promise<string> {
  if (!isSupabaseConfigured) {
    const storageKey = `@vasco_doc_counter_${docType}`;
    const prefix = docType === 'quote' ? 'Q' : 'INV';
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const current = raw ? parseInt(raw, 10) : 0;
      const next = current + 1;
      await AsyncStorage.setItem(storageKey, String(next));
      return `${prefix}-${yearSuffix}${String(next).padStart(4, '0')}`;
    } catch {
      // Fallback: use timestamp-based to avoid collisions
      return `${prefix}-${yearSuffix}${String(Date.now()).slice(-6)}`;
    }
  }

  try {
    const { data, error } = await supabase.rpc('next_document_number', { p_doc_type: docType } as any);
    if (error) throw error;
    return data as string;
  } catch {
    // Supabase unreachable (paused/offline) — fallback to local counter
    const storageKey = `@vasco_doc_counter_${docType}`;
    const prefix = docType === 'quote' ? 'Q' : 'INV';
    const yearSuffix = new Date().getFullYear().toString().slice(-2);
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const current = raw ? parseInt(raw, 10) : 0;
      const next = current + 1;
      await AsyncStorage.setItem(storageKey, String(next));
      return `${prefix}-${yearSuffix}${String(next).padStart(4, '0')}`;
    } catch {
      return `${prefix}-${yearSuffix}${String(Date.now()).slice(-6)}`;
    }
  }
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
    .insert({
      user_id: userId,
      material_id: crypto.randomUUID?.() ?? userId, // placeholder UUID — no catalog link yet
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
