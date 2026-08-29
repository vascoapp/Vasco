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

    // `documents.total_amount` is the NET total for a quote — the same unit as
    // `Quote.amount` in the app, which the quote screen grosses up for display
    // and `grossFromNet` grosses up again on the way to an invoice. This page
    // and the acceptance page below both used to render that net figure under
    // a bare "Gesamt / Totaal / Total", so the customer confirmed a price
    // 19-22% below the invoice they were then sent. Mirrors
    // `src/constants/taxRates.ts`; keep the two in step.
    const VAT_RATES: Record<string, number> = {
      NL: 0.21, DE: 0.19, FR: 0.20, ES: 0.21, IT: 0.22, UK: 0.20,
    };
    const vatRate = VAT_RATES[profile?.country ?? ''] ?? 0.21;
    const netTotal = Number(quote.total_amount) || 0;
    const vatAmount = Math.round(netTotal * vatRate * 100) / 100;
    const grossTotal = Math.round((netTotal + vatAmount) * 100) / 100;

    // ── An acceptance capability for the customer holding this link ──────
    //
    // The portal used to render the quote and then tell the reader to "open in
    // Vasco to accept" — an app the contractor's CUSTOMER does not have. That
    // was the honest handoff while nothing was wired; decide_acceptance_link
    // exists now, so the seam is just a seam: the richer link (with line items)
    // could not accept, and the link that could accept showed no line items.
    //
    // Look up before creating, so viewing a quote twice does not mint two
    // bearer tokens. Only the holder of a VALID SIGNED token reaches this line,
    // so handing them an acceptance token grants nothing they were not already
    // meant to have — it is the same customer, the same quote.
    //
    // A quote already decided returns its token and status anyway: the page
    // needs to say "already answered" rather than offer a button that will be
    // refused.
    let acceptance: { token: string; status: string } | null = null;
    try {
      const { data: existing } = await admin
        .from('quote_acceptance_links')
        .select('token, status, expires_at')
        .eq('user_id', quote.user_id)
        .eq('quote_id', quote.document_number)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        acceptance = { token: existing.token, status: existing.status };
      } else if (quote.status !== 'paid') {
        // 32 hex chars = 128 bits, the same floor the app's generator uses for
        // a capability token.
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        const token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
        const { error: mintErr } = await admin.from('quote_acceptance_links').insert({
          token,
          user_id: quote.user_id,
          quote_id: quote.document_number,
          customer_id: quote.customer_id,
          customer_name: customer?.name ?? null,
          quote_amount: grossTotal,
          // 90 days matches the quote-link validity the portal already tells
          // the customer about.
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (!mintErr) acceptance = { token, status: 'pending' };
      }
    } catch (e) {
      // The quote must still render. An acceptance token we could not mint
      // means the page falls back to the app handoff, not an error screen.
      console.error('verify-quote-token: acceptance link', e);
    }

    return new Response(JSON.stringify({
      ok: true,
      quote: {
        id: quote.id,
        reference: quote.document_number,
        subtotal: netTotal,
        vatRate,
        vatAmount,
        total: grossTotal,
        status: quote.status,
        lines: lines ?? [],
        customer,
        business: profile,
      },
      acceptance,
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
