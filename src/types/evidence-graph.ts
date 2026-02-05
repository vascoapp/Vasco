// =============================================================================
// EVIDENCE GRAPH - Types
// =============================================================================
// Formal graph structure linking Jobs → Evidence → Compliance → Payments
// Provides complete audit trail and provenance tracking
// a16z Sphere pattern: "Evidence Graph for Decision Provenance"
// =============================================================================

// ============================================
// GRAPH NODES
// ============================================

export type NodeType =
  | 'job'
  | 'evidence'
  | 'compliance'
  | 'payment'
  | 'invoice'
  | 'approval'
  | 'certification'
  | 'inspection'
  | 'milestone'
  | 'contractor'
  | 'customer';

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  data: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  status: 'active' | 'archived' | 'disputed';
  metadata?: NodeMetadata;
}

export interface NodeMetadata {
  source?: string;              // Where this node came from
  hash?: string;                // Content hash for integrity
  version?: number;             // Version number
  tags?: string[];              // Classification tags
  confidentiality?: 'public' | 'internal' | 'confidential' | 'restricted';
}

// ============================================
// GRAPH EDGES (RELATIONSHIPS)
// ============================================

export type EdgeType =
  // Evidence relationships
  | 'evidences'           // Evidence → Job (this evidence supports this job)
  | 'satisfies'           // Evidence → Compliance (this evidence satisfies this requirement)
  | 'documents'           // Evidence → Milestone (this evidence documents this milestone)

  // Approval chain
  | 'approves'            // Approval → Payment/Invoice (this approval authorizes this)
  | 'requires'            // Payment → Compliance (payment requires these compliance items)
  | 'depends_on'          // Generic dependency

  // Financial flow
  | 'funds'               // Payment → Job (this payment funds this job)
  | 'invoices'            // Invoice → Job (this invoice bills for this job)
  | 'settles'             // Payment → Invoice (this payment settles this invoice)

  // Inspection chain
  | 'inspects'            // Inspection → Job (this inspection validates this job)
  | 'certifies'           // Certification → Job/Evidence (this cert validates this item)
  | 'supersedes'          // NewEvidence → OldEvidence (version chain)

  // Actor relationships
  | 'performed_by'        // Job → Contractor
  | 'for'                 // Job → Customer
  | 'created_by'          // Evidence → User
  | 'verified_by';        // Evidence → User

export interface GraphEdge {
  id: string;
  type: EdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
  weight?: number;              // For priority/importance
  data?: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  validFrom?: string;           // Temporal validity
  validUntil?: string;
  status: 'active' | 'revoked' | 'expired';
}

// ============================================
// EVIDENCE CHAIN
// ============================================

export interface EvidenceChain {
  id: string;
  jobId: string;
  jobTitle: string;

  // Chain integrity
  rootNode: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];

  // Chain status
  isComplete: boolean;
  missingRequirements: ComplianceRequirement[];

  // Verification
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationMethod?: 'manual' | 'automated' | 'third-party';

  // Chain metrics
  totalEvidence: number;
  verifiedEvidence: number;
  complianceScore: number;       // 0-100

  // Payment readiness
  paymentReady: boolean;
  blockingReasons: string[];

  createdAt: string;
  updatedAt: string;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  category: ComplianceCategory;
  required: boolean;
  evidenceTypes: string[];       // What evidence types satisfy this
  status: 'pending' | 'satisfied' | 'waived' | 'failed';
  satisfiedBy?: string[];        // Evidence IDs
  satisfiedAt?: string;
  notes?: string;
}

export type ComplianceCategory =
  | 'safety'
  | 'quality'
  | 'regulatory'
  | 'contractual'
  | 'financial'
  | 'environmental'
  | 'insurance'
  | 'certification';

// ============================================
// EVIDENCE NODES (Specialized)
// ============================================

export interface EvidenceNode extends GraphNode {
  type: 'evidence';
  evidenceType: EvidenceNodeType;

  // Content
  contentUri: string;
  contentHash: string;           // SHA-256 hash
  mimeType: string;
  size: number;

  // Capture context
  capturedAt: string;
  capturedBy: string;
  captureLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  captureDevice?: string;

  // Verification
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;

  // Linking
  linkedJobId: string;
  linkedMilestoneId?: string;
  complianceSatisfied: string[];  // Compliance requirement IDs
}

export type EvidenceNodeType =
  | 'photo_before'
  | 'photo_during'
  | 'photo_after'
  | 'photo_issue'
  | 'video'
  | 'document'
  | 'signature'
  | 'checklist'
  | 'inspection_report'
  | 'test_result'
  | 'certification'
  | 'permit'
  | 'receipt'
  | 'warranty'
  | 'specification'
  | 'drawing'
  | 'correspondence';

// ============================================
// JOB NODE (Specialized)
// ============================================

export interface JobNode extends GraphNode {
  type: 'job';
  jobId: string;
  title: string;
  description?: string;

  // Status
  jobStatus: JobNodeStatus;
  startDate?: string;
  completionDate?: string;

  // Financial
  contractValue?: number;
  currency?: 'GBP' | 'EUR';
  invoicedAmount?: number;
  paidAmount?: number;

  // Parties
  contractorId: string;
  contractorName: string;
  customerId: string;
  customerName: string;

  // Location
  siteAddress?: string;
  siteCoordinates?: {
    latitude: number;
    longitude: number;
  };

  // Evidence summary
  totalEvidence: number;
  requiredEvidence: number;
  verifiedEvidence: number;
}

export type JobNodeStatus =
  | 'draft'
  | 'scheduled'
  | 'in_progress'
  | 'pending_inspection'
  | 'pending_approval'
  | 'completed'
  | 'invoiced'
  | 'paid'
  | 'disputed'
  | 'cancelled';

// ============================================
// PAYMENT NODE (Specialized)
// ============================================

export interface PaymentNode extends GraphNode {
  type: 'payment';
  paymentId: string;

  // Financial
  amount: number;
  currency: 'GBP' | 'EUR';
  paymentType: PaymentType;
  paymentMethod?: string;

  // Status
  paymentStatus: PaymentNodeStatus;
  scheduledDate?: string;
  paidDate?: string;

  // References
  invoiceId?: string;
  jobId: string;

  // Approval chain
  requiresApproval: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;

  // Evidence requirements
  evidenceRequired: boolean;
  evidenceComplete: boolean;
  missingEvidence: string[];
}

export type PaymentType =
  | 'deposit'
  | 'progress'
  | 'milestone'
  | 'completion'
  | 'retention_release'
  | 'final';

export type PaymentNodeStatus =
  | 'scheduled'
  | 'pending_evidence'
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'cancelled';

// ============================================
// GRAPH QUERIES
// ============================================

export interface GraphQuery {
  // Node filters
  nodeTypes?: NodeType[];
  nodeIds?: string[];
  nodeStatus?: GraphNode['status'][];

  // Edge filters
  edgeTypes?: EdgeType[];

  // Traversal
  startNodeId?: string;
  maxDepth?: number;
  direction?: 'outgoing' | 'incoming' | 'both';

  // Time filters
  createdAfter?: string;
  createdBefore?: string;

  // Search
  searchTerm?: string;
  tags?: string[];

  // Pagination
  limit?: number;
  offset?: number;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalNodes: number;
  totalEdges: number;
  query: GraphQuery;
  executedAt: string;
}

// ============================================
// GRAPH TRAVERSAL
// ============================================

export interface TraversalPath {
  id: string;
  startNode: GraphNode;
  endNode: GraphNode;
  path: PathStep[];
  totalSteps: number;
  totalWeight?: number;
}

export interface PathStep {
  node: GraphNode;
  edge?: GraphEdge;
  depth: number;
}

// ============================================
// EVIDENCE VALIDATION
// ============================================

export interface EvidenceValidation {
  chainId: string;
  jobId: string;

  // Validation result
  isValid: boolean;
  validationScore: number;       // 0-100

  // Requirement checking
  requirementResults: RequirementResult[];
  satisfiedRequirements: number;
  totalRequirements: number;

  // Integrity
  integrityValid: boolean;
  integrityIssues: IntegrityIssue[];

  // Completeness
  isComplete: boolean;
  missingItems: string[];

  // Payment readiness
  paymentReady: boolean;
  paymentBlockers: string[];

  validatedAt: string;
  validatedBy: string;
}

export interface RequirementResult {
  requirement: ComplianceRequirement;
  satisfied: boolean;
  satisfiedBy?: EvidenceNode[];
  reason?: string;
}

export interface IntegrityIssue {
  type: 'hash_mismatch' | 'missing_reference' | 'broken_chain' | 'invalid_signature' | 'expired';
  severity: 'warning' | 'error' | 'critical';
  nodeId: string;
  message: string;
  detectedAt: string;
}

// ============================================
// PAYMENT RELEASE GATE
// ============================================

export interface PaymentReleaseGate {
  id: string;
  paymentNodeId: string;
  paymentId: string;
  jobId: string;

  // Gate status
  canRelease: boolean;
  gateStatus: 'open' | 'blocked' | 'override';

  // Evidence check
  evidenceComplete: boolean;
  evidenceScore: number;

  // Compliance check
  complianceComplete: boolean;
  complianceIssues: string[];

  // Approval check
  approvalsComplete: boolean;
  pendingApprovers: string[];

  // Blocking reasons (if any)
  blockers: PaymentBlocker[];

  // Override capability
  canOverride: boolean;
  overrideRequires: string[];    // Roles that can override

  // Audit
  checkedAt: string;
  checkedBy: string;
}

export interface PaymentBlocker {
  type: 'evidence' | 'compliance' | 'approval' | 'financial' | 'dispute';
  reason: string;
  severity: 'soft' | 'hard';     // Soft can be overridden
  resolution?: string;           // How to resolve
  linkedNodeId?: string;
}

// ============================================
// GRAPH ANALYTICS
// ============================================

export interface GraphAnalytics {
  // Node counts
  totalNodes: number;
  nodesByType: Record<NodeType, number>;

  // Edge counts
  totalEdges: number;
  edgesByType: Record<EdgeType, number>;

  // Evidence metrics
  totalEvidence: number;
  verifiedEvidence: number;
  verificationRate: number;

  // Compliance metrics
  averageComplianceScore: number;
  complianceByCategory: Record<ComplianceCategory, { satisfied: number; total: number }>;

  // Payment metrics
  totalPaymentValue: number;
  releasedPaymentValue: number;
  blockedPaymentValue: number;

  // Chain metrics
  totalChains: number;
  completeChains: number;
  averageChainLength: number;

  // Time metrics
  averageTimeToVerification: number;  // hours
  averageTimeToPayment: number;       // days

  computedAt: string;
}

// ============================================
// GRAPH EVENTS
// ============================================

export interface GraphEvent {
  id: string;
  type: GraphEventType;
  timestamp: string;

  // Context
  nodeId?: string;
  edgeId?: string;
  chainId?: string;

  // Actor
  actorId: string;
  actorName: string;
  actorRole: string;

  // Details
  description: string;
  data?: Record<string, unknown>;

  // Previous state (for auditing)
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
}

export type GraphEventType =
  | 'node_created'
  | 'node_updated'
  | 'node_deleted'
  | 'edge_created'
  | 'edge_revoked'
  | 'evidence_verified'
  | 'evidence_disputed'
  | 'compliance_satisfied'
  | 'compliance_failed'
  | 'payment_released'
  | 'payment_blocked'
  | 'chain_completed'
  | 'chain_invalidated';

// ============================================
// GRAPH SUBSCRIPTION
// ============================================

export interface GraphSubscription {
  id: string;
  userId: string;

  // What to watch
  watchedNodeIds?: string[];
  watchedJobIds?: string[];
  watchedEventTypes?: GraphEventType[];

  // Notification settings
  notifyOnEvidence: boolean;
  notifyOnCompliance: boolean;
  notifyOnPayment: boolean;

  // Channels
  channels: ('in-app' | 'email' | 'push' | 'webhook')[];
  webhookUrl?: string;

  createdAt: string;
  active: boolean;
}
