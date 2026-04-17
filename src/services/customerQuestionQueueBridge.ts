// =============================================================================
// CUSTOMER QUESTION → QUEUE BRIDGE
// =============================================================================
// High-stakes questions flagged by the portal Edge Function (R168) live in
// `customer_questions` with status='drafted' + ai_reply_draft filled. This
// bridge fetches those for the current contractor and maps them into
// QueueItem shape so they render inside the existing VascoCard queue. Approve
// writes the contractor's (possibly-edited) reply back to the DB row so the
// portal poller picks it up. Reject marks the row declined.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUserId } from '../lib/currentUser';
import type { QueueItem } from './aiActionQueueService';

interface CustomerQuestionRow {
  id: string;
  question: string;
  question_lang: string | null;
  ai_reply_draft: string | null;
  ai_reply_confidence: number | null;
  ai_reply_reason: string | null;
  tracker_id: string | null;
  tracker_access_token: string | null;
  status: string;
  created_at: string;
}

/**
 * Fetch pending high-stakes questions for the current contractor and shape
 * them as QueueItem for the Vasco card.
 */
export async function fetchPendingCustomerQuestions(): Promise<QueueItem[]> {
  if (!isSupabaseConfigured) return [];
  const userId = getCurrentUserId();
  if (!userId || userId === 'current-user') return [];
  try {
    const { data, error } = await (supabase.from as any)('customer_questions')
      .select('id,question,question_lang,ai_reply_draft,ai_reply_confidence,ai_reply_reason,tracker_id,tracker_access_token,status,created_at')
      .eq('contractor_user_id', userId)
      .in('status', ['drafted', 'pending'])
      .is('approved_reply', null)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error || !Array.isArray(data)) return [];
    return (data as CustomerQuestionRow[]).map(mapRowToQueueItem);
  } catch {
    return [];
  }
}

function mapRowToQueueItem(row: CustomerQuestionRow): QueueItem {
  const snippet = row.question.length > 60 ? row.question.slice(0, 57) + '…' : row.question;
  return {
    id: `cq:${row.id}`,
    type: 'customer_question',
    status: 'pending',
    title: snippet,
    description: row.ai_reply_draft || '',
    preparedData: {
      questionId: row.id,
      question: row.question,
      draftReply: row.ai_reply_draft ?? '',
      confidence: row.ai_reply_confidence ?? 0,
      reasoning: row.ai_reply_reason ?? undefined,
      trackerAccessToken: row.tracker_access_token,
      language: row.question_lang ?? 'nl',
      template: row.ai_reply_draft ?? '',
    },
    actionLabel: 'send',
    estimatedImpact: '',
    createdAt: row.created_at,
    entityKey: `cq:${row.id}`,
    count: 1,
  };
}

/**
 * Write the contractor-approved reply (possibly edited) back to the DB so the
 * portal poller renders it to the customer. Returns true on success.
 */
export async function approveCustomerQuestionReply(questionId: string, replyText: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const userId = getCurrentUserId();
  if (!userId || userId === 'current-user') return false;
  const clean = replyText.trim();
  if (!clean) return false;
  try {
    const { error } = await (supabase.from as any)('customer_questions')
      .update({
        approved_reply: clean,
        approved_by: userId,
        approved_at: new Date().toISOString(),
        status: 'approved',
      })
      .eq('id', questionId)
      .eq('contractor_user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

export async function rejectCustomerQuestionReply(questionId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const userId = getCurrentUserId();
  if (!userId || userId === 'current-user') return false;
  try {
    const { error } = await (supabase.from as any)('customer_questions')
      .update({ status: 'declined' })
      .eq('id', questionId)
      .eq('contractor_user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

/** Helper to extract the underlying DB question id from a QueueItem.id that
 * came from this bridge (`cq:<uuid>` prefix). */
export function questionIdFromQueueItemId(queueItemId: string): string | null {
  if (queueItemId.startsWith('cq:')) return queueItemId.slice(3);
  return null;
}
