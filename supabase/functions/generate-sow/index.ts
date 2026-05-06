// =============================================================================
// GENERATE-SOW — Supabase Edge Function (R61 / Package D1)
// =============================================================================
// Takes a draft quote (line items + customer + trade) plus the contractor's
// tone preset and asks Claude Haiku for a scope-of-work narrative split into
// three paragraphs: Includes / Excludes / Warranty. Returns JSON:
//   { ok: true, scopeText: '...' }
//
// Pattern mirrors draft-customer-reply (R230-era): per-user auth, Anthropic
// fetch with Haiku, JSON parse with markdown-fence strip, structured error
// path that returns 200 with `ok: false` so the FE can surface a clean
// fallback (don't generate scope) without throwing.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rateLimit } from '../_shared/ratelimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Tone = 'formal' | 'friendly' | 'detailed' | 'concise';
type Lang = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

interface LineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
}

interface Req {
  language: Lang;
  trade?: string;
  jobTitle?: string;
  customerName?: string;
  businessName?: string;
  tone?: Tone;
  lineItems: LineItem[];
  /** Optional: 1-3 short excerpts from accepted quotes to learn the
   *  contractor's voice. Inserted as few-shot examples once available. */
  toneExamples?: string[];
  /** Optional: short summary of the job dossier (Package C3) once wired. */
  dossierBrief?: string;
}

const TONE_GUIDANCE: Record<Tone, string> = {
  formal: 'Use formal, precise language. Address the customer with their full name. No contractions.',
  friendly: 'Warm, direct, plain language. Use contractions. Address the customer by first name when possible.',
  detailed: 'Thorough, list every relevant assumption and step. Prefer numbered sub-clauses where it helps clarity.',
  concise: 'Tight prose. Three short paragraphs. No filler. No repetition.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

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
    const auth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // R64 (audit fix #5): rate-limit per user. Each Claude Haiku call is
    // ~$0.002; 30/min/user is generous for a contractor iterating on
    // wording but cheap protection against runaway loops or compromised
    // tokens. Bucket key is user uid, NOT IP — same contractor across
    // devices shares the budget, which is what we want.
    const limit = rateLimit(`sow:${user.id}`, { windowMs: 60_000, max: 30 });
    if (!limit.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Rate limited',
        retryAfter: limit.retryAfter,
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': String(limit.retryAfter),
        },
      });
    }

    const body: Req = await req.json();
    if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'lineItems required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (body.lineItems.length > 50) {
      return new Response(JSON.stringify({ ok: false, error: 'Too many line items (max 50)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tone: Tone = body.tone ?? 'friendly';
    const lang = body.language ?? 'nl';

    const linesText = body.lineItems
      .map((item, i) => {
        const qty = item.quantity ? ` × ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : '';
        return `${i + 1}. ${item.description}${qty}`;
      })
      .join('\n');

    const examplesBlock = body.toneExamples && body.toneExamples.length > 0
      ? `\n\nThe contractor's voice — match this prose style:\n${body.toneExamples
          .slice(0, 3)
          .map((ex, i) => `Example ${i + 1}:\n"""\n${ex.slice(0, 800)}\n"""`)
          .join('\n\n')}`
      : '';

    const dossierBlock = body.dossierBrief
      ? `\n\nJob context (use to ground specifics, do not quote verbatim):\n"""\n${body.dossierBrief.slice(0, 1200)}\n"""`
      : '';

    const prompt = `You are drafting a scope-of-work narrative for a construction trade quote.
Target language: ${lang}. ${TONE_GUIDANCE[tone]}

Trade: ${body.trade ?? 'general construction'}
Job title: ${body.jobTitle ?? '(not provided)'}
Customer: ${body.customerName ?? 'Customer'}
Business: ${body.businessName ?? 'Contractor'}

Line items being quoted:
${linesText}${examplesBlock}${dossierBlock}

Write the scope of work as exactly three paragraphs, in this order, separated by ONE blank line:
1. INCLUDES — what the quote covers, derived from the line items. Make the actual work concrete (mention sizes, materials, locations where line items make this clear).
2. EXCLUDES — common adjacent work that this quote does NOT cover, so the customer cannot later claim it was implied. Be trade-specific (e.g. plumbing scope excludes water-damage repair; electrical scope excludes wall-finishing).
3. WARRANTY — labour and materials warranty terms in plain language.

Return ONLY JSON matching:
{"scopeText":"INCLUDES paragraph\\n\\nEXCLUDES paragraph\\n\\nWARRANTY paragraph"}
No markdown fences. No extra commentary.`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({
        ok: false,
        error: `Claude ${resp.status}`,
        detail: errText.slice(0, 300),
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const json: any = await resp.json();
    const text: string = json?.content?.[0]?.text ?? '';
    try {
      const parsed = JSON.parse(text.replace(/```json\n?|```/g, '').trim());
      const scopeText: string = String(parsed?.scopeText ?? '').trim();
      if (!scopeText) {
        return new Response(JSON.stringify({ ok: false, error: 'Empty scope text from model' }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true, scopeText }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Could not parse Claude response',
        raw: text.slice(0, 400),
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
