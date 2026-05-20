// =============================================================================
// AI-COMMAND — Natural-language office-manager (R87 US Phase 5)
// =============================================================================
// Contractor types a sentence ("invoice Joe for $500", "what did I make
// last month", "show overdue"). This fn calls Claude Haiku with a tight
// system prompt that returns a JSON-shaped intent + human response.
// Client (app/contractor/ai-chat.tsx) renders the response + dispatches
// the intent to AppState mutators.
//
// Lite scope: 6 intents.
//   - create_invoice
//   - schedule_job
//   - query_revenue
//   - list_overdue
//   - send_reminder
//   - unknown    (chat-only fallback)
//
// All intents return a humanResponse for chat display. Actionable ones
// also return `action: { type, params }` that the client switches on.
//
// JWT-gated like analyze-photo (R66r49). Bills Anthropic ~$0.0005/call
// at Haiku rates — bots-running-up-bills is the same risk as photo
// analysis.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  };
}

interface AiCommandResponse {
  intent:
    | 'create_invoice'
    | 'schedule_job'
    | 'query_revenue'
    | 'list_overdue'
    | 'send_reminder'
    | 'unknown';
  humanResponse: string;
  action?: {
    type: string;
    params: Record<string, unknown>;
  };
}

const SYSTEM_PROMPT = `You are Vasco's office-manager assistant for contractors. Parse the contractor's natural-language command and return a JSON object with this exact shape:

{
  "intent": "create_invoice" | "schedule_job" | "query_revenue" | "list_overdue" | "send_reminder" | "unknown",
  "humanResponse": string,
  "action": optional { "type": string, "params": object }
}

Intent guide:
- create_invoice: "invoice {name} for {amount}". action.params = { customerName, amount, currency }
- schedule_job: "schedule {name} {date} {time}" / "book {name} {date}". action.params = { customerName, date, time, title }
- query_revenue: "what did I make {period}" / "revenue {period}". No action — answer in humanResponse using context.recentInvoiceTotal.
- list_overdue: "show overdue" / "who hasn't paid". No action — answer using context.overdueCount.
- send_reminder: "remind {name}". action.params = { customerName }
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
  const userMessage = contextLines.length > 0
    ? `${contextLines.join('\n')}\n\nCommand: ${payload.message}`
    : `Command: ${payload.message}`;

  // ── Call Claude Haiku ──
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
        system: SYSTEM_PROMPT,
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
    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('ai-command threw', e);
    return jsonError('network', 502);
  }
});

function jsonError(code: string, status: number) {
  return new Response(
    JSON.stringify({ error: code }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
