// =============================================================================
// EVE LIVE ACTION GENERATOR
// =============================================================================
// Builds concrete EveAction entries from the live AppState snapshot so the
// three agents (agent / auditor / analyst) surface real work rather than demo
// fixtures. Called from backgroundJobScheduler's daily block.
//
// Every user-facing string here goes through i18n (`eve.live.*`). Two reasons:
//   1. The queue renders in the contractor's locale — hardcoded English read as
//      "Invoice inv-seed-1 overdue 15d" inside an otherwise-Dutch VascoCard.
//   2. `preparedData.template` strings are CUSTOMER-facing (R286 executor opens
//      the Share sheet with them), so they must be in the customer's language.
//
// Entity references are resolved to human labels (customer name, job title,
// invoice reference) — never raw ids. A raw `cust-003` / `inv-seed-1` leaking
// into a WhatsApp message to a paying customer is the failure this guards.
// =============================================================================

import i18n from '../i18n/i18n';
import type { EveAction } from './eveAgentService';
import { formatMoney2, formatMoney } from '../i18n/formatting';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface Input {
  jobs: any[];
  quotes: any[];
  invoices: any[];
  customers: any[];
  trade?: string;
  country?: string;
}

function mkId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * i18n helper — keeps the English copy as the inline defaultValue.
 *
 * Call sites pass the FULL key (`eve.live.…`) on purpose. An earlier version
 * took a short key and built `eve.live.${key}` here, which made every key
 * invisible to the OTA preflight's static "referenced keys ⊆ en.json" scan —
 * it reported 52 false missing keys and blocked the update. Never compute a
 * translation key from a template literal.
 */
const t = (key: string, defaultValue: string, params?: Record<string, unknown>) =>
  i18n.t(key, { defaultValue, ...(params ?? {}) });

// R300: per-action expiry windows so stale insights don't accumulate.
// Without this, the AI queue retains "Win rate at 25%" items from 6 weeks
// ago. Bounded by the queue's 50-item cap + entityKey dedup, but still
// surfaces dead context.
const EXPIRY_DAYS_BY_TYPE = {
  agent: 14,    // draft_invoice — stays relevant until billed
  auditor: 14,  // overdue invoice — stays relevant until paid
  analyst: 7,   // win-rate insight — refreshes weekly
} as const;

export function buildLiveActions(input: Input): EveAction[] {
  const out: EveAction[] = [];
  const now = new Date();
  const expireFor = (agent: 'agent' | 'auditor' | 'analyst') =>
    new Date(now.getTime() + EXPIRY_DAYS_BY_TYPE[agent] * MS_PER_DAY).toISOString();

  // ── Entity label resolution ──────────────────────────────────────
  // Raw ids must never reach user- or customer-facing copy. Each resolver
  // degrades gracefully: name → id-free generic, never the bare id.
  const customerById = new Map<string, any>(
    (input.customers ?? []).filter((c) => c?.id).map((c) => [c.id, c]),
  );
  const genericCustomer = () => t('eve.live.genericCustomer', 'the customer');
  /** Customer display name from an id, or a neutral noun — never the id. */
  const customerName = (id?: string, fallbackName?: string): string =>
    fallbackName?.trim() || customerById.get(id ?? '')?.name?.trim() || genericCustomer();
  /** Salutation name — blank rather than a placeholder inside "Hi {name}," copy. */
  const salutation = (id?: string, fallbackName?: string): string =>
    fallbackName?.trim() || customerById.get(id ?? '')?.name?.trim() || '';
  /**
   * Phone number for the one-tap WhatsApp send.
   *
   * VascoCard only renders that button when `preparedData.customerPhone` is
   * set, so leaving it undefined silently downgrades a card to the generic
   * Share sheet — the contractor has to pick the customer out of a contact
   * list that the app already knows the answer to.
   *
   * `Job.sitePhone` is preferred where it exists (it is the number for THIS
   * site, e.g. the tenant rather than the landlord who is paying), but NO
   * production path writes it — only fixtures do, which is why the appointment
   * reminder's button rendered in demo and never in the field. The customer
   * record is what actually holds a number, so it is the fallback.
   *
   * Documents carry the customer as an id on some paths and as a bare name on
   * others, so both are tried. Returns undefined rather than '' — an empty
   * string is truthy enough to render a button that dials nothing.
   */
  const customerByName = new Map<string, any>(
    (input.customers ?? [])
      .filter((c) => typeof c?.name === 'string' && c.name.trim())
      .map((c) => [c.name.trim().toLowerCase(), c]),
  );
  const customerPhone = (
    id?: string,
    nameFallback?: string,
    sitePhone?: string,
  ): string | undefined => {
    const record =
      customerById.get(id ?? '') ??
      customerByName.get((nameFallback ?? id ?? '').trim().toLowerCase());
    const num = (sitePhone ?? record?.phone ?? '').trim();
    return num || undefined;
  };
  /** Invoice label: human reference ("F-2026-014") if set, else the customer. */
  const invoiceLabel = (inv: any): string =>
    inv?.reference?.trim() || customerName(inv?.customerId, inv?.customerName ?? inv?.customer);
  /** Quote label: the job title reads far better than a quote id. */
  const quoteLabel = (q: any): string =>
    q?.job?.trim() || customerName(q?.customerId, q?.customer) ;

  // ── Agent: work to draft (draft_invoice / draft_reminder) ────────
  for (const j of (input.jobs ?? []).filter((x) => x.status === 'completed').slice(0, 3)) {
    const amount = j.quotedAmount ?? j.agreedAmount ?? 0;
    out.push({
      id: mkId('eve-inv'),
      agentType: 'agent',
      type: 'draft_invoice',
      title: t('eve.live.draftInvoice.title', 'Draft invoice for {{job}}', { job: j.title }),
      description: t(
        'eve.live.draftInvoice.description',
        '{{job}} is marked completed — lock in cash flow by invoicing now.',
        { job: j.title },
      ),
      impact: t('eve.live.draftInvoice.impact', '{{amount}} revenue', { amount: formatMoney(amount) }),
      priority: amount > 2000 ? 'high' : 'medium',
      status: 'pending',
      preparedData: { jobId: j.id, amount },
      actionLabel: t('eve.live.draftInvoice.action', 'Draft invoice'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: expireFor('agent'),
    });
  }

  // ── Auditor: overdue invoices → compliance_gap + reminder draft ──
  for (const inv of (input.invoices ?? []).filter((i) => i.status === 'overdue').slice(0, 3)) {
    const days = Math.max(
      0,
      Math.round((now.getTime() - new Date((inv as any).dueDate ?? now).getTime()) / MS_PER_DAY),
    );
    const amount = inv.amount ?? 0;
    // Escalation tone by age — each is its own key so translators can pick the
    // register their market expects for a payment chase.
    const tone = days >= 14
      ? t('eve.live.overdue.toneFinal', 'final notice')
      : days >= 7
        ? t('eve.live.overdue.toneFirm', 'firm reminder')
        : t('eve.live.overdue.toneFriendly', 'friendly nudge');
    out.push({
      id: mkId('eve-aud'),
      agentType: 'auditor',
      type: 'compliance_gap',
      title: t('eve.live.overdue.title', 'Invoice {{invoice}} overdue {{days}}d', {
        invoice: invoiceLabel(inv),
        days,
      }),
      description: t('eve.live.overdue.description', '{{amount}} outstanding — {{tone}} recommended.', {
        amount: formatMoney(amount),
        tone,
      }),
      impact: t('eve.live.overdue.impact', '{{amount}} collection risk', { amount: formatMoney(amount) }),
      priority: days >= 14 ? 'critical' : days >= 7 ? 'high' : 'medium',
      status: 'pending',
      preparedData: { invoiceId: inv.id, daysOverdue: days },
      actionLabel: t('eve.live.overdue.action', 'Review'),
      requiresApproval: false,
      createdAt: now.toISOString(),
      expiresAt: expireFor('auditor'),
    });
  }

  // ── Analyst: low win rate → pricing insight ──────────────────────
  const quotesSent = (input.quotes ?? []).filter((q) => q.status === 'sent');
  const quotesAccepted = (input.quotes ?? []).filter((q) => q.status === 'accepted');
  const winRate = quotesSent.length + quotesAccepted.length > 0
    ? quotesAccepted.length / (quotesSent.length + quotesAccepted.length)
    : 0;
  if (winRate > 0 && winRate < 0.35) {
    out.push({
      id: mkId('eve-ana'),
      agentType: 'analyst',
      type: 'pricing_insight',
      title: t('eve.live.winRate.title', 'Win rate at {{pct}}%', { pct: Math.round(winRate * 100) }),
      description: t(
        'eve.live.winRate.description',
        'Below the 45% trade baseline. Review the last 5 lost quotes — pricing, tier mix, or follow-up timing are the usual culprits.',
      ),
      impact: t('eve.live.winRate.impact', 'Could recover 10-15% revenue'),
      priority: 'medium',
      status: 'pending',
      preparedData: { winRate },
      actionLabel: t('eve.live.winRate.action', 'Review lost quotes'),
      requiresApproval: false,
      createdAt: now.toISOString(),
      expiresAt: expireFor('analyst'),
    });
  }


  // ── Agent: 24h appointment reminders + 3-day quote follow-ups (R302) ────
  // Two daily-scheduler-cadence triggers. Other triggers (on_my_way,
  // appointment_reminder_2h) are too time-sensitive or already covered.
  // Each item ships a pre-rendered shareable template via preparedData.template
  // so R286's executor opens the Share sheet directly.

  // Appointment reminders — jobs scheduled in 18-30h window
  const tomorrowStart = now.getTime() + 18 * 60 * 60 * 1000;
  const tomorrowEnd = now.getTime() + 30 * 60 * 60 * 1000;
  for (const j of (input.jobs ?? []).filter((x) =>
    (x.status === 'scheduled' || x.status === 'ingepland' || x.status === 'accepted')
      && x.scheduledDate
      && new Date(x.scheduledDate).getTime() >= tomorrowStart
      && new Date(x.scheduledDate).getTime() <= tomorrowEnd,
  ).slice(0, 5)) {
    out.push({
      id: mkId('eve-appt'),
      agentType: 'agent',
      type: 'progress_update',
      title: t('eve.live.appointment.title', 'Appointment tomorrow: {{job}}', { job: j.title }),
      description: t('eve.live.appointment.description', 'Send {{customer}} a courtesy reminder.', {
        customer: customerName(j.customerId, j.customerName),
      }),
      impact: t('eve.live.appointment.impact', 'Reduces no-shows'),
      priority: 'medium',
      status: 'pending',
      preparedData: {
        jobId: j.id,
        // Pre-render the appointment_reminder template so R286 executor's
        // Share path uses tone-correct text.
        template: t(
          'eve.live.appointment.template',
          'Hi {{customer}}, just a reminder of our appointment tomorrow at {{time}} for {{job}}. Reply if you need to reschedule.',
          {
            customer: salutation(j.customerId, j.customerName),
            time: j.scheduledStartTime ?? '',
            job: j.title,
          },
        ),
        customerPhone: customerPhone(j.customerId, j.customerName, j.sitePhone),
      },
      actionLabel: t('eve.live.appointment.action', 'Send reminder'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Quote follow-ups — sent 3+ days ago, status still 'sent'
  const threeDaysAgo = now.getTime() - 3 * MS_PER_DAY;
  for (const q of (input.quotes ?? []).filter((x) =>
    x.status === 'sent'
      && (x.sentAt || x.lastUpdated)
      && new Date(x.sentAt || x.lastUpdated).getTime() < threeDaysAgo,
  ).slice(0, 3)) {
    out.push({
      id: mkId('eve-fu'),
      agentType: 'agent',
      type: 'draft_followup',
      title: t('eve.live.followUp.title', 'Follow up on quote {{quote}}', { quote: quoteLabel(q) }),
      description: t(
        'eve.live.followUp.description',
        'Quote was sent {{days}}d ago — silent customers convert when nudged.',
        {
          days: Math.round(
            (now.getTime() - new Date(q.sentAt || q.lastUpdated).getTime()) / MS_PER_DAY,
          ),
        },
      ),
      impact: q.amount
        ? t('eve.live.followUp.impact', '{{amount}} potential', { amount: formatMoney(q.amount) })
        : t('eve.live.followUp.impactFallback', 'Conversion uplift'),
      priority: 'medium',
      status: 'pending',
      preparedData: {
        quoteId: q.id,
        customerId: q.customer,
        customerPhone: customerPhone(q.customerId, q.customer),
        template: t(
          'eve.live.followUp.template',
          'Hi {{customer}}, just following up on the quote for {{quote}} ({{amount}}). Any questions?',
          {
            customer: salutation(q.customerId, q.customer),
            quote: quoteLabel(q),
            amount: formatMoney2(q.amount ?? 0),
          },
        ),
      },
      actionLabel: t('eve.live.followUp.action', 'Follow up'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * MS_PER_DAY).toISOString(),
    });
  }

  // ── R304: 6 more auto-fire triggers from MessageTrigger taxonomy ────
  // These complete the R3 dormancy fix. Each ships a pre-rendered template
  // via preparedData so R286 executor's Share path uses correct copy.

  // job_started — jobs flipped to 'in-progress' / 'bezig' in last 4h
  const fourHoursAgo = now.getTime() - 4 * 60 * 60 * 1000;
  for (const j of (input.jobs ?? []).filter((x) =>
    (x.status === 'in-progress' || x.status === 'bezig')
      && x.updatedAt
      && new Date(x.updatedAt).getTime() >= fourHoursAgo,
  ).slice(0, 3)) {
    out.push({
      id: mkId('eve-started'),
      agentType: 'agent',
      type: 'progress_update',
      title: t('eve.live.jobStarted.title', 'Notify customer: {{job}} started', { job: j.title }),
      description: t('eve.live.jobStarted.description', 'Customer-facing "we have arrived" message.'),
      impact: t('eve.live.jobStarted.impact', 'Builds trust'),
      priority: 'medium',
      status: 'pending',
      preparedData: {
        jobId: j.id,
        customerPhone: customerPhone(j.customerId, j.customerName, j.sitePhone),
        template: t(
          'eve.live.jobStarted.template',
          "Hi {{customer}}, we've started work on {{job}}. We'll keep you posted on progress.",
          { customer: salutation(j.customerId, j.customerName), job: j.title },
        ),
      },
      actionLabel: t('eve.live.jobStarted.action', 'Send update'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
    });
  }

  // job_complete — jobs completed in last 24h, customer-facing thanks
  const dayAgo = now.getTime() - MS_PER_DAY;
  for (const j of (input.jobs ?? []).filter((x) =>
    (x.status === 'completed' || x.status === 'gereed')
      && (x as any).completedAt
      && new Date((x as any).completedAt).getTime() >= dayAgo,
  ).slice(0, 3)) {
    out.push({
      id: mkId('eve-complete'),
      agentType: 'agent',
      type: 'job_handover',
      title: t('eve.live.handover.title', 'Handover note: {{job}}', { job: j.title }),
      description: t('eve.live.handover.description', 'Send the customer a wrap-up + invoice heads-up.'),
      impact: t('eve.live.handover.impact', 'Smooth handover'),
      priority: 'medium',
      status: 'pending',
      preparedData: {
        jobId: j.id,
        customerPhone: customerPhone(j.customerId, j.customerName, j.sitePhone),
        template: t(
          'eve.live.handover.template',
          'Hi {{customer}}, {{job}} is complete. Thanks for the trust — invoice on its way.',
          { customer: salutation(j.customerId, j.customerName), job: j.title },
        ),
      },
      actionLabel: t('eve.live.handover.action', 'Send handover'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 3 * MS_PER_DAY).toISOString(),
    });
  }

  // payment_received — invoices flipped to 'paid' in last 24h, send thanks
  for (const inv of (input.invoices ?? []).filter((x) =>
    x.status === 'paid'
      && (x as any).paidAt
      && new Date((x as any).paidAt).getTime() >= dayAgo,
  ).slice(0, 3)) {
    out.push({
      id: mkId('eve-paid'),
      agentType: 'agent',
      type: 'satisfaction_survey',  // closest queue type — shareable thanks
      title: t('eve.live.paymentThanks.title', 'Thank {{customer}} for payment', {
        customer: customerName(inv.customerId, inv.customerName ?? inv.customer),
      }),
      description: t('eve.live.paymentThanks.description', 'Invoice {{invoice}} paid — quick thanks goes a long way.', {
        invoice: invoiceLabel(inv),
      }),
      impact: t('eve.live.paymentThanks.impact', 'Builds repeat business'),
      priority: 'low',
      status: 'pending',
      preparedData: {
        invoiceId: inv.id,
        customerPhone: customerPhone(inv.customerId, inv.customerName ?? inv.customer),
        template: t(
          'eve.live.paymentThanks.template',
          'Thanks {{customer}} — payment received for invoice {{invoice}}. Receipt on its way.',
          {
            customer: salutation(inv.customerId, inv.customerName ?? inv.customer),
            invoice: invoiceLabel(inv),
          },
        ),
      },
      actionLabel: t('eve.live.paymentThanks.action', 'Send thanks'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * MS_PER_DAY).toISOString(),
    });
  }

  // quote_sent — quotes flipped to 'sent' in last 4h that don't have a
  // confirmation sent yet (lightweight — no idempotency tracking, dedup
  // happens at queue level via entityKey).
  for (const q of (input.quotes ?? []).filter((x) =>
    x.status === 'sent'
      && x.sentAt
      && new Date(x.sentAt).getTime() >= fourHoursAgo,
  ).slice(0, 3)) {
    out.push({
      id: mkId('eve-quote-sent'),
      agentType: 'agent',
      type: 'progress_update',
      title: t('eve.live.quoteSent.title', 'Confirm quote {{quote}} arrived', { quote: quoteLabel(q) }),
      description: t(
        'eve.live.quoteSent.description',
        'Quick "I just sent the quote — let me know if you need anything" — improves response rates.',
      ),
      impact: t('eve.live.quoteSent.impact', 'Reduces silent quotes'),
      priority: 'low',
      status: 'pending',
      preparedData: {
        quoteId: q.id,
        customerPhone: customerPhone(q.customerId, q.customer),
        template: t(
          'eve.live.quoteSent.template',
          'Hi {{customer}}, I just sent the quote for {{quote}}. Check your email — let me know if you have any questions.',
          { customer: salutation(q.customerId, q.customer), quote: quoteLabel(q) },
        ),
      },
      actionLabel: t('eve.live.quoteSent.action', 'Send confirmation'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // invoice_sent — invoices flipped to 'sent' in last 4h
  for (const inv of (input.invoices ?? []).filter((x) =>
    x.status === 'sent'
      && (x as any).sentAt
      && new Date((x as any).sentAt).getTime() >= fourHoursAgo,
  ).slice(0, 3)) {
    out.push({
      id: mkId('eve-inv-sent'),
      agentType: 'agent',
      type: 'progress_update',
      title: t('eve.live.invoiceSent.title', 'Confirm invoice {{invoice}} arrived', {
        invoice: invoiceLabel(inv),
      }),
      description: t('eve.live.invoiceSent.description', 'Customer-facing "your invoice is ready" with payment link.'),
      impact: t('eve.live.invoiceSent.impact', 'Faster payment'),
      priority: 'medium',
      status: 'pending',
      preparedData: {
        invoiceId: inv.id,
        customerPhone: customerPhone(inv.customerId, inv.customerName ?? inv.customer),
        template: t(
          'eve.live.invoiceSent.template',
          'Hi {{customer}}, invoice {{invoice}} is ready. Pay online or contact me if questions.',
          {
            customer: salutation(inv.customerId, inv.customerName ?? inv.customer),
            invoice: invoiceLabel(inv),
          },
        ),
      },
      actionLabel: t('eve.live.invoiceSent.action', 'Send confirmation'),
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return out;
}
