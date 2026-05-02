#!/usr/bin/env node
// =============================================================================
// BACKFILL EMBEDDINGS (R284)
// =============================================================================
// One-time script: read existing jobs + material catalog rows, embed them via
// the generate-embedding edge function, and upsert into public.embeddings so
// SimilarJobsSuggest / pricingAgent semantic search work on day 1 instead of
// after months of organic indexing on the FE.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-embeddings.mjs
//   --dry-run   only log what would be embedded
//   --types=material,job   restrict to specific types (default: both)
//   --limit=N   stop after N rows per type (default: no cap)
//
// Notes:
// - Materials: cohort-shareable, written with user_id=NULL.
// - Jobs:      private, written with user_id=jobs.user_id.
// - Skips rows already present in public.embeddings (id-keyed by `mat-{id}` /
//   `job-{id}`) so re-runs are idempotent.
// - Throttles to 50 embed calls per batch to avoid burning the embedding
//   provider's rate limit.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY before running.');
  process.exit(1);
}

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);
const DRY_RUN = args.get('dry-run') === 'true';
const TYPES = (args.get('types') ?? 'material,job').split(',').map((s) => s.trim());
const LIMIT = args.get('limit') ? parseInt(args.get('limit'), 10) : Infinity;
const BATCH = 50;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function embed(text) {
  const { data, error } = await supabase.functions.invoke('generate-embedding', {
    body: { text },
  });
  if (error) throw new Error(`embed fn: ${error.message}`);
  if (!data?.ok || !Array.isArray(data?.embedding)) {
    throw new Error(`embed fn returned no vector: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.embedding;
}

async function loadExistingIds(itemType) {
  const ids = new Set();
  let from = 0;
  // Paginate; embeddings table can be large after first run.
  while (true) {
    const { data, error } = await supabase
      .from('embeddings')
      .select('id')
      .eq('item_type', itemType)
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) ids.add(r.id);
    if (data.length < 1000) break;
    from += 1000;
  }
  return ids;
}

async function backfillMaterials() {
  console.log('\n=== materials (cohort-wide, user_id=null) ===');
  const existing = await loadExistingIds('material');
  console.log(`already indexed: ${existing.size}`);

  const { data: rows, error } = await supabase
    .from('material_catalog')
    .select('id, name, brand, category, article_number, supplier_id')
    .limit(Math.min(LIMIT, 5000));
  if (error) {
    console.error('material_catalog read failed:', error.message);
    return;
  }
  if (!rows?.length) {
    console.log('no material_catalog rows');
    return;
  }

  const todo = rows.filter((r) => !existing.has(`mat-${r.id}`));
  console.log(`to embed: ${todo.length} / ${rows.length}`);

  let done = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const upserts = [];
    for (const r of slice) {
      const text = [r.name, r.brand, r.article_number].filter(Boolean).join(' ').trim();
      if (!text) {
        failed++;
        continue;
      }
      if (DRY_RUN) {
        done++;
        continue;
      }
      try {
        const vector = await embed(text);
        upserts.push({
          id: `mat-${r.id}`,
          item_type: 'material',
          title: text,
          description: r.category ?? '',
          embedding: vector,
          metadata: {
            category: r.category,
            brand: r.brand,
            articleNumber: r.article_number,
            supplierId: r.supplier_id,
          },
          user_id: null,
        });
      } catch (e) {
        failed++;
        console.warn(`embed failed for ${r.id}: ${e.message}`);
      }
    }
    if (upserts.length > 0) {
      const { error: upErr } = await supabase.from('embeddings').upsert(upserts);
      if (upErr) {
        console.error('upsert batch failed:', upErr.message);
        failed += upserts.length;
      } else {
        done += upserts.length;
      }
    }
    process.stdout.write(`\rembedded ${done}/${todo.length} (failed ${failed})`);
  }
  console.log(`\nmaterials: embedded ${done}, failed ${failed}`);
}

async function backfillJobs() {
  console.log('\n=== jobs (per-owner, user_id=jobs.user_id) ===');
  const existing = await loadExistingIds('job');
  console.log(`already indexed: ${existing.size}`);

  const { data: rows, error } = await supabase
    .from('jobs')
    .select('id, user_id, title, description, trade')
    .limit(Math.min(LIMIT, 5000));
  if (error) {
    console.error('jobs read failed:', error.message);
    return;
  }
  if (!rows?.length) {
    console.log('no jobs rows');
    return;
  }

  const todo = rows.filter((r) => !existing.has(`job-${r.id}`));
  console.log(`to embed: ${todo.length} / ${rows.length}`);

  let done = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH);
    const upserts = [];
    for (const r of slice) {
      const text = `${r.title ?? ''} ${r.description ?? ''}`.trim();
      if (!text) {
        failed++;
        continue;
      }
      if (DRY_RUN) {
        done++;
        continue;
      }
      try {
        const vector = await embed(text);
        upserts.push({
          id: `job-${r.id}`,
          item_type: 'job',
          title: text,
          description: r.trade ?? '',
          embedding: vector,
          metadata: { trade: r.trade, jobId: r.id },
          user_id: r.user_id,
        });
      } catch (e) {
        failed++;
        console.warn(`embed failed for ${r.id}: ${e.message}`);
      }
    }
    if (upserts.length > 0) {
      const { error: upErr } = await supabase.from('embeddings').upsert(upserts);
      if (upErr) {
        console.error('upsert batch failed:', upErr.message);
        failed += upserts.length;
      } else {
        done += upserts.length;
      }
    }
    process.stdout.write(`\rembedded ${done}/${todo.length} (failed ${failed})`);
  }
  console.log(`\njobs: embedded ${done}, failed ${failed}`);
}

(async () => {
  console.log(`backfill-embeddings — dry-run=${DRY_RUN}, types=${TYPES.join(',')}, limit=${LIMIT}`);
  if (TYPES.includes('material')) await backfillMaterials();
  if (TYPES.includes('job')) await backfillJobs();
  console.log('\ndone.');
})().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
