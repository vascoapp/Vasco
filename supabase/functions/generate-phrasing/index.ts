// =============================================================================
// GENERATE-PHRASING — Supabase Edge Function
// =============================================================================
// Authors the WORDING of intelligence-generator strings with an LLM, without
// ever seeing the data those strings describe.
//
// Input is a list of phrasing SHAPES: a gt() key, the placeholder names its
// template may use, a character budget. No customer name, no business name, no
// amount, no date. Output is a set of {{placeholder}} templates in six
// languages, which the app interpolates on-device at render time.
//
// Two consequences worth stating plainly, because they are the whole reason
// this function is shaped like this rather than "summarise this contractor's
// finances":
//
//   * A fabricated statistic is structurally impossible. The model never
//     receives a number and `validateBatch` rejects any output containing a
//     bare digit. Compare _shared/pii.ts, which exists because generate-sow
//     DOES handle real values and therefore needs tokenisation.
//   * Nothing personal is transferred to a third country, so routing this task
//     to Kimi/Moonshot (LLM_PHRASING_PROVIDER=moonshot) is a cost decision
//     rather than a GDPR one. That matters: sole-trader financials are personal
//     data, so a runtime "explain my numbers" call would not have this property.
//
// Validation is imported from the app source rather than reimplemented, so the
// server cannot drift from the client that revalidates the same pack on load.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { rateLimit } from '../_shared/ratelimit.ts';
import { chat } from '../_shared/llm.ts';
import {
  validateBatch,
  PHRASING_LANGUAGES,
  type PhrasingSpec,
  type PhrasingBundle,
} from '../../../src/intelligence/phrasing/phrasingValidation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Req {
  specs: PhrasingSpec[];
  tone: string;
  /** Existing wording per key, as a reference for meaning. Optional. */
  current?: Record<string, Partial<PhrasingBundle>>;
  /** Retry budget when the model returns invalid templates. Default 2. */
  maxRepairs?: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function buildPrompt(specs: PhrasingSpec[], tone: string, current?: Record<string, Partial<PhrasingBundle>>): string {
  const lines = specs.map((s) => {
    const ph = s.placeholders.length ? s.placeholders.map((p) => `{{${p}}}`).join(', ') : '(none)';
    const req = s.required.length ? s.required.map((p) => `{{${p}}}`).join(', ') : '(none)';
    const ref = current?.[s.key]?.en ?? current?.[s.key]?.nl;
    return [
      `- key: ${s.key}`,
      `  placeholders available: ${ph}`,
      `  placeholders REQUIRED in every language: ${req}`,
      `  max literal characters (excluding placeholders): ${s.maxChars}`,
      ref ? `  current meaning (do not copy the wording, preserve the meaning): ${ref}` : '',
    ].filter(Boolean).join('\n');
  });

  return [
    tone,
    '',
    `Produce one short template per key, in each of these languages: ${PHRASING_LANGUAGES.join(', ')}.`,
    '',
    'Hard rules:',
    '1. Never write a digit. Not in any language, not spelled inside a word. Every quantity comes from a placeholder.',
    '2. Use ONLY the placeholders listed for that key, spelled exactly, with double braces.',
    '3. Every REQUIRED placeholder must appear in every language.',
    '4. Stay inside the character budget. German and Italian run long — shorten the wording, never drop a placeholder.',
    '5. No markdown, no HTML, no quotes around the whole string.',
    '6. Translate idiomatically per language. Do not translate word-for-word from English.',
    '',
    'Keys:',
    ...lines,
    '',
    'Return ONLY a JSON object of this exact shape, with no commentary:',
    '{"<key>": {"nl": "...", "en": "...", "de": "...", "fr": "...", "es": "...", "it": "..."}}',
  ].join('\n');
}

function parseJsonLoose(text: string): Record<string, Partial<PhrasingBundle>> | null {
  // Models sometimes wrap JSON in a markdown fence even in json mode.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    const first = candidate.indexOf('{');
    const last = candidate.lastIndexOf('}');
    if (first === -1 || last <= first) return null;
    try {
      return JSON.parse(candidate.slice(first, last + 1));
    } catch {
      return null;
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

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

    // This is an OPERATOR endpoint, not a per-user feature: it authors the copy
    // every contractor sees and it spends tokens. "Any signed-in user" is the
    // wrong bar — learnings #90 is exactly this mistake at the RPC layer, where
    // a surface assumed to be narrow turned out to be reachable by anyone.
    //
    // Closed by default: with PHRASING_OPERATOR_IDS unset nobody can call this,
    // so a deploy cannot silently open it. Rate limiting below is a backstop,
    // not the control.
    const operators = (Deno.env.get('PHRASING_OPERATOR_IDS') ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (!operators.includes(user.id)) {
      return json({ ok: false, error: 'Not permitted: phrasing generation is an operator action' }, 403);
    }

    // Generation is an ops action, not a per-render one — a tight limit is
    // correct and stops a repair loop burning the token budget.
    const limit = rateLimit(`phrasing:${user.id}`, { windowMs: 3_600_000, max: 20 });
    if (!limit.ok) {
      return json({ ok: false, error: 'Rate limited', retryAfter: limit.retryAfter }, 429);
    }

    const body = (await req.json()) as Req;
    if (!Array.isArray(body?.specs) || body.specs.length === 0) {
      return json({ ok: false, error: 'specs[] required' }, 400);
    }
    if (body.specs.length > 40) {
      // Keeps one response inside a sane token budget and keeps a failed batch
      // cheap to re-run.
      return json({ ok: false, error: 'at most 40 specs per call' }, 400);
    }

    const maxRepairs = Math.min(Math.max(body.maxRepairs ?? 2, 0), 3);
    let pending = body.specs;
    const accepted: Record<string, PhrasingBundle> = {};
    let lastViolations: ReturnType<typeof validateBatch>['violations'] = [];
    let provider = 'unknown';
    let repairs = 0;

    // Ask, validate, and re-ask ONLY for the keys that failed, telling the model
    // exactly which rule it broke. Invalid output is expected occasionally; the
    // point is that it can never reach a contractor.
    while (pending.length > 0 && repairs <= maxRepairs) {
      let prompt = buildPrompt(pending, body.tone ?? '', body.current);
      if (repairs > 0 && lastViolations.length > 0) {
        const feedback = lastViolations
          .slice(0, 40)
          .map((v) => `- ${v.key}${v.language ? ` [${v.language}]` : ''}: ${v.rule} — ${v.detail}`)
          .join('\n');
        prompt += `\n\nYour previous attempt was rejected. Fix exactly these problems:\n${feedback}`;
      }

      let result;
      try {
        result = await chat({
          task: 'phrasing',
          messages: [{ role: 'user', content: prompt }],
          maxTokens: 4000,
          temperature: repairs === 0 ? 0.7 : 0.2,
          jsonMode: true,
        });
      } catch (err) {
        return json({ ok: false, error: `LLM unavailable: ${String(err).slice(0, 200)}` }, 502);
      }
      provider = result.provider;

      const parsed = parseJsonLoose(result.text);
      if (!parsed) {
        lastViolations = pending.map((s) => ({
          key: s.key, rule: 'unparseable', detail: 'model did not return valid JSON',
        }));
        repairs += 1;
        continue;
      }

      const { accepted: ok, violations } = validateBatch(pending, parsed);
      Object.assign(accepted, ok);
      lastViolations = violations;
      pending = pending.filter((s) => !(s.key in accepted));
      repairs += 1;
    }

    return json({
      ok: true,
      provider,
      entries: accepted,
      // Surfaced rather than swallowed: a key that never validated keeps its
      // built-in gt() wording, and the operator should see which and why.
      unresolved: pending.map((s) => s.key),
      violations: lastViolations,
    });
  } catch (err) {
    return json({ ok: false, error: String(err).slice(0, 300) }, 500);
  }
});
