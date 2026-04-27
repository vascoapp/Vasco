// =============================================================================
// CUSTOMER SMART REPLIES (R270)
// =============================================================================
// Google-Inbox-style 1-tap reply suggestions. When the contractor opens a
// customer's detail screen, surface 3 context-aware reply snippets they can
// fire off in 1 tap (opens WhatsApp/SMS/email with the body pre-filled).
//
// Inputs: customer record + their open/recent quotes, invoices, jobs.
// Outputs: ranked array of suggestions with channel, body, and reason.
//
// Each snippet maps to ONE deterministic context — no LLM required.
// Localized via i18next; falls back to English when key is missing.
// =============================================================================

import i18n from '../i18n/i18n';
import { getChipMultiplier } from './smartReplyLearningService';

export type SmartReplyChannel = 'whatsapp' | 'sms' | 'email';

export interface SmartReply {
  id: string;
  body: string;
  reason: string;          // why it was suggested ("Quote sent 5d ago, no reply")
  channel: SmartReplyChannel;
  priority: number;        // higher = surface first
}

export interface CustomerContext {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  // Most recent quote for this customer
  latestQuote?: {
    id: string;
    status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
    sentAt?: string;       // ISO
    amount?: number;
  };
  // Most recent invoice
  latestInvoice?: {
    id: string;
    status: 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue';
    sentAt?: string;
    dueInDays?: number;    // negative = overdue
    amount?: number;
  };
  // Most recent job
  latestJob?: {
    id: string;
    title?: string;
    status: 'lead' | 'scheduled' | 'in-progress' | 'completed' | string;
    completedAt?: string;
  };
  // Whether the customer has any prior interaction at all
  isNewCustomer: boolean;
  // Optional inbound message hint — when contractor is replying to something
  lastInboundMessage?: string;
}

const HOURS_24 = 24 * 60 * 60 * 1000;
const DAYS_3 = 3 * HOURS_24;
const DAYS_7 = 7 * HOURS_24;

function hoursSince(iso?: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms < 0 ? null : ms / (60 * 60 * 1000);
}

function pickChannel(ctx: CustomerContext): SmartReplyChannel {
  if (ctx.customerPhone) return 'whatsapp';
  if (ctx.customerEmail) return 'email';
  return 'sms';
}

/**
 * Generate up to 3 ranked smart replies. Returns empty array when no signal
 * applies (e.g. customer with no history and no inbound message).
 */
export function generateSmartReplies(ctx: CustomerContext, max = 3): SmartReply[] {
  const t = (k: string, fallback: string, vars?: Record<string, any>) =>
    i18n.t(k, { defaultValue: fallback, ...vars });
  const channel = pickChannel(ctx);
  const out: SmartReply[] = [];

  // Helper to push deterministic id-stable suggestions
  const push = (id: string, body: string, reason: string, priority: number) => {
    out.push({ id, body, reason, channel, priority });
  };

  // 1. Inbound-message reply suggestions — highest priority when present
  if (ctx.lastInboundMessage) {
    const msg = ctx.lastInboundMessage.toLowerCase();
    if (/\b(when|wanneer|wann|quand|cuándo|quando)\b/.test(msg)) {
      push('inbound-when', t('smartReply.inbound.when', 'Let me check the schedule and confirm by end of day.'), t('smartReply.reason.inboundWhen', 'They asked about timing'), 100);
    }
    if (/\b(price|prijs|preis|prix|precio|prezzo|cost|kosten)\b/.test(msg)) {
      push('inbound-price', t('smartReply.inbound.price', 'I will send a written quote within 24h.'), t('smartReply.reason.inboundPrice', 'They asked about price'), 95);
    }
    if (/\b(yes|ja|oui|sí|si)\b/.test(msg) && msg.length < 40) {
      push('inbound-yes', t('smartReply.inbound.confirm', "Great, I'll proceed and confirm the next step."), t('smartReply.reason.inboundYes', 'They confirmed'), 90);
    }
  }

  // 2. Open quote awaiting decision
  if (ctx.latestQuote && (ctx.latestQuote.status === 'sent' || ctx.latestQuote.status === 'viewed')) {
    const ageHours = hoursSince(ctx.latestQuote.sentAt);
    if (ageHours !== null && ageHours > 48) {
      push(
        'quote-followup',
        t('smartReply.quote.followup', 'Hi {{name}}, just checking in on the quote — any questions?', { name: ctx.customerName }),
        t('smartReply.reason.quoteAged', 'Quote sent {{days}}d ago, no decision', { days: Math.round(ageHours / 24) }),
        80,
      );
    } else if (ageHours !== null && ageHours <= 48) {
      push(
        'quote-thanks',
        t('smartReply.quote.thanks', 'Thanks for reviewing the quote, let me know if anything is unclear.'),
        t('smartReply.reason.quoteFresh', 'Quote sent recently'),
        60,
      );
    }
  }

  // 3. Overdue invoice
  if (ctx.latestInvoice && ctx.latestInvoice.status === 'overdue') {
    const days = Math.abs(ctx.latestInvoice.dueInDays ?? 0);
    push(
      'invoice-overdue',
      t('smartReply.invoice.overdue', 'Friendly reminder — invoice {{ref}} is {{days}} days overdue.', { ref: ctx.latestInvoice.id, days }),
      t('smartReply.reason.invoiceOverdue', 'Invoice {{days}}d overdue', { days }),
      85,
    );
  }

  // 4. Recently completed job — ask for review/feedback
  if (ctx.latestJob?.status === 'completed' && hoursSince(ctx.latestJob.completedAt) !== null) {
    const ageHours = hoursSince(ctx.latestJob.completedAt) ?? 0;
    if (ageHours < DAYS_7 / (60 * 60 * 1000)) {
      push(
        'job-feedback',
        t('smartReply.job.feedback', 'Hope everything looks good after our visit — any feedback?'),
        t('smartReply.reason.jobCompleted', 'Job completed recently'),
        50,
      );
    }
  }

  // 5. Scheduled job — pre-arrival heads-up
  if (ctx.latestJob?.status === 'scheduled') {
    push(
      'job-onway',
      t('smartReply.job.onway', "Heads-up — I'll be on my way for {{title}} shortly.", { title: ctx.latestJob.title || 'the appointment' }),
      t('smartReply.reason.jobScheduled', 'Job is scheduled'),
      55,
    );
  }

  // 6. Brand-new customer — generic opening
  if (ctx.isNewCustomer && out.length === 0) {
    push(
      'new-greet',
      t('smartReply.new.greet', 'Hi {{name}}, thanks for reaching out — when works for a quick site visit?', { name: ctx.customerName }),
      t('smartReply.reason.newCustomer', 'No prior interaction'),
      40,
    );
    push(
      'new-ack',
      t('smartReply.new.ack', "Got it, I'll review and come back to you with a plan today."),
      t('smartReply.reason.newCustomer', 'No prior interaction'),
      35,
    );
  }

  // R271: apply learning multiplier — chips the user consistently ignores
  // get dampened, ones they tap get boosted. Neutral until ≥3 impressions.
  const learned = out.map((r) => ({ ...r, priority: r.priority * getChipMultiplier(r.id) }));
  return learned
    .sort((a, b) => b.priority - a.priority)
    .slice(0, max);
}
