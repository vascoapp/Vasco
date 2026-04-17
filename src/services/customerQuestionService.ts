// =============================================================================
// CUSTOMER QUESTION SERVICE
// =============================================================================
// Used from the decision portal (anon/customer-facing). Submits a free-text
// question to the classify-customer-question Edge Function and returns either
// an immediate AI auto-reply (low-stakes) or a "pending" state the portal
// can poll until the contractor approves.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface QuestionSubmitResult {
  ok: boolean;
  id?: string;
  autoReply?: string | null;
  pending?: boolean;
  stakes?: 'low' | 'high' | 'unknown';
  error?: string;
}

export interface CustomerQuestionContext {
  trade?: string;
  scheduledDate?: string;
  address?: string;
  jobTitle?: string;
  quoteAmount?: number;
  quoteCurrency?: string;
  decisions?: Array<{ item: string; value: string }>;
  contractorNotes?: string;
  businessName?: string;
  contractorPhone?: string;
}

export async function submitCustomerQuestion(args: {
  trackerAccessToken: string;
  question: string;
  customerName?: string;
  language?: 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';
  context?: CustomerQuestionContext;
}): Promise<QuestionSubmitResult> {
  if (!isSupabaseConfigured) {
    // Demo mode — fake a low-stakes auto-reply so the UX still works.
    return {
      ok: true,
      id: `demo_${Date.now()}`,
      autoReply: 'Thanks for your question — in live mode Vasco will draft a reply and either send it directly or route it to the contractor for approval.',
      pending: false,
      stakes: 'low',
    };
  }
  try {
    const { data, error } = await supabase.functions.invoke('classify-customer-question', {
      body: args,
    });
    if (error || !data) return { ok: false, error: error?.message ?? 'No response' };
    return data as QuestionSubmitResult;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Poll the question row for a contractor-approved reply. Returns the reply
 * text once contractor taps Approve (via the VascoCard queue), or null while
 * still pending. Used by the portal to show the answer inline. */
export async function pollQuestionReply(
  questionId: string,
): Promise<{ status: string; reply?: string | null }> {
  if (!isSupabaseConfigured) return { status: 'sent', reply: null };
  try {
    const { data } = await (supabase.from as any)('customer_questions')
      .select('status, approved_reply, auto_sent, ai_reply_draft')
      .eq('id', questionId)
      .maybeSingle();
    if (!data) return { status: 'pending' };
    const reply = data.approved_reply ?? (data.auto_sent ? data.ai_reply_draft : null);
    return { status: data.status ?? 'pending', reply };
  } catch {
    return { status: 'pending' };
  }
}
