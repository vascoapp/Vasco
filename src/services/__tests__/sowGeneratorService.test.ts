/**
 * @jest-environment node
 *
 * R61 / Package D1 — sowGeneratorService client wrapper around the
 * generate-sow edge function.
 *
 * Locks: the body shape sent to the edge fn (so the function contract
 * stays stable), the tone-preset fallback when business_settings is
 * unwritten, the offline-safe ok:false return, and the line-item cap.
 */

const mockInvoke = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpsert = jest.fn();
// R63 / D3: terminal value for the loadToneExamples query chain. The
// builder methods (.eq/.not/.order/.limit) all return the chain itself;
// the final .limit() resolves to this { data, error } object via its
// `then`-shape implementation in the mock below.
let mockToneExamplesQuery: { data: any; error: any } = { data: [], error: null };

jest.mock('../../lib/supabase', () => ({
  __esModule: true,
  isSupabaseConfigured: true,
  supabase: {
    functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-sow' } } }),
    },
    from: jest.fn(() => {
      const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        not: jest.fn(() => chain),
        order: jest.fn(() => chain),
        limit: jest.fn(() => Promise.resolve(mockToneExamplesQuery)),
        maybeSingle: () => mockMaybeSingle(),
        upsert: (...args: any[]) => mockUpsert(...args),
      };
      return chain;
    }),
  },
}));

jest.mock('../../i18n/i18n', () => ({
  __esModule: true,
  default: {
    language: 'nl',
    t: (key: string, def?: string) => def ?? key,
  },
}));

import {
  generateScopeOfWork,
  loadQuoteTonePreset,
  loadToneExamples,
  saveQuoteTonePreset,
} from '../sowGeneratorService';

describe('R61 — sowGeneratorService', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockMaybeSingle.mockReset();
    mockUpsert.mockReset();
  });

  it('forwards lineItems + tone + language to the edge fn body', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, scopeText: 'Includes…\n\nExcludes…\n\nWarranty…' },
      error: null,
    });

    const result = await generateScopeOfWork({
      lineItems: [
        { description: 'Vaillant ecoTEC Plus boiler', quantity: 1, unit: 'st' },
        { description: 'Flue replacement', quantity: 2, unit: 'm' },
      ],
      trade: 'plumbing',
      jobTitle: 'Boiler vervanging',
      customerName: 'Familie Jansen',
      businessName: 'Plumbing BV',
      tone: 'friendly',
    });

    expect(result.ok).toBe(true);
    expect(result.scopeText).toContain('Includes');

    const [fnName, opts] = mockInvoke.mock.calls[0];
    expect(fnName).toBe('generate-sow');
    expect(opts.body.language).toBe('nl');
    expect(opts.body.tone).toBe('friendly');
    expect(opts.body.lineItems).toHaveLength(2);
    expect(opts.body.lineItems[0].description).toContain('Vaillant');
  });

  it('caps lineItems at 50 to prevent runaway prompts', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true, scopeText: 'x' }, error: null });
    const big = Array.from({ length: 200 }, (_, i) => ({ description: `item ${i}` }));
    await generateScopeOfWork({ lineItems: big });
    expect(mockInvoke.mock.calls[0][1].body.lineItems).toHaveLength(50);
  });

  it('returns ok:false when lineItems empty (no edge fn call)', async () => {
    const result = await generateScopeOfWork({ lineItems: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('No line items');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('returns ok:false when edge fn throws (no UI throw)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network down'));
    const result = await generateScopeOfWork({
      lineItems: [{ description: 'x' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('network');
  });

  it('returns ok:false when edge fn returns error envelope', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: false, error: 'Could not parse Claude response' },
      error: null,
    });
    const result = await generateScopeOfWork({
      lineItems: [{ description: 'x' }],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('parse');
  });

  // R64 (audit fix #13): raw model output bubbles through on parse failure
  // so __DEV__ telemetry can iterate the prompt without server-log access.
  it('passes through raw output and retryAfter on edge fn error envelope', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        ok: false,
        error: 'Could not parse Claude response',
        raw: 'sorry, here is some text instead of JSON',
      },
      error: null,
    });
    const result = await generateScopeOfWork({
      lineItems: [{ description: 'x' }],
    });
    expect(result.ok).toBe(false);
    expect(result.raw).toContain('sorry');

    // Rate-limit envelope
    mockInvoke.mockResolvedValueOnce({
      data: { ok: false, error: 'Rate limited', retryAfter: 30 },
      error: null,
    });
    const limited = await generateScopeOfWork({ lineItems: [{ description: 'x' }] });
    expect(limited.ok).toBe(false);
    expect(limited.retryAfter).toBe(30);
  });

  it('loadQuoteTonePreset reads business_settings and falls back to friendly', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { quote_tone: 'formal' }, error: null });
    expect(await loadQuoteTonePreset()).toBe('formal');

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await loadQuoteTonePreset()).toBe('friendly');

    mockMaybeSingle.mockResolvedValueOnce({ data: { quote_tone: 'invalid_value' }, error: null });
    expect(await loadQuoteTonePreset()).toBe('friendly');
  });

  it('saveQuoteTonePreset upserts on user_id conflict', async () => {
    mockUpsert.mockResolvedValueOnce({ error: null });
    const ok = await saveQuoteTonePreset('detailed');
    expect(ok).toBe(true);
    const [payload, opts] = mockUpsert.mock.calls[0];
    expect(payload.user_id).toBe('user-sow');
    expect(payload.quote_tone).toBe('detailed');
    expect(opts.onConflict).toBe('user_id');
  });

  // R63 / D3 — tone learning from accepted-quote history
  describe('loadToneExamples', () => {
    afterEach(() => {
      mockToneExamplesQuery = { data: [], error: null };
    });

    it('returns empty array when below the 5-quote threshold', async () => {
      // 4 accepted quotes — below MIN_ACCEPTED_QUOTES_FOR_TONE_LEARN.
      mockToneExamplesQuery = {
        data: [
          { scope_text: 'Includes installation of a new boiler. Excludes electrical work. 5-year warranty on parts.', updated_at: '2026-05-01' },
          { scope_text: 'Full bathroom renovation including tiling, plumbing fixtures, and electrical. Excludes structural changes. 2-year warranty.', updated_at: '2026-04-15' },
          { scope_text: 'Kitchen remodel with new cabinets and countertops. Excludes appliance installation. 3-year warranty on workmanship.', updated_at: '2026-04-01' },
          { scope_text: 'Roof repair and gutter replacement. Excludes insulation. 10-year warranty on materials.', updated_at: '2026-03-15' },
        ],
        error: null,
      };
      const examples = await loadToneExamples();
      expect(examples).toEqual([]);
    });

    it('returns up to 3 freshest excerpts when threshold is met', async () => {
      // 6 accepted quotes — exceeds threshold; freshest first per the
      // .order(updated_at desc) the impl applies.
      mockToneExamplesQuery = {
        data: [
          { scope_text: 'EXAMPLE 1 — boiler install, formal tone, longer than fifty characters here.', updated_at: '2026-05-01' },
          { scope_text: 'EXAMPLE 2 — bathroom reno, formal tone, longer than fifty characters here.', updated_at: '2026-04-15' },
          { scope_text: 'EXAMPLE 3 — kitchen remodel, formal tone, longer than fifty characters here.', updated_at: '2026-04-01' },
          { scope_text: 'EXAMPLE 4 — roof repair, formal tone, longer than fifty characters here.', updated_at: '2026-03-15' },
          { scope_text: 'EXAMPLE 5 — wiring upgrade, formal tone, longer than fifty characters here.', updated_at: '2026-03-01' },
          { scope_text: 'EXAMPLE 6 — old quote, would not be included, longer than fifty chars.', updated_at: '2026-02-01' },
        ],
        error: null,
      };
      const examples = await loadToneExamples();
      expect(examples).toHaveLength(3);
      expect(examples[0]).toContain('EXAMPLE 1');
      expect(examples[1]).toContain('EXAMPLE 2');
      expect(examples[2]).toContain('EXAMPLE 3');
    });

    it('filters out short scope_text (less than 50 chars)', async () => {
      mockToneExamplesQuery = {
        data: [
          { scope_text: 'too short', updated_at: '2026-05-01' },
          { scope_text: 'EXAMPLE A — long enough description with more than fifty characters here.', updated_at: '2026-04-15' },
          { scope_text: 'EXAMPLE B — long enough description with more than fifty characters here.', updated_at: '2026-04-01' },
          { scope_text: 'EXAMPLE C — long enough description with more than fifty characters here.', updated_at: '2026-03-15' },
          { scope_text: 'EXAMPLE D — long enough description with more than fifty characters here.', updated_at: '2026-03-01' },
          { scope_text: 'EXAMPLE E — long enough description with more than fifty characters here.', updated_at: '2026-02-15' },
        ],
        error: null,
      };
      const examples = await loadToneExamples();
      expect(examples).toHaveLength(3);
      expect(examples.every(e => !e.includes('too short'))).toBe(true);
    });

    it('caps each example at 800 chars to prevent runaway prompts', async () => {
      const huge = 'X'.repeat(2000);
      mockToneExamplesQuery = {
        data: Array.from({ length: 6 }, (_, i) => ({
          scope_text: `Prefix ${i} ` + huge,
          updated_at: `2026-05-0${i + 1}`,
        })),
        error: null,
      };
      const examples = await loadToneExamples();
      expect(examples).toHaveLength(3);
      examples.forEach(e => {
        expect(e.length).toBeLessThanOrEqual(800);
      });
    });

    it('returns empty when query errors', async () => {
      mockToneExamplesQuery = { data: null, error: { message: 'rls violation' } };
      expect(await loadToneExamples()).toEqual([]);
    });
  });
});
