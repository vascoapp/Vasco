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

// Return type is inferred on purpose: annotating it `Uint8Array` widens the
// buffer back to ArrayBufferLike and re-breaks the crypto.subtle call below.
function b64urlDecode(s: string) {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const std = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(std);
  // Built on an explicit ArrayBuffer, not `new Uint8Array(len)`. Since TS 5.7
  // the latter is typed `Uint8Array<ArrayBufferLike>`, which is not assignable
  // to the `BufferSource` that `crypto.subtle.verify` wants — because
  // ArrayBufferLike admits SharedArrayBuffer. Runtime behaviour is identical;
  // this just states the buffer kind the code already relies on.
  const out = new Uint8Array(new ArrayBuffer(bin.length));
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

    // Unguarded `req.json()` threw on any non-JSON body and fell through to the
    // outer catch as a 500. Same rule as the token itself: on a public endpoint
    // every shape of bad input is the caller's 400, never our 500.
    let body: { quoteId?: string; token?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { quoteId, token } = body;
    if (!quoteId || !token || !token.includes('.')) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing or malformed token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [payloadB64, sigB64] = token.split('.');

    // SIGNATURE FIRST. This used to parse the payload and branch on its
    // contents — quote mismatch, expiry — *before* checking the HMAC, which let
    // an unsigned caller drive control flow and read back which branch they hit.
    // Nothing in the token may be believed until it is proven ours.
    const valid = await verifyHmac(payloadB64, sigB64, secret);
    if (!valid) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // `atob` throws InvalidCharacterError on non-base64 and JSON.parse throws on
    // non-JSON. This is a PUBLIC endpoint — `?t=` comes straight off a link a
    // customer (or anyone) can edit — so both must be a 400, not an unhandled
    // throw that reached the outer catch and returned 500 with the raw JS error
    // in the body. `verifyHmac` already guarded its own decode; the payload
    // decode was simply missed.
    let payload: { quoteId: string; issuedAt: number };
    try {
      payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Malformed token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof payload?.quoteId !== 'string' || typeof payload?.issuedAt !== 'number') {
      return new Response(JSON.stringify({ ok: false, error: 'Malformed token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
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

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: quote, error: qErr } = await admin
      .from('documents')
      // 🔴 `metadata` was in this list and **is not a column on documents**.
      // PostgREST answered 42703 "column documents.metadata does not exist",
      // which lands in `qErr` — and the branch below maps any qErr to
      // "Quote not found". So this function returned 404 for EVERY valid quote
      // and could never once have succeeded. It went unnoticed because the
      // missing QUOTE_LINK_SECRET short-circuited the request long before the
      // query ran. `scope_text` / `notes` are the real prose columns if the
      // portal ever needs them; `metadata` is optional in PortalQuote and no
      // caller reads it.
      .select('id, user_id, customer_id, total_amount, document_number, status')
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
        lines: lines ?? [],
        customer,
        business: profile,
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Unauthenticated endpoint: log the detail, return none of it. `String(err)`
    // handed a stack-shaped internal message to anyone who could edit the link.
    console.error('verify-quote-token:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Verification failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
