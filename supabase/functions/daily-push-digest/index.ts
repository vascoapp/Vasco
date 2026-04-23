// =============================================================================
// DAILY-PUSH-DIGEST — Supabase Edge Function (R226)
// =============================================================================
// Scheduled 18:00 UTC. For every user with at least one registered push
// token:
//   1. Fetch their current state (overdue invoices count/sum, pending EVE
//      queue items, quotes past cohort p75 accept-lag, jobs scheduled
//      tomorrow).
//   2. Ask the policy picker which single push to send (or none).
//   3. Rate-limit via push_notification_log (max 1/day, 24h dedupe on
//      (notif_type, entity_key)).
//   4. Fan out via the existing send-push Edge Function — no duplication
//      of the Expo Push API contract.
//
// Mirrors `src/services/pushDigestPolicy.ts` which is the jest-tested
// version. Keep the two in sync; the unit tests anchor the logic.
//
// Expected cron:
//   schedule = "0 18 * * *"   # 18:00 UTC daily
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_OVERDUE_COUNT = 1;
const MIN_OVERDUE_AMOUNT = 200;
const MIN_QUEUE = 2;
const MIN_STALING = 1;
const MIN_JOBS_TOMORROW = 1;

interface Decision {
  type: string;
  title: string;
  body: string;
  entityKey: string;
}

/** Mirror of src/services/pushDigestPolicy.ts#pickDailyPush. */
function pickDailyPush(input: {
  overdueInvoiceCount: number;
  overdueInvoiceAmount: number;
  queuePendingCount: number;
  stalingQuoteCount: number;
  jobsTomorrowCount: number;
}): Decision | null {
  if (input.overdueInvoiceCount >= MIN_OVERDUE_COUNT && input.overdueInvoiceAmount >= MIN_OVERDUE_AMOUNT) {
    const plural = input.overdueInvoiceCount > 1 ? 's' : '';
    return {
      type: 'overdue_invoices',
      title: `€${input.overdueInvoiceAmount.toLocaleString()} overdue`,
      body: `${input.overdueInvoiceCount} invoice${plural} past due. Send a reminder in 2 taps.`,
      entityKey: `overdue:${input.overdueInvoiceCount}:${input.overdueInvoiceAmount}`,
    };
  }
  if (input.queuePendingCount >= MIN_QUEUE) {
    return {
      type: 'queue_waiting',
      title: `${input.queuePendingCount} actions waiting`,
      body: `Vasco prepared ${input.queuePendingCount} things for you. Approve or skip.`,
      entityKey: `queue:${input.queuePendingCount}`,
    };
  }
  if (input.stalingQuoteCount >= MIN_STALING) {
    const plural = input.stalingQuoteCount > 1 ? 's' : '';
    return {
      type: 'staling_quotes',
      title: `${input.stalingQuoteCount} quote${plural} going stale`,
      body: `Cohort usually accepts within a week. A nudge often unsticks them.`,
      entityKey: `staling:${input.stalingQuoteCount}`,
    };
  }
  if (input.jobsTomorrowCount >= MIN_JOBS_TOMORROW) {
    const plural = input.jobsTomorrowCount > 1 ? 's' : '';
    return {
      type: 'jobs_tomorrow',
      title: `${input.jobsTomorrowCount} job${plural} tomorrow`,
      body: `Materials ready? Route planned? Tap to prep in 30 seconds.`,
      entityKey: `tomorrow:${input.jobsTomorrowCount}`,
    };
  }
  return null;
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
  if (!supabaseUrl || !serviceRole) return json({ error: 'missing env' }, 500);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Users with at least one push token registered.
  const { data: tokenRows } = await admin
    .from('push_tokens')
    .select('user_id')
    .not('user_id', 'is', null);

  const userIds = Array.from(new Set((tokenRows ?? []).map((t: any) => t.user_id))).filter(Boolean);
  if (userIds.length === 0) return json({ processed: 0, sent: 0 });

  const nowIso = new Date().toISOString();
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tomorrowStart = new Date();
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const results: Array<{ userId: string; decision: string; delivery: string }> = [];
  let sentCount = 0;

  for (const userId of userIds) {
    // Rate-limit: skip if any push sent to this user in the last 24h.
    const { count: recentPushes } = await admin
      .from('push_notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('sent_at', dayAgoIso);
    if ((recentPushes ?? 0) > 0) {
      results.push({ userId, decision: 'skip', delivery: 'rate-limited' });
      continue;
    }

    // 2. Fetch state.
    const [overdue, queue, staling, tomorrow] = await Promise.all([
      admin.from('documents')
        .select('total_amount')
        .eq('user_id', userId)
        .eq('doc_type', 'invoice')
        .eq('status', 'overdue'),
      admin.from('ai_queue_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'pending'),
      admin.from('documents')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('doc_type', 'quote')
        .eq('status', 'sent')
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      admin.from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('scheduled_at', tomorrowStart.toISOString())
        .lt('scheduled_at', tomorrowEnd.toISOString()),
    ]);

    const overdueRows = (overdue.data ?? []) as Array<{ total_amount: number | null }>;
    const overdueAmount = Math.round(
      overdueRows.reduce((sum, r) => sum + (r.total_amount ?? 0), 0),
    );
    const decision = pickDailyPush({
      overdueInvoiceCount: overdueRows.length,
      overdueInvoiceAmount: overdueAmount,
      queuePendingCount: queue.count ?? 0,
      stalingQuoteCount: (staling.data ?? []).length,
      jobsTomorrowCount: tomorrow.count ?? 0,
    });

    if (!decision) {
      results.push({ userId, decision: 'none', delivery: 'skipped' });
      continue;
    }

    // 3. 24h dedupe on (type, entity_key).
    const { count: dedup } = await admin
      .from('push_notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('notif_type', decision.type)
      .eq('entity_key', decision.entityKey)
      .gte('sent_at', dayAgoIso);
    if ((dedup ?? 0) > 0) {
      results.push({ userId, decision: decision.type, delivery: 'deduped' });
      continue;
    }

    // 4. Fan out via existing send-push Edge Function.
    let success = true;
    let err: string | null = null;
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({
          userId,
          title: decision.title,
          body: decision.body,
          data: { type: decision.type, entityKey: decision.entityKey },
        }),
      });
      if (!res.ok) { success = false; err = `send-push ${res.status}`; }
    } catch (e) {
      success = false;
      err = (e as Error).message;
    }

    await admin.from('push_notification_log').insert({
      user_id: userId,
      notif_type: decision.type,
      entity_key: decision.entityKey,
      title: decision.title,
      body: decision.body,
      success,
      error: err,
      sent_at: nowIso,
    });

    if (success) sentCount += 1;
    results.push({ userId, decision: decision.type, delivery: success ? 'sent' : `failed:${err}` });
  }

  return json({ processed: userIds.length, sent: sentCount, results });
});
