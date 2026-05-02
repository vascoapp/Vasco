// =============================================================================
// EVE LIVE ACTION GENERATOR
// =============================================================================
// Builds concrete EveAction entries from the live AppState snapshot so the
// three agents (agent / auditor / analyst) surface real work rather than demo
// fixtures. Called from backgroundJobScheduler's daily block.
// =============================================================================

import type { EveAction } from './eveAgentService';

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

  // ── Agent: work to draft (draft_invoice / draft_reminder) ────────
  for (const j of (input.jobs ?? []).filter((x) => x.status === 'completed').slice(0, 3)) {
    const amount = j.quotedAmount ?? j.agreedAmount ?? 0;
    out.push({
      id: mkId('eve-inv'),
      agentType: 'agent',
      type: 'draft_invoice',
      title: `Draft invoice for ${j.title}`,
      description: `${j.title} is marked completed — lock in cash flow by invoicing now.`,
      impact: `€${Math.round(amount)} revenue`,
      priority: amount > 2000 ? 'high' : 'medium',
      status: 'pending',
      preparedData: { jobId: j.id, amount },
      actionLabel: 'Draft invoice',
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
    out.push({
      id: mkId('eve-aud'),
      agentType: 'auditor',
      type: 'compliance_gap',
      title: `Invoice ${inv.id} overdue ${days}d`,
      description: `€${amount.toFixed(0)} outstanding — ${days >= 14 ? 'final notice' : days >= 7 ? 'firm reminder' : 'friendly nudge'} recommended.`,
      impact: `€${amount.toFixed(0)} collection risk`,
      priority: days >= 14 ? 'critical' : days >= 7 ? 'high' : 'medium',
      status: 'pending',
      preparedData: { invoiceId: inv.id, daysOverdue: days },
      actionLabel: 'Review',
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
      title: `Win rate at ${Math.round(winRate * 100)}%`,
      description: `Below the 45% trade baseline. Review the last 5 lost quotes — pricing, tier mix, or follow-up timing are the usual culprits.`,
      impact: 'Could recover 10-15% revenue',
      priority: 'medium',
      status: 'pending',
      preparedData: { winRate },
      actionLabel: 'Review lost quotes',
      requiresApproval: false,
      createdAt: now.toISOString(),
      expiresAt: expireFor('analyst'),
    });
  }

  // ── Agent: 24h appointment reminders + 3-day quote follow-ups (R302) ────
  // These are the two MessageTrigger events from customerCommunicationService
  // that fit the daily-scheduler cadence. Other triggers (on_my_way,
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
      title: `Appointment tomorrow: ${j.title}`,
      description: `Send ${j.customerId ?? 'the customer'} a courtesy reminder.`,
      impact: 'Reduces no-shows',
      priority: 'medium',
      status: 'pending',
      preparedData: {
        jobId: j.id,
        // Pre-render the appointment_reminder template so R286 executor's
        // Share path uses tone-correct text.
        template: `Hi ${j.customerId ?? ''}, just a reminder of our appointment tomorrow at ${j.scheduledStartTime ?? ''} for ${j.title}. Reply if you need to reschedule.`,
        customerPhone: j.sitePhone,
      },
      actionLabel: 'Send reminder',
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
      title: `Follow up on quote ${q.id}`,
      description: `Quote was sent ${Math.round((now.getTime() - new Date(q.sentAt || q.lastUpdated).getTime()) / MS_PER_DAY)}d ago — silent customers convert when nudged.`,
      impact: q.amount ? `€${Math.round(q.amount)} potential` : 'Conversion uplift',
      priority: 'medium',
      status: 'pending',
      preparedData: {
        quoteId: q.id,
        customerId: q.customer,
        template: `Hi ${q.customer ?? ''}, just following up on quote ${q.id} (€${q.amount ?? 0}). Any questions?`,
      },
      actionLabel: 'Follow up',
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
      title: `Notify customer: ${j.title} started`,
      description: 'Customer-facing "we have arrived" message.',
      impact: 'Builds trust',
      priority: 'medium',
      status: 'pending',
      preparedData: {
        jobId: j.id,
        template: `Hi ${j.customerId ?? ''}, we've started work on ${j.title}. We'll keep you posted on progress.`,
      },
      actionLabel: 'Send update',
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
      title: `Handover note: ${j.title}`,
      description: 'Send the customer a wrap-up + invoice heads-up.',
      impact: 'Smooth handover',
      priority: 'medium',
      status: 'pending',
      preparedData: {
        jobId: j.id,
        template: `Hi ${j.customerId ?? ''}, ${j.title} is complete. Thanks for the trust — invoice on its way.`,
      },
      actionLabel: 'Send handover',
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
      title: `Thank ${inv.customer ?? 'customer'} for payment`,
      description: `Invoice ${inv.id} paid — quick thanks goes a long way.`,
      impact: 'Builds repeat business',
      priority: 'low',
      status: 'pending',
      preparedData: {
        invoiceId: inv.id,
        template: `Thanks ${inv.customer ?? ''} — payment received for invoice ${inv.id}. Receipt on its way.`,
      },
      actionLabel: 'Send thanks',
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
      title: `Confirm quote ${q.id} arrived`,
      description: 'Quick "I just sent quote X — let me know if you need anything" — improves response rates.',
      impact: 'Reduces silent quotes',
      priority: 'low',
      status: 'pending',
      preparedData: {
        quoteId: q.id,
        template: `Hi ${q.customer ?? ''}, I just sent quote ${q.id}. Check your email — let me know if you have any questions.`,
      },
      actionLabel: 'Send confirmation',
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
      title: `Confirm invoice ${inv.id} arrived`,
      description: 'Customer-facing "your invoice is ready" with payment link.',
      impact: 'Faster payment',
      priority: 'medium',
      status: 'pending',
      preparedData: {
        invoiceId: inv.id,
        template: `Hi ${inv.customer ?? ''}, invoice ${inv.id} is ready. Pay online or contact me if questions.`,
      },
      actionLabel: 'Send confirmation',
      requiresApproval: true,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return out;
}
