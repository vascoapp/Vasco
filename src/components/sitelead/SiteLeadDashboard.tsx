// SiteLeadDashboard.tsx - Command center for construction site management
// Overview, metrics, alerts, team status, and quick actions

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { ScheduleAlert } from '../../types/sitelead';
import {
  MOCK_DASHBOARD_DATA,
  MOCK_SITE_REPORT,
  MOCK_WORKERS,
} from '../../data/mockSiteLead';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// CONFIGURATION
// ============================================

const WEATHER_ICONS: Record<string, IconName> = {
  sunny: 'sunny',
  cloudy: 'cloudy',
  rain: 'rainy',
  storm: 'thunderstorm',
};

const ALERT_CONFIG: Record<ScheduleAlert['type'], { icon: IconName; color: string }> = {
  weather: { icon: 'cloudy', color: SemanticColors.feedbackWarning },
  delay: { icon: 'time', color: SemanticColors.feedbackError },
  resource: { icon: 'people', color: SemanticColors.feedbackInfo },
  material: { icon: 'cube', color: SemanticColors.feedbackWarning },
  inspection: { icon: 'clipboard', color: SemanticColors.actionPrimary },
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface MetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: IconName;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

function MetricCard({ label, value, suffix, icon, color, trend, trendValue }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.metricContent}>
        <Text style={styles.metricValue}>
          {value}{suffix && <Text style={styles.metricSuffix}>{suffix}</Text>}
        </Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      {trend && (
        <View style={styles.trendBadge}>
          <Ionicons
            name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'}
            size={14}
            color={trend === 'up' ? SemanticColors.feedbackSuccess : trend === 'down' ? SemanticColors.feedbackError : SemanticColors.textTertiary}
          />
          {trendValue && (
            <Text style={[
              styles.trendText,
              { color: trend === 'up' ? SemanticColors.feedbackSuccess : trend === 'down' ? SemanticColors.feedbackError : SemanticColors.textTertiary }
            ]}>
              {trendValue}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

interface AlertCardProps {
  alert: ScheduleAlert;
  onDismiss: () => void;
}

function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const config = ALERT_CONFIG[alert.type];

  return (
    <View style={[
      styles.alertCard,
      { borderLeftColor: config.color }
    ]}>
      <View style={[styles.alertIcon, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon} size={18} color={config.color} />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertMessage}>{alert.message}</Text>
      </View>
      <Pressable onPress={onDismiss} style={styles.alertDismiss}>
        <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
      </Pressable>
    </View>
  );
}

interface QuickActionProps {
  icon: IconName;
  label: string;
  color: string;
  onPress: () => void;
}

function QuickAction({ icon, label, color, onPress }: QuickActionProps) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

interface SiteLeadDashboardProps {
  onNavigate?: (screen: string) => void;
}

export function SiteLeadDashboard({ onNavigate }: SiteLeadDashboardProps) {
  const [dashboardData] = useState(MOCK_DASHBOARD_DATA);
  const [report] = useState(MOCK_SITE_REPORT);
  const [alerts, setAlerts] = useState(dashboardData.alerts);

  const dismissAlert = (alertId: string) => {
    setAlerts(alerts.filter((a) => a.id !== alertId));
  };

  const weather = dashboardData.today.weather;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning</Text>
          <Text style={styles.title}>Site Dashboard</Text>
        </View>
        {weather && (
          <View style={styles.weatherBadge}>
            <Ionicons
              name={WEATHER_ICONS[weather.condition]}
              size={18}
              color={weather.workable ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
            />
            <Text style={styles.weatherTemp}>{weather.temperature}°C</Text>
          </View>
        )}
      </View>

      {/* Today's Overview */}
      <View style={styles.overviewCard}>
        <Text style={styles.overviewTitle}>Today's Overview</Text>
        <View style={styles.overviewGrid}>
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{dashboardData.today.workersOnSite}</Text>
            <Text style={styles.overviewLabel}>On Site</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{dashboardData.today.jobsInProgress}</Text>
            <Text style={styles.overviewLabel}>In Progress</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={styles.overviewValue}>{dashboardData.today.jobsCompleted}</Text>
            <Text style={styles.overviewLabel}>Completed</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewItem}>
            <Text style={[styles.overviewValue, { color: SemanticColors.feedbackSuccess }]}>
              {'\u20AC'}{(dashboardData.today.revenueToday / 1000).toFixed(1)}k
            </Text>
            <Text style={styles.overviewLabel}>Revenue</Text>
          </View>
        </View>
      </View>

      {/* Alerts */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Alerts</Text>
            <View style={styles.alertCount}>
              <Text style={styles.alertCountText}>{alerts.length}</Text>
            </View>
          </View>
          {alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={() => dismissAlert(alert.id)}
            />
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction
            icon="people"
            label="Dispatch"
            color={SemanticColors.actionPrimary}
            onPress={() => onNavigate?.('dispatch')}
          />
          <QuickAction
            icon="calendar"
            label="Schedule"
            color={SemanticColors.feedbackInfo}
            onPress={() => onNavigate?.('schedule')}
          />
          <QuickAction
            icon="bar-chart"
            label="Reports"
            color="#8B5CF6"
            onPress={() => onNavigate?.('reports')}
          />
          <QuickAction
            icon="clipboard"
            label="Inspections"
            color={SemanticColors.feedbackWarning}
            onPress={() => onNavigate?.('inspections')}
          />
        </View>
      </View>

      {/* Key Metrics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            label="Utilization"
            value={dashboardData.metrics.utilizationRate}
            suffix="%"
            icon="speedometer"
            color={SemanticColors.feedbackInfo}
            trend="up"
            trendValue="+3%"
          />
          <MetricCard
            label="On-Time Rate"
            value={dashboardData.metrics.onTimeRate}
            suffix="%"
            icon="checkmark-circle"
            color={SemanticColors.feedbackSuccess}
            trend="stable"
          />
          <MetricCard
            label="Customer Sat."
            value={dashboardData.metrics.customerSatisfaction}
            icon="star"
            color="#F59E0B"
            trend="up"
            trendValue="+0.2"
          />
          <MetricCard
            label="Safety Score"
            value={dashboardData.metrics.safetyScore}
            suffix="%"
            icon="shield-checkmark"
            color={SemanticColors.feedbackSuccess}
          />
        </View>
      </View>

      {/* Team Status */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Team Status</Text>
          <Pressable onPress={() => onNavigate?.('dispatch')}>
            <Text style={styles.seeAllText}>View All</Text>
          </Pressable>
        </View>
        <View style={styles.teamStatusCard}>
          <View style={styles.teamStatusRow}>
            <View style={styles.teamStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
              <Text style={styles.teamStatusLabel}>Available</Text>
              <Text style={styles.teamStatusValue}>{dashboardData.teamStatus.available}</Text>
            </View>
            <View style={styles.teamStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: SemanticColors.feedbackInfo }]} />
              <Text style={styles.teamStatusLabel}>Working</Text>
              <Text style={styles.teamStatusValue}>{dashboardData.teamStatus.working}</Text>
            </View>
            <View style={styles.teamStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: SemanticColors.feedbackWarning }]} />
              <Text style={styles.teamStatusLabel}>Traveling</Text>
              <Text style={styles.teamStatusValue}>{dashboardData.teamStatus.traveling}</Text>
            </View>
          </View>
          <View style={styles.teamStatusRow}>
            <View style={styles.teamStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: SemanticColors.textTertiary }]} />
              <Text style={styles.teamStatusLabel}>On Break</Text>
              <Text style={styles.teamStatusValue}>{dashboardData.teamStatus.onBreak}</Text>
            </View>
            <View style={styles.teamStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: SemanticColors.textTertiary }]} />
              <Text style={styles.teamStatusLabel}>Off Duty</Text>
              <Text style={styles.teamStatusValue}>{dashboardData.teamStatus.offDuty}</Text>
            </View>
            <View style={styles.teamStatusItem}>
              <View style={[styles.statusDot, { backgroundColor: SemanticColors.actionPrimary }]} />
              <Text style={styles.teamStatusLabel}>Total</Text>
              <Text style={styles.teamStatusValue}>{MOCK_WORKERS.length}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Week Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.weekCard}>
          <View style={styles.weekHeader}>
            <Text style={styles.weekProgress}>
              {dashboardData.weekProgress.jobsCompleted}/{dashboardData.weekProgress.jobsPlanned} Jobs
            </Text>
            <View style={[
              styles.onTrackBadge,
              { backgroundColor: dashboardData.weekProgress.onSchedule ? SemanticColors.feedbackSuccessBg : SemanticColors.feedbackWarningBg }
            ]}>
              <Ionicons
                name={dashboardData.weekProgress.onSchedule ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={dashboardData.weekProgress.onSchedule ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning}
              />
              <Text style={[
                styles.onTrackText,
                { color: dashboardData.weekProgress.onSchedule ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning }
              ]}>
                {dashboardData.weekProgress.onSchedule ? 'On Schedule' : 'Behind'}
              </Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${dashboardData.weekProgress.percentComplete}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {dashboardData.weekProgress.percentComplete}% Complete
          </Text>
        </View>
      </View>

      {/* Top Performers */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Performers This Week</Text>
        {report.workforce.topPerformers.map((performer, index) => (
          <View key={performer.workerId} style={styles.performerCard}>
            <View style={styles.performerRank}>
              <Text style={styles.performerRankText}>#{index + 1}</Text>
            </View>
            <View style={styles.performerInfo}>
              <Text style={styles.performerName}>{performer.workerName}</Text>
              <Text style={styles.performerStats}>
                {performer.jobsCompleted} jobs · {'\u20AC'}{performer.revenue.toLocaleString()}
              </Text>
            </View>
            <View style={styles.performerRating}>
              <Ionicons name="star" size={14} color="#F59E0B" />
              <Text style={styles.performerRatingText}>{performer.rating}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Upcoming Milestones */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming Milestones</Text>
        {dashboardData.upcomingMilestones.slice(0, 3).map((milestone) => (
          <View key={milestone.id} style={styles.milestoneCard}>
            <View style={[
              styles.milestoneIndicator,
              { backgroundColor: milestone.isCriticalPath ? SemanticColors.feedbackError : SemanticColors.feedbackInfo }
            ]} />
            <View style={styles.milestoneContent}>
              <Text style={styles.milestoneName}>{milestone.name}</Text>
              <Text style={styles.milestoneDate}>
                Due: {new Date(milestone.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
            {milestone.isCriticalPath && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalText}>Critical</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceBackground,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: 60,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  weatherTemp: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Overview Card
  overviewCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    marginBottom: Spacing.md,
  },
  overviewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewItem: {
    flex: 1,
    alignItems: 'center',
  },
  overviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  overviewLabel: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 4,
  },
  overviewDivider: {
    width: 1,
    backgroundColor: SemanticColors.borderDefault,
    marginHorizontal: Spacing.sm,
  },

  // Section
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: Spacing.sm,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },

  // Alert
  alertCount: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  alertCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  alertMessage: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  alertDismiss: {
    padding: 4,
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickAction: {
    width: '48%',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Metrics
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metricCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  metricSuffix: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  metricLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Team Status
  teamStatusCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  teamStatusRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  teamStatusItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  teamStatusLabel: {
    flex: 1,
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  teamStatusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Week Progress
  weekCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  weekProgress: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  onTrackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onTrackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: SemanticColors.actionPrimary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },

  // Performers
  performerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  performerRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SemanticColors.actionPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  performerRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: SemanticColors.actionPrimary,
  },
  performerInfo: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  performerName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  performerStats: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  performerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  performerRatingText: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Milestones
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  milestoneIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  milestoneContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  milestoneName: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  milestoneDate: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  criticalBadge: {
    backgroundColor: SemanticColors.feedbackErrorBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  criticalText: {
    fontSize: 10,
    fontWeight: '600',
    color: SemanticColors.feedbackError,
  },
});

export default SiteLeadDashboard;
