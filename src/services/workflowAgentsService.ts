// =============================================================================
// WORKFLOW AGENTS SERVICE
// =============================================================================
// Agentic workflow automation: Quote nurture, Cash collection, Job closeout
// a16z pattern: AI that "operates" not just "assists"
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Workflow,
  WorkflowType,
  WorkflowStatus,
  WorkflowStep,
  QuoteNurtureWorkflow,
  QuoteNurtureContext,
  CashCollectionWorkflow,
  CashCollectionContext,
  JobCloseoutWorkflow,
  JobCloseoutContext,
  MaterialReorderWorkflow,
  MaterialReorderContext,
  WorkflowAnalytics,
  WorkflowEngineConfig,
  DEFAULT_WORKFLOW_CONFIG,
  QUOTE_NURTURE_TEMPLATE,
  CASH_COLLECTION_TEMPLATE,
  JOB_CLOSEOUT_TEMPLATE,
} from '../types/workflow-agents';

// ============================================
// MOCK DATA
// ============================================

const MOCK_WORKFLOWS: Workflow[] = [
  // Active quote nurture workflow
  {
    id: 'wf_1',
    type: 'quote-nurture',
    name: 'Offerte opvolging - Familie Jansen',
    description: 'Automatische opvolging voor offerte €4.850',
    entityType: 'quote',
    entityId: 'quote_1',
    status: 'active',
    currentStepIndex: 1,
    steps: QUOTE_NURTURE_TEMPLATE.map((step, index) => ({
      ...step,
      id: `step_${index + 1}`,
      status: index === 0 ? 'completed' : index === 1 ? 'waiting' : 'pending',
      executedAt: index === 0 ? new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    })),
    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    nextActionAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    context: {
      quoteId: 'quote_1',
      customerId: 'cust_1',
      customerName: 'Familie Jansen',
      customerEmail: 'jansen@email.nl',
      customerPhone: '06-12345678',
      quoteAmount: 4850,
      quoteTier: 'better',
      quoteSentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      quoteViewed: true,
      quoteViewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      viewCount: 2,
      remindersSent: 1,
      lastContactAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastContactType: 'email',
      customerResponded: false,
      similarQuotesConversionRate: 72,
      optimalFollowupDays: 5,
    } as QuoteNurtureContext,
    actionsExecuted: [
      {
        stepId: 'step_1',
        actionType: 'send-email',
        executedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        success: true,
        result: { messageId: 'msg_123', opened: true },
        autoApproved: false,
        approvedBy: 'contractor_1',
      },
    ],
  },
  // Active cash collection workflow
  {
    id: 'wf_2',
    type: 'cash-collection',
    name: 'Incasso - Bakkerij de Groot',
    description: 'Betalingsopvolging factuur €2.340',
    entityType: 'invoice',
    entityId: 'inv_2',
    status: 'active',
    currentStepIndex: 3,
    steps: CASH_COLLECTION_TEMPLATE.map((step, index) => ({
      ...step,
      id: `step_${index + 1}`,
      status: index < 3 ? 'completed' : index === 3 ? 'waiting' : 'pending',
      executedAt: index < 3 ? new Date(Date.now() - (10 - index * 3) * 24 * 60 * 60 * 1000).toISOString() : undefined,
    })),
    startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    nextActionAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    context: {
      invoiceId: 'inv_2',
      customerId: 'cust_2',
      customerName: 'Bakkerij de Groot',
      customerEmail: 'info@bakkerijdegroot.nl',
      customerPhone: '020-1234567',
      invoiceAmount: 2340,
      invoiceDate: '2025-01-05',
      dueDate: '2025-01-19',
      daysOverdue: 13,
      amountPaid: 0,
      amountDue: 2340,
      partialPayments: [],
      remindersSent: 3,
      lastReminderAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      lastReminderType: 'firm',
      customerPaymentHistory: 'average',
      avgPaymentDays: 25,
      previousOverdueCount: 1,
      paymentLinkUrl: 'https://pay.vasco.nl/inv_2',
      paymentLinkExpiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    } as CashCollectionContext,
    actionsExecuted: [
      {
        stepId: 'step_1',
        actionType: 'send-email',
        executedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        success: true,
        autoApproved: true,
      },
      {
        stepId: 'step_2',
        actionType: 'send-email',
        executedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        success: true,
        autoApproved: true,
      },
      {
        stepId: 'step_3',
        actionType: 'send-email',
        executedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        success: true,
        autoApproved: false,
        approvedBy: 'contractor_1',
      },
    ],
  },
  // Pending job closeout workflow
  {
    id: 'wf_3',
    type: 'job-closeout',
    name: 'Afronding - Keukenrenovatie Visser',
    description: 'Factuur, garantie en review aanvragen',
    entityType: 'job',
    entityId: 'job_3',
    status: 'active',
    currentStepIndex: 0,
    steps: JOB_CLOSEOUT_TEMPLATE.map((step, index) => ({
      ...step,
      id: `step_${index + 1}`,
      status: index === 0 ? 'executing' : 'pending',
    })),
    startedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    nextActionAt: new Date().toISOString(),
    context: {
      jobId: 'job_3',
      jobTitle: 'Keukenrenovatie',
      customerId: 'cust_3',
      customerName: 'Familie Visser',
      customerEmail: 'visser@email.nl',
      completionDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quotedAmount: 1627.45,
      materialsUsed: [
        { name: 'Verf', cost: 245 },
      ],
      hoursWorked: 20,
      hasBeforePhotos: true,
      hasAfterPhotos: true,
      invoiceGenerated: false,
      warrantyGenerated: false,
      reviewRequested: false,
      satisfactionCheckScheduled: false,
    } as JobCloseoutContext,
    actionsExecuted: [],
  },
  // Completed workflow
  {
    id: 'wf_4',
    type: 'quote-nurture',
    name: 'Offerte opvolging - Familie Pietersen',
    description: 'Geconverteerd naar klus',
    entityType: 'quote',
    entityId: 'quote_old_1',
    status: 'completed',
    currentStepIndex: 2,
    steps: QUOTE_NURTURE_TEMPLATE.slice(0, 2).map((step, index) => ({
      ...step,
      id: `step_${index + 1}`,
      status: 'completed',
      executedAt: new Date(Date.now() - (14 - index * 3) * 24 * 60 * 60 * 1000).toISOString(),
    })),
    startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    context: {
      quoteId: 'quote_old_1',
      customerId: 'cust_4',
      customerName: 'Familie Pietersen',
      quoteAmount: 3200,
      quoteSentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      quoteViewed: true,
      viewCount: 3,
      remindersSent: 1,
      customerResponded: true,
      customerResponse: 'Akkoord met offerte',
      similarQuotesConversionRate: 72,
      optimalFollowupDays: 5,
    } as QuoteNurtureContext,
    actionsExecuted: [
      {
        stepId: 'step_1',
        actionType: 'send-email',
        executedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
        success: true,
        autoApproved: false,
        approvedBy: 'contractor_1',
      },
    ],
    outcome: {
      success: true,
      resultType: 'converted',
      summary: 'Offerte geaccepteerd na 1 opvolgmail',
      metrics: { daysToConversion: 4, remindersNeeded: 1 },
    },
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class WorkflowAgentsService {
  private workflows: Map<string, Workflow> = new Map();
  private config: WorkflowEngineConfig = DEFAULT_WORKFLOW_CONFIG;
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_WORKFLOWS.forEach((wf) => this.workflows.set(wf.id, wf));
  }

  // -----------------------------------------
  // Workflow Management
  // -----------------------------------------

  getWorkflows(filter?: {
    type?: WorkflowType[];
    status?: WorkflowStatus[];
    entityType?: string;
    entityId?: string;
  }): Workflow[] {
    let workflows = Array.from(this.workflows.values());

    if (filter?.type?.length) {
      workflows = workflows.filter((wf) => filter.type!.includes(wf.type));
    }
    if (filter?.status?.length) {
      workflows = workflows.filter((wf) => filter.status!.includes(wf.status));
    }
    if (filter?.entityType) {
      workflows = workflows.filter((wf) => wf.entityType === filter.entityType);
    }
    if (filter?.entityId) {
      workflows = workflows.filter((wf) => wf.entityId === filter.entityId);
    }

    return workflows.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }

  getWorkflowById(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getActiveWorkflows(): Workflow[] {
    return this.getWorkflows({ status: ['active'] });
  }

  getWorkflowsAwaitingApproval(): Workflow[] {
    return this.getActiveWorkflows().filter((wf) => {
      const currentStep = wf.steps[wf.currentStepIndex];
      return currentStep?.status === 'executing' && currentStep?.action.requiresApproval;
    });
  }

  // -----------------------------------------
  // Workflow Actions
  // -----------------------------------------

  startWorkflow(
    type: WorkflowType,
    entityId: string,
    context: Record<string, unknown>
  ): Workflow {
    const id = `wf_${Date.now()}`;

    // Get template based on type
    let steps: WorkflowStep[] = [];
    if (type === 'quote-nurture') {
      steps = QUOTE_NURTURE_TEMPLATE.map((step, index) => ({
        ...step,
        id: `${id}_step_${index + 1}`,
        status: 'pending' as const,
      }));
    } else if (type === 'cash-collection') {
      steps = CASH_COLLECTION_TEMPLATE.map((step, index) => ({
        ...step,
        id: `${id}_step_${index + 1}`,
        status: 'pending' as const,
      }));
    } else if (type === 'job-closeout') {
      steps = JOB_CLOSEOUT_TEMPLATE.map((step, index) => ({
        ...step,
        id: `${id}_step_${index + 1}`,
        status: 'pending' as const,
      }));
    }

    const workflow: Workflow = {
      id,
      type,
      name: `${this.getWorkflowTypeName(type)} - ${context.customerName || context.materialName || 'Nieuw'}`,
      description: '',
      entityType: this.getEntityTypeForWorkflow(type),
      entityId,
      status: 'active',
      currentStepIndex: 0,
      steps,
      startedAt: new Date().toISOString(),
      context,
      actionsExecuted: [],
    };

    this.workflows.set(id, workflow);
    this.notifyListeners();

    return workflow;
  }

  pauseWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'active') return false;

    workflow.status = 'paused';
    workflow.pausedAt = new Date().toISOString();
    this.notifyListeners();
    return true;
  }

  resumeWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'paused') return false;

    workflow.status = 'active';
    workflow.pausedAt = undefined;
    this.notifyListeners();
    return true;
  }

  cancelWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    workflow.status = 'cancelled';
    this.notifyListeners();
    return true;
  }

  approveStep(workflowId: string, stepId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step || step.status !== 'executing') return false;

    // Mark step as completed
    step.status = 'completed';
    step.executedAt = new Date().toISOString();

    // Log action
    workflow.actionsExecuted.push({
      stepId,
      actionType: step.action.type,
      executedAt: new Date().toISOString(),
      success: true,
      autoApproved: false,
      approvedBy: 'contractor_1',
    });

    // Move to next step
    workflow.currentStepIndex++;

    // Check if workflow is complete
    if (workflow.currentStepIndex >= workflow.steps.length) {
      workflow.status = 'completed';
      workflow.completedAt = new Date().toISOString();
      workflow.outcome = {
        success: true,
        resultType: 'completed',
        summary: 'Workflow succesvol afgerond',
      };
    } else {
      // Set next step to waiting or executing
      const nextStep = workflow.steps[workflow.currentStepIndex];
      nextStep.status = nextStep.action.requiresApproval ? 'executing' : 'waiting';
    }

    this.notifyListeners();
    return true;
  }

  skipStep(workflowId: string, stepId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;

    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step) return false;

    step.status = 'skipped';
    workflow.currentStepIndex++;

    if (workflow.currentStepIndex >= workflow.steps.length) {
      workflow.status = 'completed';
      workflow.completedAt = new Date().toISOString();
    }

    this.notifyListeners();
    return true;
  }

  // -----------------------------------------
  // Analytics
  // -----------------------------------------

  getAnalytics(type: WorkflowType, period: 'week' | 'month' | 'quarter' = 'month'): WorkflowAnalytics {
    const workflows = this.getWorkflows({ type: [type] });

    const completed = workflows.filter((wf) => wf.status === 'completed');
    const failed = workflows.filter((wf) => wf.status === 'failed');
    const cancelled = workflows.filter((wf) => wf.status === 'cancelled');

    const successful = completed.filter((wf) => wf.outcome?.success);
    const successRate = completed.length > 0 ? (successful.length / completed.length) * 100 : 0;

    const durations = completed
      .filter((wf) => wf.completedAt)
      .map((wf) => {
        const start = new Date(wf.startedAt).getTime();
        const end = new Date(wf.completedAt!).getTime();
        return (end - start) / (1000 * 60 * 60 * 24);
      });

    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    const totalActions = workflows.reduce((sum, wf) => sum + wf.actionsExecuted.length, 0);
    const approvedActions = workflows.reduce(
      (sum, wf) => sum + wf.actionsExecuted.filter((a) => !a.autoApproved).length,
      0
    );

    let analytics: WorkflowAnalytics = {
      workflowType: type,
      period,
      totalStarted: workflows.length,
      totalCompleted: completed.length,
      totalFailed: failed.length,
      totalCancelled: cancelled.length,
      successRate,
      avgDurationDays: avgDuration,
      totalActionsExecuted: totalActions,
      approvalRate: totalActions > 0 ? (approvedActions / totalActions) * 100 : 0,
      avgActionsPerWorkflow: workflows.length > 0 ? totalActions / workflows.length : 0,
    };

    // Type-specific metrics
    if (type === 'quote-nurture') {
      const converted = successful.filter((wf) => wf.outcome?.resultType === 'converted');
      analytics.conversionRate = completed.length > 0 ? (converted.length / completed.length) * 100 : 0;
    } else if (type === 'cash-collection') {
      const paid = successful.filter((wf) => wf.outcome?.resultType === 'paid');
      analytics.collectionRate = completed.length > 0 ? (paid.length / completed.length) * 100 : 0;
      analytics.avgDaysToPayment = avgDuration;
    }

    return analytics;
  }

  // -----------------------------------------
  // Helpers
  // -----------------------------------------

  private getWorkflowTypeName(type: WorkflowType): string {
    const names: Record<WorkflowType, string> = {
      'quote-nurture': 'Offerte opvolging',
      'cash-collection': 'Incasso',
      'job-closeout': 'Klus afronding',
      'material-reorder': 'Materiaal bestelling',
      'compliance-renewal': 'Certificaat verlenging',
      'customer-lifecycle': 'Klant opvolging',
      'review-generation': 'Review aanvraag',
    };
    return names[type] || type;
  }

  private getEntityTypeForWorkflow(type: WorkflowType): Workflow['entityType'] {
    const mapping: Record<WorkflowType, Workflow['entityType']> = {
      'quote-nurture': 'quote',
      'cash-collection': 'invoice',
      'job-closeout': 'job',
      'material-reorder': 'material',
      'compliance-renewal': 'certification',
      'customer-lifecycle': 'customer',
      'review-generation': 'job',
    };
    return mapping[type] || 'customer';
  }

  // -----------------------------------------
  // Configuration
  // -----------------------------------------

  getConfig(): WorkflowEngineConfig {
    return this.config;
  }

  updateConfig(updates: Partial<WorkflowEngineConfig>): void {
    this.config = { ...this.config, ...updates };
    this.notifyListeners();
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

export const workflowAgentsService = new WorkflowAgentsService();

// ============================================
// REACT HOOKS
// ============================================

export function useWorkflows(filter?: {
  type?: WorkflowType[];
  status?: WorkflowStatus[];
  entityType?: string;
  entityId?: string;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>(() =>
    workflowAgentsService.getWorkflows(filter)
  );

  useEffect(() => {
    const unsubscribe = workflowAgentsService.subscribe(() => {
      setWorkflows(workflowAgentsService.getWorkflows(filter));
    });
    return unsubscribe;
  }, [filter?.type?.join(','), filter?.status?.join(','), filter?.entityType, filter?.entityId]);

  const start = useCallback(
    (type: WorkflowType, entityId: string, context: Record<string, unknown>) => {
      return workflowAgentsService.startWorkflow(type, entityId, context);
    },
    []
  );

  const pause = useCallback((workflowId: string) => {
    return workflowAgentsService.pauseWorkflow(workflowId);
  }, []);

  const resume = useCallback((workflowId: string) => {
    return workflowAgentsService.resumeWorkflow(workflowId);
  }, []);

  const cancel = useCallback((workflowId: string) => {
    return workflowAgentsService.cancelWorkflow(workflowId);
  }, []);

  return { workflows, start, pause, resume, cancel };
}

export function useActiveWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>(() =>
    workflowAgentsService.getActiveWorkflows()
  );

  useEffect(() => {
    const unsubscribe = workflowAgentsService.subscribe(() => {
      setWorkflows(workflowAgentsService.getActiveWorkflows());
    });
    return unsubscribe;
  }, []);

  const awaitingApproval = useMemo(
    () => workflowAgentsService.getWorkflowsAwaitingApproval(),
    [workflows]
  );

  return { workflows, awaitingApproval };
}

export function useWorkflowActions(workflowId: string) {
  const approveStep = useCallback(
    (stepId: string) => {
      return workflowAgentsService.approveStep(workflowId, stepId);
    },
    [workflowId]
  );

  const skipStep = useCallback(
    (stepId: string) => {
      return workflowAgentsService.skipStep(workflowId, stepId);
    },
    [workflowId]
  );

  return { approveStep, skipStep };
}

export function useWorkflowAnalytics(type: WorkflowType, period: 'week' | 'month' | 'quarter' = 'month') {
  return useMemo(
    () => workflowAgentsService.getAnalytics(type, period),
    [type, period]
  );
}
