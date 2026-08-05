// =============================================================================
// MATERIAL MERGE VERIFIER — tests
// =============================================================================
// Run: deno test supabase/functions/_shared/materialMerge.test.ts
//
// Every test here is a way a language model could corrupt material_price_history
// — the training data the whole cohort moat runs on, and the one table that
// cannot be un-poisoned. The verifier's job is to make each of them impossible,
// so these are written as attacks rather than as happy paths.
// =============================================================================

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { acceptableMerges, type MergeCandidate } from './materialMerge.ts';

const c = (key: string, label: string, unit = 'm', category: string | null = 'cable'): MergeCandidate => ({
  cohort_key: key, label, trade: 'electrical', country: 'NL', unit, category, contractors: 1,
});

const CANDIDATES: MergeCandidate[] = [
  c('2.5x3 ymvk', 'YMvK 3x2,5mm²'),
  c('kabel 2.5x3 ymvk', 'kabel YMvK 3x2.5mm2'),
  c('1.5x3 ymvk', 'YMvK 3x1,5mm²'),
  c('gyproc plaat', 'Gyproc plaat', 'stuk', 'board'),
];

Deno.test('accepts the residual merge deterministic rules provably cannot make', () => {
  // 'YMvK 3x2,5mm²' never contains the word "kabel", so no deterministic rule
  // relates it to 'kabel ymvk 3x2.5mm2'. This is the case the whole tier exists
  // for.
  const { accepted, rejected } = acceptableMerges(
    { merges: [{ canonical: '2.5x3 ymvk', variants: ['kabel 2.5x3 ymvk'], reason: 'same cable' }] },
    CANDIDATES,
  );
  assertEquals(accepted.length, 1);
  assertEquals(accepted[0].variants, ['kabel 2.5x3 ymvk']);
  assertEquals(rejected.length, 0);
});

Deno.test('rejects an invented canonical key', () => {
  // The single most dangerous failure: the model writes a key it was not given,
  // e.g. "correcting" a spelling. output ⊆ input is what makes invention
  // structurally impossible rather than merely detectable.
  const { accepted, rejected } = acceptableMerges(
    { merges: [{ canonical: 'ymvk kabel 2.5mm2 3-aderig', variants: ['2.5x3 ymvk'] }] },
    CANDIDATES,
  );
  assertEquals(accepted.length, 0);
  assertEquals(rejected[0].why, 'canonical not in input');
});

Deno.test('rejects an invented variant but keeps the valid ones', () => {
  const { accepted, rejected } = acceptableMerges(
    { merges: [{ canonical: '2.5x3 ymvk', variants: ['kabel 2.5x3 ymvk', 'ymvk deluxe'] }] },
    CANDIDATES,
  );
  assertEquals(accepted.length, 1);
  assertEquals(accepted[0].variants, ['kabel 2.5x3 ymvk']);
  assertEquals(rejected.some((r) => r.why.includes('ymvk deluxe')), true);
});

Deno.test('refuses to merge across units', () => {
  // A price per metre and a price per piece in one cohort is worse than two
  // cohorts that show nothing.
  const { accepted, rejected } = acceptableMerges(
    { merges: [{ canonical: '2.5x3 ymvk', variants: ['gyproc plaat'] }] },
    CANDIDATES,
  );
  assertEquals(accepted.length, 0);
  assertEquals(rejected[0].why.startsWith('unit mismatch'), true);
});

Deno.test('does not prevent a genuinely different size from staying separate', () => {
  // 1,5mm² and 2,5mm² cable are different products at different prices. The
  // verifier cannot know this — but if the model DOES propose it, nothing here
  // stops it, which is why the prompt carries the rule and why this test exists
  // to document the boundary rather than to claim a guarantee.
  const { accepted } = acceptableMerges(
    { merges: [{ canonical: '2.5x3 ymvk', variants: ['1.5x3 ymvk'] }] },
    CANDIDATES,
  );
  assertEquals(accepted.length, 1); // ← accepted: this is a PROMPT-level rule, not a verifier-level one
});

Deno.test('rejects a chained alias — the relation must stay flat', () => {
  // If A→B is accepted and then B→C, the cohort key stops being an equivalence
  // class and Postgres's GROUP BY silently gives the wrong answer.
  const { accepted, rejected } = acceptableMerges(
    {
      merges: [
        { canonical: '2.5x3 ymvk', variants: ['kabel 2.5x3 ymvk'] },
        { canonical: 'kabel 2.5x3 ymvk', variants: ['1.5x3 ymvk'] },
      ],
    },
    CANDIDATES,
  );
  assertEquals(accepted.length, 1);
  assertEquals(rejected[0].why, 'canonical is already a variant (would chain)');
});

Deno.test('rejects claiming one key as a variant twice', () => {
  const { accepted, rejected } = acceptableMerges(
    {
      merges: [
        { canonical: '2.5x3 ymvk', variants: ['kabel 2.5x3 ymvk'] },
        { canonical: '1.5x3 ymvk', variants: ['kabel 2.5x3 ymvk'] },
      ],
    },
    CANDIDATES,
  );
  assertEquals(accepted.length, 1);
  assertEquals(rejected.some((r) => r.why.includes('already claimed')), true);
});

Deno.test('survives junk the model might return', () => {
  for (const junk of [null, undefined, {}, { merges: null }, { merges: [null] }, { merges: [{}] }, 'not json']) {
    const { accepted } = acceptableMerges(junk, CANDIDATES);
    assertEquals(accepted.length, 0);
  }
});

Deno.test('drops a self-merge silently rather than counting it', () => {
  const { accepted } = acceptableMerges(
    { merges: [{ canonical: '2.5x3 ymvk', variants: ['2.5x3 ymvk'] }] },
    CANDIDATES,
  );
  assertEquals(accepted.length, 0);
});
