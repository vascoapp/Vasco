import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import {
  mockProjects,
  mockDeliveryMetrics,
  getProjectById,
} from '../../data/mockProjects';
import { calculateScheduleVariance } from '../../modules/countryModules';

const COO_COLOR = '#7C3AED'; // Purple for COO (per theme)

export function ScheduleDashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('uk-001');

  const selectedProject = useMemo(() => getProjectById(selectedProjectId), [selectedProjectId]);
  const deliveryMetrics = useMemo(() => mockDeliveryMetrics[selectedProjectId], [selectedProjectId]);

  const scheduleHealth = useMemo(() => {
    if (!selectedProject || !deliveryMetrics) return null;

    const plannedEnd = selectedProject.plannedEndDate;
    const forecastEnd = selectedProject.forecastEndDate || plannedEnd;
    const variance = calculateScheduleVariance(plannedEnd, forecastEnd);

    const criticalActivities = selectedProject.scheduleActivities.filter((a) => a.isCriticalPath);
    const delayedActivities = selectedProject.scheduleActivities.filter(
      (a) => a.status === 'delayed' || a.status === 'in-progress'
    );

    return {
      spi: deliveryMetrics.spiSchedulePerformanceIndex,
      varianceDays: variance.varianceDays,
      status: variance.status,
      criticalPathFloat: deliveryMetrics.criticalPathFloat,
      criticalActivities,
      delayedCount: delayedActivities.filter((a) => a.status === 'delayed').length,
    };
  }, [selectedProject, deliveryMetrics]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ahead':
        return SemanticColors.feedbackSuccess;
      case 'on-track':
        return COO_COLOR;
      case 'delayed':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.textSecondary;
    }
  };

  if (!selectedProject || !deliveryMetrics || !scheduleHealth) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Project Selector */}
      <View style={styles.projectSelector}>
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
            <Text
              style={[
                styles.projectName,
                selectedProjectId === project.id && styles.projectNameActive,
              ]}
              numberOfLines={1}
            >
              {project.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Schedule Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.spiCircle}>
          <Text style={[styles.spiValue, { color: scheduleHealth.spi >= 0.95 ? SemanticColors.feedbackSuccess : SemanticColors.feedbackWarning }]}>
            {scheduleHealth.spi.toFixed(2)}
          </Text>
          <Text style={styles.spiLabel}>SPI</Text>
        </View>
        <View style={styles.scheduleInfo}>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(scheduleHealth.status) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(scheduleHealth.status) }]}>
                {scheduleHealth.status.replace('-', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>Variance</Text>
            <Text style={[styles.scheduleValue, { color: getStatusColor(scheduleHealth.status) }]}>
              {scheduleHealth.varianceDays > 0 ? '+' : ''}{scheduleHealth.varianceDays} days
            </Text>
          </View>
          <View style={styles.scheduleRow}>
            <Text style={styles.scheduleLabel}>Float</Text>
            <Text style={styles.scheduleValue}>{scheduleHealth.criticalPathFloat} days</Text>
          </View>
        </View>
      </View>

      {/* Dates Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project Dates</Text>
        <View style={styles.datesCard}>
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <Text style={styles.dateValue}>{selectedProject.plannedStartDate}</Text>
            </View>
            <View style={styles.dateDivider} />
            <View style={styles.dateItem}>
              <Text style={styles.dateLabel}>Planned End</Text>
              <Text style={styles.dateValue}>{selectedProject.plannedEndDate}</Text>
            </View>
          </View>
          <View style={styles.forecastRow}>
            <Text style={styles.forecastLabel}>Forecast End</Text>
            <Text style={[styles.forecastValue, { color: getStatusColor(scheduleHealth.status) }]}>
              {selectedProject.forecastEndDate || 'TBD'}
            </Text>
          </View>
        </View>
      </View>

      {/* Critical Path */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Critical Path</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{scheduleHealth.criticalActivities.length}</Text>
          </View>
        </View>
        <View style={styles.activityList}>
          {scheduleHealth.criticalActivities.slice(0, 8).map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <View style={styles.activityInfo}>
                <Text style={styles.activityName}>{activity.name}</Text>
                <Text style={styles.activityWbs}>{activity.wbsCode}</Text>
              </View>
              <View style={styles.activityProgress}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${activity.percentComplete}%` },
                      activity.status === 'delayed' && { backgroundColor: SemanticColors.feedbackError },
                    ]}
                  />
                </View>
                <Text style={[
                  styles.progressText,
                  activity.status === 'delayed' && { color: SemanticColors.feedbackError }
                ]}>
                  {activity.percentComplete}%
                </Text>
              </View>
              {activity.status === 'delayed' && (
                <View style={styles.delayBadge}>
                  <Text style={styles.delayText}>DELAYED</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* All Activities Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{selectedProject.scheduleActivities.length}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackSuccess }]}>
              {selectedProject.scheduleActivities.filter(a => a.status === 'completed').length}
            </Text>
            <Text style={styles.summaryLabel}>Completed</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: COO_COLOR }]}>
              {selectedProject.scheduleActivities.filter(a => a.status === 'in-progress').length}
            </Text>
            <Text style={styles.summaryLabel}>In Progress</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: SemanticColors.feedbackError }]}>
              {scheduleHealth.delayedCount}
            </Text>
            <Text style={styles.summaryLabel}>Delayed</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.sm,
    gap: Spacing.sm,
    paddingBottom: 100,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: SemanticColors.textSecondary,
    fontSize: 16,
  },
  projectSelector: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  projectPill: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.xs,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  projectPillActive: {
    borderColor: COO_COLOR,
  },
  projectCountry: {
    color: COO_COLOR,
    fontSize: 10,
    fontWeight: '700',
  },
  projectName: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  projectNameActive: {
    color: SemanticColors.textPrimary,
  },
  headerCard: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  spiCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SemanticColors.surfacePrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COO_COLOR,
  },
  spiValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  spiLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  scheduleInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  scheduleValue: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: COO_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  datesCard: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  dateValue: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  dateDivider: {
    width: 1,
    height: 30,
    backgroundColor: SemanticColors.borderDefault,
  },
  forecastRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  forecastLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
  },
  forecastValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  activityList: {
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    color: SemanticColors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
  activityWbs: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
  },
  activityProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    width: 60,
    height: 6,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COO_COLOR,
    borderRadius: 3,
  },
  progressText: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    width: 35,
    textAlign: 'right',
  },
  delayBadge: {
    backgroundColor: SemanticColors.feedbackError + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginLeft: 8,
  },
  delayText: {
    color: SemanticColors.feedbackError,
    fontSize: 9,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  summaryValue: {
    color: SemanticColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  summaryLabel: {
    color: SemanticColors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
});
