// =============================================================================
// PUBLIC QUOTE PORTAL — client wrapper for the signed-token Edge Functions
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface PortalQuote {
  id: string;
  reference: string;
  total: number;
  status: string;
  metadata?: Record<string, any>;
  lines: Array<{ description: string; quantity: number; unit_price: number; total_price: number; position: number }>;
  customer?: { name: string | null; email: string | null } | null;
  business?: { business_name: string | null; phone: string | null; email: string | null; country: string | null } | null;
}

export interface FetchResult {
  ok: boolean;
  quote?: PortalQuote;
  error?: string;
}

/** Customer-facing: fetch a quote via signed token (no auth session). */
export async function fetchQuoteByToken(quoteId: string, token: string): Promise<FetchResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.functions.invoke('verify-quote-token', {
      body: { quoteId, token },
    });
    if (error) return { ok: false, error: error.message };
    return data as FetchResult;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Contractor-facing: mint a shareable URL for a quote (requires auth). */
export async function signQuoteLink(quoteId: string): Promise<{ ok: boolean; url?: string; token?: string; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.functions.invoke('sign-quote-token', {
      body: { quoteId },
    });
    if (error) return { ok: false, error: error.message };
    return data as any;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
