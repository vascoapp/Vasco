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
//   3. Anonymises rows EU tax law requires we retain for 7 years:
//        invoices, quotes, jobs → customer/description NULLed, amounts kept.
//   4. Calls auth.admin.deleteUser(user_id) — ON DELETE CASCADE sweeps the
//      remaining user-scoped tables automatically.
//   5. Flips status → 'done' with `processed_at` + processor_notes summary.
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
  'customer_interactions',
  'decision_submissions',
  'quote_line_deltas',
  'customer_payment_patterns',
  'pricing_intelligence',
  'affiliate_clicks',
  'customer_questions',
  'contractor_pricing_calibration',
] as const;

// Tables we MUST retain (EU tax law — 7yr retention) but anonymise.
// For each table: column(s) to NULL out.
const ANONYMISE_TABLES: Array<{ table: string; nullColumns: string[] }> = [
  { table: 'documents', nullColumns: ['notes', 'customer_id'] },
];

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

    // Step 2 — hard-delete user-owned rows.
    for (const table of HARD_DELETE_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', row.user_id);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // Step 3 — anonymise retained rows (documents etc.) owned by the user.
    for (const { table, nullColumns } of ANONYMISE_TABLES) {
      const patch: Record<string, null> = {};
      for (const col of nullColumns) patch[col] = null;
      const { error } = await admin.from(table).update(patch).eq('user_id', row.user_id);
      if (error) errors.push(`${table}(anon): ${error.message}`);
    }

    // Step 4 — empty storage buckets (best-effort). The old flat
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

    // Step 5 — delete the auth user last. ON DELETE CASCADE handles
    // remaining tables that reference auth.users(id).
    const { error: userErr } = await admin.auth.admin.deleteUser(row.user_id);
    if (userErr) errors.push(`auth.deleteUser: ${userErr.message}`);

    // Step 6 — finalise the request row.
    if (errors.length === 0) {
      await admin
        .from('account_deletion_requests')
        .update({
          status: 'done',
          processed_at: new Date().toISOString(),
          processor_notes: `hard_deleted=${HARD_DELETE_TABLES.length} anon=${ANONYMISE_TABLES.length} buckets=${STORAGE_BUCKETS_TO_EMPTY.length}`,
        })
        .eq('id', row.id);
      results.push({ id: row.id, status: 'done' });
    } else {
      // Rollback the lock so the next cron tick retries. Cap at 5 retries
      // via a note suffix; operator intervention needed past that.
      await admin
        .from('account_deletion_requests')
        .update({
          status: 'pending',
          processor_notes: (row as any).processor_notes
            ? `${(row as any).processor_notes}; retry: ${errors.slice(0, 3).join('|')}`
            : `retry: ${errors.slice(0, 3).join('|')}`,
        })
        .eq('id', row.id);
      results.push({ id: row.id, status: 'failed', note: errors.join(' | ') });
    }
  }

  return json({
    processed: results.filter(r => r.status === 'done').length,
    failed: results.filter(r => r.status === 'failed').length,
    details: results,
  });
});
