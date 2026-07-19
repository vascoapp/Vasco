// =============================================================================
// CFO DASHBOARD - AI-Powered Financial Oversight & Cost Control
// =============================================================================
// Executive financial dashboard for real estate development CFOs
// Enhanced with Financial Auditor AI, Vasco Guidance, and smart approvals
// =============================================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { DEMO_MODE } from '../../config/demo';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { hapticSuccess } from '../../utils/haptics';
import { Spacing, SafeArea } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import {
  mockProjects,
  mockAppraisals,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatPercent,
  getCurrencyForCountry,
} from '../../modules/countryModules';

// Vasco Guidance
import { useVascoGuidance, useInlineInsight } from '../../services/vascoGuidanceService';
import { InlineInsight } from '../shared/VascoInsightCard';
import { recordScreenVisit } from '../../intelligence/learningStorage';
import { FinancialAuditorDashboard } from '../financial-auditor/FinancialAuditorDashboard';
import { FadeIn } from '../shared/FadeIn';
import { FinancialKPIGrid } from '../shared/FinancialKPIGrid';
import { TrendBarChart } from '../shared/TrendBarChart';
import { ReceivablesAgingBar } from '../shared/ReceivablesAgingBar';
import { ScenarioComparisonCard } from '../shared/ScenarioComparisonCard';


// AI Savings
import { useSavingsAggregation } from '../../services/savingsAggregatorService';
import { logInfo } from '../../utils/errorHandler';

// Savings tab: Budget Optimizer + Supplier Negotiation + TCO data
import BudgetOptimizerDashboard from './BudgetOptimizerDashboard';
import { useSupplierNegotiation } from '../../services/supplierNegotiationService';
import { useTCOSummary } from '../../services/tcoCalculatorService';


type IconName = keyof typeof Ionicons.glyphMap;

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

const DEMO_MOCK_PENDING_APPROVALS: PendingApproval[] = [
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

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_PENDING_APPROVALS: PendingApproval[] = DEMO_MODE ? DEMO_MOCK_PENDING_APPROVALS : [];

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

const DEMO_MOCK_PENDING_HANDOVERS: PendingHandover[] = [
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

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_PENDING_HANDOVERS: PendingHandover[] = DEMO_MODE ? DEMO_MOCK_PENDING_HANDOVERS : [];

export type CFOTabView = 'overview' | 'savings' | 'cashflow' | 'returns';
type TabView = CFOTabView;

// Role color - theme token
const CFO_COLOR = SemanticColors.roleCFO;

// =============================================================================
// NEW MOCK DATA FOR FINANCIAL COMPONENTS
// =============================================================================

const DEMO_MOCK_MONTHLY_SPEND = [
  { label: 'Sep', value: 3200000 },
  { label: 'Okt', value: 4100000 },
  { label: 'Nov', value: 3800000 },
  { label: 'Dec', value: 5200000 },
  { label: 'Jan', value: 4600000 },
  { label: 'Feb', value: 5800000 },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_MONTHLY_SPEND = DEMO_MODE ? DEMO_MOCK_MONTHLY_SPEND : [];

const DEMO_MOCK_AGING_BUCKETS = [
  { label: 'Huidig', amount: 2400000, color: SemanticColors.roleCFO },
  { label: '30d', amount: 850000, color: '#EAB308' },
  { label: '60d', amount: 320000, color: '#F97316' },
  { label: '90d+', amount: 180000, color: '#EF4444' },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_AGING_BUCKETS = DEMO_MODE ? DEMO_MOCK_AGING_BUCKETS : [];

const DEMO_MOCK_CASHFLOW_MONTHLY = [
  { label: 'Sep', value: 1200000 },
  { label: 'Okt', value: -800000 },
  { label: 'Nov', value: 1500000 },
  { label: 'Dec', value: -2100000 },
  { label: 'Jan', value: 900000 },
  { label: 'Feb', value: -400000 },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_CASHFLOW_MONTHLY = DEMO_MODE ? DEMO_MOCK_CASHFLOW_MONTHLY : [];

const DEMO_MOCK_SCENARIOS = [
  { name: 'Neerwaarts', irr: '14.2%', profit: '\u00A312.1M', equityMultiple: '1.48x' },
  { name: 'Basis', irr: '22.4%', profit: '\u00A318.4M', equityMultiple: '1.82x', isBase: true },
  { name: 'Opwaarts', irr: '29.8%', profit: '\u00A324.6M', equityMultiple: '2.14x' },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_SCENARIOS = DEMO_MODE ? DEMO_MOCK_SCENARIOS : [];

// =============================================================================
// HELPERS
// =============================================================================

function formatCompact(value: number, _currency: string = 'GBP'): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000) {
    return `${sign}${formatCurrency(absValue / 1_000_000_000).replace(/,00$|\.00$/, '')}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${formatCurrency(absValue / 1_000_000).replace(/,00$|\.00$/, '')}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${formatCurrency(absValue / 1_000).replace(/,00$|\.00$/, '')}K`;
  }
  return formatCurrency(value);
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
        size={15}
        color={isActive ? '#fff' : SemanticColors.textSecondary}
      />
      <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
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
      case 'ai-verified': return 'AI Geverifieerd';
      case 'requires-review': return 'Controle Nodig';
      case 'blocked': return 'Geblokkeerd';
      default: return 'In Afwachting';
    }
  };

  return (
    <View style={styles.approvalCard}>
      <View style={styles.approvalHeader}>
        <View style={styles.approvalInfo}>
          <View style={styles.approvalTitleRow}>
            <Text style={styles.approvalTitle} numberOfLines={1}>{approval.title}</Text>
            <View style={[styles.approvalStatusBadge, { backgroundColor: getStatusColor() + '20' }]}>
              <View style={[styles.approvalStatusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.approvalStatusText, { color: getStatusColor() }]}>
                {getStatusLabel()}
              </Text>
            </View>
          </View>
          <Text style={styles.approvalProject} numberOfLines={1}>{approval.project}</Text>
          {approval.vendor && (
            <Text style={styles.approvalVendor} numberOfLines={1}>{approval.vendor}</Text>
          )}
        </View>
        <View style={styles.approvalAmount}>
          <Text style={styles.approvalAmountValue}>{formatCompact(approval.amount)}</Text>
          <Text style={[
            styles.approvalDue,
            approval.dueDate === 'Today' && { color: SemanticColors.feedbackError },
          ]}>
            Vervalt: {approval.dueDate}
          </Text>
        </View>
      </View>

      {/* AI Verification Summary */}
      {approval.aiVerification && (
        <View style={styles.aiVerificationContainer}>
          <View style={styles.aiVerificationHeader}>
            <Ionicons name="shield-checkmark" size={14} color={CFO_COLOR} />
            <Text style={styles.aiVerificationTitle}>AI Verificatie</Text>
          </View>
          <View style={styles.aiCheckRow}>
            {[
              { key: 'budgetCheck', label: 'Budget' },
              { key: 'contractCheck', label: 'Contract' },
              { key: 'handoverComplete', label: 'Overdracht' },
              { key: 'rateCheck', label: 'Tarief' },
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
                  <Text style={styles.aiIssueText} numberOfLines={2}>{issue}</Text>
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
            approval.status === 'blocked' && styles.approvalActionButtonBlocked,
          ]}
          onPress={approval.status === 'blocked' ? onReview : onApprove}
        >
          <Ionicons
            name={approval.status === 'blocked' ? 'warning' : approval.status === 'ai-verified' ? 'checkmark-circle' : 'eye'}
            size={15}
            color={approval.status === 'ai-verified' ? '#fff' : approval.status === 'blocked' ? SemanticColors.feedbackError : SemanticColors.textPrimary}
          />
          <Text style={[
            styles.approvalActionButtonText,
            approval.status === 'ai-verified' && styles.approvalActionButtonTextPrimary,
            approval.status === 'blocked' && styles.approvalActionButtonTextBlocked,
          ]} numberOfLines={1}>
            {approval.status === 'blocked' ? 'Problemen' : approval.status === 'ai-verified' ? 'Goedkeuren' : 'Bekijken'}
          </Text>
        </Pressable>
        <Pressable style={styles.approvalActionButtonSecondary} onPress={onReview}>
          <Ionicons name="document-text" size={14} color={CFO_COLOR} />
          <Text style={styles.approvalActionButtonTextSecondary}>Details</Text>
        </Pressable>
      </View>
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
            <Text style={styles.modalTitle}>Goedkeuring Bevestigen</Text>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>Actie</Text>
            <Text style={styles.modalValue}>{approval.title}</Text>

            <Text style={styles.modalLabel}>Bedrag</Text>
            <Text style={[styles.modalValue, styles.modalAmount]}>{formatCompact(approval.amount)}</Text>

            <Text style={styles.modalLabel}>Ontvanger</Text>
            <Text style={styles.modalValue}>{approval.vendor || approval.project}</Text>

            <View style={styles.modalWarning}>
              <Ionicons name="information-circle" size={16} color={CFO_COLOR} />
              <Text style={styles.modalWarningText}>
                Deze actie kan niet ongedaan worden gemaakt. Bevestig dat u wilt doorgaan.
              </Text>
            </View>

            <Text style={styles.modalLabel}>Voer bevestigingscode in</Text>
            <TextInput
              style={styles.confirmInput}
              placeholder="Voer GOEDKEUREN in"
              value={confirmCode}
              onChangeText={setConfirmCode}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancelButton} onPress={onCancel}>
              <Text style={styles.modalCancelText}>Annuleren</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalConfirmButton,
                confirmCode !== 'GOEDKEUREN' && styles.modalConfirmButtonDisabled,
              ]}
              onPress={onConfirm}
              disabled={confirmCode !== 'GOEDKEUREN'}
            >
              <Text style={styles.modalConfirmText}>Bevestigen & Uitvoeren</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [showFullAuditor, setShowFullAuditor] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); hapticSuccess(); }, 600);
  }, []);

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(() => selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP', [selectedProject]);

  // Track screen visits for learning profile
  const screenContext = activeTab === 'overview' ? 'today' : activeTab === 'savings' ? 'costs' : activeTab;
  useEffect(() => { recordScreenVisit(screenContext); }, [screenContext]);

  // Vasco AI Guidance (from service)
  const allGuidance = useVascoGuidance('cfo', screenContext as any);
  const criticalGuidanceCount = useMemo(
    () => allGuidance.filter(g => g.priority === 'critical' || g.priority === 'high').length,
    [allGuidance]
  );
  // Inline insights per tab
  const cashflowInsight = useInlineInsight('cfo', 'cashflow', 'overview');
  const returnsInsight = useInlineInsight('cfo', 'returns', 'overview');

  // AI Savings data
  const aiSavings = useSavingsAggregation();

  // Budget Optimizer data for Savings tab
  const negotiation = useSupplierNegotiation();
  const tco = useTCOSummary();
  const timeSavings = useMemo(() => aiSavings.breakdown.find(c => c.id === 'time'), [aiSavings]);
  const hoursPerMonth = timeSavings ? parseFloat(timeSavings.description.match(/[\d.]+/)?.[0] || '0') : 0;

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

  // Handlers
  const handleApprove = useCallback((approval: PendingApproval) => {
    setSelectedApproval(approval);
    setConfirmModalVisible(true);
  }, []);

  const handleConfirmApproval = useCallback(() => {
    // In reality, would call approval API
    logInfo('CFODashboard', `Approved: ${selectedApproval?.id}`);
    setConfirmModalVisible(false);
    setSelectedApproval(null);
  }, [selectedApproval]);

  // Dynamic header based on active tab
  const headerConfig = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return {
          title: 'Financieel Overzicht',
          subtitle: `${mockProjects.length} actieve projecten`,
          metrics: [
            { value: formatCompact(portfolioMetrics.totalGdv, 'GBP'), label: 'Totaal GDV' },
            { value: formatPercent(portfolioMetrics.avgIrr), label: 'Gem. IRR', color: CFO_COLOR },
            { value: formatCompact(portfolioMetrics.uncommitted, 'GBP'), label: 'Ongecommitteerd' },
          ],
        };
      case 'savings':
        return {
          title: 'Savings',
          subtitle: 'AI Budget Optimalisatie',
          metrics: [
            { value: `\u20AC${aiSavings.totalSavedThisYear.toLocaleString(undefined)}`, label: 'Bespaard dit jaar', color: SemanticColors.feedbackSuccess },
            { value: `\u20AC${negotiation.totalDiscountPotential}/jr`, label: 'Leverancierskansen', color: CFO_COLOR },
            { value: `\u20AC${tco.totalSavingsThisYear}/jr`, label: 'TCO Besparing' },
          ],
        };
      case 'cashflow':
        return {
          title: 'Cashflow',
          subtitle: selectedProject?.name || '',
          metrics: [],
        };
      case 'returns':
        return {
          title: 'Rendement & IRR',
          subtitle: 'Portefeuilleprestaties',
          metrics: [
            { value: formatCompact(portfolioMetrics.totalGdv, 'GBP'), label: 'GDV' },
            { value: formatPercent(portfolioMetrics.avgIrr), label: 'IRR', color: CFO_COLOR },
            { value: formatCompact(portfolioMetrics.totalGdv - portfolioMetrics.totalBudget, 'GBP'), label: 'Winst' },
          ],
        };
      default:
        return {
          title: 'Financieel Overzicht',
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
            <Text style={styles.headerTitle} numberOfLines={1}>{headerConfig.title}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{headerConfig.subtitle}</Text>
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
            label="Overzicht"
            icon="grid"
            isActive={activeTab === 'overview'}
            badge={criticalGuidanceCount}
            onPress={() => setActiveTab('overview')}
          />
          <TabButton
            label="Savings"
            icon="trending-down"
            isActive={activeTab === 'savings'}
            onPress={() => setActiveTab('savings')}
          />
          <TabButton
            label="Cash"
            icon="wallet"
            isActive={activeTab === 'cashflow'}
            onPress={() => setActiveTab('cashflow')}
          />
          <TabButton
            label="Rendement"
            icon="trending-up"
            isActive={activeTab === 'returns'}
            onPress={() => setActiveTab('returns')}
          />
        </View>
      )}

      {/* SAVINGS TAB — rendered outside ScrollView to avoid nesting */}
      {activeTab === 'savings' && (
        <BudgetOptimizerDashboard
          accentColor={CFO_COLOR}
          embedded
          supplierNegotiation={negotiation}
          tcoSummary={tco}
        />
      )}

      {activeTab !== 'savings' && (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={CFO_COLOR} />}
      >
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Scorecard Grid */}
            <FadeIn delay={0} duration={400}>
            <FinancialKPIGrid
              accentColor={CFO_COLOR}
              tiles={[
                { label: 'Portfolio GDV', value: formatCompact(portfolioMetrics.totalGdv, 'GBP'), variance: '+3.2%', varianceDirection: 'up', status: 'green' },
                { label: 'Gemiddeld IRR', value: formatPercent(portfolioMetrics.avgIrr), variance: '+1.1%', varianceDirection: 'up', status: 'green', heroBg: true },
                { label: 'Totaal Budget', value: formatCompact(portfolioMetrics.totalBudget, 'GBP'), budgetLabel: `${mockProjects.length} projecten` },
                { label: 'Totaal Besteed', value: formatCompact(portfolioMetrics.totalSpent, 'GBP'), variance: '-2.1%', varianceDirection: 'down', status: 'amber' },
                { label: 'Ongecommitteerd', value: formatCompact(portfolioMetrics.uncommitted, 'GBP'), status: 'green' },
                { label: 'Goedkeuringen', value: `${pendingApprovalCount}`, status: pendingApprovalCount > 2 ? 'red' : 'amber', onPress: () => setActiveTab('savings') },
              ]}
            />
            </FadeIn>

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
                  <Text style={styles.cardTitle}>Openstaande Goedkeuringen</Text>
                  <Text style={styles.cardSubtitle}>AI-geverifieerde betalingsverzoeken</Text>
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
                  <Text style={styles.cardTitle}>Faciliteitsbenutting</Text>
                  <Text style={styles.cardSubtitle}>£18.5M totale faciliteit</Text>
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
                  <Text style={styles.facilityLegendLabel}>Opgenomen</Text>
                  <Text style={[styles.facilityLegendValue, { color: CFO_COLOR }]}>£12.4M</Text>
                </View>
                <View style={styles.facilityLegendItem}>
                  <View style={[styles.facilityLegendDot, { backgroundColor: Palette.hermesOrange }]} />
                  <Text style={styles.facilityLegendLabel}>Gecommitteerd</Text>
                  <Text style={[styles.facilityLegendValue, { color: Palette.hermesOrange }]}>£2.8M</Text>
                </View>
                <View style={styles.facilityLegendItem}>
                  <View style={[styles.facilityLegendDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                  <Text style={styles.facilityLegendLabel}>Beschikbaar</Text>
                  <Text style={[styles.facilityLegendValue, { color: SemanticColors.feedbackSuccess }]}>£4.2M</Text>
                </View>
              </View>
            </View>

            {/* Net Cash Position */}
            <View style={styles.netCashCard}>
              <View style={styles.netCashLeft}>
                <Text style={styles.netCashLabel}>Netto Cashpositie</Text>
                <Text style={styles.netCashSublabel}>30-daagse prognose</Text>
              </View>
              <View style={styles.netCashRight}>
                <Text style={styles.netCashValue}>£1.4M</Text>
                <View style={styles.netCashTrend}>
                  <Ionicons name="trending-down" size={12} color={SemanticColors.feedbackWarning} />
                  <Text style={[styles.netCashTrendText, { color: SemanticColors.feedbackWarning }]}>-£320K vs vorige maand</Text>
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
                  <Text style={styles.cardTitle}>Overdrachten die Betaling Blokkeren</Text>
                  <Text style={styles.cardSubtitle}>Rond overdracht af om betaling vrij te geven</Text>
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
                            {handover.handoverStatus === 'awaiting-signoff' ? 'Wacht op Aftekening' :
                             handover.handoverStatus === 'in-review' ? 'In Beoordeling' : 'In Afwachting'}
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
                        Betaling vervalt: {handover.dueDate}
                      </Text>
                      <Pressable style={styles.handoverAction}>
                        <Text style={styles.handoverActionText} numberOfLines={1}>Bekijk Pakket</Text>
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
                  {formatCompact(MOCK_PENDING_HANDOVERS.reduce((sum, h) => sum + h.paymentAmount, 0), 'GBP')} geblokkeerd in afwachting van overdracht
                </Text>
              </View>
            </View>

            {/* Herbestellen — standalone action below handovers */}
            <Pressable
              style={[styles.card, { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }]}
              onPress={() => router.push('/contractor/purchase-orders' as any)}
            >
              <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                <Ionicons name="repeat" size={18} color={SemanticColors.feedbackWarning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Herbestellen</Text>
                <Text style={styles.cardSubtitle}>Inkooptiming & cashflow-impact</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
            </Pressable>

            {/* Pending Draw Requests */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="document-text" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Lopende Opnameverzoeken</Text>
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
                          {request.status === 'awaiting' ? 'In Afwachting' : 'In Beoordeling'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Cashflow Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cashflow Analyse</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/cashflow' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: CFO_COLOR + '15' }]}>
                    <Ionicons name="swap-horizontal" size={18} color={CFO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Cashflow</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Gedetailleerde cashflowanalyse</Text>
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
              <Text style={styles.cardTitle}>IRR per Project</Text>
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
                <Text style={styles.irrTargetLegendText}>20% doelstelling</Text>
              </View>
            </View>

            {/* Investor Capital Flow */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Ionicons name="people" size={18} color={CFO_COLOR} />
                </View>
                <Text style={styles.cardTitle}>Investeerders Kapitaalstromen</Text>
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
                      <Text style={styles.investorFlowDistributed}>{formatCompact(investor.distributed, 'GBP')} uitgekeerd</Text>
                      <Text style={styles.investorFlowCommitted}>van {formatCompact(investor.committed, 'GBP')}</Text>
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

            {/* AI Savings Card — pressable → full breakdown */}
            <Pressable style={styles.card} onPress={() => router.push('/hub/savings' as any)}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
                  <Ionicons name="sparkles" size={18} color={Palette.hermesOrange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>AI Besparingen</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>Impact op rendement</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
              </View>
              <View style={styles.aiSavingsKPIs}>
                <View style={styles.aiSavingsKPI}>
                  <Text style={[styles.aiSavingsKPIValue, { color: Palette.hermesOrange }]}>
                    {'\u20AC'}{aiSavings.totalSavedThisYear.toLocaleString(undefined)}
                  </Text>
                  <Text style={styles.aiSavingsKPILabel}>bespaard dit jaar</Text>
                </View>
                <View style={styles.aiSavingsKPIDivider} />
                <View style={styles.aiSavingsKPI}>
                  <Text style={styles.aiSavingsKPIValue}>
                    {'\u20AC'}{(aiSavings.projectedAnnual / 1000).toFixed(1)}K
                  </Text>
                  <Text style={styles.aiSavingsKPILabel}>jaarpotentieel</Text>
                </View>
                <View style={styles.aiSavingsKPIDivider} />
                <View style={styles.aiSavingsKPI}>
                  <Text style={[styles.aiSavingsKPIValue, { color: SemanticColors.feedbackSuccess }]}>
                    {/* "\u2014" when unknown; was "\u2191{null}%" \u2192 rendered "\u2191%". */}
                    {aiSavings.trendPercent === null ? '\u2014' : `\u2191${aiSavings.trendPercent}%`}
                  </Text>
                  <Text style={styles.aiSavingsKPILabel}>trend</Text>
                </View>
              </View>
            </Pressable>

            {/* Hours Saved Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardHeaderIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                  <Ionicons name="time" size={18} color={SemanticColors.feedbackSuccess} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Tijd Bespaard</Text>
                  <Text style={styles.cardSubtitle}>Cumulatieve productiviteitswinst</Text>
                </View>
              </View>
              <View style={styles.aiSavingsKPIs}>
                <View style={styles.aiSavingsKPI}>
                  <Text style={[styles.aiSavingsKPIValue, { color: SemanticColors.feedbackSuccess }]}>
                    {hoursPerMonth}u
                  </Text>
                  <Text style={styles.aiSavingsKPILabel}>per maand</Text>
                </View>
                <View style={styles.aiSavingsKPIDivider} />
                <View style={styles.aiSavingsKPI}>
                  <Text style={styles.aiSavingsKPIValue}>
                    {(hoursPerMonth * 6).toFixed(0)}u
                  </Text>
                  <Text style={styles.aiSavingsKPILabel}>afgelopen 6 mnd</Text>
                </View>
                <View style={styles.aiSavingsKPIDivider} />
                <View style={styles.aiSavingsKPI}>
                  <Text style={styles.aiSavingsKPIValue}>
                    {'\u20AC'}{((timeSavings?.amount || 0) * 6).toLocaleString(undefined)}
                  </Text>
                  <Text style={styles.aiSavingsKPILabel}>waarde 6 mnd</Text>
                </View>
              </View>
            </View>

          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
      )}

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
              <Text style={styles.auditorModalTitle}>Financiële Auditor</Text>
              <Text style={styles.auditorModalSubtitle}>AI-gestuurde financiële controle</Text>
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
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
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
    fontSize: TYPE.displaySize - 4,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary, textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: {
    fontSize: TYPE.captionSize,
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
    borderRadius: RADIUS.md,
  },
  alertBadgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: Palette.white,
  },
  headerAccent: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  headerMetrics: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
  },
  headerMetric: {
    flex: 1,
    alignItems: 'center',
  },
  headerMetricValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  headerMetricLabel: {
    fontSize: TYPE.tinySize,
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 5,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabButtonActive: {
    backgroundColor: CFO_COLOR,
  },
  tabButtonText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textSecondary,
  },
  tabButtonTextActive: {
    color: Palette.white,
  },
  tabBadge: {
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: RADIUS.sm,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  tabBadgeText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Archivo_800ExtraBold',
    color: Palette.white,
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
  sectionLabel: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.sm,
    backgroundColor: CFO_COLOR + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  cardSubtitle: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },

  // Badge Pill
  badgePill: {
    backgroundColor: CFO_COLOR,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  badgePillText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_800ExtraBold',
    color: Palette.white,
  },

  // Approvals
  approvalsList: {
    gap: 12,
  },
  approvalCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
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
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  approvalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm - 2,
  },
  approvalStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  approvalStatusText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Archivo_700Bold',
  },
  approvalProject: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  approvalVendor: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  approvalAmount: {
    alignItems: 'flex-end',
  },
  approvalAmountValue: {
    fontSize: TYPE.titleSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  approvalDue: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  aiVerificationContainer: {
    backgroundColor: CFO_COLOR + '08',
    borderRadius: RADIUS.sm,
    padding: 10,
    gap: 8,
  },
  aiVerificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiVerificationTitle: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_700Bold',
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
    fontSize: TYPE.tinySize,
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
    fontSize: TYPE.tinySize,
    color: SemanticColors.feedbackWarning,
    flex: 1,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
  },
  approvalActionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceTertiary,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  approvalActionButtonPrimary: {
    backgroundColor: CFO_COLOR,
  },
  approvalActionButtonBlocked: {
    backgroundColor: SemanticColors.feedbackError + '15',
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError + '30',
  },
  approvalActionButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  approvalActionButtonTextPrimary: {
    color: Palette.white,
  },
  approvalActionButtonTextBlocked: {
    color: SemanticColors.feedbackError,
  },
  approvalActionButtonSecondary: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: CFO_COLOR + '30',
  },
  approvalActionButtonTextSecondary: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Archivo_700Bold',
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
    borderRadius: RADIUS.lg,
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
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalValue: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  modalAmount: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: 'Archivo_800ExtraBold',
    color: CFO_COLOR,
  },
  modalWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: CFO_COLOR + '10',
    padding: Spacing.sm,
    borderRadius: RADIUS.sm,
  },
  modalWarningText: {
    flex: 1,
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    lineHeight: 16,
  },
  confirmInput: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: 12,
    fontSize: TYPE.titleSize,
    fontFamily: 'Archivo_700Bold',
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
    borderRadius: RADIUS.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalCancelText: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: CFO_COLOR,
  },
  modalConfirmButtonDisabled: {
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  modalConfirmText: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Archivo_700Bold',
    color: Palette.white,
  },

  // Handover Styles
  handoverList: {
    gap: 12,
  },
  handoverItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
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
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  handoverWorkPackage: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  handoverContractor: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  handoverPayment: {
    alignItems: 'flex-end',
  },
  handoverAmount: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  handoverStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm - 2,
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
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Archivo_700Bold',
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
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_700Bold',
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
    borderRadius: RADIUS.sm - 2,
  },
  handoverMissingText: {
    fontSize: TYPE.tinySize,
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
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  handoverAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  handoverActionText: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_700Bold',
    color: CFO_COLOR,
  },
  handoverSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarningBorder,
  },
  handoverSummaryText: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Archivo_700Bold',
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
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
  },
  drawRequestLeft: {
    flex: 1,
  },
  drawRequestProject: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  drawRequestStage: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  drawRequestRight: {
    alignItems: 'flex-end',
  },
  drawRequestAmount: {
    fontSize: TYPE.bodySize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  drawRequestStatus: {
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm - 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  drawRequestStatusReview: {
    backgroundColor: CFO_COLOR + '20',
  },
  drawRequestStatusText: {
    fontSize: TYPE.tinySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textSecondary,
  },

  // Facility Utilization
  facilityUtilPercent: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_900Black',
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
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
  },
  facilityLegendValue: {
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_800ExtraBold',
  },

  // Net Cash Card
  netCashCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CFO_COLOR + '12',
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: CFO_COLOR + '30',
  },
  netCashLeft: {},
  netCashLabel: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  netCashSublabel: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  netCashRight: {
    alignItems: 'flex-end',
  },
  netCashValue: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: 'Archivo_900Black',
    color: CFO_COLOR,
  },
  netCashTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  netCashTrendText: {
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_700Bold',
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
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  irrBarCountry: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },
  irrBarTrack: {
    flex: 1,
    height: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm - 2,
    overflow: 'hidden',
    position: 'relative',
  },
  irrBarFill: {
    height: '100%',
    borderRadius: RADIUS.sm - 2,
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
    fontSize: TYPE.labelSize,
    fontFamily: 'Archivo_800ExtraBold',
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
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
  },

  // Investor Capital Flow
  investorFlowItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    gap: 8,
  },
  investorFlowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  investorFlowName: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  investorFlowIRR: {
    fontSize: TYPE.captionSize,
    fontFamily: 'Archivo_800ExtraBold',
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
    fontSize: TYPE.tinySize,
    fontFamily: 'Archivo_700Bold',
    color: CFO_COLOR,
  },
  investorFlowCommitted: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textTertiary,
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
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  auditorModalSubtitle: {
    fontSize: TYPE.captionSize,
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
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 12,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: 'Archivo_700Bold',
    color: SemanticColors.textPrimary,
  },
  actionSubtitle: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // AI Savings & Hours Saved cards
  aiSavingsKPIs: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  aiSavingsKPI: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  aiSavingsKPIValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: 'Archivo_800ExtraBold',
    color: SemanticColors.textPrimary,
  },
  aiSavingsKPILabel: {
    fontSize: TYPE.tinySize - 1,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  aiSavingsKPIDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 4,
  },
});
