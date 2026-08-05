// =============================================================================
// PROPOSE MATERIAL MERGES — the LLM tier of the pricing moat
// =============================================================================
// The cohort moat needs five DISTINCT contractors per material before it shows
// anyone anything. The binding constraint is not how many observations exist —
// it is that ONE PRODUCT IS SPELLED MANY WAYS, so the observations scatter into
// sub-k groups and the benchmark stays blank while sitting on the data.
//
// Deterministic canonicalisation (src/services/materialNormalization.ts) closes
// most of that: EAN > supplier article number > folded, dimension-aware, sorted
// text. It provably cannot close all of it. 'YMvK 3x2,5mm²' never says "kabel",
// so no rule relates it to 'kabel ymvk 3x2.5mm2'. Subset matching cannot rescue
// it either — the cohort key is a single string Postgres GROUP BYs on, so the
// relation has to be an EQUIVALENCE relation, and subset matching is not
// transitive. That residual is what this function is for, and it is the whole
// reason an LLM is in the pricing path at all.
//
// -----------------------------------------------------------------------------
// THE MODEL SELECTS. IT DOES NOT AUTHOR.
// -----------------------------------------------------------------------------
// It is shown a list of existing cohort keys and asked which ones denote the
// same product, naming one of them as the winner. It never writes a canonical
// string.
//
// That is a deliberate narrowing of `proposalIsAcceptable`, which gates an
// AUTHORED canonical form on being (1) idempotent under the deterministic
// canonicaliser and (2) free of any token absent from the sources. Both checks
// exist to stop the model inventing — it must not decide the cable is 4mm²
// because that is the common size. Selection makes inventing structurally
// impossible instead of merely detectable: the verifier is `output ⊆ input`,
// the same shape as the ranking tier's, and it needs no canonicaliser here.
// Porting the canonicaliser into Deno would have duplicated unicode folding,
// six-language unit aliases and dimension parsing — a drift risk on the one
// table that cannot be un-poisoned.
//
// -----------------------------------------------------------------------------
// WHAT IT MAY NOT DO
// -----------------------------------------------------------------------------
//   - No new keys. Every emitted key must appear in the input.
//   - No chains. A variant may not point at a key that is itself a variant;
//     that breaks transitivity and the equivalence-relation argument with it.
//   - No cross-unit or cross-category merges. Those are separate view columns;
//     merging across them would compare a metre to a piece.
//   - No overwrites. An existing alias stands until a human removes it.
//
// It writes to material_canonical_aliases, which no client key can write to —
// a crafted alias moves every contractor's benchmark, so the write path is
// service_role only, and every row records source + rationale so a bad merge is
// one DELETE away from being undone.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { chat } from '../_shared/llm.ts';
import { acceptableMerges, type MergeCandidate } from '../_shared/materialMerge.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Below this many distinct contractors a cohort shows nothing — the k gate. */
const K = 5;
/** Keys per LLM call. Small batches keep the prompt reviewable and the blast
 *  radius of a bad response bounded. */
const BATCH = 60;

const SYSTEM = [
  'You group construction-material descriptions that refer to the SAME product.',
  '',
  'You will be given a JSON list of cohort keys. Each key is a normalised',
  'material description with its unit and trade. Some keys describe one product',
  'written in different ways.',
  '',
  'Return JSON: {"merges":[{"canonical":"<one key from the list>",',
  '"variants":["<other keys from the list>"],"reason":"<short>"}]}',
  '',
  'HARD RULES:',
  '- Every string you emit MUST be copied exactly from the supplied list.',
  '  Never write a key that is not in the list. Never invent or correct one.',
  '- Only merge when the descriptions denote the same product: same material,',
  '  same dimensions, same specification. Different sizes are different',
  '  products. If two keys differ by a number, they are DIFFERENT.',
  '- Never merge across different units.',
  '- If you are unsure, do not merge. Omitting a real merge costs a little',
  '  precision; a wrong merge corrupts pricing data for every contractor.',
  '- Return {"merges":[]} when nothing should be merged.',
].join('\n');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, error: 'missing service-role config' }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  let dryRun = false;
  try {
    const body = await req.json();
    dryRun = body?.dryRun === true;
  } catch { /* no body is fine */ }

  // Candidates are the cohorts that are LOSING to fragmentation: they exist but
  // sit under the k threshold, so today they show nobody anything. Cohorts
  // already at or above k are left alone — merging them changes live numbers
  // for no gain in coverage.
  const { data: rows, error } = await admin.rpc('get_sub_k_cohort_candidates', { p_k: K });
  if (error) return json({ ok: false, error: error.message }, 500);

  const candidates = (rows ?? []) as MergeCandidate[];
  if (candidates.length < 2) {
    return json({ ok: true, candidates: candidates.length, proposed: 0, written: 0, note: 'nothing to merge' });
  }

  // Group by (trade, country, unit): a merge is only ever legitimate inside one
  // of these, so there is no reason to spend prompt on cross-group comparisons.
  const groups = new Map<string, MergeCandidate[]>();
  for (const c of candidates) {
    const g = `${c.trade}|${c.country}|${c.unit}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }

  let proposed = 0;
  let written = 0;
  const rejections: unknown[] = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += BATCH) {
      const batch = group.slice(i, i + BATCH);
      if (batch.length < 2) continue;

      // Only the key, label and unit go to the model. No prices, no contractor
      // identities, no supplier — a merge decision needs none of them, and the
      // moat's value is in the numbers, which never leave.
      const payload = batch.map((c) => ({ key: c.cohort_key, seen_as: c.label, unit: c.unit }));

      let parsed: unknown;
      try {
        const res = await chat({
          task: 'material_merge',
          jsonMode: true,
          temperature: 0,
          maxTokens: 2000,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: JSON.stringify(payload) },
          ],
        });
        const text = res.text.trim();
        // Models wrap JSON in prose or fences often enough that this is not
        // defensive programming, it is the normal case.
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        parsed = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : { merges: [] };
      } catch (err) {
        // A model failure must never take the moat with it. Skip the batch.
        rejections.push({ batch: i, why: `llm failed: ${String(err)}` });
        continue;
      }

      const { accepted, rejected } = acceptableMerges(parsed, batch);
      proposed += accepted.length;
      rejections.push(...rejected);

      if (dryRun) continue;

      for (const m of accepted) {
        for (const v of m.variants) {
          // onConflict do-nothing: an alias that already exists was either a
          // human decision or an earlier proposal, and neither is this run's to
          // overwrite.
          const { error: insErr } = await admin
            .from('material_canonical_aliases')
            .upsert(
              {
                variant_key: v,
                canonical_key: m.canonical,
                source: 'llm',
                confidence: null,
                rationale: m.reason ?? null,
              },
              { onConflict: 'variant_key', ignoreDuplicates: true },
            );
          if (!insErr) written += 1;
        }
      }
    }
  }

  return json({
    ok: true,
    candidates: candidates.length,
    proposed,
    written,
    dryRun,
    // Returned rather than swallowed: what the verifier threw out is the most
    // useful signal about whether this tier is behaving.
    rejected: rejections.slice(0, 50),
  });
});
