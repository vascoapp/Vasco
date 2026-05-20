// =============================================================================
// SEND-SMS — Twilio proxy for transactional SMS (R79 US Phase 2)
// =============================================================================
// Invoked from the mobile app via `supabase.functions.invoke('send-sms', ...)`
// with `{ to: '+1XXXXXXXXXX', body: '...' }`. Forwards to Twilio's
// Messages API and returns the resulting SID.
//
// JWT-gated — only authenticated callers can hit this so opt-in bots can't
// spam the contractor's Twilio balance.
//
// Required secrets (operator-set, none default):
//   TWILIO_ACCOUNT_SID   AC... (32 chars)
//   TWILIO_AUTH_TOKEN    32-char hex
//   TWILIO_FROM          +1XXXXXXXXXX  (Twilio-purchased number)
//
// Deploy:
//   supabase functions deploy send-sms
//   supabase secrets set TWILIO_ACCOUNT_SID=ACxxx \
//                       TWILIO_AUTH_TOKEN=xxx \
//                       TWILIO_FROM=+1XXXXXXXXXX
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmsRequest {
  to: string;
  body: string;
}

interface TwilioMessageResponse {
  sid: string;
  status: string;
  error_code: number | null;
  error_message: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // JWT gate — caller must be authenticated
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError('unauthenticated', 401);
  }

  // ── Auth check ──
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnon) {
    return jsonError('server_misconfigured', 500);
  }
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return jsonError('unauthenticated', 401);

  // ── Twilio creds ──
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const fromNumber = Deno.env.get('TWILIO_FROM');
  if (!accountSid || !authToken || !fromNumber) {
    // Twilio not configured yet — return a clear signal so the client
    // can surface "Operator hasn't enabled SMS" rather than retrying.
    return jsonError('twilio_not_configured', 503);
  }

  // ── Payload ──
  let payload: SmsRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }
  const { to, body } = payload;
  if (!to || !body) return jsonError('missing_fields', 400);

  // Twilio E.164 validation — saves a wasted API call.
  if (!/^\+\d{10,15}$/.test(to)) return jsonError('invalid_phone', 400);
  if (body.length > 1600) return jsonError('body_too_long', 400);

  // ── Forward to Twilio ──
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = btoa(`${accountSid}:${authToken}`);
  const form = new URLSearchParams({ From: fromNumber, To: to, Body: body });

  try {
    const resp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = await resp.json() as TwilioMessageResponse;

    if (!resp.ok || data.error_code) {
      console.error('Twilio error', data);
      return jsonError('twilio_error', 502, {
        twilio_code: data.error_code,
        twilio_msg: data.error_message,
      });
    }

    return new Response(
      JSON.stringify({ sid: data.sid, status: data.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('send-sms threw', e);
    return jsonError('network', 502);
  }
});

function jsonError(code: string, status: number, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ error: code, ...(extra ?? {}) }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
