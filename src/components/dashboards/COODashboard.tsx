// =============================================================================
// COO DASHBOARD - Operational Delivery & Execution
// =============================================================================
// Executive operations dashboard for real estate development COOs
// Focus: Schedule, Permits, Procurement, Change Orders
// 4-tab navigation for focused operational views
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import {
  mockProjects,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import {
  formatCurrency,
  formatPercent,
  calculateScheduleVariance,
  getCurrencyForCountry,
  PERMIT_CLOCKS,
} from '../../modules/countryModules';
import {
  generatePermitDashboard,
  generatePermitAlerts,
} from '../../modules/permitTracker';
import { FragilityScoreCard } from '../shared/FragilityScoreCard';
import { CriticalPathView } from '../shared/CriticalPathView';
import { SupplierReliabilityCard } from '../shared/SupplierReliabilityCard';
import { SupplierAlertBanner } from '../shared/SupplierAlertBanner';
import { WhatIfAnalysisModal } from '../shared/WhatIfAnalysisModal';
import {
  useFragilityScore,
  useCriticalPath,
  useFragilityAlerts,
} from '../../services/scheduleFragilityService';
import {
  useSupplierRanking,
  useDriftAlerts,
} from '../../services/supplierReliabilityService';
import {
  useWorkflowsForRole,
  usePendingWorkflows,
  useSupplierEscalations,
  crossRoleWorkflowService,
} from '../../services/crossRoleWorkflowService';
import type { Workflow, WorkflowStep } from '../../services/crossRoleWorkflowService';

// Vasco Guidance
import { useVascoGuidance, useInlineInsight } from '../../services/vascoGuidanceService';
import { VascoInsightList, InlineInsight } from '../shared/VascoInsightCard';
import type { VascoInsight } from '../shared/VascoInsightCard';
import { ContractorDashboardHeader } from '../contractor/ContractorDashboardHeader';

type IconName = keyof typeof Ionicons.glyphMap;
export type COOTabView = 'overview' | 'schedule' | 'permits' | 'procurement';
type TabView = COOTabView;

// Role color - matches theme roleCOO token
const COO_COLOR = '#7C3AED'; // Purple for COO (per theme)

// =============================================================================
// HELPERS
// =============================================================================

function formatCompact(value: number | undefined | null, currency: string = 'GBP'): string {
  if (value === undefined || value === null) return '—';
  const symbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${symbol}${value.toFixed(0)}`;
}

// =============================================================================
// COMPONENTS
// =============================================================================

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
        <Ionicons name={icon} size={20} color={COO_COLOR} />
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

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

interface COODashboardProps {
  initialTab?: TabView;
  showTabBar?: boolean;
}

export function COODashboard({ initialTab = 'overview', showTabBar = true }: COODashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');
  const [showWhatIfModal, setShowWhatIfModal] = useState(false);

  // Vasco AI Guidance
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const [snoozedGuidance, setSnoozedGuidance] = useState<Set<string>>(new Set());
  const allGuidance = useVascoGuidance('coo', activeTab as any);
  const activeGuidance = useMemo(
    () => allGuidance.filter(g => !dismissedGuidance.has(g.id) && !snoozedGuidance.has(g.id)),
    [allGuidance, dismissedGuidance, snoozedGuidance]
  );
  // Inline insights per tab
  const overviewInsight = useInlineInsight('coo', 'overview', 'overview');
  const scheduleInsight = useInlineInsight('coo', 'schedule', 'overview');
  const permitsInsight = useInlineInsight('coo', 'permits', 'overview');
  const procurementInsight = useInlineInsight('coo', 'procurement', 'overview');

  // New hooks for P1/P2 features
  const { data: fragilityScore, loading: fragilityLoading } = useFragilityScore(selectedProjectId);
  const { data: criticalPath, loading: criticalPathLoading } = useCriticalPath(selectedProjectId);
  const { data: fragilityAlerts } = useFragilityAlerts(selectedProjectId);
  const { data: topSuppliers } = useSupplierRanking('materials', 5);
  const { data: supplierAlerts } = useDriftAlerts();

  // Cross-role workflow data
  const cooWorkflows = useWorkflowsForRole('coo');
  const cooPendingWorkflows = usePendingWorkflows('coo');
  const { activeEscalations } = useSupplierEscalations();

  // Derived data
  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);
  const currency = useMemo(() => selectedProject ? getCurrencyForCountry(selectedProject.country) : 'GBP', [selectedProject]);

  // Schedule health
  const scheduleHealth = useMemo(() => {
    if (!selectedProject || !deliveryMetrics) return null;

    const variance = calculateScheduleVariance(
      selectedProject.plannedEndDate,
      selectedProject.forecastEndDate || selectedProject.plannedEndDate
    );

    const criticalActivities = selectedProject.scheduleActivities.filter(a => a.isCriticalPath);
    const delayedActivities = selectedProject.scheduleActivities.filter(a => a.status === 'delayed');
    const completedActivities = selectedProject.scheduleActivities.filter(a => a.status === 'completed');
    const inProgressActivities = selectedProject.scheduleActivities.filter(a => a.status === 'in-progress');

    return {
      spi: deliveryMetrics.spiSchedulePerformanceIndex,
      varianceDays: variance.varianceDays,
      status: variance.status,
      criticalPathFloat: deliveryMetrics.criticalPathFloat,
      progressPercent: (completedActivities.length / selectedProject.scheduleActivities.length) * 100,
      delayedCount: delayedActivities.length,
      criticalCount: criticalActivities.length,
      inProgressCount: inProgressActivities.length,
      completedCount: completedActivities.length,
      totalActivities: selectedProject.scheduleActivities.length,
    };
  }, [selectedProject, deliveryMetrics]);

  // Permit dashboard
  const permitDashboard = useMemo(() => {
    if (!selectedProject) return null;
    return generatePermitDashboard(selectedProject.permits);
  }, [selectedProject]);

  // Permit alerts
  const criticalAlerts = useMemo(() => {
    if (!selectedProject) return [];
    return selectedProject.permits
      .flatMap(p => generatePermitAlerts(p))
      .filter(a => a.severity === 'critical');
  }, [selectedProject]);

  // Procurement metrics
  const procurementRisk = useMemo(() => {
    if (!deliveryMetrics) return null;

    const totalContracts = deliveryMetrics.contractsAwarded + deliveryMetrics.contractsPending;
    const awardedPercent = totalContracts > 0
      ? deliveryMetrics.contractsAwarded / totalContracts : 0;

    return {
      awarded: deliveryMetrics.contractsAwarded,
      pending: deliveryMetrics.contractsPending,
      total: totalContracts,
      awardedPercent,
      riskValue: deliveryMetrics.procurementRiskValue,
      changeOrders: {
        submitted: deliveryMetrics.changeOrdersSubmitted,
        approved: deliveryMetrics.changeOrdersApproved,
        value: deliveryMetrics.changeOrdersValue,
      },
    };
  }, [deliveryMetrics]);

  // Portfolio metrics
  const portfolioMetrics = useMemo(() => {
    let onTrack = 0;
    let atRisk = 0;
    let behind = 0;
    let totalPermitsPending = 0;

    mockProjects.forEach((project) => {
      const metrics = mockDeliveryMetrics[project.id];
      if (metrics) {
        if (metrics.spiSchedulePerformanceIndex >= 0.95) onTrack++;
        else if (metrics.spiSchedulePerformanceIndex >= 0.85) atRisk++;
        else behind++;
      }
      const pending = project.permits.filter(p =>
        p.status === 'under-review' || p.status === 'submitted'
      ).length;
      totalPermitsPending += pending;
    });

    return { onTrack, atRisk, behind, totalPermitsPending };
  }, []);

  const fmt = (amount: number) => formatCompact(amount, currency);

  const handleDismissGuidance = useCallback((id: string) => {
    setDismissedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleSnoozeGuidance = useCallback((id: string) => {
    setSnoozedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleGuidanceAction = useCallback((insight: VascoInsight) => {
    if (insight.actionRoute) router.push(insight.actionRoute as any);
  }, [router]);

  // Project selector component (reused across tabs)
  const ProjectSelector = () => (
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
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Operations</Text>
            <Text style={styles.headerSubtitle}>{mockProjects.length} actieve projecten</Text>
          </View>
          <View style={[styles.headerAccent, { backgroundColor: COO_COLOR }]} />
        </View>

        {/* Portfolio Status Pills */}
        <View style={styles.headerMetrics}>
          <View style={[styles.statusPill, styles.statusPillGood]}>
            <Text style={styles.statusPillValue}>{portfolioMetrics.onTrack}</Text>
            <Text style={styles.statusPillLabel}>On Track</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillWarning]}>
            <Text style={styles.statusPillValue}>{portfolioMetrics.atRisk}</Text>
            <Text style={styles.statusPillLabel}>At Risk</Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillDanger]}>
            <Text style={styles.statusPillValue}>{portfolioMetrics.behind}</Text>
            <Text style={styles.statusPillLabel}>Behind</Text>
          </View>
        </View>
      </View>

      {/* Internal tab bar removed - using bottom navigation instead */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <>
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'business', value: `${portfolioMetrics.onTrack}/${mockProjects.length}`, label: 'On Track', color: COO_COLOR },
                { icon: 'trending-up', value: scheduleHealth ? `${scheduleHealth.spi.toFixed(2)}` : '—', label: 'SPI' },
                { icon: 'alert-circle', value: `${portfolioMetrics.behind}`, label: 'Behind', color: portfolioMetrics.behind > 0 ? SemanticColors.feedbackError : undefined },
              ]}
            />
            <VascoInsightList
              insights={activeGuidance}
              title="Vasco AI Guidance"
              compact
              maxVisible={2}
              onDismiss={handleDismissGuidance}
              onAction={handleGuidanceAction}
              onSnooze={handleSnoozeGuidance}
            />
            {overviewInsight && (
              <InlineInsight icon={overviewInsight.icon as IconName} message={overviewInsight.message} />
            )}

            {/* Project Selector */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Project</Text>
              <ProjectSelector />
            </View>

            {/* Key Metrics Summary */}
            {scheduleHealth && permitDashboard && procurementRisk && (
              <View style={styles.summaryGrid}>
                {/* Schedule Summary */}
                <Pressable style={styles.summaryCard} onPress={() => setActiveTab('schedule')}>
                  <View style={styles.summaryCardHeader}>
                    <Ionicons name="speedometer" size={18} color={COO_COLOR} />
                    <Text style={styles.summaryCardTitle}>Schedule</Text>
                  </View>
                  <View style={styles.summaryCardContent}>
                    <Text style={[
                      styles.summaryCardValue,
                      scheduleHealth.spi >= 0.95 && { color: SemanticColors.feedbackSuccess },
                      scheduleHealth.spi < 0.85 && { color: SemanticColors.feedbackError },
                    ]}>
                      {scheduleHealth.spi.toFixed(2)}
                    </Text>
                    <Text style={styles.summaryCardLabel}>SPI</Text>
                  </View>
                  <Text style={styles.summaryCardSubtext}>
                    {scheduleHealth.varianceDays >= 0 ? '+' : ''}{scheduleHealth.varianceDays}d variance
                  </Text>
                </Pressable>

                {/* Permits Summary */}
                <Pressable style={styles.summaryCard} onPress={() => setActiveTab('permits')}>
                  <View style={styles.summaryCardHeader}>
                    <Ionicons name="document-text" size={18} color={Palette.terracotta} />
                    <Text style={styles.summaryCardTitle}>Permits</Text>
                    {criticalAlerts.length > 0 && (
                      <View style={styles.summaryCardBadge}>
                        <Text style={styles.summaryCardBadgeText}>{criticalAlerts.length}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.summaryCardContent}>
                    <Text style={styles.summaryCardValue}>
                      {permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions}
                    </Text>
                    <Text style={styles.summaryCardLabel}>Approved</Text>
                  </View>
                  <Text style={styles.summaryCardSubtext}>
                    {permitDashboard.byStatus.pending} pending
                  </Text>
                </Pressable>

                {/* Procurement Summary */}
                <Pressable style={styles.summaryCard} onPress={() => setActiveTab('procurement')}>
                  <View style={styles.summaryCardHeader}>
                    <Ionicons name="cart" size={18} color={Palette.hermesOrange} />
                    <Text style={styles.summaryCardTitle}>Contracts</Text>
                  </View>
                  <View style={styles.summaryCardContent}>
                    <Text style={styles.summaryCardValue}>{formatPercent(procurementRisk.awardedPercent)}</Text>
                    <Text style={styles.summaryCardLabel}>Awarded</Text>
                  </View>
                  <Text style={styles.summaryCardSubtext}>
                    {procurementRisk.pending} pending
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Critical Alerts */}
            {criticalAlerts.length > 0 && (
              <Pressable style={styles.alertBanner} onPress={() => setActiveTab('permits')}>
                <Ionicons name="warning" size={20} color={SemanticColors.feedbackError} />
                <View style={styles.alertBannerContent}>
                  <Text style={styles.alertBannerTitle}>Permit Alert</Text>
                  <Text style={styles.alertBannerText} numberOfLines={1}>
                    {criticalAlerts[0].title}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={SemanticColors.feedbackError} />
              </Pressable>
            )}

            {/* Cross-Role Workflows - COO Actions */}
            {(cooPendingWorkflows.length > 0 || activeEscalations.length > 0) && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Workflow Acties</Text>
                  <View style={styles.wfBadge}>
                    <Text style={styles.wfBadgeText}>
                      {cooPendingWorkflows.length + activeEscalations.length}
                    </Text>
                  </View>
                </View>

                {/* Pending escalations requiring COO action */}
                {activeEscalations.map((wf) => {
                  const currentStep = wf.steps.find(s => s.id === wf.currentStepId);
                  const isMyStep = currentStep?.assignedRole === 'coo';
                  return (
                    <View key={wf.id} style={styles.wfItem}>
                      <View style={styles.wfItemHeader}>
                        <View style={[styles.wfTypeBadge, { backgroundColor: SemanticColors.feedbackWarning + '20' }]}>
                          <Ionicons name="flash" size={12} color={SemanticColors.feedbackWarning} />
                          <Text style={[styles.wfTypeBadgeText, { color: SemanticColors.feedbackWarning }]}>Escalatie</Text>
                        </View>
                        {isMyStep && (
                          <View style={[styles.wfActionRequired, { backgroundColor: COO_COLOR + '15' }]}>
                            <Text style={[styles.wfActionRequiredText, { color: COO_COLOR }]}>Actie vereist</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.wfItemTitle}>{wf.title}</Text>
                      <Text style={styles.wfItemMeta}>
                        {wf.projectName} {wf.amount ? `· ${formatCompact(wf.amount, wf.currency)}` : ''}
                      </Text>
                      {currentStep && (
                        <View style={styles.wfStepRow}>
                          <View style={[styles.wfStepDot, {
                            backgroundColor: currentStep.status === 'in-progress'
                              ? COO_COLOR
                              : SemanticColors.feedbackWarning,
                          }]} />
                          <Text style={styles.wfStepText}>
                            Stap {currentStep.order}: {currentStep.name}
                          </Text>
                        </View>
                      )}
                      {/* Progress indicator */}
                      <View style={styles.wfProgressBar}>
                        <View style={[styles.wfProgressFill, {
                          width: `${(wf.steps.filter(s => s.status === 'completed').length / wf.steps.length) * 100}%`,
                          backgroundColor: COO_COLOR,
                        }]} />
                      </View>
                      <Text style={styles.wfProgressText}>
                        {wf.steps.filter(s => s.status === 'completed').length}/{wf.steps.length} stappen afgerond
                      </Text>
                      {isMyStep && (
                        <Pressable
                          style={[styles.wfActionButton, { backgroundColor: COO_COLOR }]}
                          onPress={() => {
                            if (currentStep) {
                              crossRoleWorkflowService.completeStep(
                                wf.id, currentStep.id, 'coo-001', 'James Morrison', 'coo'
                              );
                            }
                          }}
                        >
                          <Ionicons name="checkmark" size={16} color="#fff" />
                          <Text style={styles.wfActionButtonText}>Stap afronden</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}

                {/* Other pending workflows for COO */}
                {cooPendingWorkflows
                  .filter(wf => wf.type !== 'supplier-escalation')
                  .slice(0, 2)
                  .map((wf) => {
                    const currentStep = wf.steps.find(s => s.id === wf.currentStepId);
                    return (
                      <View key={wf.id} style={styles.wfItem}>
                        <View style={styles.wfItemHeader}>
                          <View style={[styles.wfTypeBadge, { backgroundColor: COO_COLOR + '15' }]}>
                            <Ionicons name="git-network" size={12} color={COO_COLOR} />
                            <Text style={[styles.wfTypeBadgeText, { color: COO_COLOR }]}>Workflow</Text>
                          </View>
                        </View>
                        <Text style={styles.wfItemTitle}>{wf.title}</Text>
                        <Text style={styles.wfItemMeta}>
                          {wf.projectName} · Status: {wf.status}
                        </Text>
                        {currentStep && (
                          <View style={styles.wfStepRow}>
                            <View style={[styles.wfStepDot, { backgroundColor: COO_COLOR }]} />
                            <Text style={styles.wfStepText}>
                              Stap {currentStep.order}: {currentStep.name}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
              </View>
            )}

            {/* Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/ai-assistant' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: COO_COLOR + '15' }]}>
                    <Ionicons name="sparkles" size={18} color={COO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>AI Assistent</Text>
                    <Text style={styles.actionSubtitle}>Operationele vragen & AI hulp</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/team' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="people" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Teambeheer</Text>
                    <Text style={styles.actionSubtitle}>Team management & resource overzicht</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/documents' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="folder-open" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Documenten</Text>
                    <Text style={styles.actionSubtitle}>Operationele documentkluis</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && scheduleHealth && selectedProject && (
          <>
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'pie-chart', value: scheduleHealth ? `${scheduleHealth.progressPercent.toFixed(0)}%` : '—', label: 'Voortgang', color: COO_COLOR },
                { icon: 'alert-circle', value: String(scheduleHealth?.delayedCount || 0), label: 'Vertraagd', color: (scheduleHealth?.delayedCount || 0) > 0 ? SemanticColors.feedbackError : undefined },
                { icon: 'git-network', value: String(scheduleHealth?.criticalCount || 0), label: 'Kritiek Pad' },
              ]}
            />
            {scheduleInsight && (
              <InlineInsight icon={scheduleInsight.icon as IconName} message={scheduleInsight.message} />
            )}

            <ProjectSelector />

            {/* SPI Banner */}
            <View style={[
              styles.spiBanner,
              scheduleHealth.spi >= 0.95 && styles.spiBannerGood,
              scheduleHealth.spi >= 0.85 && scheduleHealth.spi < 0.95 && styles.spiBannerWarning,
              scheduleHealth.spi < 0.85 && styles.spiBannerDanger,
            ]}>
              <View style={styles.spiLeft}>
                <Text style={styles.spiLabel}>Schedule Performance Index</Text>
                <Text style={styles.spiStatus}>
                  {scheduleHealth.status === 'ahead' ? 'Ahead of Schedule' :
                   scheduleHealth.status === 'on-track' ? 'On Track' : 'Behind Schedule'}
                </Text>
              </View>
              <View style={styles.spiCircle}>
                <Text style={styles.spiValue}>{scheduleHealth.spi.toFixed(2)}</Text>
              </View>
            </View>

            {/* Progress Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Progress</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${scheduleHealth.progressPercent}%` }]} />
              </View>
              <View style={styles.progressStats}>
                <Text style={styles.progressPercent}>{scheduleHealth.progressPercent.toFixed(0)}% Complete</Text>
                <Text style={styles.progressVariance}>
                  {scheduleHealth.varianceDays >= 0 ? '+' : ''}{scheduleHealth.varianceDays} days
                </Text>
              </View>
            </View>

            {/* Schedule Metrics */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activity Status</Text>
              <View style={styles.activityGrid}>
                <View style={[styles.activityItem, styles.activityItemCompleted]}>
                  <Text style={styles.activityValue}>{scheduleHealth.completedCount}</Text>
                  <Text style={styles.activityLabel}>Completed</Text>
                </View>
                <View style={[styles.activityItem, styles.activityItemProgress]}>
                  <Text style={styles.activityValue}>{scheduleHealth.inProgressCount}</Text>
                  <Text style={styles.activityLabel}>In Progress</Text>
                </View>
                <View style={[styles.activityItem, scheduleHealth.delayedCount > 0 && styles.activityItemDelayed]}>
                  <Text style={[styles.activityValue, scheduleHealth.delayedCount > 0 && styles.dangerText]}>
                    {scheduleHealth.delayedCount}
                  </Text>
                  <Text style={styles.activityLabel}>Delayed</Text>
                </View>
                <View style={styles.activityItem}>
                  <Text style={styles.activityValue}>{scheduleHealth.criticalCount}</Text>
                  <Text style={styles.activityLabel}>Critical Path</Text>
                </View>
              </View>
            </View>

            {/* Key Dates */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Key Dates</Text>
              <View style={styles.datesGrid}>
                <View style={styles.dateCard}>
                  <Text style={styles.dateCardLabel}>Start Date</Text>
                  <Text style={styles.dateCardValue}>{selectedProject.startDate}</Text>
                </View>
                <View style={styles.dateCard}>
                  <Text style={styles.dateCardLabel}>Planned End</Text>
                  <Text style={styles.dateCardValue}>{selectedProject.plannedEndDate}</Text>
                </View>
                <View style={styles.dateCard}>
                  <Text style={styles.dateCardLabel}>Forecast End</Text>
                  <Text style={[
                    styles.dateCardValue,
                    scheduleHealth.varianceDays < 0 && styles.dangerText
                  ]}>
                    {selectedProject.forecastEndDate || selectedProject.plannedEndDate}
                  </Text>
                </View>
                <View style={styles.dateCard}>
                  <Text style={styles.dateCardLabel}>Float</Text>
                  <Text style={styles.dateCardValue}>{scheduleHealth.criticalPathFloat}d</Text>
                </View>
              </View>
            </View>

            {/* Schedule Fragility Scoring - P2 Feature */}
            {fragilityScore && !fragilityLoading && (
              <FragilityScoreCard
                fragility={fragilityScore}
                onPress={() => setShowWhatIfModal(true)}
                showFactors={true}
                showAlerts={true}
              />
            )}

            {/* Critical Path View - P2 Feature */}
            {criticalPath && !criticalPathLoading && (
              <CriticalPathView
                criticalPath={criticalPath}
                compact={false}
              />
            )}

            {/* What-If Analysis Button */}
            {fragilityScore && (
              <Pressable
                style={styles.whatIfButton}
                onPress={() => setShowWhatIfModal(true)}
              >
                <Ionicons name="git-branch" size={18} color={COO_COLOR} />
                <Text style={styles.whatIfButtonText}>Run What-If Analysis</Text>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            )}

            {/* Planning Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Planning Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/planning' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: COO_COLOR + '15' }]}>
                    <Ionicons name="calendar" size={18} color={COO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Planning</Text>
                    <Text style={styles.actionSubtitle}>Gedetailleerde planning & jobplanning</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/capacity' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="bar-chart" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Capaciteit</Text>
                    <Text style={styles.actionSubtitle}>Teamcapaciteit & resource-allocatie</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/route' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                    <Ionicons name="navigate" size={18} color={SemanticColors.feedbackSuccess} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Route Optimalisatie</Text>
                    <Text style={styles.actionSubtitle}>Route-efficiëntie & reisoptimalisatie</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* PERMITS TAB */}
        {activeTab === 'permits' && permitDashboard && selectedProject && (
          <>
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'document-text', value: String(permitDashboard.totalPermits), label: 'Total', color: COO_COLOR },
                { icon: 'checkmark-circle', value: String(permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions), label: 'Approved', color: SemanticColors.feedbackSuccess },
                { icon: 'alert-circle', value: String(criticalAlerts.length), label: 'Critical', color: criticalAlerts.length > 0 ? SemanticColors.feedbackError : undefined },
              ]}
            />
            {permitsInsight && (
              <InlineInsight icon={permitsInsight.icon as IconName} message={permitsInsight.message} />
            )}

            <ProjectSelector />

            {/* Critical Alerts */}
            {criticalAlerts.length > 0 && (
              <View style={styles.alertCard}>
                <View style={styles.alertCardHeader}>
                  <Ionicons name="warning" size={20} color={SemanticColors.feedbackError} />
                  <Text style={styles.alertCardTitle}>Critical Alerts ({criticalAlerts.length})</Text>
                </View>
                {criticalAlerts.slice(0, 3).map((alert, index) => (
                  <View key={index} style={styles.alertCardItem}>
                    <Text style={styles.alertCardItemText}>{alert.title}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Permit Pipeline */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Permit Pipeline</Text>
                <Text style={[styles.cardHeaderStat, { color: COO_COLOR }]}>
                  {permitDashboard.totalPermits} total
                </Text>
              </View>
              {/* Stacked Pipeline Bar */}
              <View style={styles.permitPipelineBar}>
                {permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions > 0 && (
                  <View style={[styles.permitPipelineSegment, {
                    flex: permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions,
                    backgroundColor: SemanticColors.feedbackSuccess,
                  }]} />
                )}
                {permitDashboard.byStatus.pending > 0 && (
                  <View style={[styles.permitPipelineSegment, {
                    flex: permitDashboard.byStatus.pending,
                    backgroundColor: SemanticColors.feedbackWarning,
                  }]} />
                )}
                {(permitDashboard.totalPermits - (permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions) - permitDashboard.byStatus.pending) > 0 && (
                  <View style={[styles.permitPipelineSegment, {
                    flex: permitDashboard.totalPermits - (permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions) - permitDashboard.byStatus.pending,
                    backgroundColor: SemanticColors.feedbackInfo,
                  }]} />
                )}
              </View>
              {/* Legend */}
              <View style={styles.permitPipelineLegend}>
                <View style={styles.permitPipelineLegendItem}>
                  <View style={[styles.permitPipelineDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                  <Text style={styles.permitPipelineLegendText}>Approved</Text>
                  <Text style={styles.permitPipelineLegendCount}>{permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions}</Text>
                </View>
                <View style={styles.permitPipelineLegendItem}>
                  <View style={[styles.permitPipelineDot, { backgroundColor: SemanticColors.feedbackWarning }]} />
                  <Text style={styles.permitPipelineLegendText}>Pending</Text>
                  <Text style={styles.permitPipelineLegendCount}>{permitDashboard.byStatus.pending}</Text>
                </View>
                <View style={styles.permitPipelineLegendItem}>
                  <View style={[styles.permitPipelineDot, { backgroundColor: SemanticColors.feedbackInfo }]} />
                  <Text style={styles.permitPipelineLegendText}>Under Review</Text>
                  <Text style={styles.permitPipelineLegendCount}>
                    {permitDashboard.totalPermits - (permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions) - permitDashboard.byStatus.pending}
                  </Text>
                </View>
              </View>
            </View>

            {/* Conditions Discharge Ring */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Conditions Discharge</Text>
                <Text style={[styles.cardHeaderStat, { color: SemanticColors.feedbackSuccess }]}>
                  {Math.round(permitDashboard.conditionsProgress.percentComplete * 100)}%
                </Text>
              </View>
              <View style={styles.conditionsDischargeRow}>
                {/* Ring indicator */}
                <View style={styles.conditionsRing}>
                  <View style={[styles.conditionsRingFill, {
                    borderColor: permitDashboard.conditionsProgress.percentComplete >= 0.8
                      ? SemanticColors.feedbackSuccess
                      : permitDashboard.conditionsProgress.percentComplete >= 0.5
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                  }]}>
                    <Text style={styles.conditionsRingValue}>
                      {permitDashboard.conditionsProgress.discharged}
                    </Text>
                    <Text style={styles.conditionsRingLabel}>of {permitDashboard.conditionsProgress.total}</Text>
                  </View>
                </View>
                {/* Stats */}
                <View style={styles.conditionsDischargeStats}>
                  <View style={styles.conditionsDischargeStatRow}>
                    <View style={[styles.conditionsDischargeIndicator, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                    <Text style={styles.conditionsDischargeLabel}>Discharged</Text>
                    <Text style={styles.conditionsDischargeValue}>{permitDashboard.conditionsProgress.discharged}</Text>
                  </View>
                  <View style={styles.conditionsDischargeStatRow}>
                    <View style={[styles.conditionsDischargeIndicator, { backgroundColor: SemanticColors.feedbackWarning }]} />
                    <Text style={styles.conditionsDischargeLabel}>Pending</Text>
                    <Text style={styles.conditionsDischargeValue}>{permitDashboard.conditionsProgress.pending}</Text>
                  </View>
                  <View style={styles.conditionsDischargeStatRow}>
                    <View style={[styles.conditionsDischargeIndicator, { backgroundColor: SemanticColors.feedbackError }]} />
                    <Text style={styles.conditionsDischargeLabel}>Overdue</Text>
                    <Text style={[styles.conditionsDischargeValue, permitDashboard.conditionsProgress.overdue > 0 && styles.dangerText]}>
                      {permitDashboard.conditionsProgress.overdue}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Statutory Timelines */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Statutory Timelines ({selectedProject.country})</Text>
              <View style={styles.timelinesGrid}>
                {PERMIT_CLOCKS.filter(c => c.country === selectedProject.country).map((clock) => (
                  <View key={clock.permitType} style={styles.timelineItem}>
                    <Text style={styles.timelineType}>{clock.permitType.replace(/-/g, ' ')}</Text>
                    <Text style={styles.timelineDays}>{clock.standardDays}d</Text>
                    {clock.extensionDays && (
                      <Text style={styles.timelineExtension}>+{clock.extensionDays}d ext</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Vergunning Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vergunning Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/compliance' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: COO_COLOR + '15' }]}>
                    <Ionicons name="shield-checkmark" size={18} color={COO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Compliance</Text>
                    <Text style={styles.actionSubtitle}>Regelgeving & nalevingstracking</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/warranty' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="ribbon" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Garantie</Text>
                    <Text style={styles.actionSubtitle}>Garantie- & verplichtingenbeheer</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* PROCUREMENT TAB */}
        {activeTab === 'procurement' && procurementRisk && selectedProject && (
          <>
            {/* KPI Header */}
            <ContractorDashboardHeader
              kpis={[
                { icon: 'cart', value: `${procurementRisk.awarded}/${procurementRisk.total}`, label: 'Awarded', color: COO_COLOR },
                { icon: 'time', value: String(procurementRisk.pending), label: 'Pending' },
                { icon: 'cash', value: formatCompact(procurementRisk.changeOrders.value, currency), label: 'CO Value' },
              ]}
            />
            {procurementInsight && (
              <InlineInsight icon={procurementInsight.icon as IconName} message={procurementInsight.message} />
            )}

            <ProjectSelector />

            {/* Supplier Drift Alerts - P1 Feature */}
            {supplierAlerts && supplierAlerts.length > 0 && (
              <View style={styles.supplierAlertsSection}>
                {supplierAlerts.slice(0, 2).map((alert) => (
                  <SupplierAlertBanner
                    key={alert.id}
                    alert={alert}
                    onViewDetails={() => {}}
                    onViewAlternatives={() => {}}
                  />
                ))}
              </View>
            )}

            {/* Contract Awards Progress */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Contract Awards</Text>
                <Text style={[styles.cardHeaderStat, { color: COO_COLOR }]}>
                  {formatPercent(procurementRisk.awardedPercent)}
                </Text>
              </View>
              <View style={styles.procurementBar}>
                <View style={[styles.procurementFill, { width: `${procurementRisk.awardedPercent * 100}%` }]} />
              </View>
              <View style={styles.procurementGrid}>
                <View style={[styles.procurementCard, styles.procurementCardAwarded]}>
                  <Text style={styles.procurementCardValue}>{procurementRisk.awarded}</Text>
                  <Text style={styles.procurementCardLabel}>Awarded</Text>
                </View>
                <View style={[styles.procurementCard, procurementRisk.pending > 0 && styles.procurementCardPending]}>
                  <Text style={styles.procurementCardValue}>{procurementRisk.pending}</Text>
                  <Text style={styles.procurementCardLabel}>Pending</Text>
                </View>
                <View style={styles.procurementCard}>
                  <Text style={styles.procurementCardValue}>{procurementRisk.total}</Text>
                  <Text style={styles.procurementCardLabel}>Total</Text>
                </View>
              </View>
            </View>

            {/* Risk Value */}
            {procurementRisk.riskValue > 0 && (
              <View style={styles.riskBanner}>
                <Ionicons name="alert-circle" size={20} color={SemanticColors.feedbackWarning} />
                <View style={styles.riskBannerContent}>
                  <Text style={styles.riskBannerLabel}>Procurement Risk Exposure</Text>
                  <Text style={styles.riskBannerValue}>{fmt(procurementRisk.riskValue)}</Text>
                </View>
              </View>
            )}

            {/* Change Order Pipeline */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Change Orders</Text>
                <Text style={[styles.cardHeaderStat, { color: Palette.hermesOrange }]}>{fmt(procurementRisk.changeOrders.value)}</Text>
              </View>
              {/* CO Flow Bars */}
              {[
                { label: 'Submitted', value: procurementRisk.changeOrders.submitted, max: procurementRisk.changeOrders.submitted, color: COO_COLOR },
                { label: 'Approved', value: procurementRisk.changeOrders.approved, max: procurementRisk.changeOrders.submitted, color: SemanticColors.feedbackSuccess },
                { label: 'Pending', value: procurementRisk.changeOrders.submitted - procurementRisk.changeOrders.approved, max: procurementRisk.changeOrders.submitted, color: SemanticColors.feedbackWarning },
              ].map((item) => (
                <View key={item.label} style={styles.coFlowRow}>
                  <View style={styles.coFlowLabel}>
                    <Text style={styles.coFlowLabelText}>{item.label}</Text>
                    <Text style={[styles.coFlowCount, { color: item.color }]}>{item.value}</Text>
                  </View>
                  <View style={styles.coFlowBarTrack}>
                    <View style={[styles.coFlowBarFill, {
                      width: `${item.max > 0 ? (item.value / item.max) * 100 : 0}%`,
                      backgroundColor: item.color,
                    }]} />
                  </View>
                </View>
              ))}
              {/* Total Value Callout */}
              <View style={styles.coTotalCallout}>
                <Ionicons name="cash" size={16} color={Palette.hermesOrange} />
                <Text style={styles.coTotalLabel}>Total CO Value</Text>
                <Text style={styles.coTotalValue}>{fmt(procurementRisk.changeOrders.value)}</Text>
              </View>
            </View>

            {/* Supplier Reliability Section - P1 Feature */}
            {topSuppliers && topSuppliers.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Supplier Reliability</Text>
                  <Pressable>
                    <Text style={[styles.seeAllText, { color: COO_COLOR }]}>View All</Text>
                  </Pressable>
                </View>
                <View style={styles.suppliersGrid}>
                  {topSuppliers.slice(0, 3).map((supplier) => (
                    <SupplierReliabilityCard
                      key={supplier.supplierId}
                      supplier={supplier}
                      compact={true}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Contract List Preview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Contracts</Text>
              {selectedProject.contracts.slice(0, 4).map((contract, index) => (
                <View key={contract.id} style={[
                  styles.contractRow,
                  index < Math.min(selectedProject.contracts.length, 4) - 1 && styles.contractRowBorder
                ]}>
                  <View style={styles.contractInfo}>
                    <Text style={styles.contractName} numberOfLines={1}>{contract.counterparty}</Text>
                    <Text style={styles.contractType}>{contract.type.replace(/-/g, ' ')}</Text>
                  </View>
                  <Text style={styles.contractValue}>{fmt(contract.value)}</Text>
                </View>
              ))}
            </View>

            {/* Inkoop Tools */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inkoop Tools</Text>
              <View style={styles.actionsList}>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/purchasing' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: COO_COLOR + '15' }]}>
                    <Ionicons name="storefront" size={18} color={COO_COLOR} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Leveranciers</Text>
                    <Text style={styles.actionSubtitle}>Leverancierskeuze & -beheer</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/reorder' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="refresh" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Herbestellen</Text>
                    <Text style={styles.actionSubtitle}>Slim herbestellen & voorraad</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/benchmark' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackSuccess + '15' }]}>
                    <Ionicons name="stats-chart" size={18} color={SemanticColors.feedbackSuccess} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle}>Benchmarking</Text>
                    <Text style={styles.actionSubtitle}>Leveranciers- & kostenbenchmarks</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* What-If Analysis Modal - P2 Feature */}
      {fragilityScore && (
        <WhatIfAnalysisModal
          visible={showWhatIfModal}
          onClose={() => setShowWhatIfModal(false)}
          projectId={selectedProjectId}
          projectName={selectedProject?.name || ''}
          currentFragility={fragilityScore}
        />
      )}
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
  headerAccent: {
    width: 6,
    height: 36,
    borderRadius: 3,
  },
  headerMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  statusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  statusPillGood: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  statusPillWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  statusPillDanger: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  statusPillValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  statusPillLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  tabActive: {
    backgroundColor: COO_COLOR,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
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
    backgroundColor: COO_COLOR + '15',
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

  // Project Selector
  projectRow: {
    flexDirection: 'row',
    gap: 8,
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
    borderColor: COO_COLOR,
    backgroundColor: COO_COLOR + '10',
  },
  projectCountry: {
    fontSize: 10,
    fontWeight: '700',
    color: COO_COLOR,
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

  // Summary Grid (Overview Tab)
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  summaryCardTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
  },
  summaryCardBadge: {
    backgroundColor: SemanticColors.feedbackError,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  summaryCardContent: {
    alignItems: 'center',
  },
  summaryCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  summaryCardLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  summaryCardSubtext: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },

  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SemanticColors.feedbackErrorBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackErrorBorder,
  },
  alertBannerContent: {
    flex: 1,
  },
  alertBannerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  alertBannerText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Cards
  card: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderStat: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // SPI Banner (Schedule Tab)
  spiBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 14,
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  spiBannerGood: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  spiBannerWarning: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  spiBannerDanger: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  spiLeft: {},
  spiLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  spiStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },
  spiCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SemanticColors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Progress Bar
  progressBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COO_COLOR,
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  progressVariance: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },

  // Activity Grid
  activityGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  activityItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  activityItemCompleted: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  activityItemProgress: {
    backgroundColor: COO_COLOR + '15',
  },
  activityItemDelayed: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  activityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  activityLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  dangerText: {
    color: SemanticColors.feedbackError,
  },

  // Dates Grid
  datesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
  },
  dateCardLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  dateCardValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },

  // Alert Card (Permits Tab)
  alertCard: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackErrorBorder,
    gap: 8,
  },
  alertCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  alertCardItem: {
    paddingLeft: 28,
  },
  alertCardItemText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Permit Grid
  permitGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  permitCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  permitCardApproved: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  permitCardPending: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  permitCardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  permitCardLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Conditions Bar
  conditionsBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  conditionsFill: {
    height: '100%',
    backgroundColor: SemanticColors.feedbackSuccess,
    borderRadius: 4,
  },
  conditionsStats: {
    flexDirection: 'row',
    gap: 8,
  },
  conditionsStat: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  conditionsStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  conditionsStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },

  // Timelines Grid
  timelinesGrid: {
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  timelineType: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
    textTransform: 'capitalize',
  },
  timelineDays: {
    fontSize: 14,
    fontWeight: '700',
    color: COO_COLOR,
  },
  timelineExtension: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
  },

  // Procurement Grid
  procurementBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  procurementFill: {
    height: '100%',
    backgroundColor: COO_COLOR,
    borderRadius: 4,
  },
  procurementGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  procurementCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  procurementCardAwarded: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  procurementCardPending: {
    backgroundColor: SemanticColors.feedbackWarningBg,
  },
  procurementCardValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  procurementCardLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },

  // Risk Banner
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SemanticColors.feedbackWarningBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackWarningBorder,
  },
  riskBannerContent: {
    flex: 1,
  },
  riskBannerLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  riskBannerValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.feedbackWarning,
    marginTop: 2,
  },

  // Change Order Grid
  changeOrderGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  changeOrderCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  changeOrderCardApproved: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  changeOrderValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  changeOrderLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  changeOrderTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COO_COLOR + '10',
    borderRadius: 10,
    padding: 12,
  },
  changeOrderTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  changeOrderTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COO_COLOR,
  },

  // Contract Row
  contractRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  contractRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },
  contractInfo: {
    flex: 1,
    marginRight: 12,
  },
  contractName: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  contractType: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  contractValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // P1/P2 Feature Styles
  whatIfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COO_COLOR + '10',
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: COO_COLOR + '30',
  },
  whatIfButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COO_COLOR,
  },
  supplierAlertsSection: {
    gap: Spacing.sm,
  },
  suppliersGrid: {
    gap: Spacing.sm,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Permit Pipeline
  permitPipelineBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  permitPipelineSegment: {
    height: '100%',
  },
  permitPipelineLegend: {
    gap: Spacing.xs,
  },
  permitPipelineLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permitPipelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  permitPipelineLegendText: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  permitPipelineLegendCount: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Conditions Discharge Ring
  conditionsDischargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  conditionsRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionsRingFill: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  conditionsRingValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  conditionsRingLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  conditionsDischargeStats: {
    flex: 1,
    gap: Spacing.sm,
  },
  conditionsDischargeStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conditionsDischargeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
  },
  conditionsDischargeLabel: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  conditionsDischargeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Change Order Flow Bars
  coFlowRow: {
    gap: 4,
  },
  coFlowLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coFlowLabelText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  coFlowCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  coFlowBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    overflow: 'hidden',
  },
  coFlowBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  coTotalCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: 10,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  coTotalLabel: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  coTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Palette.hermesOrange,
  },

  // Cross-Role Workflow Styles
  wfBadge: {
    backgroundColor: COO_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  wfBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  wfItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  wfItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wfTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  wfTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  wfActionRequired: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  wfActionRequiredText: {
    fontSize: 10,
    fontWeight: '700',
  },
  wfItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  wfItemMeta: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  wfStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  wfStepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wfStepText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  wfProgressBar: {
    height: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  wfProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  wfProgressText: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  wfActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  wfActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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
