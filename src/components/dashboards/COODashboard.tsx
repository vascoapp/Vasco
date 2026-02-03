// =============================================================================
// COO DASHBOARD - Operational Delivery & Execution
// =============================================================================
// Executive operations dashboard for real estate development COOs
// Focus: Schedule, Permits, Procurement, Change Orders
// 4-tab navigation for focused operational views
// =============================================================================

import { useState, useMemo } from 'react';
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

type IconName = keyof typeof Ionicons.glyphMap;
export type COOTabView = 'overview' | 'schedule' | 'permits' | 'procurement';
type TabView = COOTabView;

// Role color
const COO_COLOR = '#3B82F6'; // Blue for operations

// =============================================================================
// HELPERS
// =============================================================================

function formatCompact(value: number, currency: string = 'GBP'): string {
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

      {/* Tab Bar (only show when not using navigation tabs) */}
      {showTabBar && (
        <View style={styles.tabBar}>
          {[
            { key: 'overview', label: 'Overview', icon: 'grid' },
            { key: 'schedule', label: 'Schedule', icon: 'calendar' },
            { key: 'permits', label: 'Permits', icon: 'document-text' },
            { key: 'procurement', label: 'Procure', icon: 'cart' },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as TabView)}
            >
              <Ionicons
                name={tab.icon as IconName}
                size={18}
                color={activeTab === tab.key ? '#fff' : SemanticColors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
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
            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              <QuickAction
                icon="calendar"
                label="Reforecast"
                onPress={() => router.push('/hub/schedule' as any)}
              />
              <QuickAction
                icon="document"
                label="Permits"
                badge={criticalAlerts.length}
                onPress={() => setActiveTab('permits')}
              />
              <QuickAction
                icon="cart"
                label="Contracts"
                onPress={() => setActiveTab('procurement')}
              />
              <QuickAction
                icon="clipboard"
                label="Reports"
                badge={1}
                onPress={() => router.push('/hub/reports' as any)}
              />
            </View>

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
          </>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === 'schedule' && scheduleHealth && selectedProject && (
          <>
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
          </>
        )}

        {/* PERMITS TAB */}
        {activeTab === 'permits' && permitDashboard && selectedProject && (
          <>
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

            {/* Permit Status Summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Permit Status</Text>
              <View style={styles.permitGrid}>
                <View style={[styles.permitCard, styles.permitCardApproved]}>
                  <Text style={styles.permitCardValue}>
                    {permitDashboard.byStatus.approved + permitDashboard.byStatus.approvedWithConditions}
                  </Text>
                  <Text style={styles.permitCardLabel}>Approved</Text>
                </View>
                <View style={[styles.permitCard, styles.permitCardPending]}>
                  <Text style={styles.permitCardValue}>{permitDashboard.byStatus.pending}</Text>
                  <Text style={styles.permitCardLabel}>Pending</Text>
                </View>
                <View style={styles.permitCard}>
                  <Text style={styles.permitCardValue}>{permitDashboard.totalPermits}</Text>
                  <Text style={styles.permitCardLabel}>Total</Text>
                </View>
              </View>
            </View>

            {/* Conditions Progress */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Conditions</Text>
                <Text style={styles.cardHeaderStat}>
                  {permitDashboard.conditionsProgress.discharged}/{permitDashboard.conditionsProgress.total}
                </Text>
              </View>
              <View style={styles.conditionsBar}>
                <View style={[
                  styles.conditionsFill,
                  { width: `${permitDashboard.conditionsProgress.percentComplete * 100}%` }
                ]} />
              </View>
              <View style={styles.conditionsStats}>
                <View style={styles.conditionsStat}>
                  <Text style={styles.conditionsStatValue}>{permitDashboard.conditionsProgress.discharged}</Text>
                  <Text style={styles.conditionsStatLabel}>Discharged</Text>
                </View>
                <View style={styles.conditionsStat}>
                  <Text style={styles.conditionsStatValue}>{permitDashboard.conditionsProgress.pending}</Text>
                  <Text style={styles.conditionsStatLabel}>Pending</Text>
                </View>
                <View style={styles.conditionsStat}>
                  <Text style={[
                    styles.conditionsStatValue,
                    permitDashboard.conditionsProgress.overdue > 0 && styles.dangerText
                  ]}>
                    {permitDashboard.conditionsProgress.overdue}
                  </Text>
                  <Text style={styles.conditionsStatLabel}>Overdue</Text>
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
          </>
        )}

        {/* PROCUREMENT TAB */}
        {activeTab === 'procurement' && procurementRisk && selectedProject && (
          <>
            <ProjectSelector />

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

            {/* Change Orders */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Change Orders</Text>
              <View style={styles.changeOrderGrid}>
                <View style={styles.changeOrderCard}>
                  <Text style={styles.changeOrderValue}>{procurementRisk.changeOrders.submitted}</Text>
                  <Text style={styles.changeOrderLabel}>Submitted</Text>
                </View>
                <View style={[styles.changeOrderCard, styles.changeOrderCardApproved]}>
                  <Text style={styles.changeOrderValue}>{procurementRisk.changeOrders.approved}</Text>
                  <Text style={styles.changeOrderLabel}>Approved</Text>
                </View>
                <View style={styles.changeOrderCard}>
                  <Text style={styles.changeOrderValue}>
                    {procurementRisk.changeOrders.submitted - procurementRisk.changeOrders.approved}
                  </Text>
                  <Text style={styles.changeOrderLabel}>Pending</Text>
                </View>
              </View>

              {/* Total Value */}
              <View style={styles.changeOrderTotal}>
                <Text style={styles.changeOrderTotalLabel}>Total Change Order Value</Text>
                <Text style={styles.changeOrderTotalValue}>{fmt(procurementRisk.changeOrders.value)}</Text>
              </View>
            </View>

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
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
});
