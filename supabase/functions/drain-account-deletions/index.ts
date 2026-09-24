// =============================================================================
// DRAIN-ACCOUNT-DELETIONS — GDPR Art. 17 worker (R220)
// =============================================================================
// Invoked on a daily cron. For every pending row in account_deletion_requests
// this function:
//   1. Flips status → 'processing' (idempotent lock — another invocation
//      running in parallel won't pick up the same row twice).
//   2. Erases user-owned rows in tables where GDPR erasure applies:
//        push_tokens, scanned_invoices, job_photos, customer_interactions,
//        decision_submissions, customer_uploads (storage bucket).
//   3. Calls auth.admin.deleteUser(user_id) — ON DELETE CASCADE sweeps the
//      remaining user-scoped tables, issued invoices INCLUDED.
//   4. Flips status → 'done', clears the free-text reason. The request row no
//      longer cascades (migration 20260924000002): it is the minimal record
//      that the erasure happened, deleted after 3 years.
//
// EXPORT, THEN DELETE (user's decision, 2026-09-24): keeping invoices is the
// CONTRACTOR's duty, not Vasco's. The app's delete-account screen makes them
// download their records first; Vasco then keeps nothing.
//
// Failures: on error the row is flipped back to 'pending' with a note — the
// next cron tick retries. We don't auto-retry in-process to keep the window
// bounded and the work log auditable.
//
// Expected cron (once per day at 02:00 UTC):
//   schedule = "0 2 * * *"
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tables where user-owned rows are hard-deleted.
// Order matters only when FKs point between them — currently they don't.
const HARD_DELETE_TABLES = [
  'push_tokens',
  'scanned_invoices',
  'job_photos',
  'quote_line_deltas',
  'customer_payment_patterns',
  'pricing_intelligence',
  'affiliate_clicks',
  'contractor_pricing_calibration',
  // FK to auth.users is ON DELETE SET NULL, so the cascade would KEEP these
  // rows — with free text (job_description), event payloads and features —
  // under a copy that says everything is erased (review 2026-09-24).
  'analytics_events',
  'data_events',
  'job_embeddings',
  'model_training_pairs',
  'price_observations',
] as const;

// Tables whose rows belong to the contractor through ANOTHER column — they
// have no `user_id`, so `.eq('user_id', …)` was a permanent error on every
// run: each request was rolled back to `pending` and retried forever, and no
// erasure could ever be recorded as done (review 2026-09-24, checked against
// the live schema snapshot). Each is resolved to ids before anything is gone.
//   customer_questions     → contractor_user_id
//   material_price_history → observed_by (SET NULL FK; carries a postcode)
//   decision_submissions   → tracker_id ∈ the contractor's decision_trackers
//   customer_interactions  → customer_id ∈ their customers, or quote_id ∈ their documents
// Guard: src/__tests__/erasureReachesEveryOwnedRow.test.ts.


// Storage buckets to empty (best-effort; ignore missing objects).
const STORAGE_BUCKETS_TO_EMPTY = ['customer-uploads', 'job-photos'] as const;

interface DeletionRow {
  id: string;
  user_id: string;
  requested_at: string;
  reason: string | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) {
    return json({ error: 'missing env' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pull up to 50 per run — cron runs daily; unless there's an abuse spike
  // 50 easily covers normal deletion volume without hitting any timeout.
  const { data: pending, error: pendingErr } = await admin
    .from('account_deletion_requests')
    .select('id, user_id, requested_at, reason')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
    .limit(50);

  if (pendingErr) return json({ error: pendingErr.message }, 500);
  // Every run: erasure records are kept 3 years (accountability), then go.
  const cutoff = new Date(Date.now() - 3 * 365 * 86_400_000).toISOString();
  const { error: ageErr } = await admin.from('account_deletion_requests').delete().eq('status', 'done').lt('processed_at', cutoff);
  if (ageErr) console.error(`drain-account-deletions: could not age out old erasure records: ${ageErr.message}`);
  // A request the user withdrew (set by the operator on an email) was never
  // processed — no processed_at — and was kept forever. Same 3 years, from
  // when it was made.
  const { error: cancelErr } = await admin.from('account_deletion_requests').delete().eq('status', 'cancelled').lt('requested_at', cutoff);
  if (cancelErr) console.error(`drain-account-deletions: could not age out old cancelled requests: ${cancelErr.message}`);

  if (!pending || pending.length === 0) return json({ processed: 0 });

  const results: Array<{ id: string; status: 'done' | 'failed'; note?: string }> = [];

  for (const row of pending as DeletionRow[]) {
    // Step 1 — atomic lock via CAS-style update: status pending → processing.
    // If another invocation already flipped it, our update returns 0 rows
    // and we skip this one.
    const { data: locked, error: lockErr } = await admin
      .from('account_deletion_requests')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id');

    if (lockErr || !locked || locked.length === 0) continue;

    const errors: string[] = [];

    // Step 2a — rows owned through another column (resolve ids FIRST: the
    // trackers, customers and documents go with the auth user in step 4).
    {
      const { error: qErr } = await admin.from('customer_questions').delete().eq('contractor_user_id', row.user_id);
      if (qErr) errors.push(`customer_questions: ${qErr.message}`);

      const { error: mphErr } = await admin.from('material_price_history').delete().eq('observed_by', row.user_id);
      if (mphErr) errors.push(`material_price_history: ${mphErr.message}`);

      const { data: trackers, error: trErr } = await admin.from('decision_trackers').select('id').eq('user_id', row.user_id);
      if (trErr) errors.push(`decision_trackers(lookup): ${trErr.message}`);
      const trackerIds = (trackers ?? []).map((t: { id: string }) => String(t.id));
      if (trackerIds.length > 0) {
        const { error } = await admin.from('decision_submissions').delete().in('tracker_id', trackerIds);
        if (error) errors.push(`decision_submissions: ${error.message}`);
      }

      const { data: custs, error: cErr } = await admin.from('customers').select('id').eq('user_id', row.user_id);
      const { data: docs, error: dErr } = await admin.from('documents').select('id').eq('user_id', row.user_id);
      if (cErr || dErr) errors.push(`customer_interactions(lookup): ${(cErr ?? dErr)!.message}`);
      // PostgREST returns at most 1000 rows; a larger account is erased in
      // more than one run (the request stays pending until nothing is left).
      if ((custs ?? []).length >= 1000 || (docs ?? []).length >= 1000) errors.push('customer_interactions: more than 1000 customers/documents — continuing next run');
      const customerIds = (custs ?? []).map((c: { id: string }) => c.id);
      const docIds = (docs ?? []).map((d: { id: string }) => d.id);
      // In chunks: a long `.in()` list overflows the request URL, and
      // customer_interactions has no FK, so the auth cascade would not clean
      // up what an oversized request failed to delete (review 2026-09-24).
      for (let i = 0; i < customerIds.length; i += 100) {
        const { error } = await admin.from('customer_interactions').delete().in('customer_id', customerIds.slice(i, i + 100));
        if (error) errors.push(`customer_interactions(customer): ${error.message}`);
      }
      for (let i = 0; i < docIds.length; i += 100) {
        const { error } = await admin.from('customer_interactions').delete().in('quote_id', docIds.slice(i, i + 100));
        if (error) errors.push(`customer_interactions(quote): ${error.message}`);
      }
    }

    // Step 2b — hard-delete rows keyed by user_id.
    for (const table of HARD_DELETE_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', row.user_id);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // Step 3 — empty storage buckets (best-effort). The old flat
    // list(user_id)+remove(`${user_id}/${name}`) matched NOTHING for either
    // bucket (GDPR Art. 17 violation — PII persisted after deletion):
    //   • job-photos keys are NESTED: <user_id>/<job_id>/<file> — list(user_id)
    //     returns the <job_id> folders, and remove() of a folder prefix is a
    //     silent no-op. Recurse one level.
    //   • customer-uploads keys are <tracker_access_code>/<file> — NOT keyed by
    //     user_id at all. Resolve the user's tracker codes first.
    try {
      const { data: jobFolders } = await admin.storage.from('job-photos').list(row.user_id, { limit: 1000 });
      const keys: string[] = [];
      for (const folder of jobFolders ?? []) {
        const { data: files } = await admin.storage.from('job-photos').list(`${row.user_id}/${folder.name}`, { limit: 1000 });
        for (const f of files ?? []) keys.push(`${row.user_id}/${folder.name}/${f.name}`);
      }
      if (keys.length > 0) {
        const { error: rmErr } = await admin.storage.from('job-photos').remove(keys);
        if (rmErr) errors.push(`storage(job-photos): ${rmErr.message}`);
      }
    } catch (e) {
      errors.push(`storage(job-photos): ${(e as Error).message}`);
    }
    try {
      // decision_trackers is NOT hard-deleted before this step, so it's still
      // queryable to resolve the customer-uploads prefixes.
      const { data: trackers } = await admin.from('decision_trackers').select('access_code').eq('user_id', row.user_id);
      for (const tr of (trackers ?? []) as Array<{ access_code: string | null }>) {
        if (!tr.access_code) continue;
        const { data: files } = await admin.storage.from('customer-uploads').list(tr.access_code, { limit: 1000 });
        const keys = (files ?? []).map(f => `${tr.access_code}/${f.name}`);
        if (keys.length > 0) {
          const { error: rmErr } = await admin.storage.from('customer-uploads').remove(keys);
          if (rmErr) errors.push(`storage(customer-uploads): ${rmErr.message}`);
        }
      }
    } catch (e) {
      errors.push(`storage(customer-uploads): ${(e as Error).message}`);
    }

    // Step 4 — delete the auth user last. ON DELETE CASCADE handles
    // remaining tables that reference auth.users(id).
    // ONLY when every step above landed: a partial erasure is rolled back to
    // `pending` and retried, never finished by the cascade (review 2026-09-24).
    // The request row itself no longer cascades (20260924000002 dropped its
    // FK) — it is the erasure record. 🔴 That migration must be APPLIED before
    // this worker is deployed, or the record vanishes with the user.
    if (errors.length === 0) {
      const { error: userErr } = await admin.auth.admin.deleteUser(row.user_id);
      // Already gone (removed from the dashboard or by hand): the goal is
      // reached. Since the request row no longer cascades, treating this as a
      // failure would retry it on every tick, forever (review 2026-09-24).
      const alreadyGone = !!userErr && ((userErr as { status?: number }).status === 404 || (userErr as { code?: string }).code === 'user_not_found');
      if (userErr && !alreadyGone) errors.push(`auth.deleteUser: ${userErr.message}`);
    }

    // Step 5 — finalise the request row.
    //
    // Everything above is irreversible: rows hard-deleted, buckets emptied,
    // the auth user gone. These two writes are the ONLY record of that, and
    // their results were discarded. On the success path that loses the GDPR
    // Art. 17 completion record — the row stays `processing`, which the fetch
    // at the top does not select, so a regulator sees an unfulfilled request
    // over an account that no longer exists. On the failure path the rollback
    // to `pending` is the only thing that makes the next tick retry; if it
    // does not land, the erasure is permanently half-done and never retried
    // (#352).
    if (errors.length === 0) {
      const { data: doneRows, error: doneErr } = await admin
        .from('account_deletion_requests')
        .update({
          status: 'done',
          processed_at: new Date().toISOString(),
          processor_notes: `hard_deleted=${HARD_DELETE_TABLES.length} buckets=${STORAGE_BUCKETS_TO_EMPTY.length}`,
          reason: null, // free text the user typed — not part of the minimal record
        })
        .eq('id', row.id)
        .select('id');
      // 0 rows = the completion record did not land (the row no longer
      // cascades with the user since 20260924000002, so this is a real loss).
      if (!doneErr && (!doneRows || doneRows.length === 0)) {
        console.error(`drain-account-deletions: ERASURE COMPLETED for request ${row.id} (user ${row.user_id}) but no completion record was written.`);
      }
      if (doneErr) {
        console.error(`drain-account-deletions: ERASURE COMPLETED for request ${row.id} (user ${row.user_id}) but the completion record was NOT written:`, doneErr.message);
        results.push({ id: row.id, status: 'done', note: `completion record not written: ${doneErr.message}` });
      } else {
        results.push({ id: row.id, status: 'done' });
      }
    } else {
      // Rollback the lock so the next cron tick retries. Cap at 5 retries
      // via a note suffix; operator intervention needed past that.
      const { error: rollbackErr } = await admin
        .from('account_deletion_requests')
        .update({
          status: 'pending',
          processor_notes: (row as any).processor_notes
            ? `${(row as any).processor_notes}; retry: ${errors.slice(0, 3).join('|')}`
            : `retry: ${errors.slice(0, 3).join('|')}`,
        })
        .eq('id', row.id);
      if (rollbackErr) {
        // Stuck in `processing`: no tick will pick it up again, and part of
        // the account is already gone. This needs a human.
        console.error(`drain-account-deletions: request ${row.id} is STRANDED in processing — the lock rollback failed (${rollbackErr.message}) after a partial erasure. Manual intervention required.`);
      }
      results.push({
        id: row.id,
        status: 'failed',
        note: errors.join(' | '),
        ...(rollbackErr ? { stranded: true } : {}),
      });
    }
  }

  return json({
    processed: results.filter(r => r.status === 'done').length,
    failed: results.filter(r => r.status === 'failed').length,
    details: results,
  });
});
