// Deno unit tests for the LLM provider router + PII tokenizer.
// Run: deno test --allow-env --allow-net supabase/functions/_shared/llm_pii.test.ts
// fetch is stubbed, so no real provider calls / no network to the LLMs.
import {
  assert,
  assertEquals,
  assertStringIncludes,
  assertRejects,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { chat } from './llm.ts';
import { scrubFreeText, tokenizeIdentities } from './pii.ts';

const realFetch = globalThis.fetch;
function restore() { globalThis.fetch = realFetch; }

function anthropicOk(text: string) {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 });
}
function moonshotOk(text: string) {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
}

function clearRouting() {
  for (const k of ['LLM_PROVIDER', 'LLM_FALLBACK_PROVIDER', 'LLM_MODEL',
    'LLM_SOW_PROVIDER', 'LLM_SOW_FALLBACK_PROVIDER', 'LLM_SOW_MODEL',
    'MOONSHOT_BASE_URL']) Deno.env.delete(k);
}

Deno.test('defaults to Anthropic when no routing env set', async () => {
  clearRouting();
  Deno.env.set('ANTHROPIC_API_KEY', 'a-key');
  Deno.env.delete('MOONSHOT_API_KEY');
  let hit = '';
  globalThis.fetch = ((url: string | URL | Request) => {
    hit = String(url);
    return Promise.resolve(anthropicOk('{"scopeText":"ok"}'));
  }) as typeof fetch;
  const r = await chat({ task: 'sow', messages: [{ role: 'user', content: 'hi' }] });
  assertStringIncludes(hit, 'api.anthropic.com');
  assertEquals(r.provider, 'anthropic');
  assertEquals(r.text, '{"scopeText":"ok"}');
  restore();
});

Deno.test('routes SOW task to Moonshot when opted in, honoring base url', async () => {
  clearRouting();
  Deno.env.set('ANTHROPIC_API_KEY', 'a-key');
  Deno.env.set('MOONSHOT_API_KEY', 'm-key');
  Deno.env.set('LLM_SOW_PROVIDER', 'moonshot');
  Deno.env.set('MOONSHOT_BASE_URL', 'https://eu-gateway.example/v1');
  let hit = '';
  let auth = '';
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    hit = String(url);
    auth = String((init?.headers as Record<string, string>)?.Authorization ?? '');
    return Promise.resolve(moonshotOk('{"scopeText":"kimi"}'));
  }) as typeof fetch;
  const r = await chat({ task: 'sow', messages: [{ role: 'user', content: 'hi' }], jsonMode: true });
  assertStringIncludes(hit, 'https://eu-gateway.example/v1/chat/completions');
  assertStringIncludes(auth, 'Bearer m-key');
  assertEquals(r.provider, 'moonshot');
  restore();
});

Deno.test('fails over from Moonshot to Anthropic on error', async () => {
  clearRouting();
  Deno.env.set('ANTHROPIC_API_KEY', 'a-key');
  Deno.env.set('MOONSHOT_API_KEY', 'm-key');
  Deno.env.set('LLM_SOW_PROVIDER', 'moonshot');
  // fallback defaults to anthropic
  const hits: string[] = [];
  globalThis.fetch = ((url: string | URL | Request) => {
    const u = String(url);
    hits.push(u);
    if (u.includes('moonshot') || u.includes('chat/completions')) {
      return Promise.resolve(new Response('upstream boom', { status: 500 }));
    }
    return Promise.resolve(anthropicOk('{"scopeText":"claude-fallback"}'));
  }) as typeof fetch;
  const r = await chat({ task: 'sow', messages: [{ role: 'user', content: 'hi' }] });
  assertEquals(r.provider, 'anthropic');
  assertEquals(r.text, '{"scopeText":"claude-fallback"}');
  assert(hits.length === 2, `expected 2 attempts, got ${hits.length}`);
  restore();
});

Deno.test('throws when no provider key is configured', async () => {
  clearRouting();
  Deno.env.delete('ANTHROPIC_API_KEY');
  Deno.env.delete('MOONSHOT_API_KEY');
  Deno.env.delete('KIMI_API_KEY');
  await assertRejects(
    () => chat({ task: 'sow', messages: [{ role: 'user', content: 'hi' }] }),
    Error,
    'no provider',
  );
});

Deno.test('PII: names tokenized out and rehydrated back', () => {
  const ident = tokenizeIdentities('Familie Jansen', 'Loodgieter BV');
  assertEquals(ident.customerRef, '[CUSTOMER_NAME]');
  assertEquals(ident.businessRef, '[BUSINESS_NAME]');
  // model output uses the tokens; rehydrate restores the real names
  const out = ident.rehydrate('Beste [CUSTOMER_NAME], [BUSINESS_NAME] voert het werk uit.');
  assertEquals(out, 'Beste Familie Jansen, Loodgieter BV voert het werk uit.');
});

Deno.test('PII: missing names fall back to neutral nouns (no token leak)', () => {
  const ident = tokenizeIdentities(undefined, undefined);
  assertEquals(ident.customerRef, 'the customer');
  assertEquals(ident.businessRef, 'the contractor');
  assertEquals(ident.rehydrate('text with no tokens'), 'text with no tokens');
});

Deno.test('PII: scrubFreeText masks email/phone/IBAN/postcode and known names', () => {
  const dirty = 'Contact Jan de Vries at jan@example.com or +31 6 12345678. IBAN NL91ABNA0417164300, 1012 AB Amsterdam.';
  const clean = scrubFreeText(dirty, ['Jan de Vries']);
  assertStringIncludes(clean, '[email]');
  assertStringIncludes(clean, '[phone]');
  assertStringIncludes(clean, '[iban]');
  assertStringIncludes(clean, '[postcode]');
  assert(!clean.includes('jan@example.com'), 'email leaked');
  assert(!clean.includes('Jan de Vries'), 'name leaked');
  assert(!clean.includes('NL91ABNA0417164300'), 'IBAN leaked');
});
