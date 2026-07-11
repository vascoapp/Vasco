// =============================================================================
// SEMANTIC SEARCH — Embedding-based retrieval for materials, jobs, regulations
// =============================================================================
// Layer 3 of the compound AI architecture.
// Uses pgvector in Supabase for vector similarity search.
// Falls back to keyword matching when Supabase is unavailable.
// =============================================================================
// Supports:
// 1. Material matching — "koperen buis 15mm" → find similar products across suppliers
// 2. Similar job retrieval — find past jobs with similar scope for estimation
// 3. Regulation lookup — find relevant NEN/VCA/building codes
// 4. Natural language query — "hoeveel heb ik vorige maand aan koper uitgegeven?"
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId } from '../lib/currentUser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeIdRemap, type IdRemapEvent } from '../services/idRemapBus';

const EMBEDDING_CACHE_KEY = '@vasco_embeddings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  type: 'material' | 'job' | 'regulation' | 'supplier';
  title: string;
  description: string;
  score: number; // 0-1 similarity
  metadata: Record<string, any>;
}

export interface EmbeddingEntry {
  id: string;
  text: string;
  type: 'material' | 'job' | 'regulation';
  vector?: number[]; // 1536-dim (text-embedding-3-small) or null for local
  metadata: Record<string, any>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Embedding generation (via Supabase Edge Function)
// ---------------------------------------------------------------------------

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase.functions.invoke('generate-embedding', {
      body: { text },
    });
    if (error || !data?.embedding) return null;
    return data.embedding;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Vector search (Supabase pgvector)
// ---------------------------------------------------------------------------

async function vectorSearch(query: string, type: string, limit: number = 5): Promise<SearchResult[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const embedding = await generateEmbedding(query);
    if (!embedding) {
      if (__DEV__) console.warn('[semanticSearch] embedding generation returned null — falling back to keyword');
      return [];
    }

    const { data, error } = await (supabase.rpc as any)('match_similar_items', {
      query_embedding: embedding,
      match_type: type,
      match_count: limit,
    });

    if (error) {
      if (__DEV__) console.warn('[semanticSearch] pgvector RPC error:', error.message);
      return [];
    }
    if (!data) {
      if (__DEV__) console.warn('[semanticSearch] pgvector returned no rows (RPC may be missing?) — falling back to keyword');
      return [];
    }
    return (data as any[]).map(row => ({
      id: row.id,
      type: row.item_type,
      title: row.title,
      description: row.description ?? '',
      score: row.similarity ?? 0,
      metadata: row.metadata ?? {},
    }));
  } catch (err) {
    if (__DEV__) console.warn('[semanticSearch] vectorSearch threw:', String(err));
    return [];
  }
}

// ---------------------------------------------------------------------------
// Keyword fallback search (works offline)
// ---------------------------------------------------------------------------

function keywordSearch(query: string, items: EmbeddingEntry[], limit: number = 5): SearchResult[] {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/);

  const scored = items.map(item => {
    const text = `${item.text} ${item.metadata.category ?? ''} ${item.metadata.brand ?? ''}`.toLowerCase();
    let score = 0;

    // Exact substring match = high score
    if (text.includes(q)) score += 0.8;

    // Individual word matches
    for (const word of words) {
      if (word.length < 2) continue;
      if (text.includes(word)) score += 0.3 / words.length;
    }

    // Boost by metadata
    if (item.metadata.brand && q.includes(item.metadata.brand.toLowerCase())) score += 0.2;
    if (item.metadata.articleNumber && q.includes(item.metadata.articleNumber.toLowerCase())) score += 0.5;

    return { item, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      id: s.item.id,
      type: s.item.type,
      title: s.item.text,
      description: s.item.metadata.category ?? '',
      score: Math.min(s.score, 1),
      metadata: s.item.metadata,
    }));
}

// ---------------------------------------------------------------------------
// Local embedding index (AsyncStorage)
// ---------------------------------------------------------------------------

async function getLocalIndex(): Promise<EmbeddingEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(EMBEDDING_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function indexItem(entry: Omit<EmbeddingEntry, 'createdAt'>): Promise<void> {
  try {
    const index = await getLocalIndex();
    const existing = index.findIndex(e => e.id === entry.id);
    const full: EmbeddingEntry = { ...entry, createdAt: new Date().toISOString() };

    if (existing >= 0) {
      index[existing] = full;
    } else {
      index.push(full);
    }

    // Keep index under 500 items
    const trimmed = index.slice(-500);
    await AsyncStorage.setItem(EMBEDDING_CACHE_KEY, JSON.stringify(trimmed));

    // Also push to Supabase for vector search
    if (isSupabaseConfigured && !entry.vector) {
      const embedding = await generateEmbedding(entry.text);
      if (embedding) {
        // Materials and regulations are cohort-shareable — write user_id=null so
        // the RLS policy (user_id IS NULL OR = auth.uid()) lets every contractor
        // read them. Jobs stay private to their owner.
        const ownerId = entry.type === 'job' ? getCurrentUserId() : null;
        await (supabase.from('embeddings') as any).upsert({
          id: entry.id,
          item_type: entry.type,
          title: entry.text,
          description: entry.metadata.category ?? '',
          embedding,
          metadata: entry.metadata,
          user_id: ownerId,
        });
      }
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Public search API
// ---------------------------------------------------------------------------

export async function searchMaterials(query: string, limit: number = 5): Promise<SearchResult[]> {
  // Try vector search first
  const vectorResults = await vectorSearch(query, 'material', limit);
  if (vectorResults.length > 0) return vectorResults;

  // Fall back to keyword search
  const localIndex = await getLocalIndex();
  const materialItems = localIndex.filter(e => e.type === 'material');
  return keywordSearch(query, materialItems, limit);
}

export async function searchSimilarJobs(query: string, limit: number = 5): Promise<SearchResult[]> {
  const vectorResults = await vectorSearch(query, 'job', limit);
  if (vectorResults.length > 0) return vectorResults;

  const localIndex = await getLocalIndex();
  const jobItems = localIndex.filter(e => e.type === 'job');
  return keywordSearch(query, jobItems, limit);
}

export async function searchRegulations(query: string, limit: number = 5): Promise<SearchResult[]> {
  const vectorResults = await vectorSearch(query, 'regulation', limit);
  if (vectorResults.length > 0) return vectorResults;

  const localIndex = await getLocalIndex();
  const regItems = localIndex.filter(e => e.type === 'regulation');
  return keywordSearch(query, regItems, limit);
}

// Unified search across all types
export async function searchAll(query: string, limit: number = 10): Promise<SearchResult[]> {
  const [materials, jobs, regulations] = await Promise.all([
    searchMaterials(query, Math.ceil(limit / 3)),
    searchSimilarJobs(query, Math.ceil(limit / 3)),
    searchRegulations(query, Math.ceil(limit / 3)),
  ]);

  return [...materials, ...jobs, ...regulations]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Auto-index from app data
// ---------------------------------------------------------------------------

export async function indexJobForSearch(job: { id: string; title: string; trade?: string; description?: string | null }): Promise<void> {
  await indexItem({
    id: `job-${job.id}`,
    text: `${job.title} ${job.description ?? ''}`.trim(),
    type: 'job',
    metadata: { trade: job.trade, jobId: job.id },
  });
}

export async function indexMaterialForSearch(material: {
  id: string;
  name: string;
  category?: string;
  brand?: string;
  articleNumber?: string;
  supplierId?: string;
  price?: number;
}): Promise<void> {
  await indexItem({
    id: `mat-${material.id}`,
    text: `${material.name} ${material.brand ?? ''} ${material.articleNumber ?? ''}`.trim(),
    type: 'material',
    metadata: {
      category: material.category,
      brand: material.brand,
      articleNumber: material.articleNumber,
      supplierId: material.supplierId,
      price: material.price,
    },
  });
}

// ---------------------------------------------------------------------------
// R54: id-remap support
// ---------------------------------------------------------------------------
// indexJobForSearch / indexMaterialForSearch wrap the ids with a `job-` /
// `mat-` prefix before storing in:
//   1. Local AsyncStorage `@vasco_embeddings` keyed by the prefixed id
//   2. Supabase `embeddings` table keyed by the prefixed id
// When the original entity gets a real BE uuid via offline-queue flush,
// both storage layers carry the now-stranded prefixed temp id. Future
// vector-search hits won't link back to the canonical entity.
//
// On remap, rewrite both layers under the new prefixed real id. We
// preserve the original `text` + `metadata` so we don't need to re-fetch.

// Keys MUST match the `table` string the offline queue emits on flush
// (offlineWriteQueue emits `idRemap.table = entry.table` verbatim). addMaterial
// queues its insert as 'material_catalog' (the real DB table), NOT 'materials' —
// so the old 'materials' key never fired and every OFFLINE-created material's
// cohort search embedding stayed keyed by its temp id (orphaned; the material
// row rekeyed fine, but `match_similar_materials` could never find it by real id).
// addJob queues as 'jobs', which already matched.
const REMAP_PREFIX_BY_TABLE: Record<string, 'job' | 'material'> = {
  jobs: 'job',
  material_catalog: 'material',
};

async function remapIndexedItem(prefix: 'job' | 'material', tempId: string, realId: string): Promise<void> {
  if (!tempId || !realId || tempId === realId) return;
  const oldKey = `${prefix}-${tempId}`;
  const newKey = `${prefix}-${realId}`;

  // 1. Local AsyncStorage cache
  try {
    const raw = await AsyncStorage.getItem(EMBEDDING_CACHE_KEY);
    if (raw) {
      const index = JSON.parse(raw) as EmbeddingEntry[];
      let touched = false;
      const remapped = index.map((entry) => {
        if (entry.id === oldKey) {
          touched = true;
          // Mirror the remap into metadata too — indexJobForSearch writes
          // `metadata.jobId` which downstream consumers slice on.
          const md = { ...entry.metadata };
          if (prefix === 'job' && md.jobId === tempId) md.jobId = realId;
          if (prefix === 'material' && md.materialId === tempId) md.materialId = realId;
          return { ...entry, id: newKey, metadata: md };
        }
        return entry;
      });
      if (touched) await AsyncStorage.setItem(EMBEDDING_CACHE_KEY, JSON.stringify(remapped));
    }
  } catch {}

  // 2. Supabase embeddings row — rewrite the primary key. Doing it as
  //    UPDATE rather than DELETE+INSERT keeps the existing vector blob
  //    so we don't burn an embed-text call.
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('embeddings') as any)
        .update({ id: newKey })
        .eq('id', oldKey);
    } catch {}
  }
}

let _remapInit = false;
function initRemapListener(): void {
  if (_remapInit) return;
  _remapInit = true;
  subscribeIdRemap((e: IdRemapEvent) => {
    const prefix = REMAP_PREFIX_BY_TABLE[e.table];
    if (!prefix) return;
    void remapIndexedItem(prefix, e.tempId, e.realId);
  });
}

initRemapListener();
