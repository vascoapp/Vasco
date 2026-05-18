// =============================================================================
// SIGN-QUOTE-TOKEN — Supabase Edge Function
// =============================================================================
// Contractor calls this (with their JWT) after creating/updating a quote to
// get a shareable recipient link. The response includes:
//   - token: the signed HMAC payload
//   - url: full https URL the contractor can copy into an email/WhatsApp
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const secret = Deno.env.get('QUOTE_LINK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const portalBase = Deno.env.get('QUOTE_PORTAL_BASE') ?? 'https://vascobuild.com/quote';
    if (!secret || !supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const auth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quoteId } = (await req.json()) as { quoteId: string };
    if (!quoteId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing quoteId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure the quote belongs to the caller (prevents token forgery across users)
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: quote, error: qErr } = await admin
      .from('documents')
      .select('id, user_id, doc_type')
      .eq('id', quoteId)
      .maybeSingle();
    if (qErr || !quote || quote.doc_type !== 'quote' || quote.user_id !== user.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Quote not found or forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = { quoteId, issuedAt: Date.now() };
    const payloadStr = JSON.stringify(payload);
    const payloadB64 = b64urlEncode(new TextEncoder().encode(payloadStr));
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
    const sigB64 = b64urlEncode(new Uint8Array(sigBuf));
    const token = `${payloadB64}.${sigB64}`;
    const url = `${portalBase}/${encodeURIComponent(quoteId)}?t=${token}`;

    return new Response(JSON.stringify({ ok: true, token, url }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
