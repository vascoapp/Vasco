// =============================================================================
// SOW (SCOPE-OF-WORK) GENERATOR SERVICE — R61 / Package D1
// =============================================================================
// Client wrapper for the `generate-sow` edge function. Takes a draft quote's
// line items + the contractor's tone preset and returns a 3-paragraph
// narrative scope (INCLUDES / EXCLUDES / WARRANTY).
//
// Design notes:
//   - Edge fn is the source of truth for prompt + Anthropic call. This file
//     is a thin RPC wrapper that returns `{ ok, scopeText, error }`.
//   - Caller persists the returned scopeText to documents.scope_text via
//     the existing `updateDocument` (R57 dual-route handles both uuid and
//     docNumber-shaped quote ids — no special-casing needed here).
//   - Tone-from-history loop (D3) is NOT in this file; D1 only sends the
//     preset. When D3 lands it'll add `toneExamples` lookup before this call.
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import i18n from '../i18n/i18n';

export type QuoteTone = 'formal' | 'friendly' | 'detailed' | 'concise';

export interface SowLineItem {
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
}

export interface GenerateSowInput {
  /** Quote line items as the contractor configured them. */
  lineItems: SowLineItem[];
  trade?: string;
  jobTitle?: string;
  customerName?: string;
  businessName?: string;
  /** Contractor's preset tone. Defaults to 'friendly' if omitted. */
  tone?: QuoteTone;
  /** Optional: short narrative summary from the job dossier (D3 wires this). */
  dossierBrief?: string;
  /** Optional: 1-3 prose excerpts from accepted quotes for tone learning. */
  toneExamples?: string[];
}

export interface GenerateSowResult {
  ok: boolean;
  scopeText?: string;
  error?: string;
  /** R64 (audit fix #13): raw Claude output (first 400 chars) when JSON
   *  parse fails. Surface in __DEV__ telemetry only — production users
   *  never see this; iterating the prompt requires it. */
  raw?: string;
  /** R64 (audit fix #5): seconds to wait before retrying (set on 429). */
  retryAfter?: number;
}

/**
 * Generate a 3-paragraph scope of work for a quote. Returns `{ ok: false }`
 * on any failure (Supabase off, network error, edge fn down, malformed
 * Claude response). Caller renders an inline retry-button on `ok: false`
 * and never throws to the UI thread.
 */
export async function generateScopeOfWork(
  input: GenerateSowInput,
): Promise<GenerateSowResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase not configured' };
  }
  if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
    return { ok: false, error: 'No line items to scope' };
  }

  const lang = (i18n.language?.split('-')[0] ?? 'nl') as 'nl' | 'en' | 'de' | 'fr' | 'es' | 'it';

  try {
    const { data, error } = await supabase.functions.invoke('generate-sow', {
      body: {
        language: lang,
        trade: input.trade,
        jobTitle: input.jobTitle,
        customerName: input.customerName,
        businessName: input.businessName,
        tone: input.tone ?? 'friendly',
        lineItems: input.lineItems.slice(0, 50),
        dossierBrief: input.dossierBrief,
        toneExamples: input.toneExamples?.slice(0, 3),
      },
    });
    if (error) return { ok: false, error: error.message };
    const payload = data as GenerateSowResult;
    if (!payload?.ok) {
      // R64 (audit fix #13): preserve `raw` (parse-failure debug) +
      // `retryAfter` (rate-limit) so __DEV__ telemetry can surface them
      // and the FE can render a smarter retry hint.
      return {
        ok: false,
        error: payload?.error ?? 'Unknown error',
        raw: payload?.raw,
        retryAfter: payload?.retryAfter,
      };
    }
    return payload;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Tone preset accessor
// ---------------------------------------------------------------------------
// Reads quote_tone from business_settings — column added in
// `20260505000001_sow_columns.sql`. Falls back to 'friendly' when the row
// hasn't been written yet (new contractors before they hit the settings UI).
export async function loadQuoteTonePreset(): Promise<QuoteTone> {
  if (!isSupabaseConfigured) return 'friendly';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 'friendly';
    const { data, error } = await (supabase.from('business_settings') as any)
      .select('quote_tone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error || !data) return 'friendly';
    const raw = String(data.quote_tone ?? 'friendly').toLowerCase();
    if (raw === 'formal' || raw === 'friendly' || raw === 'detailed' || raw === 'concise') {
      return raw;
    }
    return 'friendly';
  } catch {
    return 'friendly';
  }
}

export async function saveQuoteTonePreset(tone: QuoteTone): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await (supabase.from('business_settings') as any)
      .upsert({ user_id: user.id, quote_tone: tone }, { onConflict: 'user_id' });
    return !error;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// R63 / D3 — tone learning from accepted-quote history
// ---------------------------------------------------------------------------
// Once the contractor has accumulated 5+ accepted quotes with non-empty
// `scope_text`, the cold-start tone preset becomes secondary — we feed
// real prose excerpts as few-shot examples so Claude mimics the
// contractor's actual voice instead of the generic `formal/friendly/...`
// preset. Excerpts are trimmed to ~800 chars each and capped at 3
// (matches the edge fn's slice).
//
// Threshold is a soft 5: below that the contractor's voice isn't
// established enough for the model to extract a stable pattern, and the
// caller falls back to the preset alone.
const MIN_ACCEPTED_QUOTES_FOR_TONE_LEARN = 5;
const MAX_TONE_EXAMPLES = 3;
const MAX_TONE_EXAMPLE_CHARS = 800;

/**
 * Pull the contractor's recent accepted quotes that have a non-empty
 * `scope_text`, return up to 3 prose excerpts to pass as `toneExamples`
 * on the next `generateScopeOfWork` call. Returns an empty array (not
 * null) when below the threshold, so the caller can spread it
 * unconditionally without branching.
 */
export async function loadToneExamples(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await (supabase.from('documents') as any)
      .select('scope_text, updated_at')
      .eq('user_id', user.id)
      .eq('doc_type', 'quote')
      .eq('status', 'accepted')
      .not('scope_text', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error || !Array.isArray(data)) return [];
    const examples = data
      .map((row: { scope_text: string | null }) => (row.scope_text ?? '').trim())
      .filter((s: string) => s.length > 50);
    if (examples.length < MIN_ACCEPTED_QUOTES_FOR_TONE_LEARN) return [];
    return examples
      .slice(0, MAX_TONE_EXAMPLES)
      .map((s: string) => s.slice(0, MAX_TONE_EXAMPLE_CHARS));
  } catch {
    return [];
  }
}
