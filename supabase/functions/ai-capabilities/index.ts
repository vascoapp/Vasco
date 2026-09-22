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
  // Same names _shared/llm.ts providerKey() reads — KIMI_API_KEY is its alias
  // for Moonshot (and checkLlmKey in _shared/supabaseLogs.ts, the watchdog's
  // outside-in check of the same thing via the Management API).
  const moonshot = present('MOONSHOT_API_KEY') || present('KIMI_API_KEY');

  const body = {
    // analyze-photo (photo → quote, Bon scanner) is Claude Vision only.
    vision: anthropic,
    // Text stages (scope of work, phrasing) route Claude OR Kimi (_shared/llm.ts).
    text: anthropic || moonshot,
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
