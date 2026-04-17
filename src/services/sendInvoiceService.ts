// =============================================================================
// SEND INVOICE — client wrapper around the `send-invoice` Edge Function
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type Locale = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

export interface SendInvoiceInput {
  invoiceId: string;
  to: string;
  subject?: string;
  paymentUrl?: string;
  /** Base64 PDF (without data:...; prefix). Optional. */
  pdfBase64?: string;
  locale?: Locale;
  /** Optional body override. When the reminder cadence wants to supply the
   * full message (e.g. firm/final with statutory-interest disclosure), the
   * Edge Function should prefer this over its stock template. */
  bodyOverride?: string;
}

export interface SendInvoiceResult {
  ok: boolean;
  messageId?: string | null;
  error?: string;
}

export async function sendInvoice(input: SendInvoiceInput): Promise<SendInvoiceResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: 'Supabase not configured — cannot send email.' };
  }
  try {
    const { data, error } = await supabase.functions.invoke('send-invoice', {
      body: input,
    });
    if (error) return { ok: false, error: error.message };
    const payload = data as SendInvoiceResult;
    if (!payload?.ok) return { ok: false, error: payload?.error ?? 'Unknown error' };
    return payload;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
