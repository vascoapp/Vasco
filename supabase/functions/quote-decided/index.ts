// =============================================================================
// QUOTE-DECIDED — Supabase Edge Function (W119)
// =============================================================================
// The quote portal calls this right after `decide_acceptance_link` succeeds,
// with the same acceptance token. It pushes the CONTRACTOR — "Il cliente ha
// accettato il preventivo Q0001" — in their own language.
//
// Until this existed a customer could accept in the portal, be told "your
// contractor has been notified", and the contractor learned nothing (IT walk
// 2026-10-06). The outcome event and the job are written by the RPC itself
// (migration 20261006000001), so they do not depend on this call arriving.
//
// The token is the only credential, exactly as for the RPC. What stops abuse:
//  - only a link that is ALREADY decided can push (holding a token you could
//    already decide with grants nothing new);
//  - `notified_at` is claimed with an UPDATE … WHERE notified_at IS NULL, so
//    each decision pushes at most once, however often this is called;
//  - only within 15 minutes of the decision.
// The response never says whether a push went out.
//
// POST /functions/v1/quote-decided   { token }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { quoteDecisionPush, type DecisionLocale } from '../_shared/quoteDecisionCopy.ts';
import { resolveEmailLocale } from '../_shared/authEmailTemplates.ts';
import { pushOutcome } from '../_shared/pushOutcome.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const CLAIM_WINDOW_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ ok: false }, 500);

  let token = '';
  try { token = String((await req.json())?.token ?? ''); } catch { /* bad body */ }
  // Same shape check as decide_acceptance_link.
  if (token.length < 8 || token.length > 128 || !/^[A-Za-z0-9_-]+$/.test(token)) return json({ ok: true });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // The once-only claim. Postgres serialises the row update, so two calls
  // racing on the same token cannot both get the row back.
  const since = new Date(Date.now() - CLAIM_WINDOW_MS).toISOString();
  const { data: claimed, error: claimErr } = await admin
    .from('quote_acceptance_links')
    .update({ notified_at: new Date().toISOString() })
    .eq('token', token)
    .in('status', ['accepted', 'rejected'])
    .is('notified_at', null)
    .gte('responded_at', since)
    .select('user_id, quote_id, customer_name, status');
  if (claimErr) {
    console.error('quote-decided: claim failed', claimErr.message);
    return json({ ok: false }, 503); // transient — the portal may retry
  }
  const link = claimed?.[0];
  if (!link) return json({ ok: true });

  // The contractor's language: the account's own, else their market's.
  const { data: settings } = await admin
    .from('business_settings').select('country').eq('user_id', link.user_id).maybeSingle();
  const { data: owner } = await admin.auth.admin.getUserById(link.user_id);
  const meta = (owner?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const locale = resolveEmailLocale(
    typeof meta.language === 'string' ? meta.language : null,
    (settings?.country as string | null) ?? (typeof meta.country === 'string' ? meta.country : null),
  ) as DecisionLocale;

  const { title, body } = quoteDecisionPush(locale, link.status, link.customer_name, link.quote_id);

  const resp = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      userId: link.user_id,
      title,
      body,
      data: { type: 'quote_decision', quoteId: link.quote_id, decision: link.status },
    }),
  }).catch((e) => { console.error('quote-decided: send-push unreachable', String(e)); return null; });

  // Judged by what a DEVICE took (pushOutcome), not by send-push's HTTP
  // status: it answers 200 with sent:0 when every device refused.
  //  - delivered, or no device registered (a retry cannot help; the inbox
  //    and Finanze still show the decision) → keep the claim;
  //  - anything else → release it, so the portal's one retry can push.
  const outcome = resp ? pushOutcome(await resp.json().catch(() => null)) : { delivered: false, error: 'send-push unreachable' };
  if (outcome.delivered || outcome.error === 'no registered device') return json({ ok: true });
  console.error('quote-decided: push not delivered —', outcome.error);
  await admin.from('quote_acceptance_links').update({ notified_at: null }).eq('token', token);
  return json({ ok: false }, 503);
});
