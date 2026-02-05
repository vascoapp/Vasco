/**
 * Evidence Graph Service
 *
 * Provides a formal graph structure linking:
 * Jobs → Evidence → Compliance → Payments
 *
 * Features:
 * 1. Graph node and edge management
 * 2. Evidence chain building and validation
 * 3. Compliance requirement tracking
 * 4. Payment release gates
 * 5. Graph traversal and querying
 * 6. Audit trail and provenance
 *
 * a16z Sphere pattern: "Evidence Graph for Decision Provenance"
 */

import { useState, useEffect, useCallback } from 'react';
import {
  NodeType,
  EdgeType,
  GraphNode,
  GraphEdge,
  NodeMetadata,
  EvidenceChain,
  ComplianceRequirement,
  ComplianceCategory,
  EvidenceNode,
  EvidenceNodeType,
  JobNode,
  JobNodeStatus,
  PaymentNode,
  PaymentType,
  PaymentNodeStatus,
  GraphQuery,
  GraphQueryResult,
  TraversalPath,
  PathStep,
  EvidenceValidation,
  RequirementResult,
  IntegrityIssue,
  PaymentReleaseGate,
  PaymentBlocker,
  GraphAnalytics,
  GraphEvent,
  GraphEventType,
  GraphSubscription,
} from '../types/evidence-graph';

// ============================================
// IN-MEMORY GRAPH STORE (Replace with DB)
// ============================================

interface GraphStore {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  events: GraphEvent[];
  subscriptions: Map<string, GraphSubscription>;
}

const store: GraphStore = {
  nodes: new Map(),
  edges: new Map(),
  events: [],
  subscriptions: new Map(),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function computeHash(content: string): Promise<string> {
  // In production, use crypto.subtle.digest
  const simpleHash = content.split('').reduce((hash, char) => {
    return ((hash << 5) - hash) + char.charCodeAt(0);
  }, 0);
  return Math.abs(simpleHash).toString(16).padStart(64, '0');
}

// ============================================
// SERVICE CLASS
// ============================================

class EvidenceGraphService {
  // ----------------------------------------
  // NODE OPERATIONS
  // ----------------------------------------

  async createNode(
    type: NodeType,
    label: string,
    data: Record<string, unknown>,
    createdBy: string,
    metadata?: NodeMetadata
  ): Promise<GraphNode> {
    const node: GraphNode = {
      id: generateId(type),
      type,
      label,
      data,
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'active',
      metadata: {
        version: 1,
        ...metadata,
      },
    };

    store.nodes.set(node.id, node);
    await this.emitEvent('node_created', { nodeId: node.id }, createdBy);

    return node;
  }

  async getNode(nodeId: string): Promise<GraphNode | null> {
    return store.nodes.get(nodeId) || null;
  }

  async updateNode(
    nodeId: string,
    updates: Partial<Pick<GraphNode, 'label' | 'data' | 'status' | 'metadata'>>,
    updatedBy: string
  ): Promise<GraphNode | null> {
    const node = store.nodes.get(nodeId);
    if (!node) return null;

    const previousState = { ...node };
    const updatedNode: GraphNode = {
      ...node,
      ...updates,
      metadata: {
        ...node.metadata,
        ...updates.metadata,
        version: (node.metadata?.version || 0) + 1,
      },
    };

    store.nodes.set(nodeId, updatedNode);
    await this.emitEvent('node_updated', {
      nodeId,
      previousState,
      newState: updatedNode,
    }, updatedBy);

    return updatedNode;
  }

  async deleteNode(nodeId: string, deletedBy: string): Promise<boolean> {
    const node = store.nodes.get(nodeId);
    if (!node) return false;

    // Archive rather than delete (for audit trail)
    node.status = 'archived';
    store.nodes.set(nodeId, node);

    // Revoke all edges
    for (const [edgeId, edge] of store.edges) {
      if (edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId) {
        edge.status = 'revoked';
        store.edges.set(edgeId, edge);
      }
    }

    await this.emitEvent('node_deleted', { nodeId }, deletedBy);
    return true;
  }

  // ----------------------------------------
  // EDGE OPERATIONS
  // ----------------------------------------

  async createEdge(
    type: EdgeType,
    sourceNodeId: string,
    targetNodeId: string,
    createdBy: string,
    options?: {
      label?: string;
      weight?: number;
      data?: Record<string, unknown>;
      validFrom?: string;
      validUntil?: string;
    }
  ): Promise<GraphEdge | null> {
    // Verify both nodes exist
    if (!store.nodes.has(sourceNodeId) || !store.nodes.has(targetNodeId)) {
      return null;
    }

    const edge: GraphEdge = {
      id: generateId('edge'),
      type,
      sourceNodeId,
      targetNodeId,
      label: options?.label,
      weight: options?.weight,
      data: options?.data,
      createdAt: new Date().toISOString(),
      createdBy,
      validFrom: options?.validFrom,
      validUntil: options?.validUntil,
      status: 'active',
    };

    store.edges.set(edge.id, edge);
    await this.emitEvent('edge_created', {
      edgeId: edge.id,
      sourceNodeId,
      targetNodeId,
    }, createdBy);

    return edge;
  }

  async revokeEdge(edgeId: string, revokedBy: string): Promise<boolean> {
    const edge = store.edges.get(edgeId);
    if (!edge) return false;

    edge.status = 'revoked';
    store.edges.set(edgeId, edge);

    await this.emitEvent('edge_revoked', { edgeId }, revokedBy);
    return true;
  }

  // ----------------------------------------
  // EVIDENCE NODE OPERATIONS
  // ----------------------------------------

  async createEvidenceNode(
    evidenceType: EvidenceNodeType,
    contentUri: string,
    contentHash: string,
    mimeType: string,
    size: number,
    linkedJobId: string,
    capturedBy: string,
    options?: {
      captureLocation?: EvidenceNode['captureLocation'];
      captureDevice?: string;
      linkedMilestoneId?: string;
      metadata?: NodeMetadata;
    }
  ): Promise<EvidenceNode> {
    const evidenceNode: EvidenceNode = {
      id: generateId('evidence'),
      type: 'evidence',
      label: `${evidenceType} for job ${linkedJobId}`,
      data: {},
      createdAt: new Date().toISOString(),
      createdBy: capturedBy,
      status: 'active',
      evidenceType,
      contentUri,
      contentHash,
      mimeType,
      size,
      capturedAt: new Date().toISOString(),
      capturedBy,
      captureLocation: options?.captureLocation,
      captureDevice: options?.captureDevice,
      linkedJobId,
      linkedMilestoneId: options?.linkedMilestoneId,
      complianceSatisfied: [],
      verified: false,
      metadata: options?.metadata,
    };

    store.nodes.set(evidenceNode.id, evidenceNode);

    // Create edge to job
    await this.createEdge('evidences', evidenceNode.id, linkedJobId, capturedBy);

    await this.emitEvent('node_created', {
      nodeId: evidenceNode.id,
      evidenceType,
      linkedJobId,
    }, capturedBy);

    return evidenceNode;
  }

  async verifyEvidence(
    evidenceNodeId: string,
    verifiedBy: string,
    notes?: string
  ): Promise<EvidenceNode | null> {
    const node = store.nodes.get(evidenceNodeId) as EvidenceNode;
    if (!node || node.type !== 'evidence') return null;

    node.verified = true;
    node.verifiedAt = new Date().toISOString();
    node.verifiedBy = verifiedBy;
    node.verificationNotes = notes;

    store.nodes.set(evidenceNodeId, node);

    await this.emitEvent('evidence_verified', {
      nodeId: evidenceNodeId,
      verifiedBy,
    }, verifiedBy);

    return node;
  }

  // ----------------------------------------
  // JOB NODE OPERATIONS
  // ----------------------------------------

  async createJobNode(
    jobId: string,
    title: string,
    contractorId: string,
    contractorName: string,
    customerId: string,
    customerName: string,
    createdBy: string,
    options?: {
      description?: string;
      contractValue?: number;
      currency?: 'GBP' | 'EUR';
      siteAddress?: string;
      siteCoordinates?: { latitude: number; longitude: number };
    }
  ): Promise<JobNode> {
    const jobNode: JobNode = {
      id: generateId('job'),
      type: 'job',
      label: title,
      data: {},
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'active',
      jobId,
      title,
      description: options?.description,
      jobStatus: 'draft',
      contractorId,
      contractorName,
      customerId,
      customerName,
      contractValue: options?.contractValue,
      currency: options?.currency,
      siteAddress: options?.siteAddress,
      siteCoordinates: options?.siteCoordinates,
      totalEvidence: 0,
      requiredEvidence: 0,
      verifiedEvidence: 0,
    };

    store.nodes.set(jobNode.id, jobNode);

    // Create edges to contractor and customer
    const contractorNode = await this.findNodeByExternalId('contractor', contractorId);
    const customerNode = await this.findNodeByExternalId('customer', customerId);

    if (contractorNode) {
      await this.createEdge('performed_by', jobNode.id, contractorNode.id, createdBy);
    }
    if (customerNode) {
      await this.createEdge('for', jobNode.id, customerNode.id, createdBy);
    }

    return jobNode;
  }

  async updateJobStatus(
    jobNodeId: string,
    newStatus: JobNodeStatus,
    updatedBy: string
  ): Promise<JobNode | null> {
    const node = store.nodes.get(jobNodeId) as JobNode;
    if (!node || node.type !== 'job') return null;

    const previousStatus = node.jobStatus;
    node.jobStatus = newStatus;

    if (newStatus === 'completed' && !node.completionDate) {
      node.completionDate = new Date().toISOString();
    }
    if (newStatus === 'in_progress' && !node.startDate) {
      node.startDate = new Date().toISOString();
    }

    store.nodes.set(jobNodeId, node);

    await this.emitEvent('node_updated', {
      nodeId: jobNodeId,
      previousStatus,
      newStatus,
    }, updatedBy);

    return node;
  }

  // ----------------------------------------
  // PAYMENT NODE OPERATIONS
  // ----------------------------------------

  async createPaymentNode(
    paymentId: string,
    jobId: string,
    amount: number,
    currency: 'GBP' | 'EUR',
    paymentType: PaymentType,
    createdBy: string,
    options?: {
      scheduledDate?: string;
      requiresApproval?: boolean;
      evidenceRequired?: boolean;
      invoiceId?: string;
    }
  ): Promise<PaymentNode> {
    const paymentNode: PaymentNode = {
      id: generateId('payment'),
      type: 'payment',
      label: `${paymentType} payment - ${currency}${amount}`,
      data: {},
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'active',
      paymentId,
      amount,
      currency,
      paymentType,
      paymentStatus: options?.scheduledDate ? 'scheduled' : 'pending_evidence',
      scheduledDate: options?.scheduledDate,
      jobId,
      invoiceId: options?.invoiceId,
      requiresApproval: options?.requiresApproval ?? true,
      approvalStatus: options?.requiresApproval ? 'pending' : undefined,
      evidenceRequired: options?.evidenceRequired ?? true,
      evidenceComplete: false,
      missingEvidence: [],
    };

    store.nodes.set(paymentNode.id, paymentNode);

    // Link to job
    const jobNode = await this.findNodeByExternalId('job', jobId);
    if (jobNode) {
      await this.createEdge('funds', paymentNode.id, jobNode.id, createdBy);
    }

    return paymentNode;
  }

  // ----------------------------------------
  // EVIDENCE CHAIN OPERATIONS
  // ----------------------------------------

  async buildEvidenceChain(jobNodeId: string): Promise<EvidenceChain> {
    const jobNode = store.nodes.get(jobNodeId) as JobNode;
    if (!jobNode || jobNode.type !== 'job') {
      throw new Error(`Job node ${jobNodeId} not found`);
    }

    // Collect all evidence linked to this job
    const evidenceNodes: GraphNode[] = [];
    const chainEdges: GraphEdge[] = [];

    for (const [edgeId, edge] of store.edges) {
      if (edge.status !== 'active') continue;

      if (edge.targetNodeId === jobNodeId && edge.type === 'evidences') {
        const evidenceNode = store.nodes.get(edge.sourceNodeId);
        if (evidenceNode && evidenceNode.status === 'active') {
          evidenceNodes.push(evidenceNode);
          chainEdges.push(edge);
        }
      }
    }

    // Get compliance requirements for this job type
    const requirements = await this.getComplianceRequirements(jobNode);

    // Check which requirements are satisfied
    const missingRequirements: ComplianceRequirement[] = [];
    for (const req of requirements) {
      const satisfied = evidenceNodes.some(n => {
        const en = n as EvidenceNode;
        return req.evidenceTypes.includes(en.evidenceType);
      });

      if (!satisfied && req.required) {
        missingRequirements.push(req);
      }
    }

    // Calculate verification stats
    const verifiedEvidence = evidenceNodes.filter(n => (n as EvidenceNode).verified).length;
    const complianceScore = requirements.length > 0
      ? Math.round(((requirements.length - missingRequirements.length) / requirements.length) * 100)
      : 100;

    // Determine payment readiness
    const blockingReasons: string[] = [];
    if (missingRequirements.length > 0) {
      blockingReasons.push(`Missing ${missingRequirements.length} required evidence items`);
    }
    if (verifiedEvidence < evidenceNodes.length) {
      blockingReasons.push(`${evidenceNodes.length - verifiedEvidence} evidence items not verified`);
    }

    const chain: EvidenceChain = {
      id: generateId('chain'),
      jobId: jobNode.jobId,
      jobTitle: jobNode.title,
      rootNode: jobNode,
      nodes: [jobNode, ...evidenceNodes],
      edges: chainEdges,
      isComplete: missingRequirements.length === 0,
      missingRequirements,
      verified: verifiedEvidence === evidenceNodes.length && evidenceNodes.length > 0,
      verificationMethod: 'automated',
      totalEvidence: evidenceNodes.length,
      verifiedEvidence,
      complianceScore,
      paymentReady: blockingReasons.length === 0,
      blockingReasons,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return chain;
  }

  private async getComplianceRequirements(jobNode: JobNode): Promise<ComplianceRequirement[]> {
    // Default compliance requirements - in production, load from config/database
    return [
      {
        id: 'req-photos-before',
        name: 'Before Photos',
        description: 'Photos of the site before work begins',
        category: 'quality',
        required: true,
        evidenceTypes: ['photo_before'],
        status: 'pending',
      },
      {
        id: 'req-photos-after',
        name: 'After Photos',
        description: 'Photos of the completed work',
        category: 'quality',
        required: true,
        evidenceTypes: ['photo_after'],
        status: 'pending',
      },
      {
        id: 'req-checklist',
        name: 'Completion Checklist',
        description: 'Signed completion checklist',
        category: 'contractual',
        required: true,
        evidenceTypes: ['checklist'],
        status: 'pending',
      },
      {
        id: 'req-signature',
        name: 'Customer Sign-off',
        description: 'Customer signature confirming work completion',
        category: 'contractual',
        required: true,
        evidenceTypes: ['signature'],
        status: 'pending',
      },
    ];
  }

  // ----------------------------------------
  // EVIDENCE VALIDATION
  // ----------------------------------------

  async validateEvidenceChain(chainId: string, chain: EvidenceChain, validatedBy: string): Promise<EvidenceValidation> {
    const integrityIssues: IntegrityIssue[] = [];
    const requirementResults: RequirementResult[] = [];

    // Check each evidence node integrity
    for (const node of chain.nodes) {
      if (node.type !== 'evidence') continue;

      const evidenceNode = node as EvidenceNode;

      // Check content hash (in production, re-compute and compare)
      if (!evidenceNode.contentHash) {
        integrityIssues.push({
          type: 'hash_mismatch',
          severity: 'warning',
          nodeId: node.id,
          message: 'Missing content hash',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check compliance requirements
    const requirements = await this.getComplianceRequirements(chain.rootNode as JobNode);
    for (const req of requirements) {
      const satisfyingNodes = chain.nodes.filter(n => {
        if (n.type !== 'evidence') return false;
        const en = n as EvidenceNode;
        return req.evidenceTypes.includes(en.evidenceType);
      }) as EvidenceNode[];

      requirementResults.push({
        requirement: req,
        satisfied: satisfyingNodes.length > 0,
        satisfiedBy: satisfyingNodes.length > 0 ? satisfyingNodes : undefined,
        reason: satisfyingNodes.length === 0 ? `No ${req.name} provided` : undefined,
      });
    }

    const satisfiedCount = requirementResults.filter(r => r.satisfied).length;
    const validationScore = requirements.length > 0
      ? Math.round((satisfiedCount / requirements.length) * 100)
      : 100;

    // Determine payment readiness
    const paymentBlockers: string[] = [];
    if (integrityIssues.some(i => i.severity === 'critical' || i.severity === 'error')) {
      paymentBlockers.push('Integrity issues found');
    }
    if (satisfiedCount < requirementResults.filter(r => r.requirement.required).length) {
      paymentBlockers.push('Not all required evidence provided');
    }
    if (chain.verifiedEvidence < chain.totalEvidence) {
      paymentBlockers.push('Not all evidence verified');
    }

    const validation: EvidenceValidation = {
      chainId,
      jobId: chain.jobId,
      isValid: integrityIssues.filter(i => i.severity === 'critical' || i.severity === 'error').length === 0,
      validationScore,
      requirementResults,
      satisfiedRequirements: satisfiedCount,
      totalRequirements: requirements.length,
      integrityValid: integrityIssues.length === 0,
      integrityIssues,
      isComplete: chain.isComplete,
      missingItems: chain.missingRequirements.map(r => r.name),
      paymentReady: paymentBlockers.length === 0,
      paymentBlockers,
      validatedAt: new Date().toISOString(),
      validatedBy,
    };

    return validation;
  }

  // ----------------------------------------
  // PAYMENT RELEASE GATE
  // ----------------------------------------

  async checkPaymentReleaseGate(
    paymentNodeId: string,
    checkedBy: string
  ): Promise<PaymentReleaseGate> {
    const paymentNode = store.nodes.get(paymentNodeId) as PaymentNode;
    if (!paymentNode || paymentNode.type !== 'payment') {
      throw new Error(`Payment node ${paymentNodeId} not found`);
    }

    const blockers: PaymentBlocker[] = [];
    const jobNode = await this.findNodeByExternalId('job', paymentNode.jobId);

    // Check evidence
    let evidenceComplete = false;
    let evidenceScore = 0;
    if (jobNode) {
      const chain = await this.buildEvidenceChain(jobNode.id);
      evidenceComplete = chain.isComplete && chain.verified;
      evidenceScore = chain.complianceScore;

      if (!evidenceComplete) {
        for (const missing of chain.missingRequirements) {
          blockers.push({
            type: 'evidence',
            reason: `Missing: ${missing.name}`,
            severity: missing.required ? 'hard' : 'soft',
            resolution: `Upload ${missing.evidenceTypes.join(' or ')}`,
          });
        }

        if (chain.verifiedEvidence < chain.totalEvidence) {
          blockers.push({
            type: 'evidence',
            reason: `${chain.totalEvidence - chain.verifiedEvidence} evidence items not verified`,
            severity: 'soft',
            resolution: 'Verify pending evidence',
          });
        }
      }
    }

    // Check compliance
    const complianceIssues: string[] = [];
    // Add compliance checks based on job type

    // Check approvals
    const approvalsComplete = paymentNode.approvalStatus === 'approved' || !paymentNode.requiresApproval;
    const pendingApprovers: string[] = [];
    if (!approvalsComplete) {
      blockers.push({
        type: 'approval',
        reason: 'Payment not yet approved',
        severity: 'hard',
        resolution: 'Submit for approval',
      });
      pendingApprovers.push('CFO', 'COO'); // Based on amount thresholds
    }

    const canRelease = blockers.filter(b => b.severity === 'hard').length === 0;
    const canOverride = blockers.every(b => b.severity === 'soft');

    const gate: PaymentReleaseGate = {
      id: generateId('gate'),
      paymentNodeId,
      paymentId: paymentNode.paymentId,
      jobId: paymentNode.jobId,
      canRelease,
      gateStatus: canRelease ? 'open' : 'blocked',
      evidenceComplete,
      evidenceScore,
      complianceComplete: complianceIssues.length === 0,
      complianceIssues,
      approvalsComplete,
      pendingApprovers,
      blockers,
      canOverride,
      overrideRequires: canOverride ? ['director', 'cfo'] : [],
      checkedAt: new Date().toISOString(),
      checkedBy,
    };

    return gate;
  }

  // ----------------------------------------
  // GRAPH QUERIES
  // ----------------------------------------

  async queryGraph(query: GraphQuery): Promise<GraphQueryResult> {
    const matchingNodes: GraphNode[] = [];
    const matchingEdges: GraphEdge[] = [];

    // Filter nodes
    for (const [nodeId, node] of store.nodes) {
      if (query.nodeTypes && !query.nodeTypes.includes(node.type)) continue;
      if (query.nodeIds && !query.nodeIds.includes(node.id)) continue;
      if (query.nodeStatus && !query.nodeStatus.includes(node.status)) continue;
      if (query.createdAfter && new Date(node.createdAt) < new Date(query.createdAfter)) continue;
      if (query.createdBefore && new Date(node.createdAt) > new Date(query.createdBefore)) continue;
      if (query.searchTerm) {
        const searchLower = query.searchTerm.toLowerCase();
        if (!node.label.toLowerCase().includes(searchLower)) continue;
      }
      if (query.tags && node.metadata?.tags) {
        if (!query.tags.some(t => node.metadata?.tags?.includes(t))) continue;
      }

      matchingNodes.push(node);
    }

    // Get edges for matching nodes
    const nodeIds = new Set(matchingNodes.map(n => n.id));
    for (const [edgeId, edge] of store.edges) {
      if (query.edgeTypes && !query.edgeTypes.includes(edge.type)) continue;
      if (nodeIds.has(edge.sourceNodeId) || nodeIds.has(edge.targetNodeId)) {
        matchingEdges.push(edge);
      }
    }

    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 100;
    const paginatedNodes = matchingNodes.slice(offset, offset + limit);

    return {
      nodes: paginatedNodes,
      edges: matchingEdges,
      totalNodes: matchingNodes.length,
      totalEdges: matchingEdges.length,
      query,
      executedAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------
  // GRAPH TRAVERSAL
  // ----------------------------------------

  async traverse(
    startNodeId: string,
    direction: 'outgoing' | 'incoming' | 'both',
    maxDepth: number = 3
  ): Promise<TraversalPath[]> {
    const startNode = store.nodes.get(startNodeId);
    if (!startNode) return [];

    const paths: TraversalPath[] = [];
    const visited = new Set<string>();

    const dfs = (
      currentNode: GraphNode,
      currentPath: PathStep[],
      depth: number
    ) => {
      if (depth > maxDepth) return;
      if (visited.has(currentNode.id)) return;

      visited.add(currentNode.id);
      currentPath.push({ node: currentNode, depth });

      // Find connected edges
      for (const [edgeId, edge] of store.edges) {
        if (edge.status !== 'active') continue;

        let nextNodeId: string | null = null;

        if (direction === 'outgoing' || direction === 'both') {
          if (edge.sourceNodeId === currentNode.id) {
            nextNodeId = edge.targetNodeId;
          }
        }
        if (direction === 'incoming' || direction === 'both') {
          if (edge.targetNodeId === currentNode.id) {
            nextNodeId = edge.sourceNodeId;
          }
        }

        if (nextNodeId && !visited.has(nextNodeId)) {
          const nextNode = store.nodes.get(nextNodeId);
          if (nextNode && nextNode.status === 'active') {
            const newPath = [...currentPath, { node: nextNode, edge, depth: depth + 1 }];
            dfs(nextNode, newPath, depth + 1);
          }
        }
      }

      // Record paths that reach leaf nodes
      if (currentPath.length > 1) {
        paths.push({
          id: generateId('path'),
          startNode,
          endNode: currentPath[currentPath.length - 1].node,
          path: currentPath,
          totalSteps: currentPath.length,
        });
      }
    };

    dfs(startNode, [], 0);

    return paths;
  }

  // ----------------------------------------
  // ANALYTICS
  // ----------------------------------------

  async getAnalytics(): Promise<GraphAnalytics> {
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    let totalEvidence = 0;
    let verifiedEvidence = 0;
    let totalPaymentValue = 0;
    let releasedPaymentValue = 0;
    let blockedPaymentValue = 0;

    for (const [nodeId, node] of store.nodes) {
      if (node.status !== 'active') continue;

      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;

      if (node.type === 'evidence') {
        totalEvidence++;
        if ((node as EvidenceNode).verified) {
          verifiedEvidence++;
        }
      }

      if (node.type === 'payment') {
        const pn = node as PaymentNode;
        totalPaymentValue += pn.amount;
        if (pn.paymentStatus === 'paid') {
          releasedPaymentValue += pn.amount;
        } else if (pn.paymentStatus === 'pending_evidence' || pn.paymentStatus === 'pending_approval') {
          blockedPaymentValue += pn.amount;
        }
      }
    }

    for (const [edgeId, edge] of store.edges) {
      if (edge.status !== 'active') continue;
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    }

    return {
      totalNodes: store.nodes.size,
      nodesByType: nodesByType as Record<NodeType, number>,
      totalEdges: store.edges.size,
      edgesByType: edgesByType as Record<EdgeType, number>,
      totalEvidence,
      verifiedEvidence,
      verificationRate: totalEvidence > 0 ? verifiedEvidence / totalEvidence : 0,
      averageComplianceScore: 0, // Would calculate from chains
      complianceByCategory: {} as any,
      totalPaymentValue,
      releasedPaymentValue,
      blockedPaymentValue,
      totalChains: 0,
      completeChains: 0,
      averageChainLength: 0,
      averageTimeToVerification: 0,
      averageTimeToPayment: 0,
      computedAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------
  // EVENT SYSTEM
  // ----------------------------------------

  private async emitEvent(
    type: GraphEventType,
    data: Record<string, unknown>,
    actorId: string
  ): Promise<void> {
    const event: GraphEvent = {
      id: generateId('event'),
      type,
      timestamp: new Date().toISOString(),
      nodeId: data.nodeId as string,
      edgeId: data.edgeId as string,
      chainId: data.chainId as string,
      actorId,
      actorName: actorId, // In production, resolve from user service
      actorRole: 'user',
      description: `${type}: ${JSON.stringify(data)}`,
      data,
    };

    store.events.push(event);

    // Notify subscribers
    for (const [subId, sub] of store.subscriptions) {
      if (!sub.active) continue;
      if (sub.watchedEventTypes && !sub.watchedEventTypes.includes(type)) continue;
      if (sub.watchedNodeIds && data.nodeId && !sub.watchedNodeIds.includes(data.nodeId as string)) continue;

      // In production, send notification via appropriate channel
      console.log(`Notification to ${sub.userId}:`, event);
    }
  }

  async getEvents(filters?: {
    nodeId?: string;
    eventTypes?: GraphEventType[];
    since?: string;
    limit?: number;
  }): Promise<GraphEvent[]> {
    let events = [...store.events];

    if (filters?.nodeId) {
      events = events.filter(e => e.nodeId === filters.nodeId);
    }
    if (filters?.eventTypes) {
      events = events.filter(e => filters.eventTypes!.includes(e.type));
    }
    if (filters?.since) {
      events = events.filter(e => new Date(e.timestamp) >= new Date(filters.since!));
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events.slice(0, filters?.limit || 100);
  }

  // ----------------------------------------
  // SUBSCRIPTION
  // ----------------------------------------

  async subscribe(subscription: Omit<GraphSubscription, 'id' | 'createdAt'>): Promise<GraphSubscription> {
    const sub: GraphSubscription = {
      ...subscription,
      id: generateId('sub'),
      createdAt: new Date().toISOString(),
    };

    store.subscriptions.set(sub.id, sub);
    return sub;
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const sub = store.subscriptions.get(subscriptionId);
    if (!sub) return false;

    sub.active = false;
    store.subscriptions.set(subscriptionId, sub);
    return true;
  }

  // ----------------------------------------
  // HELPERS
  // ----------------------------------------

  private async findNodeByExternalId(type: NodeType, externalId: string): Promise<GraphNode | null> {
    for (const [nodeId, node] of store.nodes) {
      if (node.type !== type) continue;

      // Check common external ID fields
      if (type === 'job' && (node as JobNode).jobId === externalId) return node;
      if (type === 'payment' && (node as PaymentNode).paymentId === externalId) return node;
      if (type === 'contractor' && node.data.contractorId === externalId) return node;
      if (type === 'customer' && node.data.customerId === externalId) return node;
    }

    return null;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const evidenceGraphService = new EvidenceGraphService();

// ============================================
// REACT HOOKS
// ============================================

export function useEvidenceChain(jobNodeId?: string) {
  const [chain, setChain] = useState<EvidenceChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buildChain = useCallback(async (nodeId: string) => {
    setLoading(true);
    try {
      const result = await evidenceGraphService.buildEvidenceChain(nodeId);
      setChain(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to build evidence chain'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (jobNodeId) {
      buildChain(jobNodeId);
    }
  }, [jobNodeId, buildChain]);

  return { chain, loading, error, buildChain };
}

export function usePaymentReleaseGate(paymentNodeId?: string, checkedBy?: string) {
  const [gate, setGate] = useState<PaymentReleaseGate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkGate = useCallback(async (nodeId: string, userId: string) => {
    setLoading(true);
    try {
      const result = await evidenceGraphService.checkPaymentReleaseGate(nodeId, userId);
      setGate(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check payment gate'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (paymentNodeId && checkedBy) {
      checkGate(paymentNodeId, checkedBy);
    }
  }, [paymentNodeId, checkedBy, checkGate]);

  return { gate, loading, error, checkGate };
}

export function useGraphQuery(initialQuery?: GraphQuery) {
  const [result, setResult] = useState<GraphQueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const executeQuery = useCallback(async (query: GraphQuery) => {
    setLoading(true);
    try {
      const queryResult = await evidenceGraphService.queryGraph(query);
      setResult(queryResult);
      setError(null);
      return queryResult;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to execute query'));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      executeQuery(initialQuery);
    }
  }, []);

  return { result, loading, error, executeQuery };
}

export function useGraphEvents(nodeId?: string) {
  const [events, setEvents] = useState<GraphEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await evidenceGraphService.getEvents({ nodeId, limit: 50 });
      setEvents(result);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, loading, refresh };
}

export function useGraphAnalytics() {
  const [analytics, setAnalytics] = useState<GraphAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await evidenceGraphService.getAnalytics();
      setAnalytics(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get analytics'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { analytics, loading, error, refresh };
}
