// =============================================================================
// AI-CAPABILITIES — which AI features can run RIGHT NOW (2026-09-22)
// =============================================================================
// The photo → quote tile, the receipt (Bon) scanner and scope-of-work drafting
// all call edge functions that need an LLM key. With no key set they fail —
// analyze-photo answers 500 "ANTHROPIC_API_KEY not configured" — so the app
// hid them behind a BUILD-TIME flag (EXPO_PUBLIC_LLM_ENABLED). That meant
// adding the key was not enough: a new OTA was needed to switch them on.
//
// This reports, from the same secrets the AI functions read, whether each
// capability is live, so the app turns the features on by itself the moment
// the key is set — and off again if it is removed.
//
// Returns BOOLEANS ONLY. Never a key, a prefix, a length or a provider-side
// detail: the response is readable by any signed-in user.
// =============================================================================

import { taskHasProvider } from '../_shared/llm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Set and not an obvious placeholder ("", "changeme", "sk-..." stubs). */
function present(name: string): boolean {
  const v = (Deno.env.get(name) ?? '').trim();
  return v.length >= 20 && !/^(changeme|todo|xxx|placeholder)/i.test(v);
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const anthropic = present('ANTHROPIC_API_KEY');

  const body = {
    // analyze-photo (photo → quote, Bon scanner) is Claude Vision only.
    vision: anthropic,
    // Scope-of-work drafting, asked of the LLM router itself: it resolves the
    // provider per task and defaults to anthropic, so "a Kimi key is set" was
    // not enough — `anthropic || moonshot` said yes and the drafting button
    // then failed (review #366). The watchdog's checkLlmKey checks key NAMES
    // outside-in for alerting; this answers "can the app use it".
    text: taskHasProvider('sow'),
    // generate-embedding / embed-text.
    embeddings: present('OPENAI_API_KEY') || present('VOYAGE_API_KEY'),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      // The app caches for an hour itself; keep intermediaries from pinning it.
      'Cache-Control': 'no-store',
    },
  });
});
