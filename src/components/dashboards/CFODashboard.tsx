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

// Vasco Guidance
import { useVascoGuidance, useInlineInsight } from '../../services/vascoGuidanceService';
import { VascoInsightList, InlineInsight } from '../shared/VascoInsightCard';
import type { VascoInsight } from '../shared/VascoInsightCard';
import { FinancialAuditorDashboard } from '../financial-auditor/FinancialAuditorDashboard';
import { FinancialKPIGrid } from '../shared/FinancialKPIGrid';
import { PLStatementView } from '../shared/PLStatementView';
import { TrendBarChart } from '../shared/TrendBarChart';
import { ReceivablesAgingBar } from '../shared/ReceivablesAgingBar';
import { ScenarioComparisonCard } from '../shared/ScenarioComparisonCard';

// Cross-Role Workflows
import {
  useWorkflowsForRole,
  usePendingWorkflows,
  useJobToPaymentWorkflows,
  useWorkflowStats,
  crossRoleWorkflowService,
} from '../../services/crossRoleWorkflowService';
import type { Workflow } from '../../services/crossRoleWorkflowService';

type IconName = keyof typeof Ionicons.glyphMap;

// (Vasco AI Guidance now provided via useVascoGuidance service)

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
// NEW MOCK DATA FOR FINANCIAL COMPONENTS
// =============================================================================

const MOCK_MONTHLY_SPEND = [
  { label: 'Sep', value: 3200000 },
  { label: 'Okt', value: 4100000 },
  { label: 'Nov', value: 3800000 },
  { label: 'Dec', value: 5200000 },
  { label: 'Jan', value: 4600000 },
  { label: 'Feb', value: 5800000 },
];

const MOCK_AGING_BUCKETS = [
  { label: 'Huidig', amount: 2400000, color: '#2563EB' },
  { label: '30d', amount: 850000, color: '#EAB308' },
  { label: '60d', amount: 320000, color: '#F97316' },
  { label: '90d+', amount: 180000, color: '#EF4444' },
];

const MOCK_CASHFLOW_MONTHLY = [
  { label: 'Sep', value: 1200000 },
  { label: 'Okt', value: -800000 },
  { label: 'Nov', value: 1500000 },
  { label: 'Dec', value: -2100000 },
  { label: 'Jan', value: 900000 },
  { label: 'Feb', value: -400000 },
];

const MOCK_SCENARIOS = [
  { name: 'Neerwaarts', irr: '14.2%', profit: '\u00A312.1M', equityMultiple: '1.48x' },
  { name: 'Basis', irr: '22.4%', profit: '\u00A318.4M', equityMultiple: '1.82x', isBase: true },
  { name: 'Opwaarts', irr: '29.8%', profit: '\u00A324.6M', equityMultiple: '2.14x' },
];

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
  const [snoozedGuidance, setSnoozedGuidance] = useState<Set<string>>(new Set());
  const [showFullAuditor, setShowFullAuditor] = useState(false);

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

  // Vasco AI Guidance (from service)
  const screenContext = activeTab === 'overview' ? 'today' : activeTab;
  const allGuidance = useVascoGuidance('cfo', screenContext as any);
  const activeGuidance = useMemo(
    () => allGuidance.filter(g => !dismissedGuidance.has(g.id) && !snoozedGuidance.has(g.id)),
    [allGuidance, dismissedGuidance, snoozedGuidance]
  );
  const criticalGuidanceCount = useMemo(
    () => activeGuidance.filter(g => g.priority === 'critical' || g.priority === 'high').length,
    [activeGuidance]
  );
  // Inline insights per tab
  const overviewInsight = useInlineInsight('cfo', 'overview', 'overview');
  const costsInsight = useInlineInsight('cfo', 'costs', 'overview');
  const cashflowInsight = useInlineInsight('cfo', 'cashflow', 'overview');
  const returnsInsight = useInlineInsight('cfo', 'returns', 'overview');

  // Cross-role workflow data
  const cfoPendingWorkflows = usePendingWorkflows('cfo');
  const { workflows: jobToPaymentWorkflows } = useJobToPaymentWorkflows();
  const workflowStats = useWorkflowStats();

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

  const handleSnoozeGuidance = useCallback((id: string) => {
    setSnoozedGuidance(prev => new Set(prev).add(id));
  }, []);

  const handleGuidanceAction = useCallback((insight: VascoInsight) => {
    if (insight.actionRoute) router.push(insight.actionRoute as any);
  }, [router]);

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

  // Dynamic header based on active tab
  const headerConfig = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Financial Overview',
          subtitle: `${mockProjects.length} active projects`,
          metrics: [
            { value: formatCompact(portfolioMetrics.totalGdv, 'GBP'), label: 'Total GDV' },
            { value: formatPercent(portfolioMetrics.avgIrr), label: 'Avg IRR', color: CFO_COLOR },
            { value: formatCompact(portfolioMetrics.uncommitted, 'GBP'), label: 'Uncommitted' },
          ],
        };
      case 'costs':
        return {
          title: 'Kostenanalyse',
          subtitle: selectedProject?.name || '',
          metrics: [],
        };
      case 'cashflow':
        return {
          title: 'Cash Flow',
          subtitle: selectedProject?.name || '',
          metrics: [],
        };
      case 'returns':
        return {
          title: 'Returns & IRR',
          subtitle: 'Portfolio performance',
          metrics: [
            { value: formatCompact(portfolioMetrics.totalGdv, 'GBP'), label: 'GDV' },
            { value: formatPercent(portfolioMetrics.avgIrr), label: 'IRR', color: CFO_COLOR },
            { value: formatCompact(portfolioMetrics.totalGdv - portfolioMetrics.totalBudget, 'GBP'), label: 'Profit' },
          ],
        };
      default:
        return {
          title: 'Financial Overview',
          subtitle: '',
          metrics: [],
        };
    }
  }, [activeTab, portfolioMetrics, selectedProject, costHealth, currency]);

  return (
    <View style={styles.container}>
      {/* Header with Portfolio Summary */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{headerConfig.title}</Text>
            <Text style={styles.headerSubtitle}>{headerConfig.subtitle}</Text>
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
        {headerConfig.metrics.length > 0 && (
        <View style={styles.headerMetrics}>
          {headerConfig.metrics.map((metric, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {idx > 0 && <View style={styles.headerMetricDivider} />}
              <View style={[styles.headerMetric, { flex: 1 }]}>
                <Text style={[styles.headerMetricValue, metric.color ? { color: metric.color } : undefined]}>{metric.value}</Text>
                <Text style={styles.headerMetricLabel}>{metric.label}</Text>
              </View>
            </View>
          ))}
        </View>
        )}
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
            {/* KPI Scorecard Grid */}
            <FinancialKPIGrid
              accentColor={CFO_COLOR}
              tiles={[
                { label: 'Portfolio GDV', value: formatCompact(portfolioMetrics.totalGdv, 'GBP'), variance: '+3.2%', varianceDirection: 'up', status: 'green' },
                { label: 'Gemiddeld IRR', value: formatPercent(portfolioMetrics.avgIrr), variance: '+1.1%', varianceDirection: 'up', status: 'green', heroBg: true },
                { label: 'Totaal Budget', value: formatCompact(portfolioMetrics.totalBudget, 'GBP'), budgetLabel: `${mockProjects.length} projecten` },
                { label: 'Totaal Besteed', value: formatCompact(portfolioMetrics.totalSpent, 'GBP'), variance: '-2.1%', varianceDirection: 'down', status: 'amber' },
                { label: 'Ongecommitteerd', value: formatCompact(portfolioMetrics.uncommitted, 'GBP'), status: 'green' },
                { label: 'Goedkeuringen', value: `${pendingApprovalCount}`, status: pendingApprovalCount > 2 ? 'red' : 'amber', onPress: () => setActiveTab('costs') },
              ]}
            />

            {/* Monthly Spend Trend */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>MAANDELIJKSE BESTEDING</Text>
              <TrendBarChart
                data={MOCK_MONTHLY_SPEND}
                positiveColor={CFO_COLOR}
                currency="GBP"
              />
            </View>

            {/* Receivables Aging */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>DEBITEUREN VEROUDERING</Text>
              <ReceivablesAgingBar buckets={MOCK_AGING_BUCKETS} currency="GBP" />
            </View>

            {/* Vasco AI Guidance */}
            <VascoInsightList
              insights={activeGuidance}
              title="Vasco AI Guidance"
              compact
              maxVisible={1}
              onDismiss={handleDismissGuidance}
              onAction={handleGuidanceAction}
              onSnooze={handleSnoozeGuidance}
            />

            {overviewInsight && (
              <InlineInsight
                icon={overviewInsight.icon as IconName}
                message={overviewInsight.message}
              />
            )}

            {/* Financial Auditor (compact card) */}
            <FinancialAuditorDashboard
              projectId="project-001"
              compact
              onExpandPress={() => setShowFullAuditor(true)}
            />

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

            {/* Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/ai-assistant' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: CFO_COLOR + '15' }]}>
                    <Ionicons name="sparkles" size={18} color={CFO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>AI Assistent</Text>
                    <Text style={styles.actionSubtitle}>Snelle financiële vragen & AI hulp</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/compliance' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Compliance</Text>
                    <Text style={styles.actionSubtitle}>Regelgeving & nalevingsoverzicht</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/documents' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="folder-open" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Documenten</Text>
                    <Text style={styles.actionSubtitle}>Financiële documentkluis</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>

            {/* Cross-Role Payment Workflows */}
            {jobToPaymentWorkflows.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: CFO_COLOR + '15' }]}>
                    <Ionicons name="git-network" size={18} color={CFO_COLOR} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Betaling Workflows</Text>
                    <Text style={styles.cardSubtitle}>Cross-role goedkeuringsprocessen</Text>
                  </View>
                  {workflowStats.pendingPaymentValue > 0 && (
                    <View style={[styles.badgePill, { backgroundColor: SemanticColors.feedbackWarning }]}>
                      <Text style={styles.badgePillText}>{formatCompact(workflowStats.pendingPaymentValue)}</Text>
                    </View>
                  )}
                </View>

                {/* Workflow Stats Summary */}
                <View style={styles.wfStatsRow}>
                  <View style={styles.wfStatItem}>
                    <Text style={[styles.wfStatValue, { color: CFO_COLOR }]}>
                      {workflowStats.total}
                    </Text>
                    <Text style={styles.wfStatLabel}>Totaal</Text>
                  </View>
                  <View style={styles.wfStatItem}>
                    <Text style={[styles.wfStatValue, { color: SemanticColors.feedbackWarning }]}>
                      {cfoPendingWorkflows.length}
                    </Text>
                    <Text style={styles.wfStatLabel}>Wachtend</Text>
                  </View>
                  <View style={styles.wfStatItem}>
                    <Text style={[styles.wfStatValue, { color: SemanticColors.feedbackSuccess }]}>
                      {workflowStats.byStatus['completed'] || 0}
                    </Text>
                    <Text style={styles.wfStatLabel}>Afgerond</Text>
                  </View>
                </View>

                {/* Active Payment Workflows */}
                {jobToPaymentWorkflows
                  .filter(wf => wf.status !== 'completed' && wf.status !== 'cancelled')
                  .slice(0, 3)
                  .map((wf) => {
                    const currentStep = wf.steps.find(s => s.id === wf.currentStepId);
                    const completedSteps = wf.steps.filter(s => s.status === 'completed').length;
                    const isCfoStep = currentStep?.assignedRole === 'cfo';

                    return (
                      <View key={wf.id} style={styles.wfPaymentItem}>
                        <View style={styles.wfPaymentHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.wfPaymentTitle}>{wf.title}</Text>
                            <Text style={styles.wfPaymentMeta}>
                              {wf.projectName} · {wf.initiatedBy.userName}
                            </Text>
                          </View>
                          <View style={styles.wfPaymentAmount}>
                            <Text style={styles.wfPaymentAmountText}>
                              {wf.currency === 'GBP' ? '£' : '€'}{wf.amount?.toLocaleString()}
                            </Text>
                          </View>
                        </View>

                        {/* Step Progress */}
                        <View style={styles.wfStepsTrack}>
                          {wf.steps.map((step, idx) => (
                            <View key={step.id} style={styles.wfStepIndicator}>
                              <View style={[
                                styles.wfStepCircle,
                                step.status === 'completed' && { backgroundColor: SemanticColors.feedbackSuccess },
                                step.status === 'in-progress' && { backgroundColor: CFO_COLOR },
                                step.status === 'pending' && { backgroundColor: SemanticColors.surfaceSecondary },
                              ]}>
                                {step.status === 'completed' && (
                                  <Ionicons name="checkmark" size={8} color="#fff" />
                                )}
                              </View>
                              {idx < wf.steps.length - 1 && (
                                <View style={[
                                  styles.wfStepLine,
                                  step.status === 'completed' && { backgroundColor: SemanticColors.feedbackSuccess },
                                ]} />
                              )}
                            </View>
                          ))}
                        </View>

                        {currentStep && (
                          <View style={styles.wfCurrentStep}>
                            <Ionicons
                              name={isCfoStep ? 'arrow-forward-circle' : 'time'}
                              size={14}
                              color={isCfoStep ? CFO_COLOR : SemanticColors.textTertiary}
                            />
                            <Text style={[
                              styles.wfCurrentStepText,
                              isCfoStep && { color: CFO_COLOR, fontWeight: '600' },
                            ]}>
                              {currentStep.name}
                              {isCfoStep ? ' (jouw actie)' : ` (${currentStep.assignedRole})`}
                            </Text>
                          </View>
                        )}

                        {isCfoStep && (
                          <View style={styles.wfCfoActions}>
                            <Pressable
                              style={[styles.wfCfoApproveBtn, { backgroundColor: SemanticColors.feedbackSuccess }]}
                              onPress={() => {
                                crossRoleWorkflowService.approvePayment(
                                  wf.id, 'cfo-001', 'Sarah Chen', `pay-${wf.id}`
                                );
                              }}
                            >
                              <Ionicons name="checkmark" size={14} color="#fff" />
                              <Text style={styles.wfCfoApproveBtnText}>Goedkeuren</Text>
                            </Pressable>
                            <Pressable style={styles.wfCfoReviewBtn}>
                              <Text style={styles.wfCfoReviewBtnText}>Bekijken</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>
            )}
          </>
        )}

        {/* COSTS TAB */}
        {activeTab === 'costs' && costHealth && selectedProject && (
          <>
            {/* KPI Scorecard Grid */}
            <FinancialKPIGrid
              accentColor={CFO_COLOR}
              tiles={[
                {
                  label: 'CPI',
                  value: costHealth.cpi.toFixed(2),
                  status: costHealth.status === 'healthy' ? 'green' : costHealth.status === 'at-risk' ? 'amber' : 'red',
                },
                {
                  label: 'Budget Variantie',
                  value: fmt(costHealth.budgetVariance),
                  variance: `${Math.abs(Math.round((costHealth.budgetVariance / selectedProject.totalBudget) * 100))}%`,
                  varianceDirection: costHealth.budgetVariance >= 0 ? 'up' : 'down',
                  status: costHealth.budgetVariance >= 0 ? 'green' : 'red',
                },
                {
                  label: 'EAC',
                  value: fmt(costHealth.eac),
                  budgetLabel: `Budget: ${fmt(selectedProject.totalBudget)}`,
                },
                {
                  label: 'Contingency Resterend',
                  value: `${Math.round(costHealth.contingencyPercent * 100)}%`,
                  budgetLabel: fmt(costHealth.contingencyRemaining),
                  status: costHealth.contingencyPercent < 0.3 ? 'red' : costHealth.contingencyPercent < 0.5 ? 'amber' : 'green',
                },
              ]}
            />
            {costsInsight && (
              <InlineInsight icon={costsInsight.icon as IconName} message={costsInsight.message} />
            )}

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

            {/* P&L Statement */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>P&L</Text>
              <PLStatementView
                accentColor={CFO_COLOR}
                currency={currency}
                rows={[
                  { label: 'Omzet (GDV)', actual: selectedProject.totalBudget * 1.25, budget: selectedProject.totalBudget * 1.2 },
                  { label: 'Grondkosten', actual: selectedProject.actualSpent * 0.3, budget: selectedProject.totalBudget * 0.28 },
                  { label: 'Bouwkosten', actual: selectedProject.actualSpent * 0.45, budget: selectedProject.totalBudget * 0.42 },
                  { label: 'Bruto Marge', actual: selectedProject.totalBudget * 1.25 - selectedProject.actualSpent * 0.75, budget: selectedProject.totalBudget * 1.2 - selectedProject.totalBudget * 0.7, isSubtotal: true },
                  { label: 'Advieskosten', actual: selectedProject.actualSpent * 0.08, budget: selectedProject.totalBudget * 0.07 },
                  { label: 'Wettelijke kosten', actual: selectedProject.actualSpent * 0.03, budget: selectedProject.totalBudget * 0.03 },
                  { label: 'Financieringskosten', actual: selectedProject.actualSpent * 0.05, budget: selectedProject.totalBudget * 0.04 },
                  { label: 'Netto Ontwikkelwinst', actual: selectedProject.totalBudget * 1.25 - selectedProject.actualSpent * 0.91, budget: selectedProject.totalBudget * 1.2 - selectedProject.totalBudget * 0.84, isTotal: true },
                ]}
              />
            </View>

            {/* Budget Waterfall */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>BUDGET VS ACTUALS</Text>
              {[
                { label: 'Budget', value: selectedProject.totalBudget, color: CFO_COLOR, percent: 100 },
                { label: 'Spent', value: selectedProject.actualSpent, color: Palette.hermesOrange, percent: (selectedProject.actualSpent / selectedProject.totalBudget) * 100 },
                { label: 'EAC', value: costHealth.eac, color: costHealth.budgetVariance < 0 ? SemanticColors.feedbackError : SemanticColors.feedbackWarning, percent: (costHealth.eac / selectedProject.totalBudget) * 100 },
              ].map((row) => (
                <View key={row.label} style={styles.waterfallRow}>
                  <View style={styles.waterfallLabel}>
                    <Text style={styles.waterfallLabelText}>{row.label}</Text>
                    <Text style={[styles.waterfallValueText, { color: row.color }]}>{fmt(row.value)}</Text>
                  </View>
                  <View style={styles.waterfallBarTrack}>
                    <View style={[styles.waterfallBarFill, { width: `${Math.min(row.percent, 100)}%`, backgroundColor: row.color }]} />
                  </View>
                </View>
              ))}
              {/* Variance callout */}
              <View style={[styles.varianceCallout, { backgroundColor: costHealth.budgetVariance >= 0 ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackErrorBg }]}>
                <Ionicons
                  name={costHealth.budgetVariance >= 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={costHealth.budgetVariance >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
                />
                <Text style={[styles.varianceText, { color: costHealth.budgetVariance >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError }]}>
                  {formatVariance(costHealth.budgetVariance, currency)} variance
                </Text>
                <Text style={styles.variancePercent}>
                  ({Math.abs(Math.round((costHealth.budgetVariance / selectedProject.totalBudget) * 100))}%)
                </Text>
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

            {/* Kosten Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Kosten Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/benchmark' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: CFO_COLOR + '15' }]}>
                    <Ionicons name="bar-chart" size={18} color={CFO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Benchmarking</Text>
                    <Text style={styles.actionSubtitle}>Kostenvergelijking tussen projecten</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/purchasing' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                    <Ionicons name="cart" size={18} color={SemanticColors.feedbackSuccess} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Leveranciers</Text>
                    <Text style={styles.actionSubtitle}>Leverancierskostenbeheer</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* CASHFLOW TAB */}
        {activeTab === 'cashflow' && (
          <>
            {/* KPI Scorecard Grid */}
            <FinancialKPIGrid
              accentColor={CFO_COLOR}
              tiles={[
                { label: 'Beschikbaar', value: '\u00A34.2M', status: 'green' },
                { label: 'Gecommitteerd', value: '\u00A32.8M', status: 'amber' },
                { label: 'Opgenomen', value: '\u00A312.4M', budgetLabel: 'Van \u00A318.5M faciliteit' },
                { label: 'Netto Cash Positie', value: '\u00A31.4M', variance: '-18.7%', varianceDirection: 'down', status: 'amber' },
              ]}
            />

            {/* Cashflow Trend */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>CASHFLOW 6 MAANDEN</Text>
              <TrendBarChart
                data={MOCK_CASHFLOW_MONTHLY}
                positiveColor={CFO_COLOR}
                negativeColor={SemanticColors.feedbackError}
                currency="GBP"
              />
            </View>

            {/* Receivables Aging */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>DEBITEUREN VEROUDERING</Text>
              <ReceivablesAgingBar buckets={MOCK_AGING_BUCKETS} currency="GBP" />
            </View>

            {cashflowInsight && (
              <InlineInsight icon={cashflowInsight.icon as IconName} message={cashflowInsight.message} />
            )}

            {/* Facility Utilization */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="server" size={18} color={CFO_COLOR} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Facility Utilization</Text>
                  <Text style={styles.cardSubtitle}>£18.5M total facility</Text>
                </View>
                <Text style={[styles.facilityUtilPercent, { color: CFO_COLOR }]}>82%</Text>
              </View>

              {/* Stacked utilization bar */}
              <View style={styles.facilityBarContainer}>
                <View style={styles.facilityBarTrack}>
                  <View style={[styles.facilitySegment, { width: '67%', backgroundColor: CFO_COLOR }]} />
                  <View style={[styles.facilitySegment, { width: '15%', backgroundColor: Palette.hermesOrange }]} />
                  <View style={[styles.facilitySegment, { width: '18%', backgroundColor: SemanticColors.surfaceTertiary }]} />
                </View>
              </View>

              {/* Legend */}
              <View style={styles.facilityLegend}>
                <View style={styles.facilityLegendItem}>
                  <View style={[styles.facilityLegendDot, { backgroundColor: CFO_COLOR }]} />
                  <Text style={styles.facilityLegendLabel}>Drawn</Text>
                  <Text style={[styles.facilityLegendValue, { color: CFO_COLOR }]}>£12.4M</Text>
                </View>
                <View style={styles.facilityLegendItem}>
                  <View style={[styles.facilityLegendDot, { backgroundColor: Palette.hermesOrange }]} />
                  <Text style={styles.facilityLegendLabel}>Committed</Text>
                  <Text style={[styles.facilityLegendValue, { color: Palette.hermesOrange }]}>£2.8M</Text>
                </View>
                <View style={styles.facilityLegendItem}>
                  <View style={[styles.facilityLegendDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                  <Text style={styles.facilityLegendLabel}>Available</Text>
                  <Text style={[styles.facilityLegendValue, { color: SemanticColors.feedbackSuccess }]}>£4.2M</Text>
                </View>
              </View>
            </View>

            {/* Net Cash Position */}
            <View style={styles.netCashCard}>
              <View style={styles.netCashLeft}>
                <Text style={styles.netCashLabel}>Net Cash Position</Text>
                <Text style={styles.netCashSublabel}>30-day forecast</Text>
              </View>
              <View style={styles.netCashRight}>
                <Text style={styles.netCashValue}>£1.4M</Text>
                <View style={styles.netCashTrend}>
                  <Ionicons name="trending-down" size={12} color={SemanticColors.feedbackWarning} />
                  <Text style={[styles.netCashTrendText, { color: SemanticColors.feedbackWarning }]}>-£320K vs last month</Text>
                </View>
              </View>
            </View>

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

            {/* Cashflow Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cashflow Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/cashflow' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: CFO_COLOR + '15' }]}>
                    <Ionicons name="swap-horizontal" size={18} color={CFO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Cash Flow</Text>
                    <Text style={styles.actionSubtitle}>Gedetailleerde cashflowanalyse</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/reorder' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="repeat" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Herbestellen</Text>
                    <Text style={styles.actionSubtitle}>Inkooptiming & cashflow-impact</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* RETURNS TAB */}
        {activeTab === 'returns' && (
          <>
            {/* KPI Scorecard Grid */}
            <FinancialKPIGrid
              accentColor={CFO_COLOR}
              tiles={[
                { label: 'Blended IRR', value: formatPercent(portfolioMetrics.avgIrr), variance: '+1.8%', varianceDirection: 'up', status: 'green', heroBg: true },
                { label: 'Totale Winst', value: '\u00A318.4M', variance: '+5.2%', varianceDirection: 'up', status: 'green' },
                { label: 'Equity Multiple', value: '1.82x', status: 'green' },
                { label: 'Gem. PoC', value: '24.5%', status: 'amber' },
                { label: 'GDV', value: formatCompact(portfolioMetrics.totalGdv, 'GBP') },
                { label: 'NPV', value: '\u00A314.8M', budgetLabel: 'Discontovoet 8%' },
              ]}
            />
            {returnsInsight && (
              <InlineInsight icon={returnsInsight.icon as IconName} message={returnsInsight.message} />
            )}

            {/* IRR Comparison Bars */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>IRR by Project</Text>
              {mockProjects.map((project) => {
                const appr = mockAppraisals[project.id];
                if (!appr) return null;
                const barPercent = Math.min((appr.irr / 0.35) * 100, 100);
                const isAboveTarget = appr.irr >= 0.20;
                return (
                  <Pressable
                    key={project.id}
                    style={styles.irrBarRow}
                    onPress={() => setSelectedProjectId(project.id)}
                  >
                    <View style={styles.irrBarLabel}>
                      <Text style={styles.irrBarProject} numberOfLines={1}>{project.name}</Text>
                      <Text style={styles.irrBarCountry}>{project.country}</Text>
                    </View>
                    <View style={styles.irrBarTrack}>
                      <View style={[
                        styles.irrBarFill,
                        { width: `${barPercent}%` },
                        isAboveTarget ? styles.irrBarGood : styles.irrBarWarn,
                      ]} />
                      {/* 20% target line */}
                      <View style={styles.irrTargetLine} />
                    </View>
                    <Text style={[styles.irrBarValue, { color: isAboveTarget ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning }]}>
                      {formatPercent(appr.irr)}
                    </Text>
                  </Pressable>
                );
              })}
              <View style={styles.irrTargetLegend}>
                <View style={styles.irrTargetLegendLine} />
                <Text style={styles.irrTargetLegendText}>20% target</Text>
              </View>
            </View>

            {/* Investor Capital Flow */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="people" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Investor Capital Flow</Text>
              </View>
              {[
                { name: 'Equity Partner A', committed: 5000000, distributed: 2100000, irr: 0.28 },
                { name: 'Mezzanine Fund', committed: 3000000, distributed: 1400000, irr: 0.18 },
                { name: 'Co-Invest Pool', committed: 2000000, distributed: 850000, irr: 0.24 },
              ].map((investor, idx) => {
                const distPercent = (investor.distributed / investor.committed) * 100;
                return (
                  <View key={idx} style={styles.investorFlowItem}>
                    <View style={styles.investorFlowHeader}>
                      <Text style={styles.investorFlowName}>{investor.name}</Text>
                      <Text style={[styles.investorFlowIRR, { color: CFO_COLOR }]}>{formatPercent(investor.irr)}</Text>
                    </View>
                    <View style={styles.investorFlowBarTrack}>
                      <View style={[styles.investorFlowBarFill, { width: `${distPercent}%` }]} />
                    </View>
                    <View style={styles.investorFlowFooter}>
                      <Text style={styles.investorFlowDistributed}>{formatCompact(investor.distributed, 'GBP')} distributed</Text>
                      <Text style={styles.investorFlowCommitted}>of {formatCompact(investor.committed, 'GBP')}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Scenario Comparison */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>SCENARIOANALYSE</Text>
              <ScenarioComparisonCard
                scenarios={MOCK_SCENARIOS}
                accentColor={CFO_COLOR}
              />
            </View>

            {/* Rendement Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rendement Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/smart-pricing' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: CFO_COLOR + '15' }]}>
                    <Ionicons name="pricetag" size={18} color={CFO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Smart Pricing</Text>
                    <Text style={styles.actionSubtitle}>Prijsimpact op marges & rendement</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/warranty' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="shield" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Garantie</Text>
                    <Text style={styles.actionSubtitle}>Garantiekostenblootstelling</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Financial Auditor Full-Screen Modal */}
      <Modal
        visible={showFullAuditor}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullAuditor(false)}
      >
        <View style={{ flex: 1, backgroundColor: SemanticColors.surfaceBackground }}>
          <View style={styles.auditorModalHeader}>
            <View>
              <Text style={styles.auditorModalTitle}>Financiele Auditor</Text>
              <Text style={styles.auditorModalSubtitle}>AI-gestuurde financiele controle</Text>
            </View>
            <Pressable onPress={() => setShowFullAuditor(false)} style={styles.auditorModalClose}>
              <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
            </Pressable>
          </View>
          <FinancialAuditorDashboard projectId="project-001" />
        </View>
      </Modal>

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
    padding: Spacing.sm,
    gap: 12,
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
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderMuted,
    gap: 12,
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
    fontSize: 14,
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

  // Budget Waterfall
  waterfallRow: {
    gap: 6,
  },
  waterfallLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterfallLabelText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  waterfallValueText: {
    fontSize: 14,
    fontWeight: '700',
  },
  waterfallBarTrack: {
    height: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  waterfallBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  varianceCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    borderRadius: 10,
    marginTop: 4,
  },
  varianceText: {
    fontSize: 14,
    fontWeight: '700',
  },
  variancePercent: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
  },

  // Facility Utilization
  facilityUtilPercent: {
    fontSize: 20,
    fontWeight: '800',
  },
  facilityBarContainer: {
    gap: 8,
  },
  facilityBarTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  facilitySegment: {
    height: '100%',
  },
  facilityLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  facilityLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  facilityLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  facilityLegendLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },
  facilityLegendValue: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Net Cash Card
  netCashCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CFO_COLOR + '12',
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: CFO_COLOR + '30',
  },
  netCashLeft: {},
  netCashLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  netCashSublabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  netCashRight: {
    alignItems: 'flex-end',
  },
  netCashValue: {
    fontSize: 24,
    fontWeight: '800',
    color: CFO_COLOR,
  },
  netCashTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  netCashTrendText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Hero Scorecard
  heroScorecard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: CFO_COLOR + '30',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: CFO_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CFO_COLOR + '08',
  },
  heroRingValue: {
    fontSize: 28,
    fontWeight: '800',
    color: CFO_COLOR,
  },
  heroRingLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  heroSubMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    width: '100%',
  },
  heroSubMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  heroSubValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroSubLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  heroSubDivider: {
    width: 1,
    height: 32,
    backgroundColor: SemanticColors.borderDefault,
  },

  // IRR Comparison Bars
  irrBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  irrBarLabel: {
    width: 90,
  },
  irrBarProject: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  irrBarCountry: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  irrBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  irrBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  irrBarGood: {
    backgroundColor: CFO_COLOR,
  },
  irrBarWarn: {
    backgroundColor: SemanticColors.feedbackWarning,
  },
  irrTargetLine: {
    position: 'absolute',
    left: '57%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: SemanticColors.textTertiary,
  },
  irrBarValue: {
    width: 42,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  irrTargetLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'flex-end',
    paddingTop: 4,
  },
  irrTargetLegendLine: {
    width: 12,
    height: 2,
    backgroundColor: SemanticColors.textTertiary,
  },
  irrTargetLegendText: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },

  // Investor Capital Flow
  investorFlowItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
    gap: 8,
  },
  investorFlowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  investorFlowName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  investorFlowIRR: {
    fontSize: 13,
    fontWeight: '700',
  },
  investorFlowBarTrack: {
    height: 8,
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  investorFlowBarFill: {
    height: '100%',
    backgroundColor: CFO_COLOR,
    borderRadius: 4,
  },
  investorFlowFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  investorFlowDistributed: {
    fontSize: 11,
    fontWeight: '600',
    color: CFO_COLOR,
  },
  investorFlowCommitted: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Cross-Role Workflow Styles
  wfStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  wfStatItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  wfStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  wfStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  wfPaymentItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  wfPaymentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  wfPaymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  wfPaymentMeta: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  wfPaymentAmount: {
    backgroundColor: CFO_COLOR + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  wfPaymentAmountText: {
    fontSize: 14,
    fontWeight: '700',
    color: CFO_COLOR,
  },
  wfStepsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  wfStepIndicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  wfStepCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wfStepLine: {
    flex: 1,
    height: 2,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 2,
  },
  wfCurrentStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wfCurrentStepText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  wfCfoActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  wfCfoApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  wfCfoApproveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  wfCfoReviewBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  wfCfoReviewBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },

  // Financial Auditor Modal
  auditorModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: Spacing.sm,
    paddingTop: 56,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  auditorModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  auditorModalSubtitle: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  auditorModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tool Action Items
  actionsList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
});
