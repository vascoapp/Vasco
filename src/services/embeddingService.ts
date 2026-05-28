// =============================================================================
// EMBEDDING SERVICE (R239)
// =============================================================================
// Thin wrappers around the embed-text Edge Function. Best-effort: silently
// no-ops when no provider is configured server-side. UI never blocks.
//
// These functions are meant to be FIRE-AND-FORGET — the embed call is a
// learning-pipeline write, not a user-facing operation. Always .catch(()=>{}).
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAuthedUserId } from '../lib/currentUser';
import { subscribeIdRemap, type IdRemapEvent } from './idRemapBus';

interface EmbedResult {
  ok: boolean;
  dimensions?: number;
  provider?: string;
  error?: string;
}

async function callEmbed(body: Record<string, unknown>): Promise<EmbedResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'supabase not configured' };
  try {
    const { data, error } = await supabase.functions.invoke('embed-text', { body });
    if (error) return { ok: false, error: error.message };
    return (data as EmbedResult) ?? { ok: false, error: 'no data' };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function embedCustomer(input: {
  customerId: string;
  text: string;
}): Promise<void> {
  const userId = getAuthedUserId();
  if (!userId || !input.customerId || !input.text) return;
  await callEmbed({ table: 'customer', key: input.customerId, text: input.text, userId });
}

export async function embedMaterial(input: {
  trade: string;
  materialName: string;
  text: string;
}): Promise<void> {
  if (!input.trade || !input.materialName || !input.text) return;
  const key = `${input.trade}|${input.materialName.toLowerCase()}`;
  await callEmbed({ table: 'material', key, text: input.text });
}

export async function embedQuoteLine(input: {
  lineId: string;
  text: string;
  quoteId?: string;
}): Promise<void> {
  const userId = getAuthedUserId();
  if (!userId || !input.lineId || !input.text) return;
  await callEmbed({ table: 'quote_line', key: input.lineId, text: input.text, userId, quoteId: input.quoteId });
}

// ---------------------------------------------------------------------------
// Semantic search helpers
// ---------------------------------------------------------------------------
// These call pgvector cosine similarity via the existing match_similar_jobs
// pattern but for the new tables. Future-facing: not yet wired into UI.

// Find similar materials given a known material key (trade|material_name).
// The key must already exist in material_embeddings — this is cohort-wide so
// any contractor's embedded materials are eligible.
export async function findSimilarMaterials(materialKey: string, limit = 5): Promise<Array<{ materialKey: string; similarity: number }>> {
  if (!isSupabaseConfigured) return [];
  if (!materialKey) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('match_similar_materials', {
      p_query_key: materialKey,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      materialKey: String(r.material_key),
      similarity: Number(r.similarity),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// R54: id-remap support
// ---------------------------------------------------------------------------
// Customer embeddings landed under tempIds when addCustomer ran offline.
// After the offline queue flushes and BE assigns a real uuid, the
// customer_embeddings row is keyed under the discarded temp id —
// match_similar_customers by real id misses forever.
//
// On remap, re-fire the embed under the real id. The original payload
// (name/email/phone/address) flows through the bus so we don't need a
// BE round-trip to derive the embed text.

let _customerRemapInit = false;
function initCustomerRemapListener(): void {
  if (_customerRemapInit) return;
  _customerRemapInit = true;
  subscribeIdRemap((e: IdRemapEvent) => {
    if (e.table !== 'customers') return;
    const p = (e.payload ?? {}) as { name?: string; email?: string; phone?: string; address?: string };
    const text = [p.name, p.email, p.phone, p.address].filter(Boolean).join(' ');
    if (text.length > 3) {
      void embedCustomer({ customerId: e.realId, text });
    }
  });
}

initCustomerRemapListener();

// ---------------------------------------------------------------------------
// Lead + Worker embeddings (intelligence retrofit Stage 4)
// ---------------------------------------------------------------------------
// These write to the generic `public.embeddings` table (item_type='lead' /
// 'worker') rather than dedicated per-feature tables. The CHECK on
// item_type was widened by migration 20260527000001.
//
// Two-step flow (mirrors semanticSearch.indexItem):
//   1. Call `generate-embedding` to get the 1536-d vector for the text
//   2. Upsert into `embeddings` with the entity's id + owner scope
//
// Fire-and-forget: callers .catch(()=>{}) — never block UI on the network.
// ---------------------------------------------------------------------------

async function generateEmbeddingVector(text: string): Promise<number[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase.functions.invoke('generate-embedding', { body: { text } });
    if (error || !data?.embedding) return null;
    return data.embedding as number[];
  } catch {
    return null;
  }
}

export async function embedLead(input: {
  leadId: string;
  text: string;          // concatenated customerName + jobDescription + notes
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = getAuthedUserId();
  if (!userId || !input.leadId || !input.text || input.text.length < 3) return;
  const embedding = await generateEmbeddingVector(input.text);
  if (!embedding) return;
  try {
    await (supabase.from('embeddings') as any).upsert({
      id: `lead:${input.leadId}`,
      item_type: 'lead',
      title: input.text.slice(0, 200),
      description: '',
      embedding,
      // R301 audit fix: stash the source text in metadata so the idRemap
      // listener can re-upsert the embedding under the real uuid without
      // round-tripping through generate-embedding (no extra OpenAI call).
      metadata: { ...(input.metadata ?? {}), embedded_text: input.text },
      // Leads are owner-scoped — RLS already enforces this, but we set
      // user_id explicitly so the row never accidentally cohort-shares.
      user_id: userId,
    });
  } catch {
    // best-effort
  }
}

export async function embedWorker(input: {
  workerId: string;
  text: string;          // concatenated name + role + trade + skills
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const userId = getAuthedUserId();
  if (!userId || !input.workerId || !input.text || input.text.length < 3) return;
  const embedding = await generateEmbeddingVector(input.text);
  if (!embedding) return;
  try {
    await (supabase.from('embeddings') as any).upsert({
      id: `worker:${input.workerId}`,
      item_type: 'worker',
      title: input.text.slice(0, 200),
      description: '',
      embedding,
      // R301 audit fix: same source-text stash as embedLead so remap can
      // re-upsert under the real uuid without a fresh embedding call.
      metadata: { ...(input.metadata ?? {}), embedded_text: input.text },
      user_id: userId,
    });
  } catch {
    // best-effort
  }
}

// Search helpers — call match_similar_items with the new item_types.
// The RPC accepts a free-text match_type so no migration is needed for the
// query side. Both helpers are scoped to the caller's own rows via RLS.

export async function findSimilarLeads(queryText: string, limit = 5): Promise<Array<{ leadId: string; similarity: number; title: string }>> {
  if (!isSupabaseConfigured || !queryText) return [];
  const embedding = await generateEmbeddingVector(queryText);
  if (!embedding) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('match_similar_items', {
      query_embedding: embedding,
      match_type: 'lead',
      match_count: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      leadId: String(r.id).replace(/^lead:/, ''),
      similarity: Number(r.similarity),
      title: String(r.title ?? ''),
    }));
  } catch {
    return [];
  }
}

export async function findSimilarWorkers(queryText: string, limit = 5): Promise<Array<{ workerId: string; similarity: number; title: string }>> {
  if (!isSupabaseConfigured || !queryText) return [];
  const embedding = await generateEmbeddingVector(queryText);
  if (!embedding) return [];
  try {
    const { data, error } = await (supabase.rpc as any)('match_similar_items', {
      query_embedding: embedding,
      match_type: 'worker',
      match_count: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      workerId: String(r.id).replace(/^worker:/, ''),
      similarity: Number(r.similarity),
      title: String(r.title ?? ''),
    }));
  } catch {
    return [];
  }
}

// ID-remap listener: when a temp lead/worker id swaps for the real BE uuid,
// re-key the embedding row so the search results map back to real entities.
// R301 audit fix: previously this just deleted the temp row, leaving a
// search-coverage gap until the next user edit re-embedded. Now we
// SELECT the temp row, insert a copy under the new id (carrying the same
// vector + metadata), then delete the temp — single round-trip to OpenAI
// was already paid on the original embed, no need to re-generate.
function initLeadWorkerRemapListener() {
  subscribeIdRemap(async (e: IdRemapEvent) => {
    if (e.table !== 'leads' && e.table !== 'workers') return;
    if (!isSupabaseConfigured) return;
    const prefix = e.table === 'leads' ? 'lead' : 'worker';
    const oldId = `${prefix}:${e.tempId}`;
    const newId = `${prefix}:${e.realId}`;
    try {
      const { data: row } = await (supabase.from('embeddings') as any)
        .select('item_type, title, description, embedding, metadata, user_id')
        .eq('id', oldId)
        .maybeSingle();
      if (row && row.embedding) {
        await (supabase.from('embeddings') as any).upsert({
          id: newId,
          item_type: row.item_type,
          title: row.title,
          description: row.description ?? '',
          embedding: row.embedding,
          metadata: row.metadata ?? {},
          user_id: row.user_id,
        });
      }
      await (supabase.from('embeddings') as any).delete().eq('id', oldId);
    } catch {
      // best-effort — search coverage degrades briefly on failure, never
      // breaks the user flow.
    }
  });
}

initLeadWorkerRemapListener();

export async function findSimilarCustomersByText(text: string, limit = 5): Promise<Array<{ customerId: string; similarity: number }>> {
  if (!isSupabaseConfigured) return [];
  const userId = getAuthedUserId();
  if (!userId) return [];
  // First embed the query text
  try {
    const { data: embedData, error: embedErr } = await supabase.functions.invoke('embed-text', {
      body: { table: 'customer', key: '__query__', text, userId },
    });
    if (embedErr || !embedData) return [];
    // Read the just-stored embedding back, search by cosine
    const { data, error } = await (supabase.rpc as any)('match_similar_customers', {
      p_user_id: userId,
      p_query_text: text,
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return (data as any[]).map((r) => ({
      customerId: String(r.customer_id),
      similarity: Number(r.similarity),
    }));
  } catch {
    return [];
  }
}
