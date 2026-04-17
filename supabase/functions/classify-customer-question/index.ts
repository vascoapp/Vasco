// =============================================================================
// CLASSIFY-CUSTOMER-QUESTION — Supabase Edge Function
// =============================================================================
// Portal-anon endpoint. Accepts a customer's free-text question +
// trackerAccessToken, classifies stakes (low/high), drafts a reply via
// Claude Haiku, inserts a `customer_questions` row.
//
// Low-stakes → auto-reply returned inline, `auto_sent: true` persisted.
// High-stakes → drafted for contractor approval in VascoCard; portal
//   gets `{ ok: true, pending: true }` and polls the row.
//
// Rate-limit: 10/min per tracker_access_token to keep AI costs bounded
// and abuse low. 5s latency target — Haiku is the right tool.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Req {
  trackerAccessToken: string;
  question: string;
  customerName?: string;
  language?: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
  /** Grounding context — lets Claude answer low-stakes informational questions
   * directly from structured data instead of deflecting. All optional. */
  context?: {
    trade?: string;
    scheduledDate?: string;     // ISO — for "when are you arriving?" answers
    address?: string;           // for "where?" answers
    jobTitle?: string;
    quoteAmount?: number;       // accepted quote total (EUR/GBP) — NEVER expose unless asked directly
    quoteCurrency?: string;
    decisions?: Array<{ item: string; value: string }>; // prior portal decisions
    contractorNotes?: string;   // any free-text the contractor left on the tracker
    businessName?: string;
    contractorPhone?: string;
  };
}

interface AIClassification {
  stakes: 'low' | 'high';
  confidence: number;
  reason: string;
  draft: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!supabaseUrl || !serviceKey || !anthropicKey) {
      return json({ ok: false, error: 'Server misconfigured' }, 500);
    }

    const body: Req = await req.json();
    const { trackerAccessToken, question, customerName, language = 'nl', context } = body;

    if (!trackerAccessToken || typeof trackerAccessToken !== 'string' || trackerAccessToken.length < 8) {
      return json({ ok: false, error: 'Invalid tracker token' }, 400);
    }
    if (!question || typeof question !== 'string') {
      return json({ ok: false, error: 'Question is required' }, 400);
    }
    const trimmed = question.trim();
    if (trimmed.length === 0 || trimmed.length > 1000) {
      return json({ ok: false, error: 'Question must be 1-1000 chars' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // ─── Rate limit: 10/min per trackerAccessToken ─────────────────────────
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recent } = await supabase
      .from('customer_questions')
      .select('id', { count: 'exact', head: true })
      .eq('tracker_access_token', trackerAccessToken)
      .gte('asked_at', since);
    if ((recent ?? 0) >= 10) {
      return json({ ok: false, error: 'Too many questions — wait a minute' }, 429);
    }

    // ─── Resolve tracker → contractor_user_id ──────────────────────────────
    // The decision_trackers table (or decision_submissions) should carry the
    // contractor's user_id. We look up via decision_submissions where the
    // tracker_id matches trackerAccessToken (tokens ARE tracker ids in Vasco).
    const { data: trackerRow } = await supabase
      .from('decision_submissions')
      .select('tracker_id, user_id')
      .eq('tracker_id', trackerAccessToken)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const contractorUserId = (trackerRow as any)?.user_id ?? null;

    // ─── AI classify + draft ───────────────────────────────────────────────
    const prompt = buildPrompt(trimmed, language, customerName, context);
    const aiResult = await classifyWithClaude(prompt, anthropicKey);
    if (!aiResult) {
      // Fall through to a pending row so the contractor sees the question even
      // if AI is offline. No auto-reply.
      return await insertAndReturn(supabase, {
        trackerAccessToken,
        contractorUserId,
        question: trimmed,
        language,
        aiResult: null,
      });
    }

    return await insertAndReturn(supabase, {
      trackerAccessToken,
      contractorUserId,
      question: trimmed,
      language,
      aiResult,
    });
  } catch (err) {
    return json({ ok: false, error: 'Internal error', detail: String(err) }, 500);
  }
});

// ─── Prompt + Claude call ─────────────────────────────────────────────────

function buildPrompt(question: string, language: string, customerName?: string, context?: Req['context']): string {
  const ctxLines: string[] = [];
  if (context) {
    if (context.trade) ctxLines.push(`- Trade: ${context.trade}`);
    if (context.jobTitle) ctxLines.push(`- Job: ${context.jobTitle}`);
    if (context.scheduledDate) ctxLines.push(`- Scheduled: ${context.scheduledDate}`);
    if (context.address) ctxLines.push(`- Address: ${context.address}`);
    if (context.businessName) ctxLines.push(`- Business: ${context.businessName}`);
    if (context.contractorPhone) ctxLines.push(`- Contractor phone: ${context.contractorPhone}`);
    if (context.contractorNotes) ctxLines.push(`- Contractor notes on this job: ${context.contractorNotes}`);
    if (context.quoteAmount != null && context.quoteCurrency) {
      ctxLines.push(`- Accepted quote total: ${context.quoteCurrency}${context.quoteAmount.toFixed(2)} (DO NOT expose this value unless the customer asks for the total directly)`);
    }
    if (Array.isArray(context.decisions) && context.decisions.length > 0) {
      ctxLines.push(`- Customer's prior decisions:`);
      for (const d of context.decisions.slice(0, 10)) {
        ctxLines.push(`    · ${d.item}: ${d.value}`);
      }
    }
  }
  const groundingBlock = ctxLines.length > 0
    ? `\n\nJOB CONTEXT (use this to answer "low" stakes questions directly):\n${ctxLines.join('\n')}`
    : '';

  return `You are classifying + drafting replies for a construction-trade contractor. The customer is asking a free-text question via the customer portal. Your job:

1. Classify STAKES:
   - "low": purely informational/logistical (arrival time, parking, how to prepare, where to find something, confirmation of appointment). ANSWERABLE from JOB CONTEXT without contractor input.
   - "high": ANYTHING involving price change, scope change (new work requested), schedule change, technical advice, or a commitment by the contractor.
   When in doubt, classify as "high" — we never want the AI to commit the contractor to work or promises.

2. Draft a reply in ${language} (same language the customer wrote in if possible).
   - For "low" stakes: a direct, friendly answer the AI can auto-send, using JOB CONTEXT values. Example: "The appointment is confirmed for Tuesday 10:00 at {address}."
   - For "high" stakes: a reply the contractor can review + approve (acknowledge the question, buy time, never commit to prices or scope). Example: "Thanks for asking — I'll check with Jan and get back to you today."
   - Keep it concise — 1-3 short sentences. No signoff. Sound like a person, not a bot.

3. CRITICAL SAFETY:
   - NEVER quote a price, even if the quote total is in JOB CONTEXT, unless the customer explicitly asks "what's the total?" — then you may confirm the accepted quote total.
   - NEVER confirm a new scope item as included.
   - NEVER commit a new schedule without contractor approval.
   - If the customer asks about emergency (gas leak, flood, fire): stakes "high", draft tells them to call 112 and that contractor will follow up.

Return ONLY valid JSON, no markdown:
{
  "stakes": "low" | "high",
  "confidence": 0.0-1.0,
  "reason": "one short sentence on why you picked that stakes level",
  "draft": "your reply text in ${language}"
}

CUSTOMER NAME: ${customerName || '(unknown)'}
QUESTION: ${question}${groundingBlock}`;
}

1. Classify STAKES:
   - "low": purely informational/logistical (arrival time, parking, how to prepare, where to find something, confirmation of appointment).
   - "high": ANYTHING involving price change, scope change (new work requested), schedule change, technical advice, or a commitment by the contractor.
   When in doubt, classify as "high" — we never want the AI to commit the contractor to work or promises.

2. Draft a reply in ${language} (same language the customer wrote in if possible).
   - For "low" stakes: a direct, friendly answer the AI can auto-send.
   - For "high" stakes: a reply the contractor can review + approve (acknowledge the question, buy time, never commit to prices or scope).
   - Keep it concise — 1-3 short sentences. No signoff ("Best," / "Thanks,"). Sound like a person, not a bot.

3. CRITICAL SAFETY:
   - NEVER quote a price.
   - NEVER confirm a new scope item as included.
   - NEVER commit a new schedule without contractor approval.
   - If the customer asks about emergency (gas leak, flood, fire): stakes "high", draft tells them to call 112 and that contractor will follow up.

Return ONLY valid JSON, no markdown:
{
  "stakes": "low" | "high",
  "confidence": 0.0-1.0,
  "reason": "one short sentence on why you picked that stakes level",
  "draft": "your reply text in ${language}"
}

CUSTOMER NAME: ${customerName || '(unknown)'}
QUESTION: ${question}`;
}

async function classifyWithClaude(prompt: string, anthropicKey: string): Promise<AIClassification | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      }),
    });
    if (!res.ok) return null;
    const claudeJson = await res.json();
    const raw = claudeJson.content?.[0]?.text ?? '';
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.stakes !== 'low' && parsed.stakes !== 'high') return null;
    return {
      stakes: parsed.stakes,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reason: String(parsed.reason ?? ''),
      draft: String(parsed.draft ?? ''),
    };
  } catch {
    return null;
  }
}

// ─── Insert + respond ──────────────────────────────────────────────────────

async function insertAndReturn(
  supabase: any,
  args: {
    trackerAccessToken: string;
    contractorUserId: string | null;
    question: string;
    language: string;
    aiResult: AIClassification | null;
  },
) {
  const { trackerAccessToken, contractorUserId, question, language, aiResult } = args;

  // Safety gate: only auto-send when AI explicitly picks "low" AND confidence
  // is above 0.75. Everything else waits on contractor approval.
  const autoSend = aiResult
    && aiResult.stakes === 'low'
    && aiResult.confidence >= 0.75;

  const row = {
    tracker_id: trackerAccessToken,
    tracker_access_token: trackerAccessToken,
    contractor_user_id: contractorUserId,
    question,
    question_lang: language,
    stakes: aiResult?.stakes ?? 'unknown',
    ai_reply_draft: aiResult?.draft ?? null,
    ai_reply_confidence: aiResult?.confidence ?? null,
    ai_reply_reason: aiResult?.reason ?? null,
    status: autoSend ? 'sent' : (aiResult ? 'drafted' : 'pending'),
    auto_sent: autoSend,
    sent_at: autoSend ? new Date().toISOString() : null,
    approved_reply: autoSend ? aiResult!.draft : null,
  };

  const { data, error } = await supabase
    .from('customer_questions')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    return json({ ok: false, error: 'DB insert failed', detail: error.message }, 500);
  }

  return json({
    ok: true,
    id: (data as any).id,
    autoReply: autoSend ? aiResult!.draft : null,
    pending: !autoSend,
    stakes: aiResult?.stakes ?? 'unknown',
  }, 200);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
