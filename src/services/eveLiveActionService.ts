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

  return out;
}
