// =============================================================================
// AI INTENT ROUTER — R193
// =============================================================================
// 3-tier classification for ai-command. Aim: drive 80%+ of traffic to Tier 1
// (free, no network call) and fall through only on ambiguity.
//
//   Tier 1: deterministic — regex + keyword match on common patterns.
//           Same JSON shape as Tier 2/3, returned in < 1ms.
//   Tier 2: OpenRouter free models (Gemma 2 9B, Llama 3.1 8B) via the
//           OpenAI-compatible API. Cost: $0 on free tier.
//   Tier 3: Claude Haiku via Anthropic, with prompt caching enabled
//           (system prompt cached at 90% discount on hits).
//
// All tiers return:
//   { intent, humanResponse, action?, ai_tier }
//
// The router exports `classifyDeterministic()` only — Tier 2/3 stay in
// the edge fn since they hit external APIs and we want all network
// calls in one place for observability.
// =============================================================================

export type Intent =
  | 'create_invoice'
  | 'schedule_job'
  | 'query_revenue'
  | 'list_overdue'
  | 'send_reminder'
  | 'cancel_job'
  | 'query_job_status'
  | 'find_customer'
  | 'weekly_summary'
  | 'unknown';

export interface IntentResult {
  intent: Intent;
  humanResponse: string;
  action?: { type: string; params: Record<string, unknown> };
  ai_tier: 'deterministic' | 'openrouter' | 'claude' | 'fallback';
}

export interface ClassifyContext {
  customers?: Array<{ id: string; name: string }>;
  recentInvoiceTotal?: number;
  overdueCount?: number;
  activeJobs?: Array<{ id: string; customer: string; status: string }>;
  weeklyRevenue?: number;
  weeklyJobsCompleted?: number;
  weeklyQuotesSent?: number;
  locale?: string;
}

// -----------------------------------------------------------------------------
// Vocabulary — language-tolerant. Catches EN + the most common NL synonyms
// since those are the two big contractor locales. Everything that doesn't
// match falls through to LLM tiers, which handle every language natively.
// -----------------------------------------------------------------------------

// Words that strongly suggest "create invoice" in EN/NL.
// R193t: \w* suffix allows Dutch inflections (factureren, gefactureerd).
const INVOICE_KEYWORDS = /\b(invoice|bill|factuur\w*|factureren|reken\w*)/i;
// "show overdue", "who hasn't paid", "list outstanding"
// R193t: removed trailing \b on Dutch words so adjective forms match
// (achterstallige, openstaande). \w* suffix tolerates inflection.
const OVERDUE_KEYWORDS = /\b(overdue|outstanding|unpaid|hasn'?t paid|achterstallig\w*|openstaand\w*|niet betaald)/i;
// "remind X", "send reminder"
const REMIND_KEYWORDS = /\b(remind|reminder|nudge|herinner\w*|herinnering\w*)\b/i;
// "what did I make {period}", "revenue {period}", "earnings"
// R193t: added `make` (present tense) — was only matching `made`.
const REVENUE_KEYWORDS = /\b(revenue|earnings|make|made|earn|earned|income|omzet|verdiend|gemaakt)\b/i;
// "weekly summary", "how was my week", "recap"
// R193t: added "my week" + "how was" to catch the common informal phrasing.
const WEEKLY_KEYWORDS = /\b(weekly|this week|my week|how was|week summary|recap|deze week|samenvatting)\b/i;
// "find X", "lookup X", "do I have a customer named X"
const FIND_KEYWORDS = /\b(find|lookup|search|zoek|opzoek|opzoeken|do I have)\b/i;
// "schedule X", "book X"
const SCHEDULE_KEYWORDS = /\b(schedule|book|plan|inplannen|agenderen)\b/i;
// "cancel job for X", "cancel X"
// R193t: Dutch imperative form (annuleer) wasn't matched. \w* tolerates
// all conjugations (annuleer, annuleert, annuleren, annuleerde).
const CANCEL_KEYWORDS = /\b(cancel|annul\w*)\b/i;
// "status of X", "where are we on X", "what's happening with X"
const STATUS_KEYWORDS = /\b(status of|where are we|how is|hoe staat|how's)\b/i;

// Currency/amount extraction — supports $, €, £, plain numbers with optional
// decimals + thousands separators.
// R193t: original alternation preferred `\d{1,3}(?:[.,]\d{3})*` first, which
// greedily matched the first 3 digits of `1200` → captured `120` instead of
// `1200`. Reordered so the thousand-separator pattern only wins when there
// IS a separator (\d{3} group required), otherwise the plain-number pattern
// captures the full integer.
const AMOUNT_RE = /(?:[$€£]\s*)?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*(?:dollars?|usd|euros?|eur|pounds?|gbp))?/i;
// Date hints (very loose — Claude/LLM still needed for precise parsing).
const HAS_DATE_HINT = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})\b/i;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function findCustomerInContext(
  message: string,
  customers: Array<{ id: string; name: string }>,
): { id: string; name: string } | null {
  if (!customers?.length) return null;
  const lower = message.toLowerCase();
  // Longest-name-first so "John Smith" beats "John" when both exist.
  const sorted = [...customers].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    if (lower.includes(c.name.toLowerCase())) return c;
  }
  return null;
}

function extractAmount(message: string): number | null {
  const m = AMOUNT_RE.exec(message);
  if (!m) return null;
  const raw = m[1].replace(/\./g, '').replace(/,/g, '.');
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtCurrency(amount: number, locale: string | undefined): string {
  const isUS = (locale ?? '').toLowerCase().startsWith('en-us');
  const symbol = isUS ? '$' : '€';
  return `${symbol}${amount.toLocaleString(isUS ? 'en-US' : 'nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// -----------------------------------------------------------------------------
// Tier 1: deterministic classification
// -----------------------------------------------------------------------------

export function classifyDeterministic(
  message: string,
  ctx: ClassifyContext,
): IntentResult | null {
  const msg = message.trim();
  if (!msg) return null;
  const customers = ctx.customers ?? [];
  const locale = ctx.locale ?? 'en';
  const tier = 'deterministic' as const;

  // --- list_overdue: pure read, fully synthesizable from context ---
  if (OVERDUE_KEYWORDS.test(msg)) {
    const n = ctx.overdueCount ?? 0;
    const humanResponse =
      n === 0
        ? "You're all caught up — no overdue invoices."
        : n === 1
          ? 'You have 1 overdue invoice.'
          : `You have ${n} overdue invoices.`;
    return { intent: 'list_overdue', humanResponse, ai_tier: tier };
  }

  // --- query_revenue: data answer from context ---
  if (REVENUE_KEYWORDS.test(msg) && !INVOICE_KEYWORDS.test(msg)) {
    const total = ctx.recentInvoiceTotal ?? 0;
    return {
      intent: 'query_revenue',
      humanResponse: `Your recent invoice total is ${fmtCurrency(total, locale)}.`,
      ai_tier: tier,
    };
  }

  // --- weekly_summary: data answer from context ---
  if (WEEKLY_KEYWORDS.test(msg) && !INVOICE_KEYWORDS.test(msg)) {
    const rev = ctx.weeklyRevenue ?? 0;
    const jobs = ctx.weeklyJobsCompleted ?? 0;
    const quotes = ctx.weeklyQuotesSent ?? 0;
    return {
      intent: 'weekly_summary',
      humanResponse: `This week: ${fmtCurrency(rev, locale)} revenue, ${jobs} job${jobs === 1 ? '' : 's'} completed, ${quotes} quote${quotes === 1 ? '' : 's'} sent.`,
      ai_tier: tier,
    };
  }

  // --- find_customer: substring match against customers list ---
  if (FIND_KEYWORDS.test(msg)) {
    // Strip the verb so the remaining text is more likely just the name.
    const stripped = msg.replace(FIND_KEYWORDS, '').trim();
    const matched = findCustomerInContext(stripped, customers);
    if (matched) {
      return {
        intent: 'find_customer',
        humanResponse: `Found ${matched.name}.`,
        action: { type: 'find_customer', params: { customerId: matched.id, name: matched.name } },
        ai_tier: tier,
      };
    }
    // Search was specific but no match — let LLM tier handle fuzzy matching.
    return null;
  }

  // --- send_reminder: needs a customer match ---
  if (REMIND_KEYWORDS.test(msg)) {
    const matched = findCustomerInContext(msg, customers);
    if (matched) {
      return {
        intent: 'send_reminder',
        humanResponse: `I'll send a reminder to ${matched.name}.`,
        action: { type: 'send_reminder', params: { customerName: matched.name, customerId: matched.id } },
        ai_tier: tier,
      };
    }
    return null; // ambiguous — escalate
  }

  // --- create_invoice: needs customer + amount ---
  if (INVOICE_KEYWORDS.test(msg)) {
    const matched = findCustomerInContext(msg, customers);
    const amount = extractAmount(msg);
    if (matched && amount) {
      const isUS = (locale ?? '').toLowerCase().startsWith('en-us');
      const currency = isUS ? 'USD' : 'EUR';
      return {
        intent: 'create_invoice',
        humanResponse: `Creating an invoice for ${matched.name} — ${fmtCurrency(amount, locale)}.`,
        action: {
          type: 'create_invoice',
          params: { customerName: matched.name, customerId: matched.id, amount, currency },
        },
        ai_tier: tier,
      };
    }
    return null; // missing slot — escalate
  }

  // --- cancel_job: needs customer match (no date parsing required) ---
  if (CANCEL_KEYWORDS.test(msg)) {
    const matched = findCustomerInContext(msg, customers);
    if (matched) {
      return {
        intent: 'cancel_job',
        humanResponse: `Cancelling the job for ${matched.name}.`,
        action: { type: 'cancel_job', params: { customerName: matched.name, customerId: matched.id } },
        ai_tier: tier,
      };
    }
    return null;
  }

  // --- query_job_status: customer + (no action) ---
  if (STATUS_KEYWORDS.test(msg)) {
    const jobs = ctx.activeJobs ?? [];
    if (!jobs.length) {
      return { intent: 'query_job_status', humanResponse: 'No active jobs right now.', ai_tier: tier };
    }
    const matched = findCustomerInContext(msg, customers);
    if (matched) {
      const job = jobs.find((j) => j.customer.toLowerCase().includes(matched.name.toLowerCase()));
      if (job) {
        return {
          intent: 'query_job_status',
          humanResponse: `${matched.name}: ${job.status}.`,
          ai_tier: tier,
        };
      }
    }
    // Generic listing
    const summary = jobs.slice(0, 5).map((j) => `${j.customer}: ${j.status}`).join('; ');
    return {
      intent: 'query_job_status',
      humanResponse: `Active jobs — ${summary}.`,
      ai_tier: tier,
    };
  }

  // --- schedule_job: needs both customer AND date hint to be safe; otherwise escalate ---
  if (SCHEDULE_KEYWORDS.test(msg)) {
    // Date parsing is the hard part — leave it to the LLM. Deterministic
    // only commits when the cost of a wrong slot is low; misbooking a job
    // by parsing "next Tuesday" wrong is high-cost. Always escalate.
    return null;
  }

  // Nothing matched — escalate.
  return null;
}
