// =============================================================================
// CFO DASHBOARD - AI-Powered Financial Oversight & Cost Control
// =============================================================================
// Executive financial dashboard for real estate development CFOs
// Enhanced with Financial Auditor AI, Vasco Guidance, and smart approvals
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  mockProjects,
  mockAppraisals,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  calculateTransferTax,
  formatPercent,
  getCurrencyForCountry,
} from '../../modules/countryModules';
import type { Country } from '../../types/buildos';

// AI Services
import { useAuditFindings, useAuditStats } from '../../services/auditorService';
import {
  useFinancialAuditStats,
  useFinancialAuditFindings,
  useOverpaymentAnalysis,
  useUnnecessarySpendAnalysis,
  useBudgetReconciliation,
} from '../../services/financialAuditorService';

type IconName = keyof typeof Ionicons.glyphMap;

// =============================================================================
// VASCO AI GUIDANCE FOR CFO
// =============================================================================

type VascoGuidanceType = 'cashflow' | 'savings' | 'overpayment' | 'budget' | 'action';

interface VascoGuidance {
  id: string;
  type: VascoGuidanceType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  icon: IconName;
  actionLabel?: string;
  actionRoute?: string;
  financialImpact?: number;
  timestamp: string;
}

const MOCK_VASCO_GUIDANCE: VascoGuidance[] = [
  {
    id: 'vg-1',
    type: 'cashflow',
    priority: 'critical',
    title: 'Cash Flow Alert',
    message: 'Projected shortfall of £45,000 in March. Submit draw request for Meridian Tower today to avoid gap.',
    icon: 'alert-circle',
    actionLabel: 'Create Draw Request',
    actionRoute: '/hub/costs',
    financialImpact: 45000,
    timestamp: '10 min ago',
  },
  {
    id: 'vg-2',
    type: 'overpayment',
    priority: 'high',
    title: 'Overpayment Detected',
    message: 'BuildCo Ltd charging £7/unit above market rate for steel brackets. Renegotiate to save £1,050.',
    icon: 'trending-down',
    actionLabel: 'Review Finding',
    financialImpact: 1050,
    timestamp: '1 hour ago',
  },
  {
    id: 'vg-3',
    type: 'savings',
    priority: 'high',
    title: 'Savings Opportunity',
    message: 'Redundant security services detected across sites. Consolidate to save £15,000/month.',
    icon: 'bulb',
    actionLabel: 'View Analysis',
    financialImpact: 15000,
    timestamp: '2 hours ago',
  },
  {
    id: 'vg-4',
    type: 'budget',
    priority: 'medium',
    title: 'Budget Variance',
    message: 'Thames View MEP costs trending 12% over budget. Consider change order or value engineering.',
    icon: 'pie-chart',
    actionLabel: 'View Budget',
    actionRoute: '/hub/costs',
    timestamp: '3 hours ago',
  },
  {
    id: 'vg-5',
    type: 'action',
    priority: 'medium',
    title: 'Payment Due Today',
    message: '3 contractor payments totaling £662K awaiting your approval. Handovers verified.',
    icon: 'checkmark-circle',
    actionLabel: 'Review Approvals',
    actionRoute: '/hub/approvals',
    financialImpact: 662000,
    timestamp: '30 min ago',
  },
];

// =============================================================================
// PENDING APPROVALS (Enhanced with AI verification)
// =============================================================================

interface PendingApproval {
  id: string;
  type: 'payment' | 'draw-request' | 'change-order' | 'retention-release';
  title: string;
  amount: number;
  vendor?: string;
  project: string;
  status: 'pending' | 'ai-verified' | 'requires-review' | 'blocked';
  aiVerification?: {
    budgetCheck: boolean;
    contractCheck: boolean;
    handoverComplete: boolean;
    rateCheck: boolean;
    recommendation: 'approve' | 'review' | 'reject';
    issues?: string[];
  };
  dueDate: string;
  requestedBy: string;
  requestedAt: string;
}

const MOCK_PENDING_APPROVALS: PendingApproval[] = [
  {
    id: 'app-1',
    type: 'payment',
    title: 'Progress Payment #12',
    amount: 185000,
    vendor: 'BuildRight Ltd',
    project: 'Meridian Tower',
    status: 'ai-verified',
    aiVerification: {
      budgetCheck: true,
      contractCheck: true,
      handoverComplete: true,
      rateCheck: true,
      recommendation: 'approve',
    },
    dueDate: 'Today',
    requestedBy: 'Site Lead',
    requestedAt: '2 hours ago',
  },
  {
    id: 'app-2',
    type: 'payment',
    title: 'M&E Invoice',
    amount: 420000,
    vendor: 'Elite Facades',
    project: 'Thames View',
    status: 'requires-review',
    aiVerification: {
      budgetCheck: true,
      contractCheck: true,
      handoverComplete: false,
      rateCheck: true,
      recommendation: 'review',
      issues: ['Handover pack incomplete - missing QA inspection'],
    },
    dueDate: '3 days',
    requestedBy: 'QS Team',
    requestedAt: 'Yesterday',
  },
  {
    id: 'app-3',
    type: 'payment',
    title: 'Steel Supply Invoice',
    amount: 57000,
    vendor: 'BuildCo Ltd',
    project: 'Green Quarter',
    status: 'blocked',
    aiVerification: {
      budgetCheck: true,
      contractCheck: false,
      handoverComplete: true,
      rateCheck: false,
      recommendation: 'reject',
      issues: [
        'Rate £45/unit exceeds contract rate £38/unit (+18%)',
        'Quantity 150 units exceeds PO quantity 120 units',
      ],
    },
    dueDate: '5 days',
    requestedBy: 'Procurement',
    requestedAt: '3 days ago',
  },
  {
    id: 'app-4',
    type: 'draw-request',
    title: 'Draw Request #8',
    amount: 850000,
    project: 'Meridian Tower',
    status: 'ai-verified',
    aiVerification: {
      budgetCheck: true,
      contractCheck: true,
      handoverComplete: true,
      rateCheck: true,
      recommendation: 'approve',
    },
    dueDate: 'Today',
    requestedBy: 'Project Manager',
    requestedAt: '1 day ago',
  },
];

// =============================================================================
// MOCK HANDOVER DATA
// =============================================================================

interface PendingHandover {
  id: string;
  projectName: string;
  contractor: string;
  workPackage: string;
  paymentAmount: number;
  handoverStatus: 'pending' | 'in-review' | 'awaiting-signoff' | 'complete';
  completionPercentage: number;
  blockedPaymentId: string;
  dueDate: string;
  missingItems: string[];
}

const MOCK_PENDING_HANDOVERS: PendingHandover[] = [
  {
    id: 'ho-1',
    projectName: 'Meridian Tower',
    contractor: 'BuildRight Ltd',
    workPackage: 'M&E First Fix',
    paymentAmount: 185000,
    handoverStatus: 'awaiting-signoff',
    completionPercentage: 95,
    blockedPaymentId: 'pay-1',
    dueDate: 'Today',
    missingItems: ['Customer sign-off'],
  },
  {
    id: 'ho-2',
    projectName: 'Thames View',
    contractor: 'Elite Facades',
    workPackage: 'Curtain Wall Section A',
    paymentAmount: 420000,
    handoverStatus: 'in-review',
    completionPercentage: 80,
    blockedPaymentId: 'pay-2',
    dueDate: '3 days',
    missingItems: ['QA inspection', 'As-built drawings'],
  },
  {
    id: 'ho-3',
    projectName: 'Green Quarter',
    contractor: 'ProSteel UK',
    workPackage: 'Structural Steel Phase 2',
    paymentAmount: 340000,
    handoverStatus: 'pending',
    completionPercentage: 60,
    blockedPaymentId: 'pay-3',
    dueDate: '7 days',
    missingItems: ['Completion photos', 'Test certificates', 'Warranty docs'],
  },
];

export type CFOTabView = 'overview' | 'costs' | 'cashflow' | 'returns';
type TabView = CFOTabView;

// Role color - matches theme roleCFO token
const CFO_COLOR = '#2563EB'; // Blue for CFO (per theme)

// =============================================================================
// HELPERS
// =============================================================================

function formatCompact(value: number, currency: string = 'GBP'): string {
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${symbol}${value.toFixed(0)}`;
}

function formatVariance(value: number, currency: string = 'GBP'): string {
  const formatted = formatCompact(Math.abs(value), currency);
  return value >= 0 ? `+${formatted}` : `-${formatted.replace(/[£€$]/, '')}`;
}

function getPriorityColor(priority: VascoGuidance['priority']): string {
  switch (priority) {
    case 'critical': return SemanticColors.feedbackError;
    case 'high': return SemanticColors.feedbackWarning;
    case 'medium': return CFO_COLOR;
    case 'low': return SemanticColors.textTertiary;
  }
}

function getPriorityBg(priority: VascoGuidance['priority']): string {
  switch (priority) {
    case 'critical': return SemanticColors.feedbackErrorBg;
    case 'high': return SemanticColors.feedbackWarningBg;
    case 'medium': return CFO_COLOR + '15';
    case 'low': return SemanticColors.surfaceSecondary;
  }
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface TabButtonProps {
  label: string;
  icon: IconName;
  isActive: boolean;
  badge?: number;
  onPress: () => void;
}

function TabButton({ label, icon, isActive, badge, onPress }: TabButtonProps) {
  return (
    <Pressable
      style={[styles.tabButton, isActive && styles.tabButtonActive]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={18}
        color={isActive ? '#fff' : SemanticColors.textSecondary}
      />
      <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
        {label}
      </Text>
      {badge !== undefined && badge > 0 && (
        <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
          <Text style={styles.tabBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface VascoGuidanceCardProps {
  guidance: VascoGuidance;
  onAction?: () => void;
  onDismiss?: () => void;
}

function VascoGuidanceCard({ guidance, onAction, onDismiss }: VascoGuidanceCardProps) {
  return (
    <View style={[styles.guidanceCard, { borderLeftColor: getPriorityColor(guidance.priority) }]}>
      <View style={styles.guidanceHeader}>
        <View style={[styles.guidanceIconContainer, { backgroundColor: getPriorityBg(guidance.priority) }]}>
          <Ionicons name={guidance.icon} size={18} color={getPriorityColor(guidance.priority)} />
        </View>
        <View style={styles.guidanceHeaderText}>
          <Text style={styles.guidanceTitle}>{guidance.title}</Text>
          <Text style={styles.guidanceTimestamp}>{guidance.timestamp}</Text>
        </View>
        {onDismiss && (
          <Pressable onPress={onDismiss} hitSlop={8}>
            <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
          </Pressable>
        )}
      </View>
      <Text style={styles.guidanceMessage}>{guidance.message}</Text>
      {guidance.financialImpact && (
        <View style={styles.guidanceImpact}>
          <Ionicons name="cash" size={14} color={getPriorityColor(guidance.priority)} />
          <Text style={[styles.guidanceImpactText, { color: getPriorityColor(guidance.priority) }]}>
            {formatCompact(guidance.financialImpact)}
          </Text>
        </View>
      )}
      {guidance.actionLabel && (
        <Pressable style={styles.guidanceAction} onPress={onAction}>
          <Text style={styles.guidanceActionText}>{guidance.actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={CFO_COLOR} />
        </Pressable>
      )}
    </View>
  );
}

interface ApprovalCardProps {
  approval: PendingApproval;
  onApprove: () => void;
  onReview: () => void;
}

function ApprovalCard({ approval, onApprove, onReview }: ApprovalCardProps) {
  const getStatusColor = () => {
    switch (approval.status) {
      case 'ai-verified': return SemanticColors.feedbackSuccess;
      case 'requires-review': return SemanticColors.feedbackWarning;
      case 'blocked': return SemanticColors.feedbackError;
      default: return SemanticColors.textTertiary;
    }
  };

  const getStatusLabel = () => {
    switch (approval.status) {
      case 'ai-verified': return 'AI Verified';
      case 'requires-review': return 'Needs Review';
      case 'blocked': return 'Blocked';
      default: return 'Pending';
    }
  };

  return (
    <View style={styles.approvalCard}>
      <View style={styles.approvalHeader}>
        <View style={styles.approvalInfo}>
          <View style={styles.approvalTitleRow}>
            <Text style={styles.approvalTitle}>{approval.title}</Text>
            <View style={[styles.approvalStatusBadge, { backgroundColor: getStatusColor() + '20' }]}>
              <View style={[styles.approvalStatusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.approvalStatusText, { color: getStatusColor() }]}>
                {getStatusLabel()}
              </Text>
            </View>
          </View>
          <Text style={styles.approvalProject}>{approval.project}</Text>
          {approval.vendor && (
            <Text style={styles.approvalVendor}>{approval.vendor}</Text>
          )}
        </View>
        <View style={styles.approvalAmount}>
          <Text style={styles.approvalAmountValue}>{formatCompact(approval.amount)}</Text>
          <Text style={[
            styles.approvalDue,
            approval.dueDate === 'Today' && { color: SemanticColors.feedbackError },
          ]}>
            Due: {approval.dueDate}
          </Text>
        </View>
      </View>

      {/* AI Verification Summary */}
      {approval.aiVerification && (
        <View style={styles.aiVerificationContainer}>
          <View style={styles.aiVerificationHeader}>
            <Ionicons name="shield-checkmark" size={14} color={CFO_COLOR} />
            <Text style={styles.aiVerificationTitle}>AI Verification</Text>
          </View>
          <View style={styles.aiCheckRow}>
            {[
              { key: 'budgetCheck', label: 'Budget' },
              { key: 'contractCheck', label: 'Contract' },
              { key: 'handoverComplete', label: 'Handover' },
              { key: 'rateCheck', label: 'Rate' },
            ].map(({ key, label }) => (
              <View key={key} style={styles.aiCheckItem}>
                <Ionicons
                  name={approval.aiVerification![key as keyof typeof approval.aiVerification] ? 'checkmark-circle' : 'alert-circle'}
                  size={14}
                  color={approval.aiVerification![key as keyof typeof approval.aiVerification]
                    ? SemanticColors.feedbackSuccess
                    : SemanticColors.feedbackError}
                />
                <Text style={styles.aiCheckLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {approval.aiVerification.issues && approval.aiVerification.issues.length > 0 && (
            <View style={styles.aiIssuesList}>
              {approval.aiVerification.issues.map((issue, idx) => (
                <View key={idx} style={styles.aiIssueItem}>
                  <Ionicons name="warning" size={12} color={SemanticColors.feedbackWarning} />
                  <Text style={styles.aiIssueText}>{issue}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.approvalActions}>
        <Pressable
          style={[
            styles.approvalActionButton,
            approval.status === 'ai-verified' && styles.approvalActionButtonPrimary,
          ]}
          onPress={approval.status === 'blocked' ? onReview : onApprove}
        >
          <Text style={[
            styles.approvalActionButtonText,
            approval.status === 'ai-verified' && styles.approvalActionButtonTextPrimary,
          ]}>
            {approval.status === 'blocked' ? 'Review Issues' : approval.status === 'ai-verified' ? 'Approve' : 'Review & Approve'}
          </Text>
        </Pressable>
        <Pressable style={styles.approvalActionButtonSecondary} onPress={onReview}>
          <Text style={styles.approvalActionButtonTextSecondary}>Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface AuditFindingCardProps {
  finding: any;
  onAction?: () => void;
}

function AuditFindingCard({ finding, onAction }: AuditFindingCardProps) {
  const getSeverityColor = () => {
    switch (finding.severity) {
      case 'critical': return SemanticColors.feedbackError;
      case 'high': return SemanticColors.feedbackWarning;
      case 'medium': return CFO_COLOR;
      default: return SemanticColors.textTertiary;
    }
  };

  return (
    <View style={[styles.findingCard, { borderLeftColor: getSeverityColor() }]}>
      <View style={styles.findingHeader}>
        <View style={[styles.findingSeverityBadge, { backgroundColor: getSeverityColor() + '20' }]}>
          <Text style={[styles.findingSeverityText, { color: getSeverityColor() }]}>
            {finding.severity.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.findingCategory}>{finding.category?.name || finding.auditType}</Text>
      </View>
      <Text style={styles.findingTitle}>{finding.title}</Text>
      <Text style={styles.findingDescription} numberOfLines={2}>{finding.description}</Text>
      {(finding.impact?.financial || finding.financialDetails?.variance) && (
        <View style={styles.findingImpact}>
          <Ionicons name="cash" size={14} color={getSeverityColor()} />
          <Text style={[styles.findingImpactText, { color: getSeverityColor() }]}>
            Impact: {formatCompact(finding.impact?.financial || Math.abs(finding.financialDetails?.variance || 0))}
          </Text>
        </View>
      )}
      {finding.suggestedAction && (
        <Pressable style={styles.findingAction} onPress={onAction}>
          <Text style={styles.findingActionText}>{finding.suggestedAction.type.replace(/-/g, ' ')}</Text>
          <Ionicons name="chevron-forward" size={14} color={CFO_COLOR} />
        </Pressable>
      )}
    </View>
  );
}

interface ConfirmationModalProps {
  visible: boolean;
  approval: PendingApproval | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationModal({ visible, approval, onConfirm, onCancel }: ConfirmationModalProps) {
  const [confirmCode, setConfirmCode] = useState('');

  if (!approval) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name="shield-checkmark" size={32} color={CFO_COLOR} />
            <Text style={styles.modalTitle}>Confirm Approval</Text>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>Action</Text>
            <Text style={styles.modalValue}>{approval.title}</Text>

            <Text style={styles.modalLabel}>Amount</Text>
            <Text style={[styles.modalValue, styles.modalAmount]}>{formatCompact(approval.amount)}</Text>

            <Text style={styles.modalLabel}>Recipient</Text>
            <Text style={styles.modalValue}>{approval.vendor || approval.project}</Text>

            <View style={styles.modalWarning}>
              <Ionicons name="information-circle" size={16} color={CFO_COLOR} />
              <Text style={styles.modalWarningText}>
                This action cannot be undone. Please confirm you want to proceed.
              </Text>
            </View>

            <Text style={styles.modalLabel}>Enter confirmation code</Text>
            <TextInput
              style={styles.confirmInput}
              placeholder="Enter APPROVE"
              value={confirmCode}
              onChangeText={setConfirmCode}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelButton} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalConfirmButton,
                confirmCode !== 'APPROVE' && styles.modalConfirmButtonDisabled,
              ]}
              onPress={onConfirm}
              disabled={confirmCode !== 'APPROVE'}
            >
              <Text style={styles.modalConfirmText}>Confirm & Execute</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface QuickActionProps {
  icon: IconName;
  label: string;
  badge?: number;
  onPress: () => void;
}

function QuickAction({ icon, label, badge, onPress }: QuickActionProps) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Ionicons name={icon} size={20} color={CFO_COLOR} />
        {badge !== undefined && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

interface MetricCardProps {
  value: string;
  label: string;
  color?: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
}

function MetricCard({ value, label, color, subtitle, trend }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, color && { color }]}>{value}</Text>
        {trend && (
          <Ionicons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
            size={14}
            color={trend === 'up' ? SemanticColors.feedbackSuccess : trend === 'down' ? SemanticColors.feedbackError : SemanticColors.textTertiary}
          />
        )}
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </View>
  );
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

interface CFODashboardProps {
  initialTab?: TabView;
  showTabBar?: boolean;
}

export function CFODashboard({ initialTab = 'overview', showTabBar = true }: CFODashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');
  const [taxAmount, setTaxAmount] = useState('');
  const [taxCountry, setTaxCountry] = useState<Country>('UK');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());

  // AI Service Hooks
  const { findings: auditFindings, loading: auditLoading } = useAuditFindings('cfo');
  const auditStats = useAuditStats('cfo');
  const financialStats = useFinancialAuditStats();
  const { findings: financialFindings } = useFinancialAuditFindings();
  const { analysis: overpaymentAnalysis, totalOverpaid } = useOverpaymentAnalysis('project-001');
  const { analysis: savingsAnalysis, totalSavings } = useUnnecessarySpendAnalysis('project-001');
  const { report: budgetReport } = useBudgetReconciliation('project-001');

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const appraisal = useMemo(() => mockAppraisals[selectedProjectId], [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(() => selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP', [selectedProject]);

  // Filter dismissed guidance
  const activeGuidance = useMemo(
    () => MOCK_VASCO_GUIDANCE.filter(g => !dismissedGuidance.has(g.id)),
    [dismissedGuidance]
  );

  // Critical guidance count
  const criticalGuidanceCount = useMemo(
    () => activeGuidance.filter(g => g.priority === 'critical' || g.priority === 'high').length,
    [activeGuidance]
  );

  // Pending approvals requiring action
  const pendingApprovalCount = useMemo(
    () => MOCK_PENDING_APPROVALS.filter(a => a.status !== 'blocked').length,
    []
  );

  // Portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let totalGdv = 0;
    let totalBudget = 0;
    let totalSpent = 0;
    let irrSum = 0;
    let projectCount = 0;

    mockProjects.forEach((project) => {
      const appr = mockAppraisals[project.id];
      if (appr) {
        totalGdv += appr.gdv;
        irrSum += appr.irr;
        projectCount++;
      }
      totalBudget += project.totalBudget;
      totalSpent += project.actualSpent;
    });

    return {
      totalGdv,
      avgIrr: projectCount > 0 ? irrSum / projectCount : 0,
      totalBudget,
      totalSpent,
      uncommitted: totalBudget - totalSpent,
    };
  }, []);

  // Cost health
  const costHealth = useMemo(() => {
    if (!selectedProject || !deliveryMetrics) return null;
    const cpi = deliveryMetrics.cpiCostPerformanceIndex;
    const eac = deliveryMetrics.estimateAtCompletion;
    const budgetVariance = selectedProject.totalBudget - eac;
    const contingencyRemaining = selectedProject.contingency - selectedProject.contingencyUsed;

    return {
      cpi,
      eac,
      budgetVariance,
      contingencyRemaining,
      contingencyPercent: selectedProject.contingency > 0
        ? contingencyRemaining / selectedProject.contingency : 0,
      status: cpi >= 0.95 ? 'healthy' : cpi >= 0.85 ? 'at-risk' : 'critical',
    };
  }, [selectedProject, deliveryMetrics]);

  // Tax calculator
  const taxResult = useMemo(() => {
    const amount = parseFloat(taxAmount);
    if (isNaN(amount) || amount <= 0) return null;
    return calculateTransferTax(taxCountry, amount, { isResidential: false });
  }, [taxAmount, taxCountry]);

  const fmt = (amount: number) => formatCompact(amount, currency);

  // Handlers
  const handleDismissGuidance = useCallback((id: string) => {
    setDismissedGuidance(prev => new Set(prev).add(id));
  }, []);

  const handleApprove = useCallback((approval: PendingApproval) => {
    setSelectedApproval(approval);
    setConfirmModalVisible(true);
  }, []);

  const handleConfirmApproval = useCallback(() => {
    // In reality, would call approval API
    console.log('Approved:', selectedApproval?.id);
    setConfirmModalVisible(false);
    setSelectedApproval(null);
  }, [selectedApproval]);

  return (
    <View style={styles.container}>
      {/* Header with Portfolio Summary */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Financial Overview</Text>
            <Text style={styles.headerSubtitle}>{mockProjects.length} active projects</Text>
          </View>
          <View style={styles.headerBadges}>
            {criticalGuidanceCount > 0 && (
              <View style={styles.alertBadge}>
                <Ionicons name="alert-circle" size={14} color="#fff" />
                <Text style={styles.alertBadgeText}>{criticalGuidanceCount}</Text>
              </View>
            )}
            <View style={[styles.headerAccent, { backgroundColor: CFO_COLOR }]} />
          </View>
        </View>

        {/* Key Metrics Row */}
        <View style={styles.headerMetrics}>
          <View style={styles.headerMetric}>
            <Text style={styles.headerMetricValue}>{formatCompact(portfolioMetrics.totalGdv, 'GBP')}</Text>
            <Text style={styles.headerMetricLabel}>Total GDV</Text>
          </View>
          <View style={styles.headerMetricDivider} />
          <View style={styles.headerMetric}>
            <Text style={[styles.headerMetricValue, { color: CFO_COLOR }]}>
              {formatPercent(portfolioMetrics.avgIrr)}
            </Text>
            <Text style={styles.headerMetricLabel}>Avg IRR</Text>
          </View>
          <View style={styles.headerMetricDivider} />
          <View style={styles.headerMetric}>
            <Text style={styles.headerMetricValue}>{formatCompact(portfolioMetrics.uncommitted, 'GBP')}</Text>
            <Text style={styles.headerMetricLabel}>Uncommitted</Text>
          </View>
        </View>
      </View>

      {/* Tab Bar */}
      {showTabBar && (
        <View style={styles.tabBar}>
          <TabButton
            label="Overview"
            icon="grid"
            isActive={activeTab === 'overview'}
            badge={criticalGuidanceCount}
            onPress={() => setActiveTab('overview')}
          />
          <TabButton
            label="Costs"
            icon="cash"
            isActive={activeTab === 'costs'}
            onPress={() => setActiveTab('costs')}
          />
          <TabButton
            label="Cash"
            icon="wallet"
            isActive={activeTab === 'cashflow'}
            onPress={() => setActiveTab('cashflow')}
          />
          <TabButton
            label="Returns"
            icon="trending-up"
            isActive={activeTab === 'returns'}
            onPress={() => setActiveTab('returns')}
          />
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* Vasco AI Guidance */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="sparkles" size={16} color={CFO_COLOR} />
                  <Text style={styles.sectionTitle}>Vasco AI Guidance</Text>
                </View>
                <Text style={styles.sectionSubtitle}>
                  {activeGuidance.length} actionable insights
                </Text>
              </View>
              <View style={styles.guidanceList}>
                {activeGuidance.slice(0, 3).map((guidance) => (
                  <VascoGuidanceCard
                    key={guidance.id}
                    guidance={guidance}
                    onDismiss={() => handleDismissGuidance(guidance.id)}
                    onAction={() => guidance.actionRoute && router.push(guidance.actionRoute as any)}
                  />
                ))}
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              <QuickAction
                icon="checkmark-done"
                label="Approvals"
                badge={pendingApprovalCount}
                onPress={() => router.push('/hub/approvals' as any)}
              />
              <QuickAction
                icon="document-text"
                label="Draw"
                badge={1}
                onPress={() => router.push('/hub/costs' as any)}
              />
              <QuickAction
                icon="shield-checkmark"
                label="Audit"
                badge={auditStats?.criticalCount || 0}
                onPress={() => {}}
              />
              <QuickAction
                icon="trending-up"
                label="Investor"
                onPress={() => router.push('/hub/reports' as any)}
              />
            </View>

            {/* AI Audit Summary */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
                  <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackWarning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Financial Audit Findings</Text>
                  <Text style={styles.cardSubtitle}>AI-detected issues requiring attention</Text>
                </View>
                {(auditStats?.criticalCount || 0) > 0 && (
                  <View style={[styles.badgePill, { backgroundColor: SemanticColors.feedbackError }]}>
                    <Text style={styles.badgePillText}>{auditStats?.criticalCount || 0} critical</Text>
                  </View>
                )}
              </View>

              {/* Stats Row */}
              <View style={styles.auditStatsRow}>
                <View style={styles.auditStatItem}>
                  <Text style={[styles.auditStatValue, { color: SemanticColors.feedbackError }]}>
                    {financialStats?.criticalFindings || 0}
                  </Text>
                  <Text style={styles.auditStatLabel}>Critical</Text>
                </View>
                <View style={styles.auditStatItem}>
                  <Text style={[styles.auditStatValue, { color: SemanticColors.feedbackWarning }]}>
                    {financialStats?.highFindings || 0}
                  </Text>
                  <Text style={styles.auditStatLabel}>High</Text>
                </View>
                <View style={styles.auditStatItem}>
                  <Text style={[styles.auditStatValue, { color: CFO_COLOR }]}>
                    {formatCompact(financialStats?.totalDiscrepancyValue || 0)}
                  </Text>
                  <Text style={styles.auditStatLabel}>Total Impact</Text>
                </View>
                <View style={styles.auditStatItem}>
                  <Text style={[styles.auditStatValue, { color: SemanticColors.feedbackSuccess }]}>
                    {formatCompact(financialStats?.potentialSavings || totalSavings || 0)}
                  </Text>
                  <Text style={styles.auditStatLabel}>Savings</Text>
                </View>
              </View>

              {/* Sample Findings */}
              {auditLoading ? (
                <ActivityIndicator size="small" color={CFO_COLOR} />
              ) : (
                <View style={styles.findingsList}>
                  {auditFindings.slice(0, 2).map((finding) => (
                    <AuditFindingCard key={finding.id} finding={finding} />
                  ))}
                  {financialFindings.slice(0, 1).map((finding) => (
                    <AuditFindingCard key={finding.id} finding={finding} />
                  ))}
                </View>
              )}
            </View>

            {/* Pending Approvals */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="checkmark-done" size={18} color={CFO_COLOR} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Pending Approvals</Text>
                  <Text style={styles.cardSubtitle}>AI-verified payment requests</Text>
                </View>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{pendingApprovalCount}</Text>
                </View>
              </View>

              <View style={styles.approvalsList}>
                {MOCK_PENDING_APPROVALS.slice(0, 2).map((approval) => (
                  <ApprovalCard
                    key={approval.id}
                    approval={approval}
                    onApprove={() => handleApprove(approval)}
                    onReview={() => {}}
                  />
                ))}
              </View>
            </View>
          </>
        )}

        {/* COSTS TAB */}
        {activeTab === 'costs' && costHealth && selectedProject && (
          <>
            {/* Project Selector */}
            <View style={styles.section}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.projectRow}>
                  {mockProjects.map((project) => (
                    <Pressable
                      key={project.id}
                      style={[
                        styles.projectPill,
                        selectedProjectId === project.id && styles.projectPillActive,
                      ]}
                      onPress={() => setSelectedProjectId(project.id)}
                    >
                      <Text style={styles.projectCountry}>{project.country}</Text>
                      <Text style={[
                        styles.projectName,
                        selectedProjectId === project.id && styles.projectNameActive,
                      ]} numberOfLines={1}>
                        {project.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* CPI Status Banner */}
            <View style={[
              styles.cpiBanner,
              costHealth.status === 'healthy' && styles.cpiBannerHealthy,
              costHealth.status === 'at-risk' && styles.cpiBannerWarning,
              costHealth.status === 'critical' && styles.cpiBannerCritical,
            ]}>
              <View style={styles.cpiLeft}>
                <Text style={styles.cpiLabel}>Cost Performance Index</Text>
                <Text style={styles.cpiStatus}>
                  {costHealth.status === 'healthy' ? 'On Budget' :
                   costHealth.status === 'at-risk' ? 'At Risk' : 'Over Budget'}
                </Text>
              </View>
              <View style={styles.cpiCircle}>
                <Text style={styles.cpiValue}>{costHealth.cpi.toFixed(2)}</Text>
              </View>
            </View>

            {/* Cost Metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cost Summary</Text>
              <View style={styles.costMetrics}>
                <MetricCard
                  value={fmt(selectedProject.totalBudget)}
                  label="Budget"
                />
                <MetricCard
                  value={fmt(selectedProject.actualSpent)}
                  label="Spent"
                  subtitle={`${Math.round((selectedProject.actualSpent / selectedProject.totalBudget) * 100)}%`}
                />
                <MetricCard
                  value={fmt(costHealth.eac)}
                  label="EAC"
                  color={costHealth.budgetVariance < 0 ? SemanticColors.feedbackError : undefined}
                />
                <MetricCard
                  value={formatVariance(costHealth.budgetVariance, currency)}
                  label="Variance"
                  color={costHealth.budgetVariance >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
                  trend={costHealth.budgetVariance >= 0 ? 'up' : 'down'}
                />
              </View>
            </View>

            {/* AI-Detected Cost Issues */}
            {(totalOverpaid > 0 || totalSavings > 0) && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
                    <Ionicons name="alert-circle" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <Text style={styles.cardTitle}>AI Cost Analysis</Text>
                </View>
                <View style={styles.costAnalysisGrid}>
                  {totalOverpaid > 0 && (
                    <View style={styles.costAnalysisItem}>
                      <Ionicons name="trending-down" size={20} color={SemanticColors.feedbackError} />
                      <Text style={styles.costAnalysisLabel}>Overpayments Detected</Text>
                      <Text style={[styles.costAnalysisValue, { color: SemanticColors.feedbackError }]}>
                        {formatCompact(totalOverpaid)}
                      </Text>
                      <Text style={styles.costAnalysisCount}>
                        {overpaymentAnalysis?.findings.length || 0} findings
                      </Text>
                    </View>
                  )}
                  {totalSavings > 0 && (
                    <View style={styles.costAnalysisItem}>
                      <Ionicons name="bulb" size={20} color={SemanticColors.feedbackSuccess} />
                      <Text style={styles.costAnalysisLabel}>Savings Opportunities</Text>
                      <Text style={[styles.costAnalysisValue, { color: SemanticColors.feedbackSuccess }]}>
                        {formatCompact(totalSavings)}
                      </Text>
                      <Text style={styles.costAnalysisCount}>
                        {savingsAnalysis?.findings.length || 0} opportunities
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Contingency */}
            <View style={styles.card}>
              <View style={styles.contingencyHeader}>
                <Text style={styles.cardTitle}>Contingency</Text>
                <Text style={[
                  styles.contingencyPercent,
                  costHealth.contingencyPercent < 0.3 && { color: SemanticColors.feedbackError }
                ]}>
                  {formatPercent(costHealth.contingencyPercent)} remaining
                </Text>
              </View>

              <View style={styles.contingencyBar}>
                <View style={[
                  styles.contingencyUsed,
                  { width: `${(1 - costHealth.contingencyPercent) * 100}%` },
                  costHealth.contingencyPercent < 0.3 && styles.contingencyUsedDanger,
                ]} />
              </View>

              <View style={styles.contingencyDetails}>
                <View style={styles.contingencyDetail}>
                  <Text style={styles.contingencyDetailLabel}>Total</Text>
                  <Text style={styles.contingencyDetailValue}>{fmt(selectedProject.contingency)}</Text>
                </View>
                <View style={styles.contingencyDetail}>
                  <Text style={styles.contingencyDetailLabel}>Used</Text>
                  <Text style={[styles.contingencyDetailValue, { color: SemanticColors.feedbackWarning }]}>
                    {fmt(selectedProject.contingencyUsed)}
                  </Text>
                </View>
                <View style={styles.contingencyDetail}>
                  <Text style={styles.contingencyDetailLabel}>Remaining</Text>
                  <Text style={[styles.contingencyDetailValue, { color: CFO_COLOR }]}>
                    {fmt(costHealth.contingencyRemaining)}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* CASHFLOW TAB */}
        {activeTab === 'cashflow' && (
          <>
            {/* Cash Position Summary */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="cash" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Cash Position</Text>
              </View>
              <View style={styles.cashPositionGrid}>
                <View style={styles.cashPositionItem}>
                  <Text style={styles.cashPositionLabel}>Available</Text>
                  <Text style={[styles.cashPositionValue, { color: CFO_COLOR }]}>£4.2M</Text>
                </View>
                <View style={styles.cashPositionItem}>
                  <Text style={styles.cashPositionLabel}>Committed</Text>
                  <Text style={styles.cashPositionValue}>£2.8M</Text>
                </View>
                <View style={styles.cashPositionItem}>
                  <Text style={styles.cashPositionLabel}>Drawn</Text>
                  <Text style={styles.cashPositionValue}>£12.4M</Text>
                </View>
                <View style={styles.cashPositionItem}>
                  <Text style={styles.cashPositionLabel}>Facility</Text>
                  <Text style={styles.cashPositionValue}>£18.5M</Text>
                </View>
              </View>
            </View>

            {/* Cash Flow Alert */}
            {activeGuidance.find(g => g.type === 'cashflow') && (
              <VascoGuidanceCard
                guidance={activeGuidance.find(g => g.type === 'cashflow')!}
                onDismiss={() => handleDismissGuidance(activeGuidance.find(g => g.type === 'cashflow')!.id)}
              />
            )}

            {/* Pending Handovers - Blocking Payment Release */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackWarningBg }]}>
                  <Ionicons name="document-attach" size={18} color={SemanticColors.feedbackWarning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Handovers Blocking Payment</Text>
                  <Text style={styles.cardSubtitle}>Complete handover to release funds</Text>
                </View>
                <View style={[styles.badgePill, { backgroundColor: SemanticColors.feedbackWarning }]}>
                  <Text style={styles.badgePillText}>{MOCK_PENDING_HANDOVERS.length}</Text>
                </View>
              </View>

              <View style={styles.handoverList}>
                {MOCK_PENDING_HANDOVERS.map((handover) => (
                  <View key={handover.id} style={styles.handoverItem}>
                    <View style={styles.handoverTop}>
                      <View style={styles.handoverInfo}>
                        <Text style={styles.handoverProject}>{handover.projectName}</Text>
                        <Text style={styles.handoverWorkPackage}>{handover.workPackage}</Text>
                        <Text style={styles.handoverContractor}>{handover.contractor}</Text>
                      </View>
                      <View style={styles.handoverPayment}>
                        <Text style={styles.handoverAmount}>{formatCompact(handover.paymentAmount, 'GBP')}</Text>
                        <View style={[
                          styles.handoverStatusBadge,
                          handover.handoverStatus === 'awaiting-signoff' && styles.handoverStatusSignoff,
                          handover.handoverStatus === 'in-review' && styles.handoverStatusReview,
                          handover.handoverStatus === 'pending' && styles.handoverStatusPending,
                        ]}>
                          <Text style={styles.handoverStatusText}>
                            {handover.handoverStatus === 'awaiting-signoff' ? 'Awaiting Sign-off' :
                             handover.handoverStatus === 'in-review' ? 'In Review' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.handoverProgressContainer}>
                      <View style={styles.handoverProgressBar}>
                        <View style={[
                          styles.handoverProgressFill,
                          { width: `${handover.completionPercentage}%` },
                          handover.completionPercentage >= 90 && styles.handoverProgressGood,
                          handover.completionPercentage >= 70 && handover.completionPercentage < 90 && styles.handoverProgressMedium,
                          handover.completionPercentage < 70 && styles.handoverProgressLow,
                        ]} />
                      </View>
                      <Text style={styles.handoverProgressText}>{handover.completionPercentage}%</Text>
                    </View>

                    {/* Missing Items */}
                    {handover.missingItems.length > 0 && (
                      <View style={styles.handoverMissing}>
                        <Ionicons name="alert-circle" size={12} color={SemanticColors.feedbackWarning} />
                        <Text style={styles.handoverMissingText}>
                          Missing: {handover.missingItems.join(', ')}
                        </Text>
                      </View>
                    )}

                    {/* Due Date */}
                    <View style={styles.handoverFooter}>
                      <Text style={[
                        styles.handoverDue,
                        handover.dueDate === 'Today' && { color: SemanticColors.feedbackError },
                      ]}>
                        Payment due: {handover.dueDate}
                      </Text>
                      <Pressable style={styles.handoverAction}>
                        <Text style={styles.handoverActionText}>View Pack</Text>
                        <Ionicons name="chevron-forward" size={14} color={CFO_COLOR} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>

              {/* Summary Banner */}
              <View style={styles.handoverSummary}>
                <Ionicons name="lock-closed" size={16} color={SemanticColors.feedbackWarning} />
                <Text style={styles.handoverSummaryText}>
                  {formatCompact(MOCK_PENDING_HANDOVERS.reduce((sum, h) => sum + h.paymentAmount, 0), 'GBP')} blocked pending handover completion
                </Text>
              </View>
            </View>

            {/* Pending Draw Requests */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="document-text" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Pending Draw Requests</Text>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>3</Text>
                </View>
              </View>
              <View style={styles.drawRequestsList}>
                {[
                  { project: 'Meridian Tower', amount: 850000, stage: 'Structural', status: 'awaiting' },
                  { project: 'Thames View', amount: 420000, stage: 'M&E First Fix', status: 'in-review' },
                  { project: 'Green Quarter', amount: 1200000, stage: 'Facade', status: 'awaiting' },
                ].map((request, idx) => (
                  <View key={idx} style={styles.drawRequestItem}>
                    <View style={styles.drawRequestLeft}>
                      <Text style={styles.drawRequestProject}>{request.project}</Text>
                      <Text style={styles.drawRequestStage}>{request.stage}</Text>
                    </View>
                    <View style={styles.drawRequestRight}>
                      <Text style={styles.drawRequestAmount}>{formatCompact(request.amount, 'GBP')}</Text>
                      <View style={[
                        styles.drawRequestStatus,
                        request.status === 'in-review' && styles.drawRequestStatusReview,
                      ]}>
                        <Text style={styles.drawRequestStatusText}>
                          {request.status === 'awaiting' ? 'Awaiting' : 'In Review'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Transfer Tax Calculator */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="calculator" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Transfer Tax Calculator</Text>
              </View>

              <View style={styles.taxCountryRow}>
                {(['UK', 'NL', 'DE'] as Country[]).map((country) => (
                  <Pressable
                    key={country}
                    style={[
                      styles.taxCountryPill,
                      taxCountry === country && styles.taxCountryPillActive,
                    ]}
                    onPress={() => setTaxCountry(country)}
                  >
                    <Text style={[
                      styles.taxCountryText,
                      taxCountry === country && styles.taxCountryTextActive,
                    ]}>
                      {country === 'UK' ? 'UK SDLT' : country === 'NL' ? 'NL RETT' : 'DE RETT'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.taxInputContainer}>
                <Text style={styles.taxInputLabel}>Purchase Price</Text>
                <View style={styles.taxInputRow}>
                  <Text style={styles.taxCurrency}>{taxCountry === 'UK' ? '£' : '€'}</Text>
                  <TextInput
                    style={styles.taxInput}
                    placeholder="Enter amount"
                    placeholderTextColor={SemanticColors.textTertiary}
                    value={taxAmount}
                    onChangeText={setTaxAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {taxResult && (
                <View style={styles.taxResult}>
                  <View style={styles.taxResultRow}>
                    <Text style={styles.taxResultLabel}>
                      {taxCountry === 'UK' ? 'SDLT Payable' :
                       taxCountry === 'NL' ? 'Overdrachtsbelasting' : 'Grunderwerbsteuer'}
                    </Text>
                    <Text style={styles.taxResultValue}>
                      {formatCompact(taxResult.totalTax, taxCountry === 'UK' ? 'GBP' : 'EUR')}
                    </Text>
                  </View>
                  <View style={styles.taxResultRow}>
                    <Text style={styles.taxEffectiveLabel}>Effective Rate</Text>
                    <Text style={styles.taxEffectiveValue}>{formatPercent(taxResult.effectiveRate)}</Text>
                  </View>
                </View>
              )}
            </View>
          </>
        )}

        {/* RETURNS TAB */}
        {activeTab === 'returns' && (
          <>
            {/* Portfolio Returns Summary */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="pie-chart" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Portfolio Returns</Text>
              </View>
              <View style={styles.portfolioReturnsGrid}>
                <View style={styles.portfolioReturnItem}>
                  <Text style={styles.portfolioReturnLabel}>Blended IRR</Text>
                  <Text style={[styles.portfolioReturnValue, { color: CFO_COLOR }]}>
                    {formatPercent(portfolioMetrics.avgIrr)}
                  </Text>
                </View>
                <View style={styles.portfolioReturnItem}>
                  <Text style={styles.portfolioReturnLabel}>Total Profit</Text>
                  <Text style={styles.portfolioReturnValue}>£18.4M</Text>
                </View>
                <View style={styles.portfolioReturnItem}>
                  <Text style={styles.portfolioReturnLabel}>Equity Multiple</Text>
                  <Text style={styles.portfolioReturnValue}>1.82x</Text>
                </View>
                <View style={styles.portfolioReturnItem}>
                  <Text style={styles.portfolioReturnLabel}>Avg PoC</Text>
                  <Text style={styles.portfolioReturnValue}>24.5%</Text>
                </View>
              </View>
            </View>

            {/* Project Returns Comparison */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="bar-chart" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Project Returns</Text>
              </View>
              <View style={styles.projectReturnsList}>
                {mockProjects.map((project) => {
                  const appr = mockAppraisals[project.id];
                  if (!appr) return null;
                  return (
                    <Pressable
                      key={project.id}
                      style={[
                        styles.projectReturnItem,
                        selectedProjectId === project.id && styles.projectReturnItemActive,
                      ]}
                      onPress={() => setSelectedProjectId(project.id)}
                    >
                      <View style={styles.projectReturnHeader}>
                        <Text style={styles.projectReturnName}>{project.name}</Text>
                        <Text style={styles.projectReturnCountry}>{project.country}</Text>
                      </View>
                      <View style={styles.projectReturnMetrics}>
                        <View style={styles.projectReturnMetric}>
                          <Text style={styles.projectReturnMetricLabel}>IRR</Text>
                          <Text style={[styles.projectReturnMetricValue, { color: CFO_COLOR }]}>
                            {formatPercent(appr.irr)}
                          </Text>
                        </View>
                        <View style={styles.projectReturnMetric}>
                          <Text style={styles.projectReturnMetricLabel}>NPV</Text>
                          <Text style={styles.projectReturnMetricValue}>
                            {formatCompact(appr.npv, getCurrencyForCountry(project.country))}
                          </Text>
                        </View>
                        <View style={styles.projectReturnMetric}>
                          <Text style={styles.projectReturnMetricLabel}>PoC</Text>
                          <Text style={styles.projectReturnMetricValue}>
                            {formatPercent(appr.profitOnCost)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Investor Returns */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="people" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Investor Returns</Text>
              </View>
              <View style={styles.investorReturnsList}>
                {[
                  { name: 'Equity Partner A', committed: 5000000, distributed: 2100000, irr: 0.28 },
                  { name: 'Mezzanine Fund', committed: 3000000, distributed: 1400000, irr: 0.18 },
                  { name: 'Co-Invest Pool', committed: 2000000, distributed: 850000, irr: 0.24 },
                ].map((investor, idx) => (
                  <View key={idx} style={styles.investorReturnItem}>
                    <View style={styles.investorReturnTop}>
                      <Text style={styles.investorReturnName}>{investor.name}</Text>
                      <Text style={[styles.investorReturnIRR, { color: CFO_COLOR }]}>
                        {formatPercent(investor.irr)} IRR
                      </Text>
                    </View>
                    <View style={styles.investorReturnBottom}>
                      <View style={styles.investorReturnStat}>
                        <Text style={styles.investorReturnStatLabel}>Committed</Text>
                        <Text style={styles.investorReturnStatValue}>
                          {formatCompact(investor.committed, 'GBP')}
                        </Text>
                      </View>
                      <View style={styles.investorReturnStat}>
                        <Text style={styles.investorReturnStatLabel}>Distributed</Text>
                        <Text style={styles.investorReturnStatValue}>
                          {formatCompact(investor.distributed, 'GBP')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Sensitivity Analysis */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="analytics" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Sensitivity Analysis</Text>
              </View>
              <View style={styles.sensitivityGrid}>
                {[
                  { scenario: 'GDV -5%', irr: 0.16, impact: 'moderate' },
                  { scenario: 'GDV -10%', irr: 0.11, impact: 'high' },
                  { scenario: 'Cost +5%', irr: 0.18, impact: 'low' },
                  { scenario: 'Cost +10%', irr: 0.14, impact: 'moderate' },
                  { scenario: 'Delay 3mo', irr: 0.19, impact: 'low' },
                  { scenario: 'Delay 6mo', irr: 0.16, impact: 'moderate' },
                ].map((item, idx) => (
                  <View key={idx} style={styles.sensitivityItem}>
                    <Text style={styles.sensitivityScenario}>{item.scenario}</Text>
                    <Text style={[
                      styles.sensitivityIRR,
                      item.impact === 'high' && { color: SemanticColors.feedbackError },
                      item.impact === 'moderate' && { color: SemanticColors.feedbackWarning },
                      item.impact === 'low' && { color: CFO_COLOR },
                    ]}>
                      {formatPercent(item.irr)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={confirmModalVisible}
        approval={selectedApproval}
        onConfirm={handleConfirmApproval}
        onCancel={() => {
          setConfirmModalVisible(false);
          setSelectedApproval(null);
        }}
      />
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },

  // Header
  header: {
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackError,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  headerAccent: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  headerMetrics: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: Spacing.md,
  },
  headerMetric: {
    flex: 1,
    alignItems: 'center',
  },
  headerMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerMetricLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  headerMetricDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: CFO_COLOR,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: '#fff',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },

  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },

  // Section
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Vasco Guidance
  guidanceList: {
    gap: Spacing.sm,
  },
  guidanceCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 4,
    gap: 8,
  },
  guidanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  guidanceIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidanceHeaderText: {
    flex: 1,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  guidanceTimestamp: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  guidanceMessage: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  guidanceImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guidanceImpactText: {
    fontSize: 13,
    fontWeight: '600',
  },
  guidanceAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 4,
  },
  guidanceActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: CFO_COLOR,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CFO_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: SemanticColors.feedbackError,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
  },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: CFO_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },

  // Badge Pill
  badgePill: {
    backgroundColor: CFO_COLOR,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },

  // Audit Stats
  auditStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  auditStatItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  auditStatValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  auditStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Findings
  findingsList: {
    gap: 10,
  },
  findingCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    borderLeftWidth: 3,
    gap: 6,
  },
  findingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  findingSeverityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  findingSeverityText: {
    fontSize: 9,
    fontWeight: '700',
  },
  findingCategory: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  findingTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  findingDescription: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  findingImpact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  findingImpactText: {
    fontSize: 12,
    fontWeight: '600',
  },
  findingAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  findingActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: CFO_COLOR,
    textTransform: 'capitalize',
  },

  // Approvals
  approvalsList: {
    gap: 12,
  },
  approvalCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    gap: 10,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  approvalInfo: {
    flex: 1,
  },
  approvalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  approvalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  approvalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  approvalStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  approvalStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  approvalProject: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  approvalVendor: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  approvalAmount: {
    alignItems: 'flex-end',
  },
  approvalAmountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  approvalDue: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  aiVerificationContainer: {
    backgroundColor: CFO_COLOR + '08',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  aiVerificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiVerificationTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: CFO_COLOR,
  },
  aiCheckRow: {
    flexDirection: 'row',
    gap: 12,
  },
  aiCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiCheckLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  aiIssuesList: {
    gap: 4,
    marginTop: 4,
  },
  aiIssueItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  aiIssueText: {
    fontSize: 11,
    color: SemanticColors.feedbackWarning,
    flex: 1,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
  },
  approvalActionButton: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  approvalActionButtonPrimary: {
    backgroundColor: CFO_COLOR,
  },
  approvalActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  approvalActionButtonTextPrimary: {
    color: '#fff',
  },
  approvalActionButtonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  approvalActionButtonTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: CFO_COLOR,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: CFO_COLOR,
  },
  modalWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: CFO_COLOR + '10',
    padding: Spacing.sm,
    borderRadius: 8,
  },
  modalWarningText: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  confirmInput: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: SemanticColors.textPrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  modalActions: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: CFO_COLOR,
  },
  modalConfirmButtonDisabled: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Project Selector
  projectRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  projectPill: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    minWidth: 100,
  },
  projectPillActive: {
    borderColor: CFO_COLOR,
    backgroundColor: CFO_COLOR + '10',
  },
  projectCountry: {
    fontSize: 10,
    fontWeight: '700',
    color: CFO_COLOR,
  },
  projectName: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  projectNameActive: {
    color: SemanticColors.textPrimary,
  },

  // CPI Banner
  cpiBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
  },
  cpiBannerHealthy: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  cpiBannerWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  cpiBannerCritical: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  cpiLeft: {},
  cpiLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  cpiStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  cpiCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cpiValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Cost Metrics
  costMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  metricSubtitle: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Cost Analysis Grid
  costAnalysisGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  costAnalysisItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  costAnalysisLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  costAnalysisValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  costAnalysisCount: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },

  // Contingency
  contingencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contingencyPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: CFO_COLOR,
  },
  contingencyBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  contingencyUsed: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackWarning,
    borderRadius: 4,
  },
  contingencyUsedDanger: {
    backgroundColor: SemanticColors.feedbackError,
  },
  contingencyDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  contingencyDetail: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  contingencyDetailLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  contingencyDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },

  // Cash Position
  cashPositionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cashPositionItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  cashPositionLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  cashPositionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },

  // Handover Styles
  handoverList: {
    gap: 12,
  },
  handoverItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    gap: 8,
  },
  handoverTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  handoverInfo: {
    flex: 1,
  },
  handoverProject: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  handoverWorkPackage: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  handoverContractor: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  handoverPayment: {
    alignItems: 'flex-end',
  },
  handoverAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  handoverStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  handoverStatusSignoff: {
    backgroundColor: SemanticColors.feedbackInfoBg,
  },
  handoverStatusReview: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  handoverStatusPending: {
    backgroundColor: SemanticColors.surfaceTertiary,
  },
  handoverStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  handoverProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  handoverProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  handoverProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  handoverProgressGood: {
    backgroundColor: SemanticColors.feedbackSuccess,
  },
  handoverProgressMedium: {
    backgroundColor: SemanticColors.feedbackWarning,
  },
  handoverProgressLow: {
    backgroundColor: SemanticColors.feedbackError,
  },
  handoverProgressText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    width: 32,
    textAlign: 'right',
  },
  handoverMissing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackWarningBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  handoverMissingText: {
    fontSize: 11,
    color: SemanticColors.feedbackWarning,
    flex: 1,
  },
  handoverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderMuted,
  },
  handoverDue: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  handoverAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  handoverActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: CFO_COLOR,
  },
  handoverSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarningBorder,
  },
  handoverSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Draw Requests
  drawRequestsList: {
    gap: 10,
  },
  drawRequestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
  },
  drawRequestLeft: {
    flex: 1,
  },
  drawRequestProject: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  drawRequestStage: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  drawRequestRight: {
    alignItems: 'flex-end',
  },
  drawRequestAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  drawRequestStatus: {
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  drawRequestStatusReview: {
    backgroundColor: CFO_COLOR + '20',
  },
  drawRequestStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },

  // Tax Calculator
  taxCountryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  taxCountryPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  taxCountryPillActive: {
    backgroundColor: CFO_COLOR + '15',
    borderColor: CFO_COLOR,
  },
  taxCountryText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  taxCountryTextActive: {
    color: CFO_COLOR,
  },
  taxInputContainer: {
    gap: 6,
  },
  taxInputLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  taxInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  taxCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    paddingLeft: 12,
    paddingRight: 4,
  },
  taxInput: {
    flex: 1,
    padding: 12,
    color: SemanticColors.textPrimary,
    fontSize: 14,
  },
  taxResult: {
    backgroundColor: CFO_COLOR + '10',
    borderRadius: 10,
    padding: Spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: CFO_COLOR + '30',
  },
  taxResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taxResultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  taxResultValue: {
    fontSize: 20,
    fontWeight: '700',
    color: CFO_COLOR,
  },
  taxEffectiveLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  taxEffectiveValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },

  // Portfolio Returns
  portfolioReturnsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portfolioReturnItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  portfolioReturnLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  portfolioReturnValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },

  // Project Returns List
  projectReturnsList: {
    gap: 10,
  },
  projectReturnItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  projectReturnItemActive: {
    borderColor: CFO_COLOR,
    backgroundColor: CFO_COLOR + '08',
  },
  projectReturnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  projectReturnName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  projectReturnCountry: {
    fontSize: 11,
    fontWeight: '600',
    color: CFO_COLOR,
  },
  projectReturnMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  projectReturnMetric: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 6,
    paddingVertical: 6,
  },
  projectReturnMetricLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  projectReturnMetricValue: {
    fontSize: 13,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },

  // Investor Returns
  investorReturnsList: {
    gap: 10,
  },
  investorReturnItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
  },
  investorReturnTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  investorReturnName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  investorReturnIRR: {
    fontSize: 13,
    fontWeight: '700',
  },
  investorReturnBottom: {
    flexDirection: 'row',
    gap: 8,
  },
  investorReturnStat: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
  },
  investorReturnStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  investorReturnStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },

  // Sensitivity Analysis
  sensitivityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sensitivityItem: {
    width: '31%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  sensitivityScenario: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },
  sensitivityIRR: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
});
