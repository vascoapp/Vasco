// taskHasProvider — ai-capabilities' `text` must match what chat() can run
// (review #366). A Kimi-only key with no LLM_PROVIDER does NOT run a task:
// chat() defaults both primary and fallback to anthropic.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { taskHasProvider } from './llm.ts';

const KEYS = ['ANTHROPIC_API_KEY', 'MOONSHOT_API_KEY', 'KIMI_API_KEY', 'LLM_PROVIDER', 'LLM_FALLBACK_PROVIDER', 'LLM_SOW_PROVIDER'];
const clean = () => KEYS.forEach((k) => Deno.env.delete(k));

Deno.test('no key at all → cannot run', () => {
  clean();
  assertEquals(taskHasProvider('sow'), false);
});

Deno.test('Kimi key only, provider left at its default → cannot run', () => {
  clean();
  Deno.env.set('KIMI_API_KEY', 'k-1234567890abcdefghij');
  assertEquals(taskHasProvider('sow'), false);
  clean();
});

Deno.test('Kimi key AND the task routed to moonshot → can run', () => {
  clean();
  Deno.env.set('MOONSHOT_API_KEY', 'k-1234567890abcdefghij');
  Deno.env.set('LLM_SOW_PROVIDER', 'moonshot');
  assertEquals(taskHasProvider('sow'), true);
  clean();
});

Deno.test('Anthropic key → can run', () => {
  clean();
  Deno.env.set('ANTHROPIC_API_KEY', 'sk-ant-1234567890abcdefghij');
  assertEquals(taskHasProvider('sow'), true);
  clean();
});
