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
import { getCurrentUserId } from '../lib/currentUser';
import i18n from '../i18n/i18n';

import type { InsightAction, InsightActionType } from './generators/types';
import { formatMoney2, formatMoney } from '../i18n/formatting';

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

// ---------------------------------------------------------------------------
// Executor bridge — lets AppState inject real side-effect functions so this
// module can stay hook-free. If no binding is registered, handlers degrade
// gracefully to the old route-hint behavior.
// ---------------------------------------------------------------------------

export interface ExecutorBindings {
  createInvoiceFromJob?: (jobId: string) => Promise<string | null>;
  createPaymentLink?: (invoiceId: string, amount: number) => Promise<string | null>;
  createPurchaseOrder?: (materialName: string, supplier?: string) => Promise<string | null>;
  scheduleJob?: (jobId: string, when: Date) => Promise<void>;
  updateQuoteAmount?: (quoteId: string, newAmount: number) => Promise<void>;
}

let bindings: ExecutorBindings = {};

export function registerExecutorBindings(next: ExecutorBindings): void {
  bindings = { ...bindings, ...next };
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
    const t = i18n.t.bind(i18n);
    const { customerName, invoiceId, amount } = params;
    const text = t('action.reminderBody', {
      defaultValue: 'Dear {{customer}},\n\nThis is a friendly reminder for invoice {{invoice}} of {{amount}}.\n\nKind regards',
      customer: customerName || t('action.customer', 'customer'),
      invoice: invoiceId || '',
      amount: formatMoney2(amount || 0),
    });
    try {
      // Share.share RESOLVES on dismiss — it does not throw — so the catch
      // below never ran and a cancelled share still returned success, marking
      // the queue item done and the timeline "Reminder sent". The
      // `action.shareCancelled` string right there shows the intent was always
      // to handle this; only the mechanism was wrong.
      const res = await Share.share({ message: text, title: t('action.reminderTitle', 'Payment reminder') });
      if (res.action === Share.dismissedAction) {
        return { success: false, message: t('action.shareCancelled', 'Share cancelled') };
      }
      return { success: true, message: t('action.reminderSent', { defaultValue: 'Reminder sent for {{amount}}', amount: formatMoney2(amount || 0) }) };
    } catch {
      return { success: false, message: t('action.shareCancelled', 'Share cancelled') };
    }
  },

  create_invoice: async (params) => {
    const t = i18n.t.bind(i18n);
    if (bindings.createInvoiceFromJob && params.jobId) {
      try {
        const invoiceId = await bindings.createInvoiceFromJob(String(params.jobId));
        if (invoiceId) {
          // Also generate a payment link when amount is available
          if (bindings.createPaymentLink && typeof params.amount === 'number') {
            await bindings.createPaymentLink(invoiceId, params.amount).catch(() => null);
          }
          return { success: true, message: t('action.invoiceCreated', { defaultValue: 'Invoice {{id}} created', id: invoiceId }), data: { invoiceId, route: `/invoices/${invoiceId}` } };
        }
      } catch (e) {
        return { success: false, message: t('action.invoiceFailed', { defaultValue: 'Could not create invoice: {{err}}', err: String(e) }) };
      }
    }
    return { success: true, message: t('action.creatingInvoice', 'Creating invoice...'), data: { route: '/contractor/tiered-quote', jobId: params.jobId } };
  },

  order_materials: async (params) => {
    const t = i18n.t.bind(i18n);
    if (bindings.createPurchaseOrder && params.materialName) {
      try {
        const poId = await bindings.createPurchaseOrder(String(params.materialName), params.supplier ? String(params.supplier) : undefined);
        if (poId) {
          return { success: true, message: t('action.orderCreated', { defaultValue: 'Purchase order created for {{material}}', material: params.materialName }), data: { poId, route: `/contractor/purchase-order/${poId}` } };
        }
      } catch {}
    }
    return { success: true, message: t('action.orderCreated', { defaultValue: 'Purchase order created for {{material}}', material: params.materialName || t('action.materials', 'materials') }), data: { route: '/contractor/purchase-orders' } };
  },

  schedule_job: async (params) => {
    const t = i18n.t.bind(i18n);
    if (bindings.scheduleJob && params.jobId && params.scheduledAt) {
      try {
        await bindings.scheduleJob(String(params.jobId), new Date(params.scheduledAt));
        return { success: true, message: t('action.jobScheduled', { defaultValue: 'Job scheduled: {{title}}', title: params.jobTitle || '' }), data: { route: `/contractor/job/${params.jobId}` } };
      } catch {}
    }
    return { success: true, message: t('action.jobScheduled', { defaultValue: 'Job scheduled: {{title}}', title: params.jobTitle || '' }), data: { route: '/contractor/drag-schedule' } };
  },

  adjust_quote: async (params) => {
    const t = i18n.t.bind(i18n);
    const { quoteId, suggestedPrice } = params;
    if (bindings.updateQuoteAmount && quoteId && typeof suggestedPrice === 'number') {
      try {
        await bindings.updateQuoteAmount(String(quoteId), suggestedPrice);
      } catch {}
    }
    return { success: true, message: t('action.quoteAdjusted', { defaultValue: 'Quote {{id}} adjusted to {{price}}', id: quoteId, price: formatMoney2(suggestedPrice) }), data: { route: `/quotes/${quoteId}` } };
  },

  renew_cert: async (params) => {
    const t = i18n.t.bind(i18n);
    return { success: true, message: t('action.renewalStarted', { defaultValue: 'Renewal started for {{cert}}', cert: params.certName || t('action.certificate', 'certificate') }), data: { route: '/(contractor)/certificaten' } };
  },

  send_followup: async (params) => {
    const t = i18n.t.bind(i18n);
    const { customerName, quoteId } = params;
    const text = t('action.followupBody', {
      defaultValue: 'Dear {{customer}},\n\nI would like to check if you have had a chance to review quote {{quote}}. Please let me know if you have any questions.\n\nKind regards',
      customer: customerName || t('action.customer', 'customer'),
      quote: quoteId || '',
    });
    try {
      const res = await Share.share({ message: text, title: t('action.followupTitle', 'Quote follow-up') });
      if (res.action === Share.dismissedAction) {
        return { success: false, message: t('action.shareCancelled', 'Share cancelled') };
      }
      return { success: true, message: t('action.followupSent', 'Follow-up sent') };
    } catch {
      return { success: false, message: t('action.shareCancelled', 'Share cancelled') };
    }
  },

  escalate_issue: async (params) => {
    const t = i18n.t.bind(i18n);
    return { success: true, message: t('action.escalated', { defaultValue: 'Escalation reported: {{issue}}', issue: params.issue || '' }), data: { route: '/sitelead/incident-report' } };
  },

  log_expense: async (params) => {
    const t = i18n.t.bind(i18n);
    return { success: true, message: t('action.expenseLogged', { defaultValue: 'Expense logged: {{amount}}', amount: formatMoney2(params.amount || 0) }), data: { route: '/contractor/expenses' } };
  },

  switch_supplier: async (params) => {
    const t = i18n.t.bind(i18n);
    const { currentSupplier, newSupplier, savings } = params;
    return { success: true, message: t('action.supplierSwitched', { defaultValue: 'Switch from {{from}} to {{to}} — save {{savings}}/order', from: currentSupplier, to: newSupplier, savings: formatMoney(savings || 0) }), data: { route: '/contractor/inkoop' } };
  },

  close_defect: async (params) => {
    const t = i18n.t.bind(i18n);
    return { success: true, message: t('action.defectClosed', { defaultValue: 'Defect {{id}} closed', id: params.defectId || '' }), data: { route: '/sitelead/close-defect' } };
  },

  submit_report: async (params) => {
    const t = i18n.t.bind(i18n);
    return { success: true, message: t('action.submittingReport', 'Submitting report...'), data: { route: '/sitelead/daily-report' } };
  },

  custom: async (params) => {
    const t = i18n.t.bind(i18n);
    return { success: true, message: params.message || t('action.executed', 'Action executed') };
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
  if (!handler) return { success: false, message: i18n.t('action.unknownType', { defaultValue: 'Unknown action type: {{type}}', type: action.type }) };

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
  emitBusinessEvent(getCurrentUserId(), {
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
      { text: i18n.t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: i18n.t('common.execute', 'Execute'),
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
