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
import { getCurrentUserId } from '../lib/currentUser';

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
  const userId = getCurrentUserId();
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
  const userId = getCurrentUserId();
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

export async function findSimilarCustomersByText(text: string, limit = 5): Promise<Array<{ customerId: string; similarity: number }>> {
  if (!isSupabaseConfigured) return [];
  const userId = getCurrentUserId();
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
