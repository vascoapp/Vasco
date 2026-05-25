// =============================================================================
// AI-COMMAND — Natural-language office-manager (R87 US Phase 5)
// =============================================================================
// Contractor types a sentence ("invoice Joe for $500", "what did I make
// last month", "show overdue"). This fn classifies the intent across THREE
// TIERS and returns a JSON-shaped result the client can dispatch.
//
//   Tier 1 — deterministic (R193):
//     Pure JS regex/keyword match. Handles ~70-80% of common patterns
//     (revenue/overdue/weekly read-only queries + invoice/reminder/cancel
//     with name+amount slots). $0 cost, < 1ms latency.
//
//   Tier 2 — OpenRouter free models (R193):
//     google/gemma-2-9b-it:free → meta-llama/llama-3.1-8b-instruct:free.
//     Multi-language support out of the box. $0 cost on free tier; falls
//     back to next model on 5xx/timeout.
//
//   Tier 3 — Claude Haiku (last resort):
//     Original Anthropic path. System prompt now ephemerally cached at
//     90% discount on hits. Only fires when Tier 1+2 both miss.
//
// 10 intents (R95 expanded from 6):
//   - create_invoice, schedule_job, query_revenue, list_overdue,
//     send_reminder, cancel_job, query_job_status, find_customer,
//     weekly_summary, unknown (chat-only fallback)
//
// JWT-gated like analyze-photo (R66r49). R192 added per-user rolling-60s
// rate limit at 30 req/min as a runaway-defense backstop (real cost
// defense is the tier router above).
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { classifyDeterministic, type Intent, type IntentResult, type ClassifyContext } from '../_shared/aiIntentRouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

// R193 OpenRouter model chain. Free-tier models try in order; each one
// gets ~5s timeout before falling through. Anthropic Haiku via OpenRouter
// would also work but we keep the direct path (Tier 3) since we already
// have ANTHROPIC_API_KEY in env + prompt caching.
const OPENROUTER_MODELS = [
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.1-8b-instruct:free',
];
const OPENROUTER_TIMEOUT_MS = 5_000;

interface AiCommandRequest {
  message: string;
  // Optional context — lets Claude reference real names/amounts in the
  // response. Client sends a short summary on every call so we don't
  // round-trip the entire customer/invoice list.
  context?: {
    customers?: Array<{ id: string; name: string }>;
    recentInvoiceTotal?: number;
    overdueCount?: number;
    locale?: string;
    activeJobs?: Array<{ id: string; customer: string; status: string }>;
    weeklyRevenue?: number;
    weeklyJobsCompleted?: number;
    weeklyQuotesSent?: number;
  };
}

interface AiCommandResponse {
  intent: Intent;
  humanResponse: string;
  action?: {
    type: string;
    params: Record<string, unknown>;
  };
  // R193: tells the client which tier handled the request — primarily
  // for cost observability (filter ai_tier='claude' to see what's
  // actually escalating). Optional so older clients don't break.
  ai_tier?: 'deterministic' | 'openrouter' | 'claude' | 'fallback';
}

const SYSTEM_PROMPT = `You are Vasco's office-manager assistant for contractors. Parse the contractor's natural-language command and return a JSON object with this exact shape:

{
  "intent": "create_invoice" | "schedule_job" | "query_revenue" | "list_overdue" | "send_reminder" | "cancel_job" | "query_job_status" | "find_customer" | "weekly_summary" | "unknown",
  "humanResponse": string,
  "action": optional { "type": string, "params": object }
}

Intent guide:
- create_invoice: "invoice {name} for {amount}". action.params = { customerName, amount, currency }
- schedule_job: "schedule {name} {date} {time}" / "book {name} {date}". action.params = { customerName, date, time, title }
- query_revenue: "what did I make {period}" / "revenue {period}". No action — answer in humanResponse using context.recentInvoiceTotal.
- list_overdue: "show overdue" / "who hasn't paid". No action — answer using context.overdueCount.
- send_reminder: "remind {name}". action.params = { customerName }
- cancel_job: "cancel job for {name}" / "cancel {jobId}". action.params = { customerName } or { jobId }
- query_job_status: "status of {name}" / "where are we on {name}" / "what's happening". No action — list jobs from context.activeJobs in humanResponse.
- find_customer: "find {name}" / "lookup {name}" / "do I have a customer called {name}". action.params = { query }. Match against context.customers and list matches in humanResponse.
- weekly_summary: "how was my week" / "weekly summary" / "recap". No action — answer using context.weeklyRevenue, weeklyJobsCompleted, weeklyQuotesSent.
- unknown: anything else / casual chat. humanResponse is conversational.

Rules:
1. Return ONLY the JSON object, no prose around it.
2. humanResponse must be friendly and confirm what you'll do (or ask for clarification if ambiguous).
3. Date format in params: YYYY-MM-DD. Time format: HH:MM (24h).
4. Amount in params: number (no currency symbol).
5. If a customer name in the command matches one in context.customers (case-insensitive substring), use the exact matched name from context. If no match, still include the typed name — client validates.
6. Keep humanResponse under 200 chars.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  // ── Auth ──
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('unauthenticated', 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnon) return jsonError('server_misconfigured', 500);
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return jsonError('unauthenticated', 401);

  // ── R192 rate limit: rolling 60s, 30 req max per user ──
  // Service-role client bypasses RLS so the upsert can run regardless of
  // the calling user's policies. Falls open (allows the call) if the rate-
  // limit table is unreachable — better to overspend by a single call than
  // to hard-fail the contractor's AI chat on a transient DB blip.
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey) {
    try {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const now = new Date();
      const { data: row } = await admin
        .from('ai_rate_limit')
        .select('window_start, count')
        .eq('user_id', user.id)
        .maybeSingle();
      const windowStartMs = row?.window_start ? new Date(row.window_start).getTime() : 0;
      const inWindow = now.getTime() - windowStartMs < RATE_LIMIT_WINDOW_MS;
      if (inWindow && (row?.count ?? 0) >= RATE_LIMIT_MAX) {
        const retryAfterMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now.getTime() - windowStartMs));
        return new Response(
          JSON.stringify({ error: 'rate_limited', retry_after_ms: retryAfterMs }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } },
        );
      }
      const nextCount = inWindow ? (row?.count ?? 0) + 1 : 1;
      const nextWindowStart = inWindow ? row!.window_start : now.toISOString();
      await admin
        .from('ai_rate_limit')
        .upsert({ user_id: user.id, window_start: nextWindowStart, count: nextCount, updated_at: now.toISOString() });
    } catch (e) {
      console.error('ai-command rate-limit check failed (failing open):', e);
    }
  }

  // ── Claude API key ──
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) return jsonError('claude_not_configured', 503);

  // ── Payload ──
  let payload: AiCommandRequest;
  try {
    payload = await req.json();
  } catch {
    return jsonError('bad_json', 400);
  }
  if (!payload.message || payload.message.length === 0) return jsonError('missing_message', 400);
  if (payload.message.length > 1000) return jsonError('message_too_long', 400);

  // ── R193 Tier 1: deterministic classification ──
  // Pure JS pattern match. Returns a synthesized response for the common
  // read-only queries + action-with-clean-slots cases. No network call.
  const ctx: ClassifyContext = {
    customers: payload.context?.customers,
    recentInvoiceTotal: payload.context?.recentInvoiceTotal,
    overdueCount: payload.context?.overdueCount,
    activeJobs: payload.context?.activeJobs,
    weeklyRevenue: payload.context?.weeklyRevenue,
    weeklyJobsCompleted: payload.context?.weeklyJobsCompleted,
    weeklyQuotesSent: payload.context?.weeklyQuotesSent,
    locale: payload.context?.locale,
  };
  const deterministic = classifyDeterministic(payload.message, ctx);
  if (deterministic) {
    return new Response(
      JSON.stringify(deterministic satisfies AiCommandResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ── Build user prompt with context ──
  const contextLines: string[] = [];
  if (payload.context?.customers?.length) {
    const sample = payload.context.customers.slice(0, 20).map((c) => c.name).join(', ');
    contextLines.push(`Recent customers: ${sample}`);
  }
  if (payload.context?.recentInvoiceTotal != null) {
    contextLines.push(`Recent invoice total (90d): $${payload.context.recentInvoiceTotal}`);
  }
  if (payload.context?.overdueCount != null) {
    contextLines.push(`Overdue invoice count: ${payload.context.overdueCount}`);
  }
  if (payload.context?.activeJobs?.length) {
    const jobsSample = payload.context.activeJobs.slice(0, 10)
      .map((j) => `${j.customer}: ${j.status}`).join('; ');
    contextLines.push(`Active jobs (top 10): ${jobsSample}`);
  }
  if (payload.context?.weeklyRevenue != null) {
    contextLines.push(`This week — revenue: $${payload.context.weeklyRevenue}, jobs completed: ${payload.context.weeklyJobsCompleted ?? 0}, quotes sent: ${payload.context.weeklyQuotesSent ?? 0}`);
  }
  const userMessage = contextLines.length > 0
    ? `${contextLines.join('\n')}\n\nCommand: ${payload.message}`
    : `Command: ${payload.message}`;

  // ── R193 Tier 2: OpenRouter free-model chain ──
  // OpenAI-compatible API. Try each model in order; on 5xx/timeout/parse
  // error, fall to next. If all fail, escalate to Tier 3 (Claude).
  const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
  if (openrouterKey) {
    for (const model of OPENROUTER_MODELS) {
      const tierResult = await callOpenRouter(openrouterKey, model, userMessage);
      if (tierResult) {
        return new Response(
          JSON.stringify({ ...tierResult, ai_tier: 'openrouter' as const } satisfies AiCommandResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }
  }

  // ── R193 Tier 3: Claude Haiku with prompt caching ──
  // R193 adds cache_control: 'ephemeral' on the system prompt block —
  // Anthropic 5-min cache, ~90% discount on the cached portion across
  // hits. Static system prompt = nearly free input tokens on rapid
  // back-to-back calls.
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Anthropic non-ok', resp.status, errText);
      return jsonError('claude_error', 502);
    }
    const data = await resp.json() as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text ?? '';
    let parsed: AiCommandResponse;
    try {
      // Strip any markdown fences Claude might wrap around the JSON.
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: Claude didn't return valid JSON. Synthesize an unknown
      // intent with the raw text as humanResponse so the chat still
      // shows the AI's reply.
      parsed = { intent: 'unknown', humanResponse: text || 'Sorry, I didn\'t catch that.' };
    }
    parsed.ai_tier = 'claude';
    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('ai-command threw', e);
    return jsonError('network', 502);
  }
});

// -----------------------------------------------------------------------------
// R193: OpenRouter call (OpenAI-compatible chat-completions API)
// -----------------------------------------------------------------------------
// Returns parsed result on success, null on any failure (timeout, non-2xx,
// JSON-parse error). Caller falls through to next model / Tier 3.
async function callOpenRouter(
  apiKey: string,
  model: string,
  userMessage: string,
): Promise<AiCommandResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // OpenRouter asks for these for attribution + rate-limit perks.
        'HTTP-Referer': 'https://admin.vascobuild.com',
        'X-Title': 'Vasco AI Office',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 400,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      console.warn(`OpenRouter ${model} non-ok ${resp.status}`);
      return null;
    }
    const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content ?? '';
    if (!text) return null;
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned) as AiCommandResponse;
  } catch (e) {
    clearTimeout(timer);
    console.warn(`OpenRouter ${model} failed:`, (e as Error)?.message ?? e);
    return null;
  }
}

function jsonError(code: string, status: number) {
  return new Response(
    JSON.stringify({ error: code }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
