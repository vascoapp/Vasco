// =============================================================================
// EVE AGENT SERVICE — 3-Agent AI Workforce (inspired by Eve Legal 2.0)
// =============================================================================
// EVE operates as 3 distinct AI agents, each with clear responsibilities:
//
// 1. EVE AGENT — The worker. Handles quotes, invoices, follow-ups, scheduling.
//    Executes case-level tasks proactively. "The associate that never sleeps."
//
// 2. EVE AUDITOR — The safety net. Monitors compliance, certifications,
//    deadlines, insurance. Flags risks before they become problems.
//
// 3. EVE ANALYST — The strategist. Benchmarks, pricing intelligence, cashflow
//    predictions, performance patterns across the entire business.
//
// Pattern: Each agent works continuously → queues results → human approves.
// Gating: Gratis gets 5 insights/month total. Contractor gets full access.
// =============================================================================

import type { SubscriptionState } from './subscriptionService';
import { canUseAiInsight, recordAiInsightUsage, getTierLimits } from './subscriptionService';

// ─── Agent Types ───────────────────────────────────────────────────────────

export type EveAgentType = 'agent' | 'auditor' | 'analyst';

export interface EveAction {
  id: string;
  agentType: EveAgentType;
  type: EveActionType;
  title: string;
  description: string;
  impact: string;                  // "Save 20 min" / "EUR 450 revenue" / "Avoid EUR 500 fine"
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
  preparedData: Record<string, unknown>;
  actionLabel: string;             // "Send Invoice" / "Renew Now" / "View Report"
  createdAt: string;
  expiresAt?: string;
  requiresApproval: boolean;       // EVE Legal AI pattern — never auto-execute customer-facing
}

// ─── Agent Action Types ────────────────────────────────────────────────────

export type EveActionType =
  // Agent actions (execution)
  | 'draft_invoice'
  | 'draft_quote'
  | 'draft_reminder'
  | 'draft_followup'
  | 'schedule_suggestion'
  | 'progress_update'
  | 'batch_invoices'
  | 'maintenance_reminder'
  | 'material_reorder'
  | 'job_handover'
  | 'satisfaction_survey'
  // Auditor actions (monitoring)
  | 'cert_expiring'
  | 'insurance_expiring'
  | 'permit_required'
  | 'permit_renewal'
  | 'tax_deadline'
  | 'vat_filing_due'
  | 'safety_checklist'
  | 'compliance_gap'
  | 'einvoice_required'
  | 'subcontractor_check'
  | 'equipment_inspection'
  // Analyst actions (intelligence)
  | 'pricing_insight'
  | 'cashflow_forecast'
  | 'benchmark_alert'
  | 'quote_win_prediction'
  | 'payment_prediction'
  | 'revenue_trend'
  | 'cost_optimization'
  | 'supplier_comparison'
  | 'seasonal_demand'
  | 'client_risk_score'
  // Purchasing agent actions (Pro+)
  | 'purchasing_deal'         // Best deal found for job materials
  | 'price_drop_alert'        // Material price dropped at supplier
  | 'bulk_opportunity'        // Cross-job bulk purchase savings
  | 'seasonal_stock_up'       // Pre-season stock recommendation
  | 'supplier_report';        // Monthly supplier reliability report

// ─── Agent Configurations ──────────────────────────────────────────────────

export interface EveAgentConfig {
  type: EveAgentType;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  actionTypes: EveActionType[];
  runIntervalHours: number;
  maxPendingActions: number;
}

export const EVE_AGENTS: Record<EveAgentType, EveAgentConfig> = {
  agent: {
    type: 'agent',
    name: 'EVE Agent',
    tagline: 'Your tireless business assistant',
    description: 'Handles day-to-day execution: drafts invoices from completed jobs, sends payment reminders, follows up on stale quotes, suggests schedule optimizations, and prepares end-of-day updates. Works 24/7 so you can focus on the tools.',
    icon: 'flash',
    color: '#E35205',
    actionTypes: [
      'draft_invoice', 'draft_quote', 'draft_reminder', 'draft_followup',
      'schedule_suggestion', 'progress_update', 'batch_invoices',
      'maintenance_reminder', 'material_reorder', 'job_handover', 'satisfaction_survey',
    ],
    runIntervalHours: 4,
    maxPendingActions: 20,
  },
  auditor: {
    type: 'auditor',
    name: 'EVE Auditor',
    tagline: 'Your compliance safety net',
    description: 'Continuously monitors every certification, insurance policy, permit, and tax deadline across your business. Flags risks 30/60/90 days before they become problems. Ensures you never start a job without proper documentation.',
    icon: 'shield-checkmark',
    color: '#1E3A8A',
    actionTypes: [
      'cert_expiring', 'insurance_expiring', 'permit_required', 'permit_renewal',
      'tax_deadline', 'vat_filing_due', 'safety_checklist', 'compliance_gap',
      'einvoice_required', 'subcontractor_check', 'equipment_inspection',
    ],
    runIntervalHours: 12,
    maxPendingActions: 15,
  },
  analyst: {
    type: 'analyst',
    name: 'EVE Analyst',
    tagline: 'Your business intelligence advisor',
    description: 'Connects patterns across your entire business to surface insights: benchmark your rates against 14,000+ EU contractors, predict which quotes will win, forecast cashflow 90 days out, and identify which job types deliver the best margins.',
    icon: 'analytics',
    color: '#10B981',
    actionTypes: [
      'pricing_insight', 'cashflow_forecast', 'benchmark_alert',
      'quote_win_prediction', 'payment_prediction', 'revenue_trend',
      'cost_optimization', 'supplier_comparison', 'seasonal_demand', 'client_risk_score',
      'purchasing_deal', 'price_drop_alert', 'bulk_opportunity', 'seasonal_stock_up', 'supplier_report',
    ],
    runIntervalHours: 24,
    maxPendingActions: 10,
  },
};

// ─── Agent Status ──────────────────────────────────────────────────────────

export interface EveAgentStatus {
  type: EveAgentType;
  isActive: boolean;
  lastRunAt: string | null;
  pendingActions: number;
  actionsThisMonth: number;
  topAction: EveAction | null;
}

export interface EveWorkforceStatus {
  agents: EveAgentStatus[];
  totalPendingActions: number;
  totalActionsThisMonth: number;
  insightsRemaining: number;
  insightsLimit: number;
  isFullAccess: boolean;
}

// ─── Workforce Overview ────────────────────────────────────────────────────

export function getWorkforceStatus(
  subscription: SubscriptionState,
  pendingActions: EveAction[],
): EveWorkforceStatus {
  const limits = getTierLimits(subscription.tier);
  const insightsLimit = limits.maxAiInsightsPerMonth;
  const insightsUsed = subscription.aiInsightsUsedThisMonth;

  const agentStatuses: EveAgentStatus[] = (['agent', 'auditor', 'analyst'] as EveAgentType[]).map((type) => {
    const config = EVE_AGENTS[type];
    const agentActions = pendingActions.filter((a) => a.agentType === type);
    const isActive = subscription.tier !== 'free' || insightsUsed < insightsLimit;

    return {
      type,
      isActive,
      lastRunAt: new Date().toISOString(),
      pendingActions: agentActions.filter((a) => a.status === 'pending').length,
      actionsThisMonth: agentActions.length,
      topAction: agentActions.find((a) => a.status === 'pending' && a.priority === 'critical')
        || agentActions.find((a) => a.status === 'pending' && a.priority === 'high')
        || agentActions.find((a) => a.status === 'pending')
        || null,
    };
  });

  return {
    agents: agentStatuses,
    totalPendingActions: pendingActions.filter((a) => a.status === 'pending').length,
    totalActionsThisMonth: pendingActions.length,
    insightsRemaining: Math.max(0, insightsLimit - insightsUsed),
    insightsLimit: insightsLimit === Infinity ? -1 : insightsLimit,
    isFullAccess: subscription.tier === 'contractor',
  };
}

// ─── Demo Actions (for onboarding AI moment + dashboard) ───────────────────

export function generateDemoActions(trade: string, country: string): EveAction[] {
  const now = new Date();
  const actions: EveAction[] = [
    // Agent actions
    {
      id: 'demo-agent-1', agentType: 'agent', type: 'draft_invoice',
      title: 'Invoice ready for Fam. de Vries', description: 'Boiler maintenance completed yesterday. Invoice prepared: EUR 285 incl. BTW.',
      impact: 'EUR 285 revenue', priority: 'high', status: 'pending',
      preparedData: { amount: 285, customer: 'Fam. de Vries', jobTitle: 'Boiler maintenance' },
      actionLabel: 'Review & Send', createdAt: now.toISOString(), requiresApproval: true,
    },
    {
      id: 'demo-agent-2', agentType: 'agent', type: 'draft_reminder',
      title: 'Payment reminder: Van Houten BV', description: 'Invoice #2024-089 is 14 days overdue (EUR 1,240). Reminder drafted.',
      impact: 'EUR 1,240 at risk', priority: 'high', status: 'pending',
      preparedData: { invoiceId: '2024-089', amount: 1240, daysOverdue: 14 },
      actionLabel: 'Send Reminder', createdAt: now.toISOString(), requiresApproval: true,
    },
    {
      id: 'demo-agent-3', agentType: 'agent', type: 'draft_followup',
      title: 'Quote follow-up: Kitchen renovation', description: 'Quote sent 5 days ago, no response. Follow-up message prepared.',
      impact: 'EUR 4,800 potential', priority: 'medium', status: 'pending',
      preparedData: { quoteAmount: 4800, daysSinceSent: 5 },
      actionLabel: 'Send Follow-up', createdAt: now.toISOString(), requiresApproval: true,
    },

    // Auditor actions
    {
      id: 'demo-auditor-1', agentType: 'auditor', type: 'cert_expiring',
      title: 'VCA certification expires in 28 days', description: 'Your VCA safety certificate expires on 25 April. Renewal takes 2-3 weeks.',
      impact: 'Avoid work stoppage', priority: 'critical', status: 'pending',
      preparedData: { certName: 'VCA', expiryDate: '2026-04-25', renewalUrl: 'https://ssvv.nl' },
      actionLabel: 'Start Renewal', createdAt: now.toISOString(), requiresApproval: false,
    },
    {
      id: 'demo-auditor-2', agentType: 'auditor', type: 'vat_filing_due',
      title: 'BTW filing due in 18 days', description: 'Q1 2026 VAT return deadline: April 15. Vasco has prepared your summary.',
      impact: 'Avoid EUR 500+ fine', priority: 'high', status: 'pending',
      preparedData: { deadline: '2026-04-15', quarter: 'Q1 2026' },
      actionLabel: 'View Summary', createdAt: now.toISOString(), requiresApproval: false,
    },
    {
      id: 'demo-auditor-3', agentType: 'auditor', type: 'einvoice_required',
      title: 'E-invoice required for München job', description: 'German B2G invoices require XRechnung format. Upgrade to Contractor for auto-formatting.',
      impact: 'Legal requirement', priority: 'high', status: 'pending',
      preparedData: { format: 'XRechnung', country: 'DE' },
      actionLabel: 'Learn More', createdAt: now.toISOString(), requiresApproval: false,
    },

    // Analyst actions
    {
      id: 'demo-analyst-1', agentType: 'analyst', type: 'pricing_insight',
      title: 'Your hourly rate is 12% below market', description: `${trade} contractors in your area charge EUR 52/hr avg. You charge EUR 46/hr. Raising to EUR 50 would add EUR 320/month.`,
      impact: '+EUR 320/month', priority: 'medium', status: 'pending',
      preparedData: { currentRate: 46, marketAvg: 52, suggestedRate: 50, monthlyImpact: 320 },
      actionLabel: 'View Benchmark', createdAt: now.toISOString(), requiresApproval: false,
    },
    {
      id: 'demo-analyst-2', agentType: 'analyst', type: 'cashflow_forecast',
      title: 'Cash gap predicted in 3 weeks', description: 'Based on pending invoices and upcoming material costs, a EUR 2,100 shortfall is likely around April 18.',
      impact: 'Plan ahead', priority: 'high', status: 'pending',
      preparedData: { gapDate: '2026-04-18', gapAmount: 2100, pendingInvoices: 3 },
      actionLabel: 'View Forecast', createdAt: now.toISOString(), requiresApproval: false,
    },
    {
      id: 'demo-analyst-3', agentType: 'analyst', type: 'quote_win_prediction',
      title: 'Quote #2024-094 has 78% win probability', description: 'Based on similar jobs, client history, and your pricing: strong chance of winning. Consider sending a follow-up.',
      impact: 'EUR 3,200 potential', priority: 'medium', status: 'pending',
      preparedData: { quoteId: '2024-094', winProbability: 78, amount: 3200 },
      actionLabel: 'View Analysis', createdAt: now.toISOString(), requiresApproval: false,
    },
  ];

  return actions;
}

// ─── Agent Descriptions for UI ─────────────────────────────────────────────

export function getAgentDescription(type: EveAgentType): {
  name: string;
  tagline: string;
  capabilities: string[];
  freeLimit: string;
  paidBenefit: string;
} {
  switch (type) {
    case 'agent':
      return {
        name: 'EVE Agent',
        tagline: 'Your tireless business assistant',
        capabilities: [
          'Draft invoices from completed jobs',
          'Send payment reminders automatically',
          'Follow up on stale quotes',
          'Suggest schedule optimizations',
          'Prepare end-of-day customer updates',
          'Batch weekly unbilled jobs',
          'Trigger maintenance reminders',
        ],
        freeLimit: '2 actions/month',
        paidBenefit: 'Unlimited — runs every 4 hours',
      };
    case 'auditor':
      return {
        name: 'EVE Auditor',
        tagline: 'Your compliance safety net',
        capabilities: [
          'Monitor certification expiry dates',
          'Track insurance renewals',
          'Flag missing permits before job start',
          'Alert on VAT/tax filing deadlines',
          'Verify subcontractor compliance',
          'Generate safety checklists per country',
          'Ensure e-invoice format compliance',
        ],
        freeLimit: '2 alerts/month',
        paidBenefit: 'Always-on monitoring — all 6 EU countries',
      };
    case 'analyst':
      return {
        name: 'EVE Analyst',
        tagline: 'Your business intelligence advisor',
        capabilities: [
          'Benchmark rates against 14K+ contractors',
          'Predict quote win probability',
          'Forecast cashflow 90 days out',
          'Identify most profitable job types',
          'Compare supplier pricing',
          'Detect seasonal demand patterns',
          'Score client payment risk',
        ],
        freeLimit: '1 insight/month',
        paidBenefit: 'Full intelligence — ML predictions + benchmarks',
      };
  }
}
