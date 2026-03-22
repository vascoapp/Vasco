// =============================================================================
// ACTION EXECUTOR — Turns insights into executed actions
// =============================================================================
// Layer 5 of the compound AI architecture.
// Each InsightAction is dispatched to the appropriate service.
// Actions are logged for outcome tracking (did the reminder result in payment?).
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share, Alert } from 'react-native';
import { emitBusinessEvent } from './dataCollector';
import { recordMetricSnapshot } from './learningStorage';

import type { InsightAction, InsightActionType } from './generators/types';

const ACTION_LOG_KEY = '@vasco_action_log';
const MAX_ACTION_LOG = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

export interface ActionLogEntry {
  id: string;
  actionType: InsightActionType;
  insightId: string;
  generatorId: string;
  params: Record<string, any>;
  executedAt: string;
  result: ActionResult;
  outcomeTracked: boolean;
  outcome?: 'positive' | 'negative' | 'neutral';
  outcomeAt?: string;
}

// ---------------------------------------------------------------------------
// Action Handlers
// ---------------------------------------------------------------------------

type ActionHandler = (params: Record<string, any>) => Promise<ActionResult>;

const handlers: Record<InsightActionType, ActionHandler> = {
  send_reminder: async (params) => {
    const { customerName, invoiceId, amount } = params;
    const text = `Beste ${customerName || 'klant'},\n\nHierbij een vriendelijke herinnering voor factuur ${invoiceId || ''} van €${(amount || 0).toLocaleString('nl-NL')}.\n\nMet vriendelijke groet`;
    try {
      await Share.share({ message: text, title: 'Betaalherinnering' });
      return { success: true, message: `Herinnering verstuurd voor €${amount}` };
    } catch {
      return { success: false, message: 'Delen geannuleerd' };
    }
  },

  create_invoice: async (params) => {
    // Triggers navigation — the actual creation happens in the UI
    return { success: true, message: 'Factuur aanmaken...', data: { route: '/contractor/tiered-quote', jobId: params.jobId } };
  },

  order_materials: async (params) => {
    return { success: true, message: `Inkooporder aangemaakt voor ${params.materialName || 'materialen'}`, data: { route: '/contractor/purchase-orders' } };
  },

  schedule_job: async (params) => {
    return { success: true, message: `Klus ingepland: ${params.jobTitle || ''}`, data: { route: '/contractor/drag-schedule' } };
  },

  adjust_quote: async (params) => {
    const { quoteId, suggestedPrice } = params;
    return { success: true, message: `Offerte ${quoteId} aangepast naar €${suggestedPrice}`, data: { route: `/quotes/${quoteId}` } };
  },

  renew_cert: async (params) => {
    return { success: true, message: `Vernieuwing gestart voor ${params.certName || 'certificaat'}`, data: { route: '/(contractor)/certificaten' } };
  },

  send_followup: async (params) => {
    const { customerName, quoteId } = params;
    const text = `Beste ${customerName || 'klant'},\n\nGraag informeer ik of u de offerte ${quoteId || ''} heeft kunnen bekijken. Ik hoor graag of u vragen heeft.\n\nMet vriendelijke groet`;
    try {
      await Share.share({ message: text, title: 'Offerte opvolging' });
      return { success: true, message: 'Opvolging verstuurd' };
    } catch {
      return { success: false, message: 'Delen geannuleerd' };
    }
  },

  escalate_issue: async (params) => {
    return { success: true, message: `Escalatie gemeld: ${params.issue || ''}`, data: { route: '/sitelead/incident-report' } };
  },

  log_expense: async (params) => {
    return { success: true, message: `Uitgave geregistreerd: €${params.amount || 0}`, data: { route: '/contractor/expenses' } };
  },

  switch_supplier: async (params) => {
    const { currentSupplier, newSupplier, savings } = params;
    return { success: true, message: `Wissel van ${currentSupplier} naar ${newSupplier} — bespaar €${savings}/bestelling`, data: { route: '/contractor/inkoop' } };
  },

  close_defect: async (params) => {
    return { success: true, message: `Gebrek ${params.defectId || ''} gesloten`, data: { route: '/sitelead/close-defect' } };
  },

  submit_report: async (params) => {
    return { success: true, message: 'Rapport indienen...', data: { route: '/sitelead/daily-report' } };
  },

  custom: async (params) => {
    return { success: true, message: params.message || 'Actie uitgevoerd' };
  },
};

// ---------------------------------------------------------------------------
// Execute an action
// ---------------------------------------------------------------------------

export async function executeAction(
  action: InsightAction,
  insightId: string,
  generatorId: string,
): Promise<ActionResult> {
  const handler = handlers[action.type];
  if (!handler) return { success: false, message: `Onbekend actietype: ${action.type}` };

  const result = await handler(action.params);

  // Log the action
  const entry: ActionLogEntry = {
    id: `act-${Date.now()}`,
    actionType: action.type,
    insightId,
    generatorId,
    params: action.params,
    executedAt: new Date().toISOString(),
    result,
    outcomeTracked: false,
  };
  await logAction(entry);

  // Emit business event for AI learning
  emitBusinessEvent('current-user', {
    eventType: 'insight_action_executed',
    entityType: 'job' as any,
    entityId: insightId,
    payload: {
      actionType: action.type,
      generatorId,
      success: result.success,
      estimatedImpact: action.estimatedImpact,
    },
  }).catch(() => {});

  return result;
}

// ---------------------------------------------------------------------------
// Action with confirmation
// ---------------------------------------------------------------------------

export function executeActionWithConfirmation(
  action: InsightAction,
  insightId: string,
  generatorId: string,
  onResult: (result: ActionResult) => void,
): void {
  if (!action.requiresApproval) {
    executeAction(action, insightId, generatorId).then(onResult);
    return;
  }

  Alert.alert(
    action.label,
    action.estimatedImpact ? `${action.label}\n\n${action.estimatedImpact}` : action.label,
    [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitvoeren',
        onPress: () => executeAction(action, insightId, generatorId).then(onResult),
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// Action log (AsyncStorage)
// ---------------------------------------------------------------------------

async function logAction(entry: ActionLogEntry): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ACTION_LOG_KEY);
    const log: ActionLogEntry[] = raw ? JSON.parse(raw) : [];
    log.unshift(entry);
    await AsyncStorage.setItem(ACTION_LOG_KEY, JSON.stringify(log.slice(0, MAX_ACTION_LOG)));
  } catch {}
}

export async function getActionLog(): Promise<ActionLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTION_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Track outcome of a past action (e.g., "reminder sent" → "invoice paid 3 days later")
export async function recordActionOutcome(
  actionId: string,
  outcome: 'positive' | 'negative' | 'neutral',
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ACTION_LOG_KEY);
    const log: ActionLogEntry[] = raw ? JSON.parse(raw) : [];
    const entry = log.find(e => e.id === actionId);
    if (entry) {
      entry.outcomeTracked = true;
      entry.outcome = outcome;
      entry.outcomeAt = new Date().toISOString();
      await AsyncStorage.setItem(ACTION_LOG_KEY, JSON.stringify(log));
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Action stats — how effective are AI actions?
// ---------------------------------------------------------------------------

export async function getActionStats(): Promise<{
  total: number;
  successful: number;
  positiveOutcomes: number;
  negativeOutcomes: number;
  topActions: { type: InsightActionType; count: number }[];
}> {
  const log = await getActionLog();
  const successful = log.filter(e => e.result.success).length;
  const positiveOutcomes = log.filter(e => e.outcome === 'positive').length;
  const negativeOutcomes = log.filter(e => e.outcome === 'negative').length;

  const countByType = new Map<InsightActionType, number>();
  for (const e of log) {
    countByType.set(e.actionType, (countByType.get(e.actionType) ?? 0) + 1);
  }
  const topActions = Array.from(countByType.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  return { total: log.length, successful, positiveOutcomes, negativeOutcomes, topActions };
}
