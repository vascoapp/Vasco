// =============================================================================
// ROUTE OPTIMIZER COMPONENT
// =============================================================================
// Intelligent route optimization and daily job scheduling
// =============================================================================

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { formatCurrency } from '../../i18n/formatting';
import {
  useTodaysRoutes,
  useRouteStats,
  OptimizedRoute,
  RouteJob,
} from '../../services/routeOptimizerService';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
// =============================================================================
// TYPES
// =============================================================================

type TabType = 'today' | 'map' | 'stats';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const PriorityBadge: React.FC<{ priority: RouteJob['priority'] }> = ({ priority }) => {
  const getConfig = () => {
    switch (priority) {
      case 'urgent':
        return { label: 'Spoed', color: Palette.red500, bg: "rgba(239, 68, 68, 0.15)" };
      case 'high':
        return { label: 'Hoog', color: Palette.orange500, bg: Palette.orange100 };
      case 'normal':
        return { label: 'Normaal', color: Palette.blue500, bg: "rgba(59, 130, 246, 0.15)" };
      case 'low':
        return { label: 'Laag', color: Palette.gray500, bg: Palette.gray100 };
      default:
        return { label: priority, color: Palette.gray500, bg: Palette.gray100 };
    }
  };

  const config = getConfig();
  return (
    <View style={[styles.priorityBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.priorityText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const StatusIndicator: React.FC<{ status: RouteJob['status'] }> = ({ status }) => {
  const getConfig = () => {
    switch (status) {
      case 'completed':
        return { color: Palette.green500, icon: 'checkmark-circle' };
      case 'arrived':
        return { color: Palette.blue500, icon: 'location' };
      case 'en_route':
        return { color: Palette.orange500, icon: 'car' };
      case 'pending':
        return { color: Palette.gray400, icon: 'ellipse-outline' };
      default:
        return { color: Palette.gray400, icon: 'ellipse-outline' };
    }
  };

  const config = getConfig();
  return (
    <View style={[styles.statusIndicator, { backgroundColor: config.color }]}>
      <Ionicons name={config.icon as keyof typeof Ionicons.glyphMap} size={16} color={Palette.white} />
    </View>
  );
};

const JobCard: React.FC<{
  job: RouteJob;
  index: number;
  isLast: boolean;
  onUpdateStatus: (status: RouteJob['status']) => void;
}> = ({ job, index, isLast, onUpdateStatus }) => {
  const [expanded, setExpanded] = useState(false);

  const getNextStatus = (): RouteJob['status'] | null => {
    switch (job.status) {
      case 'pending':
        return 'en_route';
      case 'en_route':
        return 'arrived';
      case 'arrived':
        return 'completed';
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus();

  return (
    <View style={styles.jobWrapper}>
      <View style={styles.timeline}>
        <StatusIndicator status={job.status} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>

      <Pressable
        style={[
          styles.jobCard,
          job.status === 'completed' && styles.jobCardCompleted,
        ]}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobTime}>
            <Text style={styles.jobTimeText}>{job.scheduledTime}</Text>
            <Text style={styles.jobDuration}>{job.duration} min</Text>
          </View>
          <View style={styles.jobInfo}>
            <Text style={styles.jobCustomer}>{job.customerName}</Text>
            <Text style={styles.jobAddress} numberOfLines={1}>
              {job.address}, {job.city}
            </Text>
          </View>
          <PriorityBadge priority={job.priority} />
        </View>

        <View style={styles.jobMeta}>
          <View style={styles.jobTypeContainer}>
            <Ionicons name="construct-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.jobTypeText}>{job.jobType.replace('_', ' ')}</Text>
          </View>
        </View>

        {expanded && (
          <View style={styles.expandedContent}>
            {job.notes && (
              <View style={styles.notesSection}>
                <Ionicons name="document-text-outline" size={16} color={SemanticColors.textSecondary} />
                <Text style={styles.notesText}>{job.notes}</Text>
              </View>
            )}

            <View style={styles.jobActions}>
              <Pressable style={styles.navigateButton}>
                <Ionicons name="navigate-outline" size={18} color={SemanticColors.actionPrimary} />
                <Text style={styles.navigateButtonText}>Navigeren</Text>
              </Pressable>

              {nextStatus && (
                <Pressable
                  style={styles.statusButton}
                  onPress={() => onUpdateStatus(nextStatus)}
                >
                  <Ionicons
                    name={
                      nextStatus === 'en_route'
                        ? 'car'
                        : nextStatus === 'arrived'
                        ? 'location'
                        : 'checkmark-circle'
                    }
                    size={18}
                    color={Palette.white}
                  />
                  <Text style={styles.statusButtonText}>
                    {nextStatus === 'en_route'
                      ? 'Start Rit'
                      : nextStatus === 'arrived'
                      ? 'Aangekomen'
                      : 'Afgerond'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
};

const RouteCard: React.FC<{
  route: OptimizedRoute;
  onUpdateJobStatus: (jobId: string, status: RouteJob['status']) => void;
}> = ({ route, onUpdateJobStatus }) => {
  const completedJobs = route.jobs.filter(j => j.status === 'completed').length;
  const progress = (completedJobs / route.jobs.length) * 100;

  return (
    <View style={styles.routeCard}>
      <View style={styles.routeHeader}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeAssignee}>{route.assignedToName}</Text>
          <Text style={styles.routeTimeRange}>
            {route.startTime} - {route.endTime}
          </Text>
        </View>
        <View style={styles.routeProgress}>
          <Text style={styles.routeProgressText}>
            {completedJobs}/{route.jobs.length}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.savingsRow}>
        <View style={styles.savingItem}>
          <Ionicons name="car-outline" size={16} color={Palette.green500} />
          <Text style={styles.savingText}>
            {route.savings.distanceSaved.toFixed(1)} km bespaard
          </Text>
        </View>
        <View style={styles.savingItem}>
          <Ionicons name="time-outline" size={16} color={Palette.green500} />
          <Text style={styles.savingText}>
            {route.savings.timeSaved} min bespaard
          </Text>
        </View>
        <View style={styles.savingItem}>
          <Ionicons name="cash-outline" size={16} color={Palette.green500} />
          <Text style={styles.savingText}>
            {formatCurrency(route.savings.fuelSaved)} bespaard
          </Text>
        </View>
      </View>

      <View style={styles.jobsList}>
        {route.jobs.map((job, index) => (
          <JobCard
            key={job.id}
            job={job}
            index={index}
            isLast={index === route.jobs.length - 1}
            onUpdateStatus={(status) => onUpdateJobStatus(job.id, status)}
          />
        ))}
      </View>
    </View>
  );
};

const StatCard: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}> = ({ icon, label, value, subtext, color = SemanticColors.actionPrimary }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
  </View>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const RouteOptimizer: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const { routes, loading, updateJobStatus } = useTodaysRoutes();
  const stats = useRouteStats();

  const handleUpdateJobStatus = (routeId: string, jobId: string, status: RouteJob['status']) => {
    updateJobStatus(routeId, jobId, status);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'today':
        return (
          <View style={styles.tabContent}>
            <View style={styles.todaySummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.routesToday}</Text>
                <Text style={styles.summaryLabel}>Routes</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.totalJobsToday}</Text>
                <Text style={styles.summaryLabel}>Klussen</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.completionRate}%</Text>
                <Text style={styles.summaryLabel}>Afgerond</Text>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Routes laden...</Text>
              </View>
            ) : routes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={48} color={SemanticColors.textSecondary} />
                <Text style={styles.emptyText}>Geen routes voor vandaag</Text>
                <Pressable style={styles.createRouteButton}>
                  <Ionicons name="add" size={18} color={Palette.white} />
                  <Text style={styles.createRouteButtonText}>Route Maken</Text>
                </Pressable>
              </View>
            ) : (
              routes.map(route => (
                <RouteCard
                  key={route.id}
                  route={route}
                  onUpdateJobStatus={(jobId, status) =>
                    handleUpdateJobStatus(route.id, jobId, status)
                  }
                />
              ))
            )}
          </View>
        );

      case 'map':
        return (
          <View style={styles.tabContent}>
            <View style={styles.mapPlaceholder}>
              <Ionicons name="map" size={64} color={SemanticColors.textSecondary} />
              <Text style={styles.mapPlaceholderText}>Kaartweergave</Text>
              <Text style={styles.mapPlaceholderSubtext}>
                Interactieve kaart met geoptimaliseerde routes
              </Text>
            </View>

            <View style={styles.mapLegend}>
              <Text style={styles.legendTitle}>Legenda</Text>
              <View style={styles.legendItems}>
                {[
                  { color: Palette.gray400, label: 'Gepland' },
                  { color: Palette.orange500, label: 'Onderweg' },
                  { color: Palette.blue500, label: 'Aangekomen' },
                  { color: Palette.green500, label: 'Afgerond' },
                ].map((item, index) => (
                  <View key={index} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        );

      case 'stats':
        return (
          <View style={styles.tabContent}>
            <View style={styles.statsGrid}>
              <StatCard
                icon="analytics-outline"
                label="Gem. Afstand"
                value={`${stats.avgDistancePerRoute} km`}
                subtext="per route"
              />
              <StatCard
                icon="time-outline"
                label="Tijd Bespaard"
                value={`${stats.avgTimeSavedPerRoute} min`}
                subtext="gemiddeld"
                color={Palette.green500}
              />
              <StatCard
                icon="cash-outline"
                label="Brandstof Bespaard"
                value={formatCurrency(stats.totalSavingsThisMonth)}
                subtext="deze maand"
                color={Palette.green500}
              />
              <StatCard
                icon="checkmark-done-outline"
                label="Afronding"
                value={`${stats.completionRate}%`}
                subtext="van klussen"
                color={Palette.blue500}
              />
            </View>

            <View style={styles.optimizationSection}>
              <Text style={styles.sectionTitle}>Route Optimalisatie</Text>
              <View style={styles.optimizationCard}>
                <View style={styles.optimizationRow}>
                  <View style={styles.optimizationItem}>
                    <Text style={styles.optimizationLabel}>Originele afstand</Text>
                    <Text style={styles.optimizationValue}>30.8 km</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color={SemanticColors.textSecondary} />
                  <View style={styles.optimizationItem}>
                    <Text style={styles.optimizationLabel}>Geoptimaliseerd</Text>
                    <Text style={[styles.optimizationValue, { color: Palette.green500 }]}>
                      18.5 km
                    </Text>
                  </View>
                </View>
                <View style={styles.savingsHighlight}>
                  <Ionicons name="leaf" size={20} color={Palette.green500} />
                  <Text style={styles.savingsHighlightText}>
                    40% kortere route = minder brandstof & CO2
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.tipsSection}>
              <Text style={styles.sectionTitle}>Optimalisatie Tips</Text>
              {[
                { icon: 'time-outline', tip: 'Plan storingen in de ochtend voor kortere wachttijden' },
                { icon: 'map-outline', tip: 'Groepeer klussen in dezelfde wijk' },
                { icon: 'calendar-outline', tip: 'Vermijd spitsuren (7-9u en 17-19u)' },
              ].map((item, index) => (
                <View key={index} style={styles.tipItem}>
                  <View style={styles.tipIconContainer}>
                    <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={SemanticColors.actionPrimary} />
                  </View>
                  <Text style={styles.tipText}>{item.tip}</Text>
                </View>
              ))}
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Route Planner</Text>
        <Pressable style={styles.optimizeButton}>
          <Ionicons name="flash" size={18} color={Palette.white} />
          <Text style={styles.optimizeButtonText}>Optimaliseer</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {[
          { key: 'today', label: t('common.today', 'Today'), icon: 'today-outline' },
          { key: 'map', label: t('routes.map', 'Map'), icon: 'map-outline' },
          { key: 'stats', label: t('routes.statistics', 'Statistics'), icon: 'stats-chart-outline' },
        ].map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <Ionicons
              name={tab.icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={activeTab === tab.key ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderContent()}
      </ScrollView>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  title: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  optimizeButtonText: {
    color: Palette.white,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize - 1,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: SemanticColors.surfaceBackground,
    gap: 6,
  },
  tabActive: {
    backgroundColor: SemanticColors.actionPrimary + '15',
  },
  tabText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.textSecondary,
  },
  tabTextActive: {
    color: SemanticColors.actionPrimary,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  todaySummary: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  summaryLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.titleSize,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: TYPE.titleSize,
    color: SemanticColors.textSecondary,
    marginBottom: 16,
  },
  createRouteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  createRouteButtonText: {
    color: Palette.white,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize - 1,
  },
  routeCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeAssignee: {
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  routeTimeRange: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  routeProgress: {
    alignItems: 'flex-end',
  },
  routeProgressText: {
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  progressBar: {
    width: 60,
    height: 6,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Palette.green500,
    borderRadius: 3,
  },
  savingsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: 16,
  },
  savingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingText: {
    fontSize: TYPE.labelSize,
    color: Palette.green600,
    fontFamily: TYPE.labelFamily,
  },
  jobsList: {
    gap: 0,
  },
  jobWrapper: {
    flexDirection: 'row',
  },
  timeline: {
    width: 32,
    alignItems: 'center',
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: SemanticColors.borderDefault,
    marginVertical: 4,
  },
  jobCard: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
    borderRadius: 10,
    padding: 12,
    marginLeft: 8,
    marginBottom: 8,
  },
  jobCardCompleted: {
    opacity: 0.6,
  },
  jobHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  jobTime: {
    marginRight: 12,
    alignItems: 'center',
  },
  jobTimeText: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  jobDuration: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  jobInfo: {
    flex: 1,
  },
  jobCustomer: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
  },
  jobAddress: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  jobMeta: {
    flexDirection: 'row',
  },
  jobTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobTypeText: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    textTransform: 'capitalize',
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  notesSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  notesText: {
    flex: 1,
    fontSize: TYPE.captionSize,
    color: SemanticColors.textPrimary,
  },
  jobActions: {
    flexDirection: 'row',
    gap: 10,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary + '15',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  navigateButtonText: {
    color: SemanticColors.actionPrimary,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize - 1,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  statusButtonText: {
    color: Palette.white,
    fontFamily: TYPE.titleFamily,
    fontSize: TYPE.bodySize - 1,
  },
  mapPlaceholder: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    marginBottom: 16,
  },
  mapPlaceholderText: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  mapLegend: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  legendTitle: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: TYPE.captionSize,
    color: SemanticColors.textSecondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  statLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  statSubtext: {
    fontSize: TYPE.tinySize,
    color: SemanticColors.textSecondary,
  },
  optimizationSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.titleFamily,
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  optimizationCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  optimizationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  optimizationItem: {
    alignItems: 'center',
  },
  optimizationLabel: {
    fontSize: TYPE.labelSize,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  optimizationValue: {
    fontSize: TYPE.sectionSize,
    fontFamily: TYPE.sectionFamily,
    color: SemanticColors.textPrimary,
  },
  savingsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  savingsHighlightText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: "#15803d",
    fontFamily: TYPE.labelFamily,
  },
  tipsSection: {
    marginBottom: 24,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  tipIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.actionPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipText: {
    flex: 1,
    fontSize: TYPE.bodySize - 1,
    color: SemanticColors.textPrimary,
  },
});

export default RouteOptimizer;
