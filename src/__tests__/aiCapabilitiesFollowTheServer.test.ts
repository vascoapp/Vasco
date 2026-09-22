/**
 * AI features follow what the SERVER can run, not only the build.
 *
 * Adding ANTHROPIC_API_KEY used to need a new OTA as well, because photo →
 * quote and scope drafting were gated on a build-time flag. The
 * `ai-capabilities` edge function now says what is live; the app turns the
 * features on when it says so — and keeps them OFF whenever it cannot ask.
 */
const mockInvoke = jest.fn();
jest.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { functions: { invoke: (...a: any[]) => mockInvoke(...a) } },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getAiCapabilities, __resetAiCapabilitiesForTests, BUILD_CAPABILITIES } from '../services/aiCapabilities';
import { stripComments } from '../utils/stripComments';

describe('AI capabilities follow the server', () => {
  beforeEach(async () => {
    __resetAiCapabilitiesForTests();
    mockInvoke.mockReset();
    await AsyncStorage.clear();
  });

  it('the build alone enables nothing in this build', () => {
    expect(BUILD_CAPABILITIES).toEqual({ vision: false, text: false, embeddings: false });
  });

  it('turns vision on when the server reports the key is set', async () => {
    mockInvoke.mockResolvedValue({ data: { vision: true, text: true, embeddings: false }, error: null });
    await expect(getAiCapabilities()).resolves.toEqual({ vision: true, text: true, embeddings: false });
    expect(mockInvoke).toHaveBeenCalledWith('ai-capabilities', expect.anything());
  });

  it('stays OFF when the server cannot be asked — never assumes it works', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(getAiCapabilities()).resolves.toEqual({ vision: false, text: false, embeddings: false });
    mockInvoke.mockRejectedValue(new Error('network'));
    __resetAiCapabilitiesForTests();
    await expect(getAiCapabilities()).resolves.toEqual({ vision: false, text: false, embeddings: false });
  });

  it('ignores anything but a literal true', async () => {
    mockInvoke.mockResolvedValue({ data: { vision: 'yes', text: 1 }, error: null });
    await expect(getAiCapabilities()).resolves.toEqual({ vision: false, text: false, embeddings: false });
  });

  it('asks once an hour, not on every screen', async () => {
    mockInvoke.mockResolvedValue({ data: { vision: true, text: true, embeddings: false }, error: null });
    await getAiCapabilities();
    await getAiCapabilities();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('the quote builder gates photo → quote on vision and drafting on text', () => {
    const src = stripComments(readFileSync(join(__dirname, '../components/contractor/TieredQuoteBuilder.tsx'), 'utf8'));
    expect(src).toMatch(/const aiCaps = useAiCapabilities\(\)/);
    expect(src).toMatch(/\{aiCaps\.vision \? \(/);
    expect(src).toMatch(/aiCaps\.text && !sowText/);
    expect(src).not.toMatch(/LLM_GENERATION_ENABLED/);
  });

  it('the edge function returns booleans only — never a key', () => {
    const fn = stripComments(readFileSync(join(__dirname, '../../supabase/functions/ai-capabilities/index.ts'), 'utf8'));
    const body = fn.slice(fn.indexOf('const body = {'), fn.indexOf('};', fn.indexOf('const body = {')));
    expect(body).not.toMatch(/Deno\.env\.get/);
    expect(body).toMatch(/vision:/);
  });
});
