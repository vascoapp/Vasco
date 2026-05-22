// =============================================================================
// AI-COMMAND SERVICE — Office-manager chat dispatcher (R87 US Phase 5)
// =============================================================================
// Client-side wrapper around the `ai-command` Supabase edge function.
// Sends a contractor's natural-language command + light context (recent
// customers, revenue totals, overdue count). Returns parsed intent + a
// human response for the chat UI.
//
// The chat UI (app/contractor/ai-chat.tsx) handles dispatch — it
// switches on `result.intent` and calls the right AppState mutator.
// =============================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import { trackEvent } from './eventTrackingService';

export type AiIntent =
  | 'create_invoice'
  | 'schedule_job'
  | 'query_revenue'
  | 'list_overdue'
  | 'send_reminder'
  // R95 — extended intent set covering common contractor asks.
  | 'cancel_job'
  | 'query_job_status'
  | 'find_customer'
  | 'weekly_summary'
  | 'unknown';

export interface AiCommandContext {
  customers?: Array<{ id: string; name: string }>;
  recentInvoiceTotal?: number;
  overdueCount?: number;
  locale?: string;
  // R95 — added for the new intents. Optional so existing callers keep working.
  activeJobs?: Array<{ id: string; customer: string; status: string }>;
  weeklyRevenue?: number;
  weeklyJobsCompleted?: number;
  weeklyQuotesSent?: number;
}

export interface AiCommandResult {
  intent: AiIntent;
  humanResponse: string;
  action?: { type: string; params: Record<string, unknown> };
}

export type AiCommandError =
  | { ok: false; reason: 'claude_disabled' | 'network' | 'claude_error' | 'unknown' };

export type AiCommandReturn =
  | { ok: true; result: AiCommandResult }
  | AiCommandError;

/**
 * Send a command to Claude via the ai-command edge function. Returns a
 * structured result the chat UI can render + dispatch.
 *
 * When supabase isn't configured (demo mode), returns a canned response
 * so the chat UI still renders something useful for the demo flow.
 */
export async function sendAiCommand(
  message: string,
  context?: AiCommandContext,
): Promise<AiCommandReturn> {
  // R95 breadcrumb. Length only, never the message body — chat input is
  // potentially PII and shouldn't land in event payloads.
  trackEvent('ai_command_sent', { length: message.length }).catch(() => {});

  if (!isSupabaseConfigured) {
    // Demo mode — deterministic stub so the chat UI is testable without
    // a real Anthropic key. Pattern-matches a few common asks.
    return { ok: true, result: stubResponse(message, context) };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-command', {
      body: { message, context },
    });
    if (error) {
      logWarn('sendAiCommand', `edge fn error: ${error.message}`);
      return { ok: false, reason: 'claude_error' };
    }
    if (data && typeof data === 'object' && 'intent' in data) {
      return { ok: true, result: data as AiCommandResult };
    }
    return { ok: false, reason: 'unknown' };
  } catch (e) {
    logWarn('sendAiCommand', `threw: ${(e as Error).message}`);
    return { ok: false, reason: 'network' };
  }
}

// ─── Demo-mode stub ─────────────────────────────────────────────────────

function stubResponse(message: string, ctx?: AiCommandContext): AiCommandResult {
  const lower = message.toLowerCase();

  // Pattern: "invoice {name} for {amount}" / "bill {name} {amount}"
  const invoiceMatch = lower.match(/(?:invoice|bill)\s+(\w+)(?:\s+for)?\s+\$?(\d+)/);
  if (invoiceMatch) {
    const name = invoiceMatch[1];
    const amount = Number(invoiceMatch[2]);
    return {
      intent: 'create_invoice',
      humanResponse: `OK — I'll draft an invoice for $${amount} to ${name}. Review before sending.`,
      action: { type: 'create_invoice', params: { customerName: name, amount, currency: 'USD' } },
    };
  }

  // "what did I make..." / "revenue"
  if (/(what did i make|revenue|earnings)/i.test(lower)) {
    const total = ctx?.recentInvoiceTotal ?? 0;
    return {
      intent: 'query_revenue',
      humanResponse: total > 0
        ? `Last 90 days: $${total.toLocaleString('en-US')} in invoices.`
        : `No invoice activity in the last 90 days yet.`,
    };
  }

  // "show overdue" / "who hasn't paid"
  if (/(overdue|who.*pa(id|y))/i.test(lower)) {
    const count = ctx?.overdueCount ?? 0;
    return {
      intent: 'list_overdue',
      humanResponse: count > 0
        ? `${count} invoice${count === 1 ? '' : 's'} overdue. Open the Money tab to review.`
        : `No overdue invoices — everything's paid.`,
    };
  }

  // "schedule {name}"
  const scheduleMatch = lower.match(/(?:schedule|book)\s+(\w+)/);
  if (scheduleMatch) {
    const name = scheduleMatch[1];
    return {
      intent: 'schedule_job',
      humanResponse: `OK — I'll set up a job for ${name}. What date and time?`,
      action: { type: 'schedule_job', params: { customerName: name } },
    };
  }

  // "remind {name}"
  const reminderMatch = lower.match(/remind\s+(\w+)/);
  if (reminderMatch) {
    const name = reminderMatch[1];
    return {
      intent: 'send_reminder',
      humanResponse: `Sending a payment reminder to ${name}.`,
      action: { type: 'send_reminder', params: { customerName: name } },
    };
  }

  // "cancel {job for X}" / "cancel job {N}". Eat "for"/"the" filler words
  // so "cancel job for Anna" → "anna", not "for".
  const cancelMatch = lower.match(/cancel\s+(?:job\s+)?(?:for\s+|the\s+)?(\w+)/);
  if (cancelMatch) {
    const target = cancelMatch[1];
    return {
      intent: 'cancel_job',
      humanResponse: `OK — I'll cancel the job for ${target}. Confirm before I send the notification?`,
      action: { type: 'cancel_job', params: { customerName: target } },
    };
  }

  // "status {of X}" / "what's happening with {X}"
  if (/(status|what.*happening|where.*at)/i.test(lower)) {
    const jobs = ctx?.activeJobs ?? [];
    if (jobs.length === 0) {
      return {
        intent: 'query_job_status',
        humanResponse: `No active jobs right now.`,
      };
    }
    const top = jobs.slice(0, 3).map((j) => `• ${j.customer}: ${j.status}`).join('\n');
    return {
      intent: 'query_job_status',
      humanResponse: `${jobs.length} active job${jobs.length === 1 ? '' : 's'}:\n${top}`,
    };
  }

  // "find {name}" / "lookup {name}" / "do I have a customer called {X}"
  // Match on the original (cased) message so we preserve the user's casing
  // in the action param. Some test fixtures rely on this round-trip.
  const findMatch = message.match(/(?:find|lookup|customer.*called)\s+(\w+)/i);
  if (findMatch) {
    const needle = findMatch[1].toLowerCase();
    const matches = (ctx?.customers ?? []).filter((c) => c.name.toLowerCase().includes(needle));
    if (matches.length === 0) {
      return {
        intent: 'find_customer',
        humanResponse: `No customer matching "${findMatch[1]}".`,
      };
    }
    const list = matches.slice(0, 5).map((c) => `• ${c.name}`).join('\n');
    return {
      intent: 'find_customer',
      humanResponse: `Found ${matches.length}:\n${list}`,
      action: { type: 'find_customer', params: { query: findMatch[1], matches: matches.length } },
    };
  }

  // "summary" / "how was my week" / "recap"
  if (/(summary|recap|how.*week|how.*doing)/i.test(lower)) {
    const rev = ctx?.weeklyRevenue ?? 0;
    const jobs = ctx?.weeklyJobsCompleted ?? 0;
    const quotes = ctx?.weeklyQuotesSent ?? 0;
    return {
      intent: 'weekly_summary',
      humanResponse: `This week: $${rev.toLocaleString('en-US')} invoiced, ${jobs} job${jobs === 1 ? '' : 's'} completed, ${quotes} quote${quotes === 1 ? '' : 's'} sent.`,
    };
  }

  // Fallback
  return {
    intent: 'unknown',
    humanResponse: 'I can help with invoices, scheduling, reminders, revenue, job status, customer lookups, and weekly summaries. Try "invoice John for $500", "status update", or "how was my week".',
  };
}
