// =============================================================================
// RANK-INSIGHTS — situational weighting of already-computed insights
// =============================================================================
// Tier 2 of the LLM ladder. The rules engine has already decided WHICH insights
// fire and how confident it is in each; this asks only "given the week the
// contractor is actually having, which of these matters most right now?"
//
// WHAT IS SENT — shapes, never values:
//
//   { generatorId, category, priority, magnitude: 'small'|'medium'|'large',
//     ageDays, confidenceBucket }
//
// No customer name, no business name, no amount, no invoice number. A
// contractor with EUR 12,431 overdue and one with EUR 240 overdue produce the
// SAME payload if both land in the 'large' bucket. That is deliberate: like the
// phrasing task, this keeps Kimi/Moonshot a cost decision rather than a
// third-country transfer question, and unlike `generate-sow` it needs no PII
// tokenisation at all because there is no PII in the first place.
//
// WHAT COMES BACK is bounded to [0.75, 1.35] per generator and validated
// against the ids actually offered. See rankingContract.ts — the same file the
// client re-validates with, so the bounds cannot drift between the two.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rateLimit } from '../_shared/ratelimit.ts';
import { chat } from '../_shared/llm.ts';
import {
  validateRankingWeights,
  MIN_MULTIPLIER,
  MAX_MULTIPLIER,
  RANKING_HINT_VERSION,
} from '../../../src/intelligence/ranking/rankingContract.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Magnitude = 'small' | 'medium' | 'large';

interface InsightShape {
  generatorId: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  magnitude?: Magnitude;
  ageDays?: number;
  confidenceBucket?: 'low' | 'medium' | 'high';
}

interface Req {
  insights: InsightShape[];
  /** Situational context, also value-free. */
  context?: {
    dayOfWeek?: number;
    /** e.g. ['vat_deadline_in_3_days', 'week_is_fully_booked'] */
    signals?: string[];
    country?: string;
    trade?: string;
  };
  contextDigest: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function buildPrompt(req: Req): string {
  // Only emit magnitude when the caller actually supplied one. Defaulting it to
  // 'medium' told the model every insight was mid-sized, which is worse than
  // saying nothing: it looks like information and is not.
  const rows = req.insights.map((i) => [
    `- ${i.generatorId}`,
    `category=${i.category ?? 'other'}`,
    `priority=${i.priority ?? 'medium'}`,
    i.magnitude ? `magnitude=${i.magnitude}` : '',
    `age_days=${i.ageDays ?? 0}`,
    `confidence=${i.confidenceBucket ?? 'medium'}`,
  ].filter(Boolean).join(' '));

  const ctx = req.context ?? {};
  return [
    'You advise a self-employed construction tradesperson. A rules engine has already',
    'decided which insights are worth showing and how confident it is in each.',
    '',
    'Your ONLY job: given the situation below, say which of these deserve to be seen',
    'FIRST this week. You are expressing judgement about timing and context — not',
    'about whether the underlying numbers are right, which is not your concern and',
    'which you cannot see.',
    '',
    `Situation: day_of_week=${ctx.dayOfWeek ?? 'unknown'}`,
    ctx.country ? `country=${ctx.country}` : '',
    ctx.trade ? `trade=${ctx.trade}` : '',
    ctx.signals?.length ? `signals=${ctx.signals.join(', ')}` : '',
    '',
    'Insights:',
    ...rows,
    '',
    'Rules:',
    `1. Return a multiplier between ${MIN_MULTIPLIER} and ${MAX_MULTIPLIER} for each insight you have`,
    '   an opinion on. 1.0 means no opinion — OMIT those rather than returning 1.0.',
    '2. Use ONLY the generatorId values listed above, spelled exactly. Inventing one',
    '   is a hard failure.',
    '3. Do not return every insight. Most weeks, two or three deserve an opinion.',
    '4. Give a short reason (under 15 words) for each.',
    '',
    'Return ONLY JSON, no commentary:',
    '{"weights":[{"generatorId":"...","multiplier":1.2,"reason":"..."}]}',
  ].filter(Boolean).join('\n');
}

function parseLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const a = candidate.indexOf('{');
    const b = candidate.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    try { return JSON.parse(candidate.slice(a, b + 1)); } catch { return null; }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader) return json({ ok: false, error: 'Missing authorization' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ ok: false, error: 'Unauthorized' }, 401);

    // Unlike generate-phrasing this IS a per-user feature, so it is not
    // operator-gated — but it is called by the background scheduler, not by a
    // render, so a handful per day per user is the expected shape. A tight
    // limit keeps a scheduler bug from becoming a token bill.
    const limit = rateLimit(`rank:${user.id}`, { windowMs: 3_600_000, max: 12 });
    if (!limit.ok) return json({ ok: false, error: 'Rate limited', retryAfter: limit.retryAfter }, 429);

    const body = (await req.json()) as Req;
    const insights = Array.isArray(body?.insights) ? body.insights : [];
    if (insights.length === 0) return json({ ok: false, error: 'insights[] required' }, 400);
    if (insights.length > 30) return json({ ok: false, error: 'at most 30 insights per call' }, 400);
    if (typeof body.contextDigest !== 'string' || !body.contextDigest) {
      return json({ ok: false, error: 'contextDigest required' }, 400);
    }

    // Defence in depth: strip anything that is not part of the shape contract,
    // so a future caller cannot accidentally widen the payload into real values.
    const shapes: InsightShape[] = insights.map((i) => ({
      generatorId: String(i?.generatorId ?? '').slice(0, 64),
      category: i?.category ? String(i.category).slice(0, 32) : undefined,
      priority: i?.priority,
      magnitude: i?.magnitude,
      ageDays: Number.isFinite(i?.ageDays) ? Math.round(Number(i.ageDays)) : undefined,
      confidenceBucket: i?.confidenceBucket,
    })).filter((i) => i.generatorId);

    const offered = shapes.map((s) => s.generatorId);

    let result;
    try {
      result = await chat({
        task: 'ranking',
        messages: [{ role: 'user', content: buildPrompt({ ...body, insights: shapes }) }],
        maxTokens: 900,
        temperature: 0.3,
        jsonMode: true,
      });
    } catch (err) {
      // Ranking is an optimisation. A failure means the contractor sees the
      // rules' ordering, which is the current behaviour and perfectly fine.
      return json({ ok: false, error: `LLM unavailable: ${String(err).slice(0, 200)}` }, 502);
    }

    const parsed = parseLoose(result.text) as { weights?: unknown } | null;
    const { accepted, violations } = validateRankingWeights(offered, parsed?.weights);

    return json({
      ok: true,
      hint: {
        version: RANKING_HINT_VERSION,
        generatedAt: new Date().toISOString(),
        contextDigest: body.contextDigest,
        provider: result.provider,
        weights: accepted,
      },
      // Surfaced, not swallowed: a model that keeps inventing ids or asking for
      // 5x is a prompt problem the operator should be able to see.
      violations,
    });
  } catch (err) {
    return json({ ok: false, error: String(err).slice(0, 300) }, 500);
  }
});
