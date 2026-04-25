// =============================================================================
// EMBED TEXT — Supabase Edge Function (R239)
// =============================================================================
// Generates 1536-d embeddings for arbitrary text and upserts into one of the
// three embedding tables (customer_embeddings, material_embeddings,
// quote_line_embeddings). Provider-agnostic: prefers OpenAI when
// OPENAI_API_KEY is set, falls back to Voyage when VOYAGE_API_KEY is set,
// returns 400 with a clear error if neither.
//
// Input: { table, key, text, userId? } where table ∈ {customer, material, quote_line}
// Output: { ok: true, dimensions, provider } or { ok: false, error }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EmbedTable = 'customer' | 'material' | 'quote_line';

interface RequestBody {
  table: EmbedTable;
  key: string;          // customer_id | material_key | quote_line_id
  text: string;
  userId?: string;
  quoteId?: string;
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

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.table || !body.key || !body.text || body.text.length < 3) {
      return new Response(JSON.stringify({ ok: false, error: 'table, key, and text are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      return new Response(JSON.stringify({
        ok: false,
        error: 'No embedding provider configured. Set OPENAI_API_KEY or VOYAGE_API_KEY.',
      }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server misconfigured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let upsertErr: { message: string } | null = null;
    if (body.table === 'customer') {
      if (!body.userId) {
        return new Response(JSON.stringify({ ok: false, error: 'userId required for customer table' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await admin.from('customer_embeddings').upsert({
        customer_id: body.key,
        user_id: body.userId,
        embedding: vector,
        source_text: body.text.slice(0, 2000),
        embedded_at: new Date().toISOString(),
      });
      upsertErr = error;
    } else if (body.table === 'material') {
      const { error } = await admin.from('material_embeddings').upsert({
        material_key: body.key,
        embedding: vector,
        source_text: body.text.slice(0, 2000),
        embedded_at: new Date().toISOString(),
      });
      upsertErr = error;
    } else if (body.table === 'quote_line') {
      if (!body.userId) {
        return new Response(JSON.stringify({ ok: false, error: 'userId required for quote_line table' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await admin.from('quote_line_embeddings').upsert({
        user_id: body.userId,
        quote_id: body.quoteId ?? null,
        line_id: body.key,
        embedding: vector,
        source_text: body.text.slice(0, 2000),
        embedded_at: new Date().toISOString(),
      });
      upsertErr = error;
    } else {
      return new Response(JSON.stringify({ ok: false, error: 'invalid table' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (upsertErr) {
      return new Response(JSON.stringify({ ok: false, error: upsertErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, dimensions: 1536, provider }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
