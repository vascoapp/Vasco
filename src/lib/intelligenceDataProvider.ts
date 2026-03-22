/**
 * Intelligence Data Provider — Supabase persistence for the agentic layer.
 * When Supabase is not configured, all writes are no-ops and reads return empty.
 * The intelligence engine / calibration / pricing modules call these functions
 * instead of using AsyncStorage directly.
 */

import { supabase, isSupabaseConfigured } from './supabase';

// Intelligence tables are not in the Database type (will be auto-generated later).
// Use an untyped accessor to avoid `never` resolution on .from().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
function from(table: string) { return db.from(table); }

// ── Helpers ──────────────────────────────────────────────────

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

// ── Data Events ──────────────────────────────────────────────

export async function insertEvent(event: {
  event_type: string;
  session_id?: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
  entities: unknown[];
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();
  const { data, error } = await from('data_events')
    .insert({ ...event, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] insertEvent:', error.message); return null; }
  return data?.id ?? null;
}

export async function updateEventOutcome(
  eventId: string,
  outcome: Record<string, unknown>,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await from('data_events')
    .update({ outcome })
    .eq('id', eventId);
  if (error) console.warn('[IntelDP] updateEventOutcome:', error.message);
}

export async function queryEvents(
  eventType: string,
  options?: { limit?: number; since?: string },
): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  let q = from('data_events')
    .select('*')
    .eq('event_type', eventType)
    .order('created_at', { ascending: false });
  if (options?.since) q = q.gte('created_at', options.since);
  if (options?.limit) q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) { console.warn('[IntelDP] queryEvents:', error.message); return []; }
  return data ?? [];
}

// ── Entities ─────────────────────────────────────────────────

export async function upsertEntity(entity: {
  entity_type: string;
  name: string;
  aliases?: string[];
  attributes?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  confidence?: number;
  sources?: string[];
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();

  // Check for existing by name + type
  const { data: existing } = await from('entities')
    .select('id')
    .eq('entity_type', entity.entity_type)
    .ilike('name', entity.name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await from('entities')
      .update({
        aliases: entity.aliases,
        attributes: entity.attributes,
        stats: entity.stats,
        confidence: entity.confidence,
      })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await from('entities')
    .insert({ ...entity, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] upsertEntity:', error.message); return null; }
  return data?.id ?? null;
}

export async function findEntitiesByType(entityType: string): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await from('entities')
    .select('*')
    .eq('entity_type', entityType)
    .order('name');
  if (error) { console.warn('[IntelDP] findEntities:', error.message); return []; }
  return data ?? [];
}

export async function getEntityById(id: string): Promise<any | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await from('entities')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.warn('[IntelDP] getEntity:', error.message); return null; }
  return data;
}

// ── Feedback Weights ─────────────────────────────────────────

export async function loadFeedbackObservations(
  feedbackType: string,
  segmentKey: string,
): Promise<{ timestamp: string; value: number }[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await from('feedback_weights')
    .select('observations')
    .eq('feedback_type', feedbackType)
    .eq('segment_key', segmentKey)
    .maybeSingle();
  if (error) { console.warn('[IntelDP] loadFeedback:', error.message); return []; }
  return (data?.observations as any[]) ?? [];
}

export async function saveFeedbackObservations(
  feedbackType: string,
  segmentKey: string,
  observations: { timestamp: string; value: number }[],
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = await getUserId();
  const { error } = await from('feedback_weights')
    .upsert(
      {
        user_id: userId,
        feedback_type: feedbackType,
        segment_key: segmentKey,
        observations: observations as any,
      } as any,
      { onConflict: 'user_id,feedback_type,segment_key' },
    );
  if (error) console.warn('[IntelDP] saveFeedback:', error.message);
}

export async function loadAllFeedbackWeights(): Promise<
  { feedback_type: string; segment_key: string; observations: any[] }[]
> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await from('feedback_weights')
    .select('feedback_type, segment_key, observations');
  if (error) { console.warn('[IntelDP] loadAllFeedback:', error.message); return []; }
  return (data ?? []) as any[];
}

// ── Calibration ──────────────────────────────────────────────

export async function insertCalibrationEntry(entry: {
  generator_id: string;
  prediction: string;
  predicted_value?: number;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();
  const { data, error } = await from('calibration_entries')
    .insert({ ...entry, user_id: userId, predicted_at: new Date().toISOString() } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] insertCalibration:', error.message); return null; }
  return data?.id ?? null;
}

export async function resolveCalibrationEntry(
  entryId: string,
  actualValue: number,
  accurate: boolean,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  await from('calibration_entries')
    .update({
      actual_value: actualValue,
      resolved_at: new Date().toISOString(),
      accurate,
    })
    .eq('id', entryId);
}

export async function getCalibrationEntriesByGenerator(
  generatorId: string,
  options?: { unresolvedOnly?: boolean; maxAgeDays?: number },
): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  let q = from('calibration_entries')
    .select('*')
    .eq('generator_id', generatorId)
    .order('predicted_at', { ascending: false });
  if (options?.unresolvedOnly) q = q.is('resolved_at', null);
  if (options?.maxAgeDays) {
    const since = new Date(Date.now() - options.maxAgeDays * 86_400_000).toISOString();
    q = q.gte('predicted_at', since);
  }
  const { data, error } = await q;
  if (error) { console.warn('[IntelDP] getCalibration:', error.message); return []; }
  return data ?? [];
}

export async function getAllCalibrationScores(): Promise<
  { generator_id: string; total: number; resolved: number; accurate: number; rate: number }[]
> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await from('calibration_entries')
    .select('generator_id, resolved_at, accurate');
  if (error) { return []; }

  const byGen = new Map<string, { total: number; resolved: number; accurate: number }>();
  for (const row of data ?? []) {
    const g = byGen.get(row.generator_id) || { total: 0, resolved: 0, accurate: 0 };
    g.total++;
    if (row.resolved_at) g.resolved++;
    if (row.accurate) g.accurate++;
    byGen.set(row.generator_id, g);
  }

  return Array.from(byGen.entries()).map(([generator_id, s]) => ({
    generator_id,
    ...s,
    rate: s.resolved > 0 ? s.accurate / s.resolved : 0.5,
  }));
}

// ── Training Examples ────────────────────────────────────────

export async function insertTrainingExample(example: {
  model_type: string;
  features: Record<string, unknown>;
  target?: unknown;
  weight?: number;
  source?: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();
  const { data, error } = await from('training_examples')
    .insert({ ...example, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] insertTraining:', error.message); return null; }
  return data?.id ?? null;
}

export async function getTrainingExamples(
  modelType: string,
  limit = 500,
): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await from('training_examples')
    .select('*')
    .eq('model_type', modelType)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.warn('[IntelDP] getTraining:', error.message); return []; }
  return data ?? [];
}

// ── Model Predictions ────────────────────────────────────────

export async function insertPrediction(prediction: {
  model_type: string;
  model_version: string;
  input: Record<string, unknown>;
  prediction: unknown;
  confidence: number;
  explanation?: string[];
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();
  const { data, error } = await from('model_predictions')
    .insert({ ...prediction, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] insertPrediction:', error.message); return null; }
  return data?.id ?? null;
}

// ── Price Observations ───────────────────────────────────────

export async function insertPriceObservation(obs: {
  material_id: string;
  material_name: string;
  supplier_id?: string;
  supplier_name?: string;
  price: number;
  currency?: string;
  unit?: string;
  source?: string;
  confidence?: number;
  is_sale?: boolean;
  sale_end_date?: string;
  regular_price?: number;
  in_stock?: boolean;
  stock_level?: string;
  lead_time_days?: number;
  min_quantity?: number;
  bulk_pricing?: unknown;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();
  const { data, error } = await from('price_observations')
    .insert({ ...obs, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] insertPriceObs:', error.message); return null; }
  return data?.id ?? null;
}

export async function bulkInsertPriceObservations(
  observations: Parameters<typeof insertPriceObservation>[0][],
): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const userId = await getUserId();
  const rows = observations.map((o) => ({ ...o, user_id: userId }));
  const { data, error } = await from('price_observations')
    .insert(rows as any)
    .select('id');
  if (error) { console.warn('[IntelDP] bulkPriceObs:', error.message); return 0; }
  return data?.length ?? 0;
}

export async function getPriceHistory(
  materialId: string,
  options?: { supplierId?: string; startDate?: string; limit?: number },
): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  let q = from('price_observations')
    .select('*')
    .eq('material_id', materialId)
    .order('observed_at', { ascending: false });
  if (options?.supplierId) q = q.eq('supplier_id', options.supplierId);
  if (options?.startDate) q = q.gte('observed_at', options.startDate);
  if (options?.limit) q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) { console.warn('[IntelDP] getPriceHistory:', error.message); return []; }
  return data ?? [];
}

export async function getPriceReference(materialId: string): Promise<any | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await from('price_references')
    .select('*')
    .eq('material_id', materialId)
    .maybeSingle();
  if (error) { console.warn('[IntelDP] getPriceRef:', error.message); return null; }
  return data;
}

// ── Material Catalog ─────────────────────────────────────────

export async function upsertMaterial(material: {
  name: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  sku?: string;
  ean?: string;
  base_unit?: string;
  aliases?: string[];
  specifications?: Record<string, unknown>;
  demand_pattern?: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();

  // Check existing by name
  const { data: existing } = await from('material_catalog')
    .select('id')
    .ilike('name', material.name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await from('material_catalog')
      .update(material)
      .eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await from('material_catalog')
    .insert({ ...material, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] upsertMaterial:', error.message); return null; }
  return data?.id ?? null;
}

export async function searchMaterials(
  query: string,
  options?: { category?: string; limit?: number },
): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  let q = from('material_catalog')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name');
  if (options?.category) q = q.eq('category', options.category);
  if (options?.limit) q = q.limit(options.limit);
  const { data, error } = await q;
  if (error) { console.warn('[IntelDP] searchMaterials:', error.message); return []; }
  return data ?? [];
}

export async function addMaterialAlias(
  materialId: string,
  alias: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data } = await from('material_catalog')
    .select('aliases')
    .eq('id', materialId)
    .single();
  if (!data) return;
  const aliases = [...((data.aliases as string[]) || []), alias];
  await from('material_catalog')
    .update({ aliases })
    .eq('id', materialId);
}

// ── Suppliers ────────────────────────────────────────────────

export async function upsertSupplier(supplier: {
  name: string;
  account_status?: string;
  credit_terms?: number;
  reliability_score?: number;
  api_enabled?: boolean;
  catalog_url?: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();

  const { data: existing } = await from('suppliers')
    .select('id')
    .ilike('name', supplier.name)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await from('suppliers').update(supplier).eq('id', existing.id);
    return existing.id;
  }

  const { data, error } = await from('suppliers')
    .insert({ ...supplier, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] upsertSupplier:', error.message); return null; }
  return data?.id ?? null;
}

export async function getSuppliers(): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await from('suppliers')
    .select('*')
    .order('name');
  if (error) { console.warn('[IntelDP] getSuppliers:', error.message); return []; }
  return data ?? [];
}

export async function getSupplierById(id: string): Promise<any | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await from('suppliers')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) { console.warn('[IntelDP] getSupplier:', error.message); return null; }
  return data;
}

// ── Extracted Documents ──────────────────────────────────────

export async function saveExtractedDocument(doc: {
  source_type: 'pdf' | 'camera' | 'paste' | 'excel' | 'csv';
  source_uri?: string;
  doc_type: 'invoice' | 'quote' | 'receipt' | 'unknown';
  supplier_name?: string;
  supplier_id?: string;
  document_number?: string;
  document_date?: string;
  total_amount?: number;
  vat_amount?: number;
  currency?: string;
  confidence?: number;
  raw_text?: string;
  extracted_json?: Record<string, unknown>;
  status?: string;
}): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const userId = await getUserId();
  const { data, error } = await from('extracted_documents')
    .insert({ ...doc, user_id: userId } as any)
    .select('id')
    .single();
  if (error) { console.warn('[IntelDP] saveExtractedDoc:', error.message); return null; }
  return data?.id ?? null;
}

export async function saveExtractedLineItems(
  documentId: string,
  items: {
    description: string;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
    unit?: string;
    brand?: string;
    category?: string;
    article_number?: string;
    confidence?: number;
  }[],
): Promise<number> {
  if (!isSupabaseConfigured || items.length === 0) return 0;
  const rows = items.map((item) => ({ ...item, document_id: documentId }));
  const { data, error } = await from('extracted_line_items')
    .insert(rows as any)
    .select('id');
  if (error) { console.warn('[IntelDP] saveExtractedItems:', error.message); return 0; }
  return data?.length ?? 0;
}

export async function listExtractedDocuments(
  status?: string,
): Promise<any[]> {
  if (!isSupabaseConfigured) return [];
  let q = from('extracted_documents')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) { console.warn('[IntelDP] listExtractedDocs:', error.message); return []; }
  return data ?? [];
}

export async function getExtractedDocument(id: string): Promise<{ doc: any; items: any[] } | null> {
  if (!isSupabaseConfigured) return null;
  const { data: doc, error: docErr } = await from('extracted_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (docErr || !doc) { console.warn('[IntelDP] getExtractedDoc:', docErr?.message); return null; }
  const { data: items, error: itemsErr } = await from('extracted_line_items')
    .select('*')
    .eq('document_id', id)
    .order('created_at');
  if (itemsErr) { console.warn('[IntelDP] getExtractedItems:', itemsErr.message); }
  return { doc, items: items ?? [] };
}
