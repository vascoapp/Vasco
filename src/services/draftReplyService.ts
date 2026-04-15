// =============================================================================
// DRAFT CUSTOMER REPLY — client wrapper for draft-customer-reply Edge Function
// =============================================================================

import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface ReplyOption {
  tone: 'friendly' | 'firm' | 'concise' | string;
  text: string;
}

export interface DraftReplyInput {
  inbound: string;
  context?: string;
  language: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
  customerName?: string;
  businessName?: string;
}

export async function draftCustomerReply(input: DraftReplyInput): Promise<{ ok: boolean; options?: ReplyOption[]; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase not configured' };
  try {
    const { data, error } = await supabase.functions.invoke('draft-customer-reply', { body: input });
    if (error) return { ok: false, error: error.message };
    return data as any;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
