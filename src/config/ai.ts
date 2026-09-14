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
