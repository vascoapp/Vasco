/**
 * Is server-side LLM generation live?
 *
 * Every generative path (scope-of-work text, photo → quote) calls an edge
 * function that needs ANTHROPIC_API_KEY or MOONSHOT_API_KEY, and production has
 * neither (`npx supabase secrets list`, re-checked 2026-09-14). The quote
 * builder still offered "Leistungsumfang generieren — KI-erstellter Text" and a
 * photo-scan tile: on a German device the first answered, after twelve seconds,
 * "Leistungsumfang konnte nicht generiert werden". The store listing (#297)
 * and the paywall (#316) already refuse to claim these features; the builder
 * was the one surface still offering them.
 *
 * Off unless the build sets EXPO_PUBLIC_LLM_ENABLED=true — set it in the same
 * change that funds the key, and delete paywallMakesNoDarkClaims.test.ts then.
 * Direct `process.env.EXPO_PUBLIC_…` access only: Metro inlines nothing else
 * (see config/env.ts, R105).
 */
export const LLM_GENERATION_ENABLED: boolean =
  process.env.EXPO_PUBLIC_LLM_ENABLED === 'true';

/**
 * Are server-side EMBEDDINGS live?
 *
 * `generate-embedding` and `embed-text` need OPENAI_API_KEY or VOYAGE_API_KEY,
 * and production has neither (`npx supabase secrets list`, 2026-09-22). Every
 * call answered 503 — including one per keystroke in the quote builder, where
 * "Similar past jobs" spun beside a first-time contractor's scope text while
 * the watchdog counted the 5xx (TestFlight, 2026-09-22). With this off, the
 * semantic search goes straight to its local keyword index, which is what it
 * fell back to after the 503 anyway — minus the round trip and the spinner.
 *
 * Off unless the build sets EXPO_PUBLIC_EMBEDDINGS_ENABLED=true — set it in the
 * same change that funds the key.
 */
export const EMBEDDINGS_ENABLED: boolean =
  process.env.EXPO_PUBLIC_EMBEDDINGS_ENABLED === 'true';
