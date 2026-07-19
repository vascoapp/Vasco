// =============================================================================
// EVE AGENT SERVICE — 3-Agent AI Workforce types + config
// =============================================================================
// Defines the EVE 3-agent model (Agent / Auditor / Analyst). The action types
// + EVE_AGENTS config are consumed by:
//   - `app/contractor/eve.tsx` — per-agent dashboard (R40)
//   - `src/services/eveLiveActionService.ts` — buildLiveActions
//   - `src/services/eveTelemetry.ts` — approve/reject outcome tracking
//
// R66r62: trimmed from 345 LoC → 142 LoC by deleting 3 structural orphans:
//   - getWorkforceStatus + EveAgentStatus + EveWorkforceStatus types
//   - generateDemoActions (demo fixtures, never imported)
//   - getAgentDescription (capability copy now lives in EVE_AGENTS)
// All three had zero callers per grep across src/ + app/. Capability copy
// + tagline live entirely in EVE_AGENTS below, consumed by eve.tsx.
// Subscription-tier gating happens at action-creation time in
// backgroundJobScheduler, not here — keeping this file tier-agnostic.
// =============================================================================

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
    name: 'Vasco Agent',
    tagline: 'Your tireless business assistant',
    description: 'Handles day-to-day execution: drafts invoices from completed jobs, sends payment reminders, follows up on stale quotes, suggests schedule optimizations, and prepares end-of-day updates. Works 24/7 so you can focus on the tools.',
    icon: 'flash',
    color: '#F97316',
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
    name: 'Vasco Auditor',
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
    name: 'Vasco Analyst',
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
