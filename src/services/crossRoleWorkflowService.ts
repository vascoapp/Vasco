// =============================================================================
// CROSS-ROLE WORKFLOW SERVICE
// =============================================================================
// Orchestrates workflows that span multiple roles in the Vasco platform
// Implements Phase 4 Integration & Cross-Role Workflows (a16z)
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { registerSingletonReset } from './singletonReset';

// ============================================
// TYPES
// ============================================

export type WorkflowType =
  | 'job-to-payment'           // Contractor job completion → CFO payment release
  | 'supplier-escalation'      // Site Lead issue → COO/CFO escalation
  | 'permit-approval'          // COO permit request → Director approval
  | 'risk-escalation';         // Any role risk flag → Director notification

export type WorkflowStatus =
  | 'initiated'
  | 'in-progress'
  | 'pending-review'
  | 'pending-approval'
  | 'pending-signoff'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type WorkflowStepStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'skipped'
  | 'blocked'
  | 'failed';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  assignedRole: 'contractor' | 'site-lead' | 'coo' | 'cfo' | 'director';
  status: WorkflowStepStatus;
  order: number;
  requiredForCompletion: boolean;

  // Timing
  startedAt?: string;
  completedAt?: string;
  dueBy?: string;

  // Assignment
  assignedUserId?: string;
  assignedUserName?: string;

  // Dependencies
  dependsOn?: string[];  // Step IDs that must complete first

  // Data
  inputData?: Record<string, unknown>;
  outputData?: Record<string, unknown>;

  // Notes
  notes?: string;
  rejectionReason?: string;
}

export interface Workflow {
  id: string;
  type: WorkflowType;
  status: WorkflowStatus;

  // Context
  title: string;
  description: string;
  projectId?: string;
  projectName?: string;
  jobId?: string;

  // Financial
  amount?: number;
  currency?: 'GBP' | 'EUR';

  // Steps
  steps: WorkflowStep[];
  currentStepId: string;

  // Participants
  initiatedBy: {
    userId: string;
    userName: string;
    role: string;
  };
  participants: {
    userId: string;
    userName: string;
    role: string;
    stepIds: string[];
  }[];

  // Timing
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  dueBy?: string;

  // Linked items
  evidencePackId?: string;
  handoverPackageId?: string;
  paymentId?: string;
  supplierId?: string;

  // Audit
  history: WorkflowHistoryEntry[];
}

export interface WorkflowHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  performedBy: {
    userId: string;
    userName: string;
    role: string;
  };
  stepId?: string;
  details?: string;
  previousStatus?: WorkflowStatus;
  newStatus?: WorkflowStatus;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf-001',
    type: 'job-to-payment',
    status: 'pending-signoff',
    title: 'M&E First Fix - Payment Release',
    description: 'Job completion and payment release workflow for M&E First Fix at Meridian Tower',
    projectId: 'uk-001',
    projectName: 'Meridian Tower',
    jobId: 'job-mep-001',
    amount: 185000,
    currency: 'GBP',
    steps: [
      {
        id: 'step-1',
        name: 'Complete Work',
        description: 'Contractor completes all work items for the job',
        assignedRole: 'contractor',
        status: 'completed',
        order: 1,
        requiredForCompletion: true,
        startedAt: '2025-01-15T08:00:00Z',
        completedAt: '2025-01-28T16:00:00Z',
        assignedUserId: 'contractor-001',
        assignedUserName: 'BuildRight Ltd',
      },
      {
        id: 'step-2',
        name: 'Upload Evidence',
        description: 'Upload photos, documents, and complete checklists',
        assignedRole: 'contractor',
        status: 'completed',
        order: 2,
        requiredForCompletion: true,
        dependsOn: ['step-1'],
        startedAt: '2025-01-28T16:00:00Z',
        completedAt: '2025-01-28T17:30:00Z',
        assignedUserId: 'contractor-001',
        assignedUserName: 'BuildRight Ltd',
      },
      {
        id: 'step-3',
        name: 'Site Verification',
        description: 'Site Lead verifies work quality and completeness on site',
        assignedRole: 'site-lead',
        status: 'completed',
        order: 3,
        requiredForCompletion: true,
        dependsOn: ['step-2'],
        startedAt: '2025-01-29T09:00:00Z',
        completedAt: '2025-01-29T11:00:00Z',
        assignedUserId: 'site-lead-001',
        assignedUserName: 'Mike Thompson',
      },
      {
        id: 'step-4',
        name: 'Customer Sign-off',
        description: 'Customer reviews handover pack and provides sign-off',
        assignedRole: 'contractor',
        status: 'in-progress',
        order: 4,
        requiredForCompletion: true,
        dependsOn: ['step-3'],
        startedAt: '2025-01-29T14:00:00Z',
        dueBy: '2025-02-01T17:00:00Z',
      },
      {
        id: 'step-5',
        name: 'Payment Approval',
        description: 'CFO reviews completed handover and approves payment release',
        assignedRole: 'cfo',
        status: 'pending',
        order: 5,
        requiredForCompletion: true,
        dependsOn: ['step-4'],
        assignedUserId: 'cfo-001',
        assignedUserName: 'Sarah Chen',
      },
      {
        id: 'step-6',
        name: 'Payment Released',
        description: 'Payment is processed and funds transferred',
        assignedRole: 'cfo',
        status: 'pending',
        order: 6,
        requiredForCompletion: true,
        dependsOn: ['step-5'],
      },
    ],
    currentStepId: 'step-4',
    initiatedBy: {
      userId: 'contractor-001',
      userName: 'BuildRight Ltd',
      role: 'contractor',
    },
    participants: [
      { userId: 'contractor-001', userName: 'BuildRight Ltd', role: 'contractor', stepIds: ['step-1', 'step-2', 'step-4'] },
      { userId: 'site-lead-001', userName: 'Mike Thompson', role: 'site-lead', stepIds: ['step-3'] },
      { userId: 'cfo-001', userName: 'Sarah Chen', role: 'cfo', stepIds: ['step-5', 'step-6'] },
    ],
    createdAt: '2025-01-15T08:00:00Z',
    updatedAt: '2025-01-29T14:00:00Z',
    dueBy: '2025-02-05T17:00:00Z',
    evidencePackId: 'ep-001',
    handoverPackageId: 'hp-001',
    history: [
      {
        id: 'hist-1',
        timestamp: '2025-01-15T08:00:00Z',
        action: 'Workflow initiated',
        performedBy: { userId: 'contractor-001', userName: 'BuildRight Ltd', role: 'contractor' },
        previousStatus: undefined,
        newStatus: 'initiated',
      },
      {
        id: 'hist-2',
        timestamp: '2025-01-28T16:00:00Z',
        action: 'Work completed',
        performedBy: { userId: 'contractor-001', userName: 'BuildRight Ltd', role: 'contractor' },
        stepId: 'step-1',
        details: 'All work items marked complete',
      },
      {
        id: 'hist-3',
        timestamp: '2025-01-28T17:30:00Z',
        action: 'Evidence pack assembled',
        performedBy: { userId: 'contractor-001', userName: 'BuildRight Ltd', role: 'contractor' },
        stepId: 'step-2',
        details: '12 photos, 3 documents uploaded',
      },
      {
        id: 'hist-4',
        timestamp: '2025-01-29T11:00:00Z',
        action: 'Site verification passed',
        performedBy: { userId: 'site-lead-001', userName: 'Mike Thompson', role: 'site-lead' },
        stepId: 'step-3',
        details: 'Quality inspection passed, no defects found',
      },
    ],
  },
  {
    id: 'wf-002',
    type: 'job-to-payment',
    status: 'in-progress',
    title: 'Curtain Wall Section A - Payment Release',
    description: 'Job completion and payment release workflow for facade work at Thames View',
    projectId: 'nl-001',
    projectName: 'Thames View',
    jobId: 'job-facade-001',
    amount: 420000,
    currency: 'GBP',
    steps: [
      {
        id: 'step-1',
        name: 'Complete Work',
        description: 'Contractor completes all work items for the job',
        assignedRole: 'contractor',
        status: 'completed',
        order: 1,
        requiredForCompletion: true,
        completedAt: '2025-01-25T16:00:00Z',
        assignedUserId: 'contractor-002',
        assignedUserName: 'Elite Facades',
      },
      {
        id: 'step-2',
        name: 'Upload Evidence',
        description: 'Upload photos, documents, and complete checklists',
        assignedRole: 'contractor',
        status: 'in-progress',
        order: 2,
        requiredForCompletion: true,
        dependsOn: ['step-1'],
        startedAt: '2025-01-26T09:00:00Z',
        assignedUserId: 'contractor-002',
        assignedUserName: 'Elite Facades',
        notes: 'Awaiting as-built drawings from subcontractor',
      },
      {
        id: 'step-3',
        name: 'Site Verification',
        description: 'Site Lead verifies work quality and completeness on site',
        assignedRole: 'site-lead',
        status: 'pending',
        order: 3,
        requiredForCompletion: true,
        dependsOn: ['step-2'],
      },
      {
        id: 'step-4',
        name: 'Customer Sign-off',
        description: 'Customer reviews handover pack and provides sign-off',
        assignedRole: 'contractor',
        status: 'pending',
        order: 4,
        requiredForCompletion: true,
        dependsOn: ['step-3'],
      },
      {
        id: 'step-5',
        name: 'Payment Approval',
        description: 'CFO reviews completed handover and approves payment release',
        assignedRole: 'cfo',
        status: 'pending',
        order: 5,
        requiredForCompletion: true,
        dependsOn: ['step-4'],
      },
      {
        id: 'step-6',
        name: 'Payment Released',
        description: 'Payment is processed and funds transferred',
        assignedRole: 'cfo',
        status: 'pending',
        order: 6,
        requiredForCompletion: true,
        dependsOn: ['step-5'],
      },
    ],
    currentStepId: 'step-2',
    initiatedBy: {
      userId: 'contractor-002',
      userName: 'Elite Facades',
      role: 'contractor',
    },
    participants: [
      { userId: 'contractor-002', userName: 'Elite Facades', role: 'contractor', stepIds: ['step-1', 'step-2', 'step-4'] },
      { userId: 'site-lead-002', userName: 'Tom Richards', role: 'site-lead', stepIds: ['step-3'] },
      { userId: 'cfo-001', userName: 'Sarah Chen', role: 'cfo', stepIds: ['step-5', 'step-6'] },
    ],
    createdAt: '2025-01-20T08:00:00Z',
    updatedAt: '2025-01-26T09:00:00Z',
    dueBy: '2025-02-10T17:00:00Z',
    history: [],
  },
  // Supplier Escalation Workflow Example
  {
    id: 'wf-003',
    type: 'supplier-escalation',
    status: 'pending-review',
    title: 'Supplier Quality Issue - BuildMart Supplies',
    description: 'Quality issue escalation for defective materials from BuildMart Supplies',
    projectId: 'uk-001',
    projectName: 'Meridian Tower',
    amount: 45000,
    currency: 'GBP',
    supplierId: 'sup-1',
    steps: [
      {
        id: 'step-1',
        name: 'Report Issue',
        description: 'Site Lead reports supplier issue with evidence',
        assignedRole: 'site-lead',
        status: 'completed',
        order: 1,
        requiredForCompletion: true,
        startedAt: '2025-01-28T09:00:00Z',
        completedAt: '2025-01-28T09:30:00Z',
        assignedUserId: 'site-lead-001',
        assignedUserName: 'Mike Thompson',
        outputData: {
          issueType: 'quality',
          description: 'Steel reinforcement bars below spec - 10% of batch affected',
          photosUploaded: 4,
        },
      },
      {
        id: 'step-2',
        name: 'COO Review',
        description: 'COO reviews issue and determines procurement action',
        assignedRole: 'coo',
        status: 'in-progress',
        order: 2,
        requiredForCompletion: true,
        dependsOn: ['step-1'],
        startedAt: '2025-01-28T10:00:00Z',
        assignedUserId: 'coo-001',
        assignedUserName: 'James Morrison',
      },
      {
        id: 'step-3',
        name: 'Supplier Contact',
        description: 'Contact supplier for resolution (replacement/refund)',
        assignedRole: 'coo',
        status: 'pending',
        order: 3,
        requiredForCompletion: true,
        dependsOn: ['step-2'],
      },
      {
        id: 'step-4',
        name: 'CFO Approval',
        description: 'CFO approves financial impact and credit/refund processing',
        assignedRole: 'cfo',
        status: 'pending',
        order: 4,
        requiredForCompletion: false,  // Only if financial impact
        dependsOn: ['step-3'],
        assignedUserId: 'cfo-001',
        assignedUserName: 'Sarah Chen',
      },
      {
        id: 'step-5',
        name: 'Resolution',
        description: 'Issue resolved - replacement received or alternative sourced',
        assignedRole: 'coo',
        status: 'pending',
        order: 5,
        requiredForCompletion: true,
        dependsOn: ['step-3'],
      },
      {
        id: 'step-6',
        name: 'Update Supplier Rating',
        description: 'Update supplier reliability score based on resolution',
        assignedRole: 'coo',
        status: 'pending',
        order: 6,
        requiredForCompletion: true,
        dependsOn: ['step-5'],
      },
    ],
    currentStepId: 'step-2',
    initiatedBy: {
      userId: 'site-lead-001',
      userName: 'Mike Thompson',
      role: 'site-lead',
    },
    participants: [
      { userId: 'site-lead-001', userName: 'Mike Thompson', role: 'site-lead', stepIds: ['step-1'] },
      { userId: 'coo-001', userName: 'James Morrison', role: 'coo', stepIds: ['step-2', 'step-3', 'step-5', 'step-6'] },
      { userId: 'cfo-001', userName: 'Sarah Chen', role: 'cfo', stepIds: ['step-4'] },
    ],
    createdAt: '2025-01-28T09:00:00Z',
    updatedAt: '2025-01-28T10:00:00Z',
    dueBy: '2025-02-03T17:00:00Z',
    history: [
      {
        id: 'hist-1',
        timestamp: '2025-01-28T09:00:00Z',
        action: 'Supplier issue reported',
        performedBy: { userId: 'site-lead-001', userName: 'Mike Thompson', role: 'site-lead' },
        previousStatus: undefined,
        newStatus: 'initiated',
        details: 'Quality issue with steel reinforcement - defective batch identified',
      },
      {
        id: 'hist-2',
        timestamp: '2025-01-28T09:30:00Z',
        action: 'Evidence uploaded',
        performedBy: { userId: 'site-lead-001', userName: 'Mike Thompson', role: 'site-lead' },
        stepId: 'step-1',
        details: '4 photos documenting defects',
      },
      {
        id: 'hist-3',
        timestamp: '2025-01-28T10:00:00Z',
        action: 'Escalated to COO',
        performedBy: { userId: 'system', userName: 'System', role: 'system' },
        newStatus: 'pending-review',
        details: 'Issue routed to COO for procurement decision',
      },
    ],
  },
];

// ============================================
// SERVICE CLASS
// ============================================

type WorkflowListener = () => void;

class CrossRoleWorkflowService {
  private static instance: CrossRoleWorkflowService;
  private listeners: Set<WorkflowListener> = new Set();
  private workflows: Map<string, Workflow> = new Map();

  constructor() {
    MOCK_WORKFLOWS.forEach(wf => this.workflows.set(wf.id, wf));
  }

  static getInstance(): CrossRoleWorkflowService {
    if (!CrossRoleWorkflowService.instance) {
      CrossRoleWorkflowService.instance = new CrossRoleWorkflowService();
      registerSingletonReset(() => {
        const inst = CrossRoleWorkflowService.instance;
        inst.workflows.clear();
        MOCK_WORKFLOWS.forEach((wf) => inst.workflows.set(wf.id, wf));
        inst.listeners.forEach((l) => l());
      });
    }
    return CrossRoleWorkflowService.instance;
  }

  subscribe(listener: WorkflowListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  // ----------------------------------------
  // WORKFLOW QUERIES
  // ----------------------------------------

  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  getWorkflowsByType(type: WorkflowType): Workflow[] {
    return this.getAllWorkflows().filter(wf => wf.type === type);
  }

  getWorkflowsByStatus(status: WorkflowStatus): Workflow[] {
    return this.getAllWorkflows().filter(wf => wf.status === status);
  }

  getWorkflowsForRole(role: string): Workflow[] {
    return this.getAllWorkflows().filter(wf =>
      wf.participants.some(p => p.role === role) ||
      wf.steps.some(s => s.assignedRole === role && s.status !== 'completed')
    );
  }

  getWorkflowsForUser(userId: string): Workflow[] {
    return this.getAllWorkflows().filter(wf =>
      wf.participants.some(p => p.userId === userId)
    );
  }

  getPendingWorkflowsForRole(role: string): Workflow[] {
    return this.getAllWorkflows().filter(wf => {
      const currentStep = wf.steps.find(s => s.id === wf.currentStepId);
      return currentStep?.assignedRole === role &&
             (currentStep.status === 'pending' || currentStep.status === 'in-progress');
    });
  }

  // ----------------------------------------
  // JOB TO PAYMENT WORKFLOW
  // ----------------------------------------

  /**
   * Initiates a job-to-payment workflow when a contractor marks a job complete
   */
  initiateJobToPaymentWorkflow(params: {
    jobId: string;
    jobTitle: string;
    projectId: string;
    projectName: string;
    contractorId: string;
    contractorName: string;
    amount: number;
    currency: 'GBP' | 'EUR';
    siteLeadId?: string;
    siteLeadName?: string;
    cfoId?: string;
    cfoName?: string;
  }): Workflow {
    const workflowId = `wf-${Date.now()}`;
    const now = new Date().toISOString();

    const workflow: Workflow = {
      id: workflowId,
      type: 'job-to-payment',
      status: 'initiated',
      title: `${params.jobTitle} - Payment Release`,
      description: `Job completion and payment release workflow for ${params.jobTitle} at ${params.projectName}`,
      projectId: params.projectId,
      projectName: params.projectName,
      jobId: params.jobId,
      amount: params.amount,
      currency: params.currency,
      steps: [
        {
          id: 'step-1',
          name: 'Complete Work',
          description: 'Contractor completes all work items for the job',
          assignedRole: 'contractor',
          status: 'completed',  // Already done when workflow initiated
          order: 1,
          requiredForCompletion: true,
          startedAt: now,
          completedAt: now,
          assignedUserId: params.contractorId,
          assignedUserName: params.contractorName,
        },
        {
          id: 'step-2',
          name: 'Upload Evidence',
          description: 'Upload photos, documents, and complete checklists',
          assignedRole: 'contractor',
          status: 'in-progress',
          order: 2,
          requiredForCompletion: true,
          dependsOn: ['step-1'],
          startedAt: now,
          assignedUserId: params.contractorId,
          assignedUserName: params.contractorName,
        },
        {
          id: 'step-3',
          name: 'Site Verification',
          description: 'Site Lead verifies work quality and completeness on site',
          assignedRole: 'site-lead',
          status: 'pending',
          order: 3,
          requiredForCompletion: true,
          dependsOn: ['step-2'],
          assignedUserId: params.siteLeadId,
          assignedUserName: params.siteLeadName,
        },
        {
          id: 'step-4',
          name: 'Customer Sign-off',
          description: 'Customer reviews handover pack and provides sign-off',
          assignedRole: 'contractor',
          status: 'pending',
          order: 4,
          requiredForCompletion: true,
          dependsOn: ['step-3'],
        },
        {
          id: 'step-5',
          name: 'Payment Approval',
          description: 'CFO reviews completed handover and approves payment release',
          assignedRole: 'cfo',
          status: 'pending',
          order: 5,
          requiredForCompletion: true,
          dependsOn: ['step-4'],
          assignedUserId: params.cfoId,
          assignedUserName: params.cfoName,
        },
        {
          id: 'step-6',
          name: 'Payment Released',
          description: 'Payment is processed and funds transferred',
          assignedRole: 'cfo',
          status: 'pending',
          order: 6,
          requiredForCompletion: true,
          dependsOn: ['step-5'],
        },
      ],
      currentStepId: 'step-2',
      initiatedBy: {
        userId: params.contractorId,
        userName: params.contractorName,
        role: 'contractor',
      },
      participants: [
        { userId: params.contractorId, userName: params.contractorName, role: 'contractor', stepIds: ['step-1', 'step-2', 'step-4'] },
      ],
      createdAt: now,
      updatedAt: now,
      history: [
        {
          id: `hist-${Date.now()}`,
          timestamp: now,
          action: 'Workflow initiated - Job marked complete',
          performedBy: { userId: params.contractorId, userName: params.contractorName, role: 'contractor' },
          previousStatus: undefined,
          newStatus: 'initiated',
        },
      ],
    };

    // Add site lead participant if provided
    if (params.siteLeadId && params.siteLeadName) {
      workflow.participants.push({
        userId: params.siteLeadId,
        userName: params.siteLeadName,
        role: 'site-lead',
        stepIds: ['step-3'],
      });
    }

    // Add CFO participant if provided
    if (params.cfoId && params.cfoName) {
      workflow.participants.push({
        userId: params.cfoId,
        userName: params.cfoName,
        role: 'cfo',
        stepIds: ['step-5', 'step-6'],
      });
    }

    this.workflows.set(workflow.id, workflow);
    trackUserAction('workflow_initiated', { type: 'job-to-payment', jobId: params.jobId });
    this.notify();

    return workflow;
  }

  // ----------------------------------------
  // SUPPLIER ESCALATION WORKFLOW
  // ----------------------------------------

  /**
   * Initiates a supplier issue escalation workflow
   * Flow: Site Lead → COO → CFO (if financial impact) → Resolution
   */
  initiateSupplierEscalationWorkflow(params: {
    supplierId: string;
    supplierName: string;
    projectId: string;
    projectName: string;
    issueType: 'quality' | 'delivery' | 'pricing' | 'communication' | 'other';
    issueDescription: string;
    estimatedImpact?: number;
    currency?: 'GBP' | 'EUR';
    siteLeadId: string;
    siteLeadName: string;
    cooId?: string;
    cooName?: string;
    cfoId?: string;
    cfoName?: string;
    photoUris?: string[];
  }): Workflow {
    const workflowId = `wf-${Date.now()}`;
    const now = new Date().toISOString();
    const hasFinancialImpact = (params.estimatedImpact || 0) > 0;

    const workflow: Workflow = {
      id: workflowId,
      type: 'supplier-escalation',
      status: 'initiated',
      title: `Supplier ${params.issueType.charAt(0).toUpperCase() + params.issueType.slice(1)} Issue - ${params.supplierName}`,
      description: params.issueDescription,
      projectId: params.projectId,
      projectName: params.projectName,
      amount: params.estimatedImpact,
      currency: params.currency || 'GBP',
      supplierId: params.supplierId,
      steps: [
        {
          id: 'step-1',
          name: 'Report Issue',
          description: 'Site Lead reports supplier issue with evidence',
          assignedRole: 'site-lead',
          status: 'completed',
          order: 1,
          requiredForCompletion: true,
          startedAt: now,
          completedAt: now,
          assignedUserId: params.siteLeadId,
          assignedUserName: params.siteLeadName,
          outputData: {
            issueType: params.issueType,
            description: params.issueDescription,
            photosUploaded: params.photoUris?.length || 0,
          },
        },
        {
          id: 'step-2',
          name: 'COO Review',
          description: 'COO reviews issue and determines procurement action',
          assignedRole: 'coo',
          status: 'in-progress',
          order: 2,
          requiredForCompletion: true,
          dependsOn: ['step-1'],
          startedAt: now,
          assignedUserId: params.cooId,
          assignedUserName: params.cooName,
        },
        {
          id: 'step-3',
          name: 'Supplier Contact',
          description: 'Contact supplier for resolution (replacement/refund)',
          assignedRole: 'coo',
          status: 'pending',
          order: 3,
          requiredForCompletion: true,
          dependsOn: ['step-2'],
        },
        {
          id: 'step-4',
          name: 'CFO Approval',
          description: 'CFO approves financial impact and credit/refund processing',
          assignedRole: 'cfo',
          status: 'pending',
          order: 4,
          requiredForCompletion: hasFinancialImpact,
          dependsOn: ['step-3'],
          assignedUserId: params.cfoId,
          assignedUserName: params.cfoName,
        },
        {
          id: 'step-5',
          name: 'Resolution',
          description: 'Issue resolved - replacement received or alternative sourced',
          assignedRole: 'coo',
          status: 'pending',
          order: 5,
          requiredForCompletion: true,
          dependsOn: hasFinancialImpact ? ['step-4'] : ['step-3'],
        },
        {
          id: 'step-6',
          name: 'Update Supplier Rating',
          description: 'Update supplier reliability score based on resolution',
          assignedRole: 'coo',
          status: 'pending',
          order: 6,
          requiredForCompletion: true,
          dependsOn: ['step-5'],
        },
      ],
      currentStepId: 'step-2',
      initiatedBy: {
        userId: params.siteLeadId,
        userName: params.siteLeadName,
        role: 'site-lead',
      },
      participants: [
        { userId: params.siteLeadId, userName: params.siteLeadName, role: 'site-lead', stepIds: ['step-1'] },
      ],
      createdAt: now,
      updatedAt: now,
      dueBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      history: [
        {
          id: `hist-${Date.now()}`,
          timestamp: now,
          action: 'Supplier issue reported',
          performedBy: { userId: params.siteLeadId, userName: params.siteLeadName, role: 'site-lead' },
          previousStatus: undefined,
          newStatus: 'initiated',
          details: `${params.issueType} issue: ${params.issueDescription}`,
        },
      ],
    };

    // Add COO participant if provided
    if (params.cooId && params.cooName) {
      workflow.participants.push({
        userId: params.cooId,
        userName: params.cooName,
        role: 'coo',
        stepIds: ['step-2', 'step-3', 'step-5', 'step-6'],
      });
    }

    // Add CFO participant if provided and financial impact
    if (hasFinancialImpact && params.cfoId && params.cfoName) {
      workflow.participants.push({
        userId: params.cfoId,
        userName: params.cfoName,
        role: 'cfo',
        stepIds: ['step-4'],
      });
    }

    this.workflows.set(workflow.id, workflow);
    trackUserAction('workflow_initiated', { type: 'supplier-escalation', supplierId: params.supplierId });
    this.notify();

    return workflow;
  }

  /**
   * Gets supplier escalation workflows
   */
  getSupplierEscalations(): Workflow[] {
    return this.getWorkflowsByType('supplier-escalation');
  }

  /**
   * Gets active supplier escalations (not completed or cancelled)
   */
  getActiveSupplierEscalations(): Workflow[] {
    return this.getSupplierEscalations().filter(
      wf => wf.status !== 'completed' && wf.status !== 'cancelled'
    );
  }

  // ----------------------------------------
  // STEP OPERATIONS
  // ----------------------------------------

  /**
   * Advances a workflow step to the next status
   */
  completeStep(
    workflowId: string,
    stepId: string,
    userId: string,
    userName: string,
    role: string,
    outputData?: Record<string, unknown>,
    notes?: string
  ): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return;

    // Update step
    step.status = 'completed';
    step.completedAt = new Date().toISOString();
    step.outputData = outputData;
    if (notes) step.notes = notes;

    // Add history entry
    workflow.history.push({
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: `Step completed: ${step.name}`,
      performedBy: { userId, userName, role },
      stepId,
      details: notes,
    });

    // Find and activate next step
    const nextStep = workflow.steps.find(s =>
      s.order === step.order + 1 && s.status === 'pending'
    );

    if (nextStep) {
      nextStep.status = 'in-progress';
      nextStep.startedAt = new Date().toISOString();
      workflow.currentStepId = nextStep.id;
      workflow.status = 'in-progress';
    } else {
      // All steps complete
      workflow.status = 'completed';
      workflow.completedAt = new Date().toISOString();
    }

    workflow.updatedAt = new Date().toISOString();
    trackUserAction('workflow_step_completed', { workflowId, stepId, role });
    this.notify();
  }

  /**
   * Links an evidence pack to a workflow
   */
  linkEvidencePack(workflowId: string, evidencePackId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.evidencePackId = evidencePackId;
      workflow.updatedAt = new Date().toISOString();
      this.notify();
    }
  }

  /**
   * Links a handover package to a workflow
   */
  linkHandoverPackage(workflowId: string, handoverPackageId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      workflow.handoverPackageId = handoverPackageId;
      workflow.updatedAt = new Date().toISOString();
      this.notify();
    }
  }

  /**
   * Approves payment in a job-to-payment workflow
   */
  approvePayment(
    workflowId: string,
    cfoId: string,
    cfoName: string,
    paymentId: string
  ): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.type !== 'job-to-payment') return;

    // Complete the payment approval step
    this.completeStep(workflowId, 'step-5', cfoId, cfoName, 'cfo', { approved: true });

    // Link payment
    workflow.paymentId = paymentId;

    // Add history
    workflow.history.push({
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'Payment approved',
      performedBy: { userId: cfoId, userName: cfoName, role: 'cfo' },
      details: `Payment of ${workflow.currency} ${workflow.amount?.toLocaleString()} approved`,
    });

    trackUserAction('workflow_payment_approved', { workflowId, amount: workflow.amount });
    this.notify();
  }

  /**
   * Releases payment (final step)
   */
  releasePayment(workflowId: string, cfoId: string, cfoName: string): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.type !== 'job-to-payment') return;

    // Complete the payment release step
    this.completeStep(workflowId, 'step-6', cfoId, cfoName, 'cfo', { released: true });

    workflow.status = 'completed';
    workflow.completedAt = new Date().toISOString();

    workflow.history.push({
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: 'Payment released',
      performedBy: { userId: cfoId, userName: cfoName, role: 'cfo' },
      details: `${workflow.currency} ${workflow.amount?.toLocaleString()} transferred to ${workflow.initiatedBy.userName}`,
    });

    trackUserAction('workflow_payment_released', { workflowId, amount: workflow.amount });
    this.notify();
  }

  // ----------------------------------------
  // STATISTICS
  // ----------------------------------------

  getWorkflowStats(): {
    total: number;
    byStatus: Record<WorkflowStatus, number>;
    byType: Record<WorkflowType, number>;
    pendingPaymentValue: number;
    averageCompletionDays: number;
  } {
    const workflows = this.getAllWorkflows();

    const byStatus = {} as Record<WorkflowStatus, number>;
    const byType = {} as Record<WorkflowType, number>;
    let pendingPaymentValue = 0;
    let totalCompletionDays = 0;
    let completedCount = 0;

    workflows.forEach(wf => {
      byStatus[wf.status] = (byStatus[wf.status] || 0) + 1;
      byType[wf.type] = (byType[wf.type] || 0) + 1;

      if (wf.type === 'job-to-payment' && wf.status !== 'completed' && wf.amount) {
        pendingPaymentValue += wf.amount;
      }

      if (wf.completedAt && wf.createdAt) {
        const days = Math.ceil(
          (new Date(wf.completedAt).getTime() - new Date(wf.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        totalCompletionDays += days;
        completedCount++;
      }
    });

    return {
      total: workflows.length,
      byStatus,
      byType,
      pendingPaymentValue,
      averageCompletionDays: completedCount > 0 ? Math.round(totalCompletionDays / completedCount) : 0,
    };
  }
}

export const crossRoleWorkflowService = CrossRoleWorkflowService.getInstance();

// ============================================
// REACT HOOKS
// ============================================

export function useWorkflow(workflowId: string | undefined) {
  const [workflow, setWorkflow] = useState<Workflow | undefined>(
    workflowId ? crossRoleWorkflowService.getWorkflow(workflowId) : undefined
  );

  useEffect(() => {
    if (workflowId) {
      setWorkflow(crossRoleWorkflowService.getWorkflow(workflowId));
    }
    return crossRoleWorkflowService.subscribe(() => {
      if (workflowId) {
        setWorkflow(crossRoleWorkflowService.getWorkflow(workflowId));
      }
    });
  }, [workflowId]);

  const completeStep = useCallback(
    (stepId: string, userId: string, userName: string, role: string, outputData?: Record<string, unknown>) => {
      if (workflowId) {
        crossRoleWorkflowService.completeStep(workflowId, stepId, userId, userName, role, outputData);
      }
    },
    [workflowId]
  );

  return { workflow, completeStep };
}

export function useWorkflowsForRole(role: string) {
  const [workflows, setWorkflows] = useState<Workflow[]>(
    crossRoleWorkflowService.getWorkflowsForRole(role)
  );

  useEffect(() => {
    setWorkflows(crossRoleWorkflowService.getWorkflowsForRole(role));
    return crossRoleWorkflowService.subscribe(() => {
      setWorkflows(crossRoleWorkflowService.getWorkflowsForRole(role));
    });
  }, [role]);

  return workflows;
}

export function usePendingWorkflows(role: string) {
  const [workflows, setWorkflows] = useState<Workflow[]>(
    crossRoleWorkflowService.getPendingWorkflowsForRole(role)
  );

  useEffect(() => {
    setWorkflows(crossRoleWorkflowService.getPendingWorkflowsForRole(role));
    return crossRoleWorkflowService.subscribe(() => {
      setWorkflows(crossRoleWorkflowService.getPendingWorkflowsForRole(role));
    });
  }, [role]);

  return workflows;
}

export function useJobToPaymentWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>(
    crossRoleWorkflowService.getWorkflowsByType('job-to-payment')
  );

  useEffect(() => {
    setWorkflows(crossRoleWorkflowService.getWorkflowsByType('job-to-payment'));
    return crossRoleWorkflowService.subscribe(() => {
      setWorkflows(crossRoleWorkflowService.getWorkflowsByType('job-to-payment'));
    });
  }, []);

  const initiateWorkflow = useCallback(
    (params: Parameters<typeof crossRoleWorkflowService.initiateJobToPaymentWorkflow>[0]) => {
      return crossRoleWorkflowService.initiateJobToPaymentWorkflow(params);
    },
    []
  );

  return { workflows, initiateWorkflow };
}

export function useWorkflowStats() {
  const [stats, setStats] = useState(crossRoleWorkflowService.getWorkflowStats());

  useEffect(() => {
    setStats(crossRoleWorkflowService.getWorkflowStats());
    return crossRoleWorkflowService.subscribe(() => {
      setStats(crossRoleWorkflowService.getWorkflowStats());
    });
  }, []);

  return stats;
}

export function useSupplierEscalations() {
  const [workflows, setWorkflows] = useState<Workflow[]>(
    crossRoleWorkflowService.getSupplierEscalations()
  );
  const [activeEscalations, setActiveEscalations] = useState<Workflow[]>(
    crossRoleWorkflowService.getActiveSupplierEscalations()
  );

  useEffect(() => {
    setWorkflows(crossRoleWorkflowService.getSupplierEscalations());
    setActiveEscalations(crossRoleWorkflowService.getActiveSupplierEscalations());
    return crossRoleWorkflowService.subscribe(() => {
      setWorkflows(crossRoleWorkflowService.getSupplierEscalations());
      setActiveEscalations(crossRoleWorkflowService.getActiveSupplierEscalations());
    });
  }, []);

  const initiateEscalation = useCallback(
    (params: Parameters<typeof crossRoleWorkflowService.initiateSupplierEscalationWorkflow>[0]) => {
      return crossRoleWorkflowService.initiateSupplierEscalationWorkflow(params);
    },
    []
  );

  return { workflows, activeEscalations, initiateEscalation };
}
