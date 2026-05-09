// =============================================================================
// GENERATE EMBEDDING — Supabase Edge Function (R279)
// =============================================================================
// Read-only twin of embed-text. Returns a 1536-d embedding for arbitrary text
// without any DB side effects. Used by src/intelligence/semanticSearch.ts to
// embed query strings before calling the match_similar_items pgvector RPC.
//
// Provider chain: OpenAI (text-embedding-3-small) → Voyage (voyage-3) →
// 503 with clear error when neither is configured.
//
// Input:  { text: string }
// Output: { ok: true, embedding: number[], dimensions: 1536, provider } |
//         { ok: false, error }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// R66r49 #13 audit: this function bills OpenAI/Voyage per call. Without
// auth, anyone with the URL can loop calls and run up the bill. Require
// a valid user JWT.
async function requireAuth(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized — missing token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) {
    return new Response(JSON.stringify({ ok: false, error: 'server config missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized — invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return { userId: user.id };
}

interface RequestBody {
  text: string;
}

async function embedWithOpenAI(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const vector = json?.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.length === 1536 ? vector : null;
  } catch {
    return null;
  }
}

async function embedWithVoyage(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [text.slice(0, 8000)],
        model: 'voyage-3',
        output_dimension: 1536,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const vector = json?.data?.[0]?.embedding;
    return Array.isArray(vector) && vector.length === 1536 ? vector : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // R66r49 #13: gate before paying for embedding call.
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.text || typeof body.text !== 'string' || body.text.trim().length < 3) {
      return new Response(
        JSON.stringify({ ok: false, error: 'text is required (min 3 chars)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const voyageKey = Deno.env.get('VOYAGE_API_KEY');

    let vector: number[] | null = null;
    let provider = '';
    if (openaiKey) {
      vector = await embedWithOpenAI(body.text, openaiKey);
      provider = 'openai';
    }
    if (!vector && voyageKey) {
      vector = await embedWithVoyage(body.text, voyageKey);
      provider = 'voyage';
    }
    if (!vector) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'No embedding provider configured. Set OPENAI_API_KEY or VOYAGE_API_KEY.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, embedding: vector, dimensions: 1536, provider }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
