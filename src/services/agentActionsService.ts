// =============================================================================
// AGENT ACTIONS SERVICE
// =============================================================================
// System of Action: AI-generated actions with approval workflow
// a16z pattern: "Operate, don't just assist"
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AgentAction,
  ActionType,
  ActionStatus,
  ActionCategory,
  ActionStake,
  ActionPreview,
  ActionImpact,
  ActionResult,
  HoursSavedEntry,
  HoursSavedSummary,
  ACTION_TIME_ESTIMATES,
  DEFAULT_ACTION_RULES,
  QuoteFollowupPayload,
  InvoiceReminderPayload,
  InvoiceGeneratePayload,
  JobCloseoutPayload,
  MaterialOrderPayload,
} from '../types/agent-actions';

// ============================================
// MOCK DATA
// ============================================

const MOCK_ACTIONS: AgentAction[] = [
  // Quote follow-up action
  {
    id: 'action_1',
    type: 'quote-followup',
    category: 'quote',
    stake: 'medium',
    title: 'Follow up met Familie Jansen',
    description: 'Offerte verstuurd 3 dagen geleden, nog geen reactie',
    reason: 'Vergelijkbare offertes converteren 72% binnen 5 dagen. Opvolging verhoogt de kans met 35%.',
    payload: {
      quoteId: 'quote_1',
      customerId: 'cust_1',
      customerName: 'Familie Jansen',
      quoteAmount: 4850,
      daysSinceSent: 3,
      suggestedMessage: 'Beste Familie Jansen,\n\nGraag wilde ik even informeren of u nog vragen heeft over de offerte voor het schilderwerk. Ik help u graag verder.\n\nMet vriendelijke groet,\nJan van der Berg',
      channel: 'whatsapp',
      similarQuotesConversionRate: 72,
      optimalFollowupWindow: '2-5 dagen',
    } as QuoteFollowupPayload,
    preview: {
      content: 'Beste Familie Jansen,\n\nGraag wilde ik even informeren of u nog vragen heeft over de offerte voor het schilderwerk. Ik help u graag verder.\n\nMet vriendelijke groet,\nJan van der Berg',
      amount: 4850,
      currency: 'EUR',
    },
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    requiresReview: true,
    relatedEntityType: 'quote',
    relatedEntityId: 'quote_1',
    confidence: 85,
    estimatedImpact: {
      timeSavedMinutes: 10,
      conversionLift: 35,
    },
  },
  // Invoice reminder action
  {
    id: 'action_2',
    type: 'invoice-reminder',
    category: 'invoice',
    stake: 'medium',
    title: 'Betalingsherinnering Bakkerij de Groot',
    description: 'Factuur 7 dagen over vervaldatum',
    reason: 'Klant heeft normaal binnen 14 dagen betaald. Vriendelijke herinnering voorkomt verdere vertraging.',
    payload: {
      invoiceId: 'inv_2',
      customerId: 'cust_2',
      customerName: 'Bakkerij de Groot',
      amount: 2340,
      daysOverdue: 7,
      reminderCount: 0,
      suggestedMessage: 'Beste Bakkerij de Groot,\n\nGraag herinneren wij u aan factuur #2024-089 van €2.340. De vervaldatum was 7 dagen geleden.\n\nU kunt eenvoudig betalen via de link in de factuur.\n\nMet vriendelijke groet,\nJan van der Berg',
      tone: 'friendly',
      channel: 'email',
    } as InvoiceReminderPayload,
    preview: {
      content: 'Beste Bakkerij de Groot,\n\nGraag herinneren wij u aan factuur #2024-089 van €2.340...',
      amount: 2340,
      currency: 'EUR',
      fields: [
        { label: 'Dagen over vervaldatum', value: '7 dagen' },
        { label: 'Eerdere herinneringen', value: '0' },
      ],
    },
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    requiresReview: true,
    relatedEntityType: 'invoice',
    relatedEntityId: 'inv_2',
    confidence: 90,
    estimatedImpact: {
      timeSavedMinutes: 8,
      paymentSpeedup: 5,
    },
  },
  // Invoice generation action
  {
    id: 'action_3',
    type: 'invoice-generate',
    category: 'invoice',
    stake: 'medium',
    title: 'Factuur aanmaken: Keukenrenovatie Visser',
    description: 'Klus afgerond gisteren, factuur klaar voor verzending',
    reason: 'Snelle facturering verbetert cashflow. Gemiddelde betaaltijd is 28 dagen na versturen.',
    payload: {
      jobId: 'job_3',
      customerId: 'cust_3',
      customerName: 'Familie Visser',
      lineItems: [
        { description: 'Schilderwerk keuken - arbeidskosten', quantity: 16, unit: 'uur', unitPrice: 55, total: 880 },
        { description: 'Materialen (verf, primer, tape)', quantity: 1, unit: 'set', unitPrice: 245, total: 245 },
        { description: 'Afwerking en oplevering', quantity: 4, unit: 'uur', unitPrice: 55, total: 220 },
      ],
      subtotal: 1345,
      vatRate: 21,
      vatAmount: 282.45,
      total: 1627.45,
    } as InvoiceGeneratePayload,
    preview: {
      amount: 1627.45,
      currency: 'EUR',
      fields: [
        { label: 'Klant', value: 'Familie Visser' },
        { label: 'Project', value: 'Keukenrenovatie' },
        { label: 'Subtotaal', value: '€1.345,00' },
        { label: 'BTW (21%)', value: '€282,45' },
        { label: 'Totaal', value: '€1.627,45' },
      ],
    },
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    requiresReview: true,
    relatedEntityType: 'job',
    relatedEntityId: 'job_3',
    confidence: 95,
    estimatedImpact: {
      timeSavedMinutes: 20,
      revenueImpact: 1627.45,
    },
  },
  // Material order action
  {
    id: 'action_4',
    type: 'material-order',
    category: 'purchasing',
    stake: 'medium',
    title: 'Verf bestellen bij Verfwinkel.nl',
    description: 'Voorraad Sigma S2U Nova laag, 3 klussen gepland',
    reason: 'Huidige prijs €45/liter is 12% onder gemiddelde. Bulk korting beschikbaar.',
    payload: {
      materials: [
        {
          materialId: 'mat_1',
          name: 'Sigma S2U Nova Satin - RAL 9010',
          quantity: 20,
          unit: 'liter',
          supplierId: 'sup_1',
          supplierName: 'Verfwinkel.nl',
          unitPrice: 45,
          totalPrice: 900,
        },
      ],
      totalAmount: 900,
      supplierId: 'sup_1',
      supplierName: 'Verfwinkel.nl',
      deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      savings: 120,
      savingsReason: 'Bulk korting + 12% onder gemiddelde prijs',
    } as MaterialOrderPayload,
    preview: {
      amount: 900,
      currency: 'EUR',
      fields: [
        { label: 'Product', value: 'Sigma S2U Nova Satin 20L' },
        { label: 'Leverancier', value: 'Verfwinkel.nl' },
        { label: 'Besparing', value: '€120 (12%)' },
        { label: 'Levering', value: 'Over 3 dagen' },
      ],
    },
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'pending',
    requiresReview: true,
    relatedEntityType: 'material',
    relatedEntityId: 'mat_1',
    confidence: 88,
    estimatedImpact: {
      timeSavedMinutes: 25,
      costSavings: 120,
    },
  },
  // Completed action example
  {
    id: 'action_5',
    type: 'customer-check-in',
    category: 'communication',
    stake: 'low',
    title: 'Check-in bij Familie Pietersen',
    description: '30 dagen na oplevering - tevredenheidscheck',
    reason: 'Automatische check-in verhoogt review-kans en herhaalopdrachten.',
    payload: {},
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    executedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    status: 'executed',
    requiresReview: false,
    confidence: 92,
    estimatedImpact: {
      timeSavedMinutes: 10,
    },
  },
];

const MOCK_HOURS_SAVED: HoursSavedEntry[] = [
  {
    id: 'hs_1',
    actionId: 'action_5',
    actionType: 'customer-check-in',
    minutesSaved: 10,
    description: 'Automatische check-in bij Familie Pietersen',
    savedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'hs_2',
    actionId: 'action_prev_1',
    actionType: 'invoice-generate',
    minutesSaved: 20,
    description: 'Factuur gegenereerd voor Project De Vries',
    savedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'hs_3',
    actionId: 'action_prev_2',
    actionType: 'quote-followup',
    minutesSaved: 10,
    description: 'Follow-up verzonden naar Bakkerij Jansen',
    savedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'hs_4',
    actionId: 'action_prev_3',
    actionType: 'schedule-optimize-day',
    minutesSaved: 30,
    description: 'Dagplanning geoptimaliseerd - 45min reistijd bespaard',
    savedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'hs_5',
    actionId: 'action_prev_4',
    actionType: 'invoice-reminder',
    minutesSaved: 8,
    description: 'Betalingsherinnering verzonden',
    savedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class AgentActionsService {
  private actions: Map<string, AgentAction> = new Map();
  private hoursSaved: Map<string, HoursSavedEntry> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // R31: dropped MOCK_ACTIONS + MOCK_HOURS_SAVED constructor seeds.
    // Test setups call __seedMockData.
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_ACTIONS.forEach((a) => this.actions.set(a.id, a));
    MOCK_HOURS_SAVED.forEach((h) => this.hoursSaved.set(h.id, h));
  }

  // -----------------------------------------
  // Action Management
  // -----------------------------------------

  getActions(filter?: {
    status?: ActionStatus[];
    category?: ActionCategory[];
    stake?: ActionStake[];
  }): AgentAction[] {
    let actions = Array.from(this.actions.values());

    if (filter?.status) {
      actions = actions.filter((a) => filter.status!.includes(a.status));
    }
    if (filter?.category) {
      actions = actions.filter((a) => filter.category!.includes(a.category));
    }
    if (filter?.stake) {
      actions = actions.filter((a) => filter.stake!.includes(a.stake));
    }

    return actions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getPendingActions(): AgentAction[] {
    return this.getActions({ status: ['pending'] });
  }

  getActionById(id: string): AgentAction | undefined {
    return this.actions.get(id);
  }

  // -----------------------------------------
  // Action Workflow
  // -----------------------------------------

  approveAction(actionId: string): ActionResult {
    const action = this.actions.get(actionId);
    if (!action) {
      return { success: false, error: 'Action not found' };
    }

    if (action.status !== 'pending') {
      return { success: false, error: 'Action is not pending' };
    }

    // Execute the action
    action.status = 'executed';
    action.approvedAt = new Date().toISOString();
    action.executedAt = new Date().toISOString();
    action.executionResult = { success: true, message: 'Actie uitgevoerd' };

    // Record time saved
    const timeSaved = ACTION_TIME_ESTIMATES[action.type] || 10;
    this.recordHoursSaved(action.id, action.type, timeSaved, action.title);

    this.notifyListeners();

    return { success: true, message: 'Actie goedgekeurd en uitgevoerd' };
  }

  rejectAction(actionId: string, reason?: string): ActionResult {
    const action = this.actions.get(actionId);
    if (!action) {
      return { success: false, error: 'Action not found' };
    }

    action.status = 'rejected';
    action.rejectedReason = reason;

    this.notifyListeners();

    return { success: true, message: 'Actie afgewezen' };
  }

  bulkApprove(actionIds: string[]): { approved: number; failed: number } {
    let approved = 0;
    let failed = 0;

    actionIds.forEach((id) => {
      const result = this.approveAction(id);
      if (result.success) {
        approved++;
      } else {
        failed++;
      }
    });

    return { approved, failed };
  }

  // -----------------------------------------
  // Hours Saved Tracking
  // -----------------------------------------

  private recordHoursSaved(
    actionId: string,
    actionType: ActionType,
    minutesSaved: number,
    description: string
  ): void {
    const entry: HoursSavedEntry = {
      id: `hs_${Date.now()}`,
      actionId,
      actionType,
      minutesSaved,
      description,
      savedAt: new Date().toISOString(),
    };
    this.hoursSaved.set(entry.id, entry);
  }

  getHoursSavedSummary(): HoursSavedSummary {
    const entries = Array.from(this.hoursSaved.values());
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const today = entries.filter((e) => new Date(e.savedAt) >= startOfDay);
    const thisWeek = entries.filter((e) => new Date(e.savedAt) >= startOfWeek);
    const thisMonth = entries.filter((e) => new Date(e.savedAt) >= startOfMonth);

    const byCategory: Record<ActionCategory, number> = {
      quote: 0,
      invoice: 0,
      scheduling: 0,
      purchasing: 0,
      communication: 0,
      compliance: 0,
      reporting: 0,
      'job-management': 0,
    };

    const actionTypeToCategory: Record<string, ActionCategory> = {
      'quote-followup': 'quote',
      'quote-reminder': 'quote',
      'quote-optimize': 'quote',
      'quote-generate': 'quote',
      'invoice-generate': 'invoice',
      'invoice-reminder': 'invoice',
      'invoice-escalate': 'invoice',
      'payment-plan-suggest': 'invoice',
      'schedule-propose': 'scheduling',
      'schedule-reschedule': 'scheduling',
      'schedule-optimize-day': 'scheduling',
      'material-order': 'purchasing',
      'bulk-order-opportunity': 'purchasing',
      'price-alert-action': 'purchasing',
      'customer-followup': 'communication',
      'customer-check-in': 'communication',
      'review-request': 'communication',
      'referral-request': 'communication',
      'job-closeout': 'job-management',
      'job-status-update': 'job-management',
      'warranty-create': 'job-management',
      'certification-renewal': 'compliance',
      'compliance-filing': 'compliance',
      'insurance-renewal': 'compliance',
      'weekly-summary': 'reporting',
      'monthly-report': 'reporting',
      'lender-update': 'reporting',
    };

    entries.forEach((e) => {
      const category = actionTypeToCategory[e.actionType] || 'communication';
      byCategory[category] += e.minutesSaved;
    });

    // Calculate top actions
    const actionCounts: Record<ActionType, { totalMinutes: number; count: number }> = {} as any;
    entries.forEach((e) => {
      if (!actionCounts[e.actionType]) {
        actionCounts[e.actionType] = { totalMinutes: 0, count: 0 };
      }
      actionCounts[e.actionType].totalMinutes += e.minutesSaved;
      actionCounts[e.actionType].count++;
    });

    const topActions = Object.entries(actionCounts)
      .map(([type, data]) => ({
        actionType: type as ActionType,
        totalMinutes: data.totalMinutes,
        count: data.count,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 5);

    return {
      today: today.reduce((sum, e) => sum + e.minutesSaved, 0),
      thisWeek: thisWeek.reduce((sum, e) => sum + e.minutesSaved, 0),
      thisMonth: thisMonth.reduce((sum, e) => sum + e.minutesSaved, 0),
      allTime: entries.reduce((sum, e) => sum + e.minutesSaved, 0),
      byCategory,
      topActions,
    };
  }

  // -----------------------------------------
  // Action Generation (simulated)
  // -----------------------------------------

  generateNewActions(): void {
    // In production, this would be triggered by events or scheduled jobs
    // For demo, we just show the mock actions
    this.notifyListeners();
  }

  // -----------------------------------------
  // Action Stats
  // -----------------------------------------

  getActionStats(): {
    pending: number;
    executed: number;
    rejected: number;
    todayExecuted: number;
    avgConfidence: number;
  } {
    const actions = Array.from(this.actions.values());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = actions.filter((a) => a.status === 'pending').length;
    const executed = actions.filter((a) => a.status === 'executed').length;
    const rejected = actions.filter((a) => a.status === 'rejected').length;
    const todayExecuted = actions.filter(
      (a) => a.status === 'executed' && a.executedAt && new Date(a.executedAt) >= today
    ).length;

    const avgConfidence =
      actions.length > 0
        ? actions.reduce((sum, a) => sum + a.confidence, 0) / actions.length
        : 0;

    return { pending, executed, rejected, todayExecuted, avgConfidence };
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

export const agentActionsService = new AgentActionsService();

// ============================================
// REACT HOOKS
// ============================================

export function useAgentActions(filter?: {
  status?: ActionStatus[];
  category?: ActionCategory[];
  stake?: ActionStake[];
}) {
  const [actions, setActions] = useState<AgentAction[]>(() =>
    agentActionsService.getActions(filter)
  );

  useEffect(() => {
    const unsubscribe = agentActionsService.subscribe(() => {
      setActions(agentActionsService.getActions(filter));
    });
    return unsubscribe;
  }, [filter?.status?.join(','), filter?.category?.join(','), filter?.stake?.join(',')]);

  const approve = useCallback((actionId: string) => {
    return agentActionsService.approveAction(actionId);
  }, []);

  const reject = useCallback((actionId: string, reason?: string) => {
    return agentActionsService.rejectAction(actionId, reason);
  }, []);

  const bulkApprove = useCallback((actionIds: string[]) => {
    return agentActionsService.bulkApprove(actionIds);
  }, []);

  return { actions, approve, reject, bulkApprove };
}

export function usePendingActions() {
  const [actions, setActions] = useState<AgentAction[]>(() =>
    agentActionsService.getPendingActions()
  );

  useEffect(() => {
    const unsubscribe = agentActionsService.subscribe(() => {
      setActions(agentActionsService.getPendingActions());
    });
    return unsubscribe;
  }, []);

  const pendingCount = actions.length;
  const highStakeCount = actions.filter((a) => a.stake === 'high').length;
  const mediumStakeCount = actions.filter((a) => a.stake === 'medium').length;

  return { actions, pendingCount, highStakeCount, mediumStakeCount };
}

export function useHoursSaved() {
  const [summary, setSummary] = useState<HoursSavedSummary>(() =>
    agentActionsService.getHoursSavedSummary()
  );

  useEffect(() => {
    const unsubscribe = agentActionsService.subscribe(() => {
      setSummary(agentActionsService.getHoursSavedSummary());
    });
    return unsubscribe;
  }, []);

  return summary;
}

export function useActionStats() {
  const [stats, setStats] = useState(() => agentActionsService.getActionStats());

  useEffect(() => {
    const unsubscribe = agentActionsService.subscribe(() => {
      setStats(agentActionsService.getActionStats());
    });
    return unsubscribe;
  }, []);

  return stats;
}
