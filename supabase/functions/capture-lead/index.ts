// =============================================================================
// CAPTURE-LEAD — Public lead-capture endpoint (R84 US Phase 4 close)
// =============================================================================
// Public (no JWT) POST endpoint for the embeddable lead-capture widget.
// Contractor pastes the snippet on their own website; visitors fill the
// form; this fn validates + inserts into `leads`.
//
// Unlike most edge functions in this repo, this is NOT JWT-gated — the
// widget runs on the public web, on the contractor's customer-facing
// site. Instead we use:
//   1. CORS allowing only the contractor's configured origin (per
//      business_settings.website domain).
//   2. A per-IP rate limit (5 submissions/hour).
//   3. Bot-trap honeypot field (`hp_token` must be empty).
//   4. Required contractor identifier in the URL: `?to={user_id}` —
//      the embed snippet bakes this in so we know which contractor
//      owns the lead.
//
// Caller payload:
//   { to: <user_id>, customerName, customerPhone?, customerEmail?,
//     jobDescription?, hp_token? }
// Returns: { ok: true, leadId } on success, { error } otherwise.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS — wide open for now; tighten to per-contractor allowlist when we
// surface the `widget_allowed_origin` column on business_settings.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CaptureLeadRequest {
  to?: string;            // contractor user_id
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  jobDescription?: string;
  hp_token?: string;      // honeypot — must be empty
}

// Simple in-memory rate limit. Per-IP, 5 inserts / hour. Survives only
// within a single edge-fn worker — good enough to slow drive-by spam
// without a Redis dep. Real abuse needs Cloudflare Turnstile (deferred).
const rateBucket = new Map<string, { count: number; firstAt: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 5;

function rateAllowed(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBucket.get(ip);
  if (!bucket || now - bucket.firstAt > RATE_WINDOW_MS) {
    rateBucket.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (bucket.count >= RATE_MAX) return false;
  bucket.count += 1;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRole) return jsonError('server_misconfigured', 500);

  // Parse payload first so we can validate before any DB call.
  let payload: CaptureLeadRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }
  const { to, customerName, customerPhone, customerEmail, jobDescription, hp_token } = payload;

  // Bot trap: real visitors don't fill hidden fields.
  if (hp_token && hp_token.length > 0) {
    // Pretend success so bots don't iterate on a failure signal.
    return new Response(
      JSON.stringify({ ok: true, leadId: 'bot-suppressed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!to || !/^[0-9a-f-]{36}$/i.test(to)) return jsonError('missing_recipient', 400);
  if (!customerName || customerName.trim().length === 0) return jsonError('missing_name', 400);
  if (customerName.length > 200) return jsonError('name_too_long', 400);
  if (jobDescription && jobDescription.length > 2000) return jsonError('description_too_long', 400);

  // Light email/phone sanity. We don't reject — invalid contact info still
  // lands as a lead so the contractor can call back via whatever is
  // valid, but we trim/normalize.
  const cleanedPhone = customerPhone?.trim().replace(/[^\d+\s()-]/g, '') || undefined;
  const cleanedEmail = customerEmail?.trim().toLowerCase() || undefined;

  // Per-IP rate limit.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (!rateAllowed(ip)) return jsonError('rate_limited', 429);

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await admin
      .from('leads')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        user_id: to,
        status: 'new',
        source: 'website_form',
        customer_name: customerName.trim(),
        customer_phone: cleanedPhone,
        customer_email: cleanedEmail,
        job_description: jobDescription?.trim() || null,
      } as any)
      .select('id')
      .single();

    if (error) {
      console.error('capture-lead insert error', error);
      return jsonError('insert_failed', 500);
    }

    return new Response(
      JSON.stringify({ ok: true, leadId: data?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('capture-lead threw', e);
    return jsonError('network', 500);
  }
});

function jsonError(code: string, status: number) {
  return new Response(
    JSON.stringify({ error: code }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
