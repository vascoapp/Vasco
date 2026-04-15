// =============================================================================
// DRAFT-CUSTOMER-REPLY — Supabase Edge Function
// =============================================================================
// Takes the last inbound customer message + short context and asks Claude Haiku
// for three reply options in the contractor's preferred tone. Returns JSON:
//   { options: [{ tone: 'friendly', text: '...' }, {...}, {...}] }
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Req {
  inbound: string;
  context?: string;
  language: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
  customerName?: string;
  businessName?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!supabaseUrl || !anonKey || !anthropicKey) {
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
    const auth = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: Req = await req.json();
    if (!body.inbound || body.inbound.length > 4000) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid inbound message' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `You are drafting reply options for a construction trade contractor responding to a customer message.
Target language: ${body.language}. Keep every reply short (under 60 words), direct, and professional.

Customer: ${body.customerName ?? 'Customer'}
Business: ${body.businessName ?? 'Contractor'}
Context: ${body.context ?? '(none)'}

Customer said:
"""
${body.inbound}
"""

Return ONLY JSON matching:
{"options":[{"tone":"friendly","text":"…"},{"tone":"firm","text":"…"},{"tone":"concise","text":"…"}]}
No markdown fences.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ ok: false, error: `Claude ${resp.status}`, detail: errText.slice(0, 300) }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const json: any = await resp.json();
    const text: string = json?.content?.[0]?.text ?? '';
    try {
      const parsed = JSON.parse(text.replace(/```json\n?|```/g, '').trim());
      return new Response(JSON.stringify({ ok: true, options: parsed?.options ?? [] }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Could not parse Claude response', raw: text.slice(0, 400) }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
