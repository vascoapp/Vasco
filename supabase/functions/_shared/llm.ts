// =============================================================================
// LLM — provider-agnostic chat for Supabase Edge Functions
// =============================================================================
// One `chat()` entry point that speaks either Anthropic (native Messages API)
// or Moonshot / Kimi (OpenAI-compatible Chat Completions). Which provider and
// model serve a given task is resolved from env at call time, so routing is
// configuration, not code — and there is always a Claude fallback so a Kimi
// outage (or a bad model id) degrades to the known-good path instead of a 502.
//
// Rollout is safe by default: with no env set, every task runs on Anthropic
// exactly as before. An operator opts a task onto Kimi per task, e.g.
//   LLM_SOW_PROVIDER=moonshot         # route the scope-of-work task to Kimi
//   LLM_SOW_MODEL=kimi-k2-0905-preview
//   MOONSHOT_API_KEY=...              # Moonshot platform key
//   MOONSHOT_BASE_URL=https://...     # optional: point at an EU-hosted gateway
//                                     #   (OpenRouter / Together / AI Gateway)
//                                     #   for data-residency (Option B) with no
//                                     #   code change.
// Global knobs (apply to every task unless a task-specific var overrides):
//   LLM_PROVIDER / LLM_FALLBACK_PROVIDER
// Per-task overrides (TASK is the upper-cased `task` arg, e.g. SOW):
//   LLM_<TASK>_PROVIDER / LLM_<TASK>_MODEL / LLM_<TASK>_FALLBACK_PROVIDER
// =============================================================================

export type LlmProvider = 'anthropic' | 'moonshot';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  /** Logical task name — drives per-task env resolution (e.g. 'sow'). */
  task: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Ask OpenAI-compatible providers to return a JSON object. Anthropic
   *  relies on the prompt for JSON (no native flag), so this is a no-op there. */
  jsonMode?: boolean;
}

export interface ChatResult {
  text: string;
  provider: LlmProvider;
  model: string;
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
// Env-overridable — Moonshot rotates Kimi K2 model ids; the operator pins the
// exact current id via LLM_<TASK>_MODEL / LLM_MODEL. This is only the fallback
// default if none is set.
const DEFAULT_MOONSHOT_MODEL = 'kimi-k2-0905-preview';

function envUpper(task: string, suffix: string): string | undefined {
  const v = Deno.env.get(`LLM_${task.toUpperCase()}_${suffix}`);
  return v && v.length > 0 ? v : undefined;
}

function normalizeProvider(v: string | undefined): LlmProvider | undefined {
  if (v === 'anthropic' || v === 'moonshot') return v;
  return undefined;
}

function resolveProvider(task: string, role: 'PROVIDER' | 'FALLBACK_PROVIDER', fallback: LlmProvider): LlmProvider {
  return (
    normalizeProvider(envUpper(task, role)) ??
    normalizeProvider(Deno.env.get(`LLM_${role}`) ?? undefined) ??
    fallback
  );
}

function resolveModel(task: string, provider: LlmProvider): string {
  const perTask = envUpper(task, 'MODEL');
  if (perTask) return perTask;
  const global = Deno.env.get('LLM_MODEL');
  if (global && global.length > 0) return global;
  return provider === 'moonshot' ? DEFAULT_MOONSHOT_MODEL : DEFAULT_ANTHROPIC_MODEL;
}

function providerKey(provider: LlmProvider): string | undefined {
  if (provider === 'anthropic') return Deno.env.get('ANTHROPIC_API_KEY') ?? undefined;
  return Deno.env.get('MOONSHOT_API_KEY') ?? Deno.env.get('KIMI_API_KEY') ?? undefined;
}

// --- provider adapters -------------------------------------------------------

async function callAnthropic(model: string, key: string, opts: ChatOptions): Promise<string> {
  // Anthropic wants system prompts as a top-level param, not a message.
  const system = opts.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const messages = opts.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: [{ type: 'text' as const, text: m.content }] }));

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 800,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(system ? { system } : {}),
      messages,
    }),
  });
  if (!resp.ok) {
    throw new Error(`anthropic ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const json = await resp.json();
  return json?.content?.[0]?.text ?? '';
}

async function callMoonshot(model: string, key: string, opts: ChatOptions): Promise<string> {
  const base = (Deno.env.get('MOONSHOT_BASE_URL') ?? 'https://api.moonshot.ai/v1').replace(/\/$/, '');
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 800,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!resp.ok) {
    throw new Error(`moonshot ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const json = await resp.json();
  return json?.choices?.[0]?.message?.content ?? '';
}

async function callProvider(provider: LlmProvider, model: string, key: string, opts: ChatOptions): Promise<string> {
  return provider === 'moonshot'
    ? callMoonshot(model, key, opts)
    : callAnthropic(model, key, opts);
}

// --- public entry point ------------------------------------------------------

/**
 * Run a chat completion for `task`, honoring env-based provider/model routing
 * with an automatic fallback to the secondary provider. Throws only when every
 * usable attempt fails (or none has a configured key) — callers keep their own
 * try/catch and map the throw to a clean `ok:false` fallback for the UI.
 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const primaryProvider = resolveProvider(opts.task, 'PROVIDER', 'anthropic');
  const fallbackProvider = resolveProvider(opts.task, 'FALLBACK_PROVIDER', 'anthropic');

  // Ordered, de-duplicated attempt list; drop any provider with no key.
  const planned: Array<{ provider: LlmProvider; model: string }> = [
    { provider: primaryProvider, model: resolveModel(opts.task, primaryProvider) },
    { provider: fallbackProvider, model: resolveModel(opts.task, fallbackProvider) },
  ];
  const attempts = planned.filter((a, i) => {
    const dup = planned.findIndex((b) => b.provider === a.provider && b.model === a.model) !== i;
    return !dup && !!providerKey(a.provider);
  });

  if (attempts.length === 0) {
    throw new Error('llm: no provider has a configured API key');
  }

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const key = providerKey(attempt.provider)!;
      const text = await callProvider(attempt.provider, attempt.model, key, opts);
      if (text && text.trim().length > 0) {
        return { text, provider: attempt.provider, model: attempt.model };
      }
      lastErr = new Error(`${attempt.provider} returned empty text`);
    } catch (err) {
      lastErr = err;
      // fall through to the next attempt (typically the Claude fallback)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
