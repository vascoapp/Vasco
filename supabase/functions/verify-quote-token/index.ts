// =============================================================================
// VERIFY-QUOTE-TOKEN — Supabase Edge Function
// =============================================================================
// Public quote portal links carry a signed HMAC token so we can drop the
// contractor's auth session and still prove the visitor is the intended
// recipient. Token format:
//
//   base64url({ quoteId, issuedAt }) . base64url(hmac-sha256(payload, secret))
//
// The client POSTs { quoteId, token } here; this function returns the quote
// record (+ line items + business name) if the token is valid and fresh.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const std = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyHmac(payload: string, sigB64: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sig = b64urlDecode(sigB64);
    return await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('QUOTE_LINK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret || !supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { quoteId, token } = (await req.json()) as { quoteId: string; token: string };
    if (!quoteId || !token || !token.includes('.')) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing or malformed token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [payloadB64, sigB64] = token.split('.');
    const payloadJson = new TextDecoder().decode(b64urlDecode(payloadB64));
    const payload = JSON.parse(payloadJson) as { quoteId: string; issuedAt: number };
    if (payload.quoteId !== quoteId) {
      return new Response(JSON.stringify({ ok: false, error: 'Token/quote mismatch' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
      return new Response(JSON.stringify({ ok: false, error: 'Token expired' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const valid = await verifyHmac(payloadB64, sigB64, secret);
    if (!valid) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: quote, error: qErr } = await admin
      .from('documents')
      .select('id, user_id, customer_id, total_amount, document_number, status, metadata')
      .eq('id', quoteId)
      .eq('doc_type', 'quote')
      .maybeSingle();
    if (qErr || !quote) {
      return new Response(JSON.stringify({ ok: false, error: 'Quote not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: lines } = await admin
      .from('line_items')
      .select('description, quantity, unit_price, total_price, position')
      .eq('document_id', quoteId)
      .order('position', { ascending: true });

    const { data: profile } = await admin
      .from('business_settings')
      .select('business_name, phone, email, country')
      .eq('user_id', quote.user_id)
      .maybeSingle();

    const { data: customer } = quote.customer_id
      ? await admin.from('customers').select('name, email').eq('id', quote.customer_id).maybeSingle()
      : { data: null };

    return new Response(JSON.stringify({
      ok: true,
      quote: {
        id: quote.id,
        reference: quote.document_number,
        total: quote.total_amount,
        status: quote.status,
        metadata: quote.metadata,
        lines: lines ?? [],
        customer,
        business: profile,
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
