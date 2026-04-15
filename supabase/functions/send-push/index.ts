// =============================================================================
// SEND-PUSH — Supabase Edge Function
// =============================================================================
// Fan-out to Expo Push API for a given user. Called by webhooks (invoice
// paid, Mollie/Stripe) or triggered by the app. Reads the user's active
// push_tokens rows and sends one notification per device.
// =============================================================================
// POST /functions/v1/send-push
// Body: { userId, title, body, data? }
// Returns: { ok, sent, failed }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SendPushRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default';
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceKey || !supabaseUrl) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization') ?? '';
    const isInternal = authHeader === `Bearer ${serviceKey}`;
    const body = (await req.json()) as SendPushRequest;

    if (!body.userId || !body.title || !body.body) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // If not internal (webhook), require the caller to be the same user
    if (!isInternal) {
      const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anonClient.auth.getUser();
      if (!user || user.id !== body.userId) {
        return new Response(JSON.stringify({ ok: false, error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: tokens, error: tokErr } = await admin
      .from('push_tokens')
      .select('token, platform, device_id')
      .eq('user_id', body.userId);
    if (tokErr) {
      return new Response(JSON.stringify({ ok: false, error: tokErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const rows = (tokens ?? []) as Array<{ token: string; platform: string; device_id: string }>;
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, failed: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages: ExpoPushMessage[] = rows.map((r) => ({
      to: r.token,
      title: body.title,
      body: body.body,
      data: body.data,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
    }));

    // Expo accepts up to 100 messages per request
    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) chunks.push(messages.slice(i, i + 100));

    let sent = 0;
    let failed = 0;
    const invalidTokens: string[] = [];

    for (const chunk of chunks) {
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const json: any = await resp.json().catch(() => ({}));
      const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
      for (let i = 0; i < tickets.length; i += 1) {
        const t = tickets[i];
        if (t?.status === 'ok') sent += 1;
        else {
          failed += 1;
          if (t?.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(chunk[i].to);
          }
        }
      }
    }

    // Prune tokens that Expo told us are dead
    if (invalidTokens.length > 0) {
      await admin.from('push_tokens').delete().in('token', invalidTokens);
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, pruned: invalidTokens.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
