// =============================================================================
// COO DASHBOARD - Commercial Real Estate KPI Framework
// =============================================================================
// 4-tab navigation: Financials | Efficiency | Market | Emerging
// Aligned with CRE executive priorities for 2026
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing, SafeArea } from '../../theme/spacing';
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
import { FinancialKPIGrid } from '../shared/FinancialKPIGrid';
import type { KPITile } from '../shared/FinancialKPIGrid';
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
import {
  useFinancialPerformance,
  useOperationalEfficiency,
  useStakeholderMarket,
  useEmergingPriorities,
} from '../../services/cooRealEstateKPIService';

// Vasco Guidance
import { useVascoGuidance, useInlineInsight } from '../../services/vascoGuidanceService';
import { VascoInsightList, InlineInsight } from '../shared/VascoInsightCard';
import type { VascoInsight } from '../shared/VascoInsightCard';
import { ContractorDashboardHeader } from '../contractor/ContractorDashboardHeader';


type IconName = keyof typeof Ionicons.glyphMap;
export type COOTabView = 'financials' | 'efficiency' | 'market' | 'emerging';
type TabView = COOTabView;

const COO_COLOR = Palette.hermesOrange;

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

function varianceColor(val: number): string {
  return val >= 0 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError;
}

function varianceDir(val: number): 'up' | 'down' {
  return val >= 0 ? 'up' : 'down';
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

interface COODashboardProps {
  initialTab?: TabView;
  showTabBar?: boolean;
}

export function COODashboard({ initialTab = 'financials', showTabBar = true }: COODashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabView>(initialTab);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');
  const [showWhatIfModal, setShowWhatIfModal] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // CRE KPI hooks
  const financialKPIs = useFinancialPerformance(selectedProjectId);
  const efficiencyKPIs = useOperationalEfficiency(selectedProjectId);
  const stakeholderKPIs = useStakeholderMarket(selectedProjectId);
  const emergingKPIs = useEmergingPriorities(selectedProjectId);

  // Vasco AI Guidance
  const [dismissedGuidance, setDismissedGuidance] = useState<Set<string>>(new Set());
  const [snoozedGuidance, setSnoozedGuidance] = useState<Set<string>>(new Set());
  const allGuidance = useVascoGuidance('coo', activeTab as any);
  const activeGuidance = useMemo(
    () => allGuidance.filter(g => !dismissedGuidance.has(g.id) && !snoozedGuidance.has(g.id)),
    [allGuidance, dismissedGuidance, snoozedGuidance]
  );
  const financialsInsight = useInlineInsight('coo', 'financials', 'overview');
  const efficiencyInsight = useInlineInsight('coo', 'efficiency', 'overview');
  const marketInsight = useInlineInsight('coo', 'market', 'overview');
  const emergingInsight = useInlineInsight('coo', 'emerging', 'overview');

  // Schedule / P1-P2 hooks
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

  const fmt = (amount: number) => formatCompact(amount, currency);
  const sym = currency === 'GBP' ? '£' : '€';

  const handleDismissGuidance = useCallback((id: string) => {
    setDismissedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleSnoozeGuidance = useCallback((id: string) => {
    setSnoozedGuidance(prev => new Set(prev).add(id));
  }, []);
  const handleGuidanceAction = useCallback((insight: VascoInsight) => {
    if (insight.actionRoute) router.push(insight.actionRoute as any);
  }, [router]);

  // Project selector — dropdown balloon
  const ProjectSelector = () => (
    <View style={styles.dropdownContainer}>
      <Pressable
        style={styles.dropdownButton}
        onPress={() => setShowProjectDropdown(!showProjectDropdown)}
      >
        <View style={styles.dropdownButtonLeft}>
          <Text style={styles.dropdownCountryTag}>{selectedProject?.country}</Text>
          <Text style={styles.dropdownSelectedName} numberOfLines={1}>
            {selectedProject?.name || 'Select project'}
          </Text>
        </View>
        <Ionicons
          name={showProjectDropdown ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={COO_COLOR}
        />
      </Pressable>
      {showProjectDropdown && (
        <View style={styles.dropdownMenu}>
          {mockProjects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            return (
              <Pressable
                key={project.id}
                style={[
                  styles.dropdownItem,
                  isSelected && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedProjectId(project.id);
                  setShowProjectDropdown(false);
                }}
              >
                <Text style={styles.dropdownItemCountry}>{project.country}</Text>
                <Text
                  style={[
                    styles.dropdownItemName,
                    isSelected && styles.dropdownItemNameActive,
                  ]}
                  numberOfLines={1}
                >
                  {project.name}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color={COO_COLOR} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle} numberOfLines={1}>Operations</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{mockProjects.length} actieve projecten</Text>
          </View>
          <View style={[styles.headerAccent, { backgroundColor: COO_COLOR }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================ */}
        {/* TAB 1: FINANCIALS                                                */}
        {/* ================================================================ */}
        {activeTab === 'financials' && (
          <>
            <ContractorDashboardHeader
              kpis={[
                { icon: 'trending-up', value: `${financialKPIs.irr}%`, label: 'IRR', color: COO_COLOR },
                { icon: 'cash', value: formatCompact(financialKPIs.noi, financialKPIs.currency), label: 'NOI' },
                { icon: 'analytics', value: `${financialKPIs.operatingMargin}%`, label: 'Margin' },
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
            {financialsInsight && (
              <InlineInsight icon={financialsInsight.icon as IconName} message={financialsInsight.message} />
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Project</Text>
              <ProjectSelector />
            </View>

            {/* Financial KPI Grid — 6 tiles */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Financial Performance</Text>
              <FinancialKPIGrid
                accentColor={COO_COLOR}
                tiles={[
                  {
                    label: 'IRR',
                    value: `${financialKPIs.irr}%`,
                    variance: `${financialKPIs.irrVariance > 0 ? '+' : ''}${financialKPIs.irrVariance}%`,
                    varianceDirection: varianceDir(financialKPIs.irrVariance),
                    status: financialKPIs.irr >= 15 ? 'green' : financialKPIs.irr >= 10 ? 'amber' : 'red',
                    heroBg: true,
                  },
                  {
                    label: 'NOI',
                    value: formatCompact(financialKPIs.noi, financialKPIs.currency),
                    variance: formatCompact(financialKPIs.noiVariance, financialKPIs.currency),
                    varianceDirection: varianceDir(financialKPIs.noiVariance),
                    status: financialKPIs.noiVariance >= 0 ? 'green' : 'red',
                  },
                  {
                    label: 'OPERATING MARGIN',
                    value: `${financialKPIs.operatingMargin}%`,
                    variance: `${financialKPIs.marginVariance > 0 ? '+' : ''}${financialKPIs.marginVariance}%`,
                    varianceDirection: varianceDir(financialKPIs.marginVariance),
                    status: financialKPIs.operatingMargin >= 15 ? 'green' : financialKPIs.operatingMargin >= 12 ? 'amber' : 'red',
                  },
                  {
                    label: 'G&A RATIO',
                    value: `${financialKPIs.gaExpenseRatio}%`,
                    status: financialKPIs.gaExpenseRatio <= 5 ? 'green' : financialKPIs.gaExpenseRatio <= 6 ? 'amber' : 'red',
                  },
                  {
                    label: 'EBITDA',
                    value: formatCompact(financialKPIs.ebitda, financialKPIs.currency),
                    status: 'green',
                  },
                  {
                    label: 'EQUITY IRR',
                    value: `${financialKPIs.equityIrr}%`,
                    status: financialKPIs.equityIrr >= 18 ? 'green' : financialKPIs.equityIrr >= 14 ? 'amber' : 'red',
                  },
                ]}
              />
            </View>

            {/* Cross-Role Workflows */}
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
                      <Text style={styles.wfItemTitle} numberOfLines={1}>{wf.title}</Text>
                      <Text style={styles.wfItemMeta} numberOfLines={1}>
                        {wf.projectName} {wf.amount ? `· ${formatCompact(wf.amount, wf.currency)}` : ''}
                      </Text>
                      {currentStep && (
                        <View style={styles.wfStepRow}>
                          <View style={[styles.wfStepDot, {
                            backgroundColor: currentStep.status === 'in-progress'
                              ? COO_COLOR
                              : SemanticColors.feedbackWarning,
                          }]} />
                          <Text style={styles.wfStepText} numberOfLines={1}>
                            Stap {currentStep.order}: {currentStep.name}
                          </Text>
                        </View>
                      )}
                      <View style={styles.wfProgressBar}>
                        <View style={[styles.wfProgressFill, {
                          width: `${(wf.steps.filter(s => s.status === 'completed').length / wf.steps.length) * 100}%`,
                          backgroundColor: COO_COLOR,
                        }]} />
                      </View>
                      <Text style={styles.wfProgressText} numberOfLines={1}>
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
                        <Text style={styles.wfItemTitle} numberOfLines={1}>{wf.title}</Text>
                        <Text style={styles.wfItemMeta} numberOfLines={1}>
                          {wf.projectName} · Status: {wf.status}
                        </Text>
                        {currentStep && (
                          <View style={styles.wfStepRow}>
                            <View style={[styles.wfStepDot, { backgroundColor: COO_COLOR }]} />
                            <Text style={styles.wfStepText} numberOfLines={1}>
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
                    <Text style={styles.actionTitle} numberOfLines={1}>AI Assistent</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Operationele vragen & AI hulp</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/team' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                    <Ionicons name="people" size={18} color={SemanticColors.feedbackInfo} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Teambeheer</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Team management & resource overzicht</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => router.push('/contractor/documents' as any)}>
                  <View style={[styles.actionIcon, { backgroundColor: SemanticColors.feedbackWarning + '15' }]}>
                    <Ionicons name="folder-open" size={18} color={SemanticColors.feedbackWarning} />
                  </View>
                  <View style={styles.actionContent}>
                    <Text style={styles.actionTitle} numberOfLines={1}>Documenten</Text>
                    <Text style={styles.actionSubtitle} numberOfLines={2}>Operationele documentkluis</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={SemanticColors.textTertiary} />
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 2: EFFICIENCY                                                */}
        {/* ================================================================ */}
        {activeTab === 'efficiency' && scheduleHealth && selectedProject && (
          <>
            <ContractorDashboardHeader
              kpis={[
                { icon: 'speedometer', value: scheduleHealth.spi.toFixed(2), label: 'SPI', color: COO_COLOR },
                { icon: 'time', value: `${efficiencyKPIs.avgConstructionDuration}/${efficiencyKPIs.plannedDuration}m`, label: 'Duration' },
                { icon: 'calculator', value: `${efficiencyKPIs.monthsToBreakeven}m`, label: 'Breakeven' },
              ]}
            />
            {efficiencyInsight && (
              <InlineInsight icon={efficiencyInsight.icon as IconName} message={efficiencyInsight.message} />
            )}

            <ProjectSelector />

            {/* Operational Efficiency KPI Grid — 5 tiles */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Operational Efficiency</Text>
              <FinancialKPIGrid
                accentColor={COO_COLOR}
                tiles={[
                  {
                    label: 'AVG DURATION',
                    value: `${efficiencyKPIs.avgConstructionDuration}m`,
                    budgetLabel: `Planned: ${efficiencyKPIs.plannedDuration}m`,
                    status: efficiencyKPIs.avgConstructionDuration <= efficiencyKPIs.plannedDuration ? 'green' : 'red',
                    heroBg: true,
                  },
                  {
                    label: 'BREAKEVEN',
                    value: `${efficiencyKPIs.monthsToBreakeven}m`,
                    status: efficiencyKPIs.monthsToBreakeven <= 24 ? 'green' : efficiencyKPIs.monthsToBreakeven <= 30 ? 'amber' : 'red',
                  },
                  {
                    label: 'OPEX RATIO',
                    value: `${efficiencyKPIs.opExRatio}%`,
                    status: efficiencyKPIs.opExRatio <= 30 ? 'green' : efficiencyKPIs.opExRatio <= 35 ? 'amber' : 'red',
                  },
                  {
                    label: `MAINT ${sym}/SQFT`,
                    value: `${sym}${efficiencyKPIs.maintenanceCostPerSqft.toFixed(2)}`,
                    status: efficiencyKPIs.maintenanceCostPerSqft <= 4.5 ? 'green' : 'amber',
                  },
                  {
                    label: 'ASSET UTIL',
                    value: `${efficiencyKPIs.assetUtilization}%`,
                    status: efficiencyKPIs.assetUtilization >= 85 ? 'green' : efficiencyKPIs.assetUtilization >= 75 ? 'amber' : 'red',
                  },
                ]}
              />
            </View>

            {/* SPI + Progress Combined */}
            <View style={[
              styles.spiBanner,
              scheduleHealth.spi >= 0.95 && styles.spiBannerGood,
              scheduleHealth.spi >= 0.85 && scheduleHealth.spi < 0.95 && styles.spiBannerWarning,
              scheduleHealth.spi < 0.85 && styles.spiBannerDanger,
            ]}>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.spiLabel}>Schedule Performance</Text>
                    <Text style={styles.spiStatus}>
                      {scheduleHealth.status === 'ahead' ? 'Ahead of Schedule' :
                       scheduleHealth.status === 'on-track' ? 'On Track' : 'Behind Schedule'}
                    </Text>
                  </View>
                  <View style={styles.spiCircle}>
                    <Text style={styles.spiValue}>{scheduleHealth.spi.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${scheduleHealth.progressPercent}%` }]} />
                </View>
                <View style={styles.progressStats}>
                  <Text style={[styles.progressPercent, { color: SemanticColors.textSecondary }]}>{scheduleHealth.progressPercent.toFixed(0)}% Complete</Text>
                  <Text style={styles.progressVariance}>
                    {scheduleHealth.varianceDays >= 0 ? '+' : ''}{scheduleHealth.varianceDays} days
                  </Text>
                </View>
              </View>
            </View>

            {/* Activity Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activiteiten ({scheduleHealth.totalActivities})</Text>
              {/* Stacked bar */}
              <View style={styles.activityBarTrack}>
                <View style={[styles.activityBarSegment, {
                  flex: scheduleHealth.completedCount,
                  backgroundColor: SemanticColors.feedbackSuccess,
                }]} />
                <View style={[styles.activityBarSegment, {
                  flex: scheduleHealth.inProgressCount,
                  backgroundColor: COO_COLOR,
                }]} />
                {scheduleHealth.delayedCount > 0 && (
                  <View style={[styles.activityBarSegment, {
                    flex: scheduleHealth.delayedCount,
                    backgroundColor: SemanticColors.feedbackError,
                  }]} />
                )}
                <View style={[styles.activityBarSegment, {
                  flex: scheduleHealth.totalActivities - scheduleHealth.completedCount - scheduleHealth.inProgressCount - scheduleHealth.delayedCount,
                  backgroundColor: SemanticColors.surfaceSecondary,
                }]} />
              </View>
              {/* Legend rows */}
              <View style={styles.activityLegend}>
                <View style={styles.activityLegendRow}>
                  <View style={[styles.activityLegendDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                  <Text style={styles.activityLegendLabel}>Afgerond</Text>
                  <Text style={styles.activityLegendValue}>{scheduleHealth.completedCount}</Text>
                </View>
                <View style={styles.activityLegendRow}>
                  <View style={[styles.activityLegendDot, { backgroundColor: COO_COLOR }]} />
                  <Text style={styles.activityLegendLabel}>Actief</Text>
                  <Text style={styles.activityLegendValue}>{scheduleHealth.inProgressCount}</Text>
                </View>
                {scheduleHealth.delayedCount > 0 && (
                  <View style={styles.activityLegendRow}>
                    <View style={[styles.activityLegendDot, { backgroundColor: SemanticColors.feedbackError }]} />
                    <Text style={styles.activityLegendLabel}>Vertraagd</Text>
                    <Text style={[styles.activityLegendValue, styles.dangerText]}>{scheduleHealth.delayedCount}</Text>
                  </View>
                )}
                <View style={styles.activityLegendRow}>
                  <View style={[styles.activityLegendDot, { backgroundColor: SemanticColors.feedbackWarning }]} />
                  <Text style={styles.activityLegendLabel}>Kritiek pad</Text>
                  <Text style={styles.activityLegendValue}>{scheduleHealth.criticalCount}</Text>
                </View>
              </View>
            </View>

            {/* Key Dates */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Key Dates</Text>
              <View style={styles.datesGrid}>
                <View style={styles.dateCard}>
                  <Text style={styles.dateCardLabel}>Start Date</Text>
                  <Text style={styles.dateCardValue}>{selectedProject.plannedStartDate}</Text>
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

            {/* Schedule Fragility - P2 */}
            {fragilityScore && !fragilityLoading && (
              <FragilityScoreCard
                fragility={fragilityScore}
                onPress={() => setShowWhatIfModal(true)}
                showFactors={true}
                showAlerts={true}
              />
            )}

            {/* Critical Path View - P2 */}
            {criticalPath && !criticalPathLoading && (
              <CriticalPathView
                criticalPath={criticalPath}
                compact={false}
              />
            )}

            {/* What-If Analysis */}
            {fragilityScore && (
              <Pressable
                style={styles.whatIfButton}
                onPress={() => setShowWhatIfModal(true)}
              >
                <Ionicons name="git-branch" size={18} color={COO_COLOR} />
                <Text style={styles.whatIfButtonText} numberOfLines={1}>Run What-If Analysis</Text>
                <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
              </Pressable>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 3: MARKET                                                    */}
        {/* ================================================================ */}
        {activeTab === 'market' && permitDashboard && selectedProject && (
          <>
            <ContractorDashboardHeader
              kpis={[
                { icon: 'business', value: `${stakeholderKPIs.occupancyRate}%`, label: 'Occupancy', color: COO_COLOR },
                { icon: 'people', value: `${stakeholderKPIs.tenantRetention}%`, label: 'Retention' },
                { icon: 'time', value: `${stakeholderKPIs.avgDaysOnMarket}d`, label: 'Days on Market' },
              ]}
            />
            {marketInsight && (
              <InlineInsight icon={marketInsight.icon as IconName} message={marketInsight.message} />
            )}

            <ProjectSelector />

            {/* Stakeholder KPI Grid — 4 tiles */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Stakeholder & Market</Text>
              <FinancialKPIGrid
                accentColor={COO_COLOR}
                tiles={[
                  {
                    label: 'OCCUPANCY RATE',
                    value: `${stakeholderKPIs.occupancyRate}%`,
                    status: stakeholderKPIs.occupancyRate >= 90 ? 'green' : stakeholderKPIs.occupancyRate >= 80 ? 'amber' : 'red',
                    heroBg: true,
                  },
                  {
                    label: 'TENANT RETENTION',
                    value: `${stakeholderKPIs.tenantRetention}%`,
                    status: stakeholderKPIs.tenantRetention >= 85 ? 'green' : stakeholderKPIs.tenantRetention >= 75 ? 'amber' : 'red',
                  },
                  {
                    label: 'DAYS ON MARKET',
                    value: `${stakeholderKPIs.avgDaysOnMarket}`,
                    status: stakeholderKPIs.avgDaysOnMarket <= 30 ? 'green' : stakeholderKPIs.avgDaysOnMarket <= 45 ? 'amber' : 'red',
                  },
                  {
                    label: 'LEASE-UP VELOCITY',
                    value: `${stakeholderKPIs.leaseUpVelocity}/mo`,
                    status: stakeholderKPIs.leaseUpVelocity >= 4 ? 'green' : stakeholderKPIs.leaseUpVelocity >= 3 ? 'amber' : 'red',
                  },
                ]}
              />
            </View>

            {/* ESG & Sustainability Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>ESG & Sustainability</Text>
                <View style={[styles.esgRatingBadge, {
                  backgroundColor: stakeholderKPIs.esgEnergyRating <= 'B'
                    ? SemanticColors.feedbackSuccessBg
                    : stakeholderKPIs.esgEnergyRating <= 'D'
                      ? SemanticColors.feedbackWarningBg
                      : SemanticColors.feedbackErrorBg,
                }]}>
                  <Text style={[styles.esgRatingText, {
                    color: stakeholderKPIs.esgEnergyRating <= 'B'
                      ? SemanticColors.feedbackSuccess
                      : stakeholderKPIs.esgEnergyRating <= 'D'
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                  }]}>
                    Rating {stakeholderKPIs.esgEnergyRating}
                  </Text>
                </View>
              </View>

              {/* Energy Score Ring */}
              <View style={styles.esgRingRow}>
                <View style={styles.esgRing}>
                  <View style={[styles.esgRingFill, {
                    borderColor: stakeholderKPIs.esgEnergyScore >= 75
                      ? SemanticColors.feedbackSuccess
                      : stakeholderKPIs.esgEnergyScore >= 50
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                  }]}>
                    <Text style={styles.esgRingValue}>{stakeholderKPIs.esgEnergyScore}</Text>
                    <Text style={styles.esgRingLabel}>Energy</Text>
                  </View>
                </View>
                <View style={styles.esgMetrics}>
                  <View style={styles.esgMetricRow}>
                    <Ionicons name="water" size={14} color={SemanticColors.feedbackInfo} />
                    <Text style={styles.esgMetricLabel}>Water/sqft</Text>
                    <Text style={styles.esgMetricValue}>{stakeholderKPIs.esgWaterPerSqft}L</Text>
                  </View>
                  <View style={styles.esgMetricRow}>
                    <Ionicons name="leaf" size={14} color={SemanticColors.feedbackSuccess} />
                    <Text style={styles.esgMetricLabel}>Carbon</Text>
                    <Text style={styles.esgMetricValue}>{stakeholderKPIs.esgCarbonEmissions}t CO2</Text>
                  </View>
                  <View style={styles.esgMetricRow}>
                    <Ionicons name="ribbon" size={14} color={COO_COLOR} />
                    <Text style={styles.esgMetricLabel}>BREEAM</Text>
                    <Text style={styles.esgMetricValue}>{stakeholderKPIs.breeamActual}/100</Text>
                  </View>
                  <View style={styles.esgMetricRow}>
                    <Ionicons name="flag" size={14} color={Palette.hermesOrange} />
                    <Text style={styles.esgMetricLabel}>Target</Text>
                    <Text style={styles.esgMetricValue}>{stakeholderKPIs.breeamTarget}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Permit Pipeline (condensed) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Permit Pipeline</Text>
                <Text style={[styles.cardHeaderStat, { color: COO_COLOR }]}>
                  {permitDashboard.totalPermits} total
                </Text>
              </View>
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

            {/* Conditions Discharge */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Conditions Discharge</Text>
                <Text style={[styles.cardHeaderStat, { color: SemanticColors.feedbackSuccess }]}>
                  {Math.round(permitDashboard.conditionsProgress.percentComplete * 100)}%
                </Text>
              </View>
              <View style={styles.conditionsDischargeRow}>
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
                <View style={styles.conditionsDischargeStats}>
                  <View style={styles.conditionsDischargeStatRow}>
                    <View style={[styles.conditionsDischargeIndicator, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                    <Text style={styles.conditionsDischargeLabel}>Discharged</Text>
                    <Text style={styles.conditionsDischargeValue}>{permitDashboard.conditionsProgress.discharged}</Text>
                  </View>
                  <View style={styles.conditionsDischargeStatRow}>
                    <View style={[styles.conditionsDischargeIndicator, { backgroundColor: SemanticColors.feedbackWarning }]} />
                    <Text style={styles.conditionsDischargeLabel}>Pending</Text>
                    <Text style={styles.conditionsDischargeValue}>{permitDashboard.conditionsProgress.total - permitDashboard.conditionsProgress.discharged}</Text>
                  </View>
                  <View style={styles.conditionsDischargeStatRow}>
                    <View style={[styles.conditionsDischargeIndicator, { backgroundColor: SemanticColors.feedbackError }]} />
                    <Text style={styles.conditionsDischargeLabel}>Overdue</Text>
                    <Text style={[styles.conditionsDischargeValue, false && styles.dangerText]}>
                      {0}
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
                    {clock.extendedDays && (
                      <Text style={styles.timelineExtension}>+{clock.extendedDays}d ext</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Critical Alerts (moved from Overview) */}
            {criticalAlerts.length > 0 && (
              <View style={styles.alertCard}>
                <View style={styles.alertCardHeader}>
                  <Ionicons name="warning" size={20} color={SemanticColors.feedbackError} />
                  <Text style={styles.alertCardTitle}>Critical Alerts ({criticalAlerts.length})</Text>
                </View>
                {criticalAlerts.slice(0, 3).map((alert, index) => (
                  <View key={index} style={styles.alertCardItem}>
                    <Text style={styles.alertCardItemText} numberOfLines={2}>{alert.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ================================================================ */}
        {/* TAB 4: EMERGING                                                  */}
        {/* ================================================================ */}
        {activeTab === 'emerging' && procurementRisk && selectedProject && (
          <>
            <ContractorDashboardHeader
              kpis={[
                { icon: 'hardware-chip', value: formatCompact(emergingKPIs.predictiveMaintenance.reduce((s, i) => s + i.estimatedCostSaving, 0), emergingKPIs.currency), label: 'AI Savings', color: COO_COLOR },
                { icon: 'bulb', value: `${Math.round((emergingKPIs.smartFeatureAdoption + emergingKPIs.amenityUtilization) / 2)}`, label: 'Innovation' },
                { icon: 'warning', value: `${supplierAlerts?.length || 0}`, label: 'Supply Risk', color: (supplierAlerts?.length || 0) > 0 ? SemanticColors.feedbackWarning : undefined },
              ]}
            />
            {emergingInsight && (
              <InlineInsight icon={emergingInsight.icon as IconName} message={emergingInsight.message} />
            )}

            <ProjectSelector />

            {/* Precision Execution Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Precision Execution</Text>
              <View style={styles.precisionRow}>
                <View style={styles.precisionRing}>
                  <View style={[styles.precisionRingFill, {
                    borderColor: emergingKPIs.precisionScore >= 80
                      ? SemanticColors.feedbackSuccess
                      : emergingKPIs.precisionScore >= 60
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                  }]}>
                    <Text style={styles.precisionRingValue}>{emergingKPIs.precisionScore}</Text>
                    <Text style={styles.precisionRingLabel}>Score</Text>
                  </View>
                </View>
                <View style={styles.precisionMetrics}>
                  <View style={styles.precisionMetricItem}>
                    <Text style={styles.precisionMetricLabel}>Plan Adherence</Text>
                    <Text style={styles.precisionMetricValue}>{emergingKPIs.planAdherence}%</Text>
                  </View>
                  <View style={styles.precisionMetricItem}>
                    <Text style={styles.precisionMetricLabel}>Decision Accuracy</Text>
                    <Text style={styles.precisionMetricValue}>{emergingKPIs.decisionAccuracy}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Elastic Portfolios Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Elastic Portfolios</Text>
              {/* Stacked bar */}
              <View style={styles.elasticBarContainer}>
                <View style={styles.elasticBar}>
                  <View style={[styles.elasticSegment, {
                    flex: emergingKPIs.coreSpacePercent,
                    backgroundColor: COO_COLOR,
                  }]} />
                  <View style={[styles.elasticSegment, {
                    flex: emergingKPIs.flexSpacePercent,
                    backgroundColor: Palette.hermesOrange,
                  }]} />
                </View>
                <View style={styles.elasticLegend}>
                  <View style={styles.elasticLegendItem}>
                    <View style={[styles.elasticLegendDot, { backgroundColor: COO_COLOR }]} />
                    <Text style={styles.elasticLegendText}>Core {emergingKPIs.coreSpacePercent}%</Text>
                  </View>
                  <View style={styles.elasticLegendItem}>
                    <View style={[styles.elasticLegendDot, { backgroundColor: Palette.hermesOrange }]} />
                    <Text style={styles.elasticLegendText}>Flex {emergingKPIs.flexSpacePercent}%</Text>
                  </View>
                </View>
              </View>
              <View style={styles.elasticStats}>
                <View style={styles.elasticStatItem}>
                  <Text style={styles.elasticStatLabel}>Flex Utilization</Text>
                  <Text style={styles.elasticStatValue}>{emergingKPIs.flexUtilization}%</Text>
                </View>
                <View style={styles.elasticStatItem}>
                  <Text style={styles.elasticStatLabel}>Flex Rev/sqft</Text>
                  <Text style={styles.elasticStatValue}>{sym}{emergingKPIs.flexRevenuePerSqft}</Text>
                </View>
                <View style={styles.elasticStatItem}>
                  <Text style={styles.elasticStatLabel}>Core Rev/sqft</Text>
                  <Text style={styles.elasticStatValue}>{sym}{emergingKPIs.coreRevenuePerSqft}</Text>
                </View>
              </View>
            </View>

            {/* AI Predictive Maintenance Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>AI Predictive Maintenance</Text>
                <Ionicons name="hardware-chip" size={18} color={COO_COLOR} />
              </View>
              {emergingKPIs.predictiveMaintenance.map((item, idx) => (
                <View key={idx} style={styles.maintenanceItem}>
                  <View style={styles.maintenanceHeader}>
                    <View style={[styles.maintenanceSeverity, {
                      backgroundColor: item.severity === 'high'
                        ? SemanticColors.feedbackErrorBg
                        : item.severity === 'medium'
                          ? SemanticColors.feedbackWarningBg
                          : SemanticColors.surfaceSecondary,
                    }]}>
                      <Ionicons
                        name={item.severity === 'high' ? 'alert-circle' : item.severity === 'medium' ? 'warning' : 'information-circle'}
                        size={14}
                        color={item.severity === 'high'
                          ? SemanticColors.feedbackError
                          : item.severity === 'medium'
                            ? SemanticColors.feedbackWarning
                            : SemanticColors.textSecondary}
                      />
                    </View>
                    <View style={styles.maintenanceInfo}>
                      <Text style={styles.maintenanceName} numberOfLines={1}>{item.equipment}</Text>
                      <Text style={styles.maintenanceMeta} numberOfLines={1}>
                        {item.daysUntilFailure}d until failure · {item.failureProbability}% risk
                      </Text>
                    </View>
                    <Text style={styles.maintenanceSaving}>{formatCompact(item.estimatedCostSaving, emergingKPIs.currency)}</Text>
                  </View>
                  {/* Risk bar */}
                  <View style={styles.maintenanceBarTrack}>
                    <View style={[styles.maintenanceBarFill, {
                      width: `${item.failureProbability}%`,
                      backgroundColor: item.severity === 'high'
                        ? SemanticColors.feedbackError
                        : item.severity === 'medium'
                          ? SemanticColors.feedbackWarning
                          : SemanticColors.feedbackInfo,
                    }]} />
                  </View>
                </View>
              ))}
            </View>

            {/* Tenant Experience */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tenant Experience</Text>
              <View style={styles.experienceGrid}>
                <View style={styles.experienceItem}>
                  <Ionicons name="happy" size={20} color={COO_COLOR} />
                  <Text style={styles.experienceValue}>{emergingKPIs.tenantNps}</Text>
                  <Text style={styles.experienceLabel}>Tenant NPS</Text>
                </View>
                <View style={styles.experienceItem}>
                  <Ionicons name="phone-portrait" size={20} color={Palette.hermesOrange} />
                  <Text style={styles.experienceValue}>{emergingKPIs.smartFeatureAdoption}%</Text>
                  <Text style={styles.experienceLabel}>Smart Adoption</Text>
                </View>
                <View style={styles.experienceItem}>
                  <Ionicons name="cafe" size={20} color={SemanticColors.feedbackSuccess} />
                  <Text style={styles.experienceValue}>{emergingKPIs.amenityUtilization}%</Text>
                  <Text style={styles.experienceLabel}>Amenity Util.</Text>
                </View>
              </View>
            </View>

            {/* Supplier Reliability + Procurement Stats merged */}
            {topSuppliers && topSuppliers.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Supplier Reliability</Text>
                  <Pressable>
                    <Text style={[styles.seeAllText, { color: COO_COLOR }]} numberOfLines={1}>View All</Text>
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
                {/* Procurement stats row (merged from Procurement Summary) */}
                <View style={styles.procurementStatsRow}>
                  <View style={styles.procurementStatMini}>
                    <Text style={styles.procurementStatMiniValue}>{procurementRisk.awarded}/{procurementRisk.total}</Text>
                    <Text style={styles.procurementStatMiniLabel}>Contracts Awarded</Text>
                  </View>
                  <View style={styles.procurementStatMiniDivider} />
                  <View style={styles.procurementStatMini}>
                    <Text style={styles.procurementStatMiniValue}>{procurementRisk.changeOrders.approved}</Text>
                    <Text style={styles.procurementStatMiniLabel}>Change Orders</Text>
                  </View>
                  <View style={styles.procurementStatMiniDivider} />
                  <View style={styles.procurementStatMini}>
                    <Text style={[styles.procurementStatMiniValue, procurementRisk.riskValue > 0 && { color: SemanticColors.feedbackWarning }]}>{fmt(procurementRisk.riskValue)}</Text>
                    <Text style={styles.procurementStatMiniLabel}>Risk Exposure</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Supplier Drift Alerts */}
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

            {/* Innovation Readiness */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Innovation Readiness</Text>
                <Ionicons name="bulb" size={18} color={COO_COLOR} />
              </View>
              <View style={styles.innovationGrid}>
                <View style={styles.innovationItem}>
                  <View style={[styles.innovationRing, {
                    borderColor: emergingKPIs.digitalMaturity >= 70
                      ? SemanticColors.feedbackSuccess
                      : emergingKPIs.digitalMaturity >= 50
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                  }]}>
                    <Text style={styles.innovationRingValue}>{emergingKPIs.digitalMaturity}</Text>
                  </View>
                  <Text style={styles.innovationLabel}>Digital Maturity</Text>
                </View>
                <View style={styles.innovationItem}>
                  <View style={styles.innovationProgress}>
                    {[1, 2, 3].map((step) => (
                      <View key={step} style={[
                        styles.innovationDot,
                        {
                          backgroundColor: step <= Math.ceil(emergingKPIs.smartFeatureAdoption / 33)
                            ? COO_COLOR
                            : SemanticColors.surfaceSecondary,
                        },
                      ]} />
                    ))}
                  </View>
                  <Text style={styles.innovationLabel}>AI Adoption</Text>
                  <Text style={styles.innovationSublabel}>{emergingKPIs.smartFeatureAdoption}%</Text>
                </View>
                <View style={styles.innovationItem}>
                  <View style={[styles.innovationRing, {
                    borderColor: emergingKPIs.sustainabilityScore >= 70
                      ? SemanticColors.feedbackSuccess
                      : emergingKPIs.sustainabilityScore >= 50
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackError,
                  }]}>
                    <Text style={styles.innovationRingValue}>{emergingKPIs.sustainabilityScore}</Text>
                  </View>
                  <Text style={styles.innovationLabel}>Sustainability</Text>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* What-If Analysis Modal */}
      {fragilityScore && (
        <WhatIfAnalysisModal
          visible={showWhatIfModal}
          onClose={() => setShowWhatIfModal(false)}
          projectId={selectedProjectId}
          activities={(selectedProject?.scheduleActivities || []) as any}
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

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.lg,
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

  // Project Dropdown
  dropdownContainer: {
    zIndex: 10,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  dropdownButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dropdownCountryTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    backgroundColor: COO_COLOR,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dropdownSelectedName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  dropdownMenu: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  dropdownItemActive: {
    backgroundColor: COO_COLOR + '10',
  },
  dropdownItemCountry: {
    fontSize: 10,
    fontWeight: '700',
    color: COO_COLOR,
  },
  dropdownItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textSecondary,
  },
  dropdownItemNameActive: {
    color: SemanticColors.textPrimary,
    fontWeight: '600',
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

  // SPI Banner
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

  // Activity Breakdown
  activityBarTrack: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  activityBarSegment: {
    height: '100%',
  },
  activityLegend: {
    gap: 6,
  },
  activityLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityLegendLabel: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  activityLegendValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
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

  // What-If button
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

  // Alert Card
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

  // ESG Card
  esgRatingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  esgRatingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  esgRingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  esgRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  esgRingFill: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  esgRingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  esgRingLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
  },
  esgMetrics: {
    flex: 1,
    gap: 8,
  },
  esgMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  esgMetricLabel: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  esgMetricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Precision Execution
  precisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  precisionRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  precisionRingFill: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
  },
  precisionRingValue: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  precisionRingLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
  },
  precisionMetrics: {
    flex: 1,
    gap: 12,
  },
  precisionMetricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  precisionMetricLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  precisionMetricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },

  // Elastic Portfolios
  elasticBarContainer: {
    gap: 8,
  },
  elasticBar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  elasticSegment: {
    height: '100%',
  },
  elasticLegend: {
    flexDirection: 'row',
    gap: 16,
  },
  elasticLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  elasticLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  elasticLegendText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  elasticStats: {
    flexDirection: 'row',
    gap: 8,
  },
  elasticStatItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  elasticStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  elasticStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 2,
  },

  // Predictive Maintenance
  maintenanceItem: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  maintenanceSeverity: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maintenanceInfo: {
    flex: 1,
  },
  maintenanceName: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  maintenanceMeta: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 1,
  },
  maintenanceSaving: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  maintenanceBarTrack: {
    height: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  maintenanceBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Experience Grid
  experienceGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  experienceItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  experienceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  experienceLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textAlign: 'center',
  },

  // Procurement
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
  coTotalCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: 10,
    padding: Spacing.sm,
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
  riskInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 8,
    padding: 10,
  },
  riskInlineLabel: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  riskInlineValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackWarning,
  },

  // Supplier sections
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
  procurementStatsRow: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  procurementStatMini: {
    flex: 1,
    alignItems: 'center',
  },
  procurementStatMiniValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  procurementStatMiniLabel: {
    fontSize: 9,
    color: SemanticColors.textTertiary,
    marginTop: 2,
    textAlign: 'center',
  },
  procurementStatMiniDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 4,
  },

  // Innovation Readiness
  innovationGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  innovationItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  innovationRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
  },
  innovationRingValue: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  innovationLabel: {
    fontSize: 10,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
  },
  innovationSublabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  innovationProgress: {
    flexDirection: 'row',
    gap: 6,
    height: 48,
    alignItems: 'center',
  },
  innovationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
