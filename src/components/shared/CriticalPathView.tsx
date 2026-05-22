// =============================================================================
// CRITICAL PATH VIEW
// =============================================================================
// Visual representation of the project critical path
// Used in COODashboard schedule tab for critical path analysis
// =============================================================================

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import type { CriticalPath, CriticalPathActivity } from '../../types/schedule-fragility';

interface CriticalPathViewProps {
  criticalPath: CriticalPath;
  compact?: boolean;
  highlightActivityId?: string;
}

export function CriticalPathView({
  criticalPath,
  compact = false,
  highlightActivityId,
}: CriticalPathViewProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getProgressColor = (percent: number) => {
    if (percent === 100) return SemanticColors.feedbackSuccess;
    if (percent >= 50) return SemanticColors.feedbackInfo;
    if (percent > 0) return SemanticColors.feedbackWarning;
    return SemanticColors.textTertiary;
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <Ionicons name="git-network" size={16} color={SemanticColors.feedbackError} />
          <Text style={styles.compactTitle}>Critical Path</Text>
          <Text style={styles.compactDuration}>{criticalPath.totalDuration} days</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.compactPath}>
            {criticalPath.activities.map((activity, index) => (
              <View key={activity.activityId} style={styles.compactActivityWrapper}>
                <View
                  style={[
                    styles.compactActivity,
                    activity.activityId === highlightActivityId && styles.compactActivityHighlighted,
                  ]}
                >
                  <Text style={styles.compactActivityName} numberOfLines={1}>
                    {activity.activityName}
                  </Text>
                  <View style={styles.compactProgressBar}>
                    <View
                      style={[
                        styles.compactProgressFill,
                        {
                          width: `${activity.percentComplete}%`,
                          backgroundColor: getProgressColor(activity.percentComplete),
                        },
                      ]}
                    />
                  </View>
                </View>
                {index < criticalPath.activities.length - 1 && (
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={SemanticColors.textTertiary}
                    style={styles.compactArrow}
                  />
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="git-network" size={20} color={SemanticColors.feedbackError} />
          <Text style={styles.title}>Critical Path</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{criticalPath.totalDuration}</Text>
            <Text style={styles.statLabel}>Days</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{criticalPath.activities.length}</Text>
            <Text style={styles.statLabel}>Activities</Text>
          </View>
        </View>
      </View>

      {/* Date Range */}
      <View style={styles.dateRange}>
        <View style={styles.dateItem}>
          <Ionicons name="calendar" size={14} color={SemanticColors.textTertiary} />
          <Text style={styles.dateLabel}>Start:</Text>
          <Text style={styles.dateValue}>{formatDate(criticalPath.startDate)}</Text>
        </View>
        <Ionicons name="arrow-forward" size={14} color={SemanticColors.textTertiary} />
        <View style={styles.dateItem}>
          <Ionicons name="flag" size={14} color={SemanticColors.feedbackSuccess} />
          <Text style={styles.dateLabel}>End:</Text>
          <Text style={styles.dateValue}>{formatDate(criticalPath.endDate)}</Text>
        </View>
      </View>

      {/* Path Visualization */}
      <View style={styles.pathContainer}>
        {criticalPath.activities.map((activity, index) => (
          <View key={activity.activityId}>
            <ActivityNode
              activity={activity}
              isHighlighted={activity.activityId === highlightActivityId}
              isFirst={index === 0}
              isLast={index === criticalPath.activities.length - 1}
            />
            {index < criticalPath.activities.length - 1 && (
              <View style={styles.connector}>
                <View style={styles.connectorLine} />
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={SemanticColors.feedbackError}
                />
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Bottlenecks */}
      {criticalPath.bottlenecks.length > 0 && (
        <View style={styles.bottlenecksSection}>
          <Text style={styles.sectionTitle}>Bottlenecks</Text>
          {criticalPath.bottlenecks.map((bottleneck, index) => (
            <View key={index} style={styles.bottleneckItem}>
              <View
                style={[
                  styles.bottleneckSeverity,
                  {
                    backgroundColor:
                      bottleneck.severity === 'high'
                        ? SemanticColors.feedbackError
                        : SemanticColors.feedbackWarning,
                  },
                ]}
              />
              <View style={styles.bottleneckContent}>
                <Text style={styles.bottleneckName}>{bottleneck.activityName}</Text>
                <Text style={styles.bottleneckReason}>{bottleneck.reason}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Near Critical Activities */}
      {criticalPath.nearCriticalActivities.length > 0 && (
        <View style={styles.nearCriticalSection}>
          <View style={styles.nearCriticalHeader}>
            <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
            <Text style={styles.nearCriticalTitle}>
              {criticalPath.nearCriticalActivities.length} near-critical activities
            </Text>
          </View>
          <Text style={styles.nearCriticalSubtext}>
            Activities with less than 5 days float
          </Text>
        </View>
      )}
    </View>
  );
}

// Activity Node Component
interface ActivityNodeProps {
  activity: CriticalPathActivity;
  isHighlighted?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

function ActivityNode({ activity, isHighlighted, isFirst, isLast }: ActivityNodeProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const getProgressColor = (percent: number) => {
    if (percent === 100) return SemanticColors.feedbackSuccess;
    if (percent >= 50) return SemanticColors.feedbackInfo;
    if (percent > 0) return SemanticColors.feedbackWarning;
    return SemanticColors.textTertiary;
  };

  return (
    <View
      style={[
        styles.activityNode,
        isHighlighted && styles.activityNodeHighlighted,
        isFirst && styles.activityNodeFirst,
        isLast && styles.activityNodeLast,
      ]}
    >
      {/* Position Badge */}
      <View style={styles.positionBadge}>
        <Text style={styles.positionText}>{activity.position}</Text>
      </View>

      {/* Activity Details */}
      <View style={styles.activityDetails}>
        <Text style={styles.activityName}>{activity.activityName}</Text>

        <View style={styles.activityMeta}>
          <View style={styles.activityMetaItem}>
            <Ionicons name="time" size={12} color={SemanticColors.textTertiary} />
            <Text style={styles.activityMetaText}>{activity.duration} days</Text>
          </View>
          <View style={styles.activityMetaItem}>
            <Ionicons name="calendar-outline" size={12} color={SemanticColors.textTertiary} />
            <Text style={styles.activityMetaText}>
              {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${activity.percentComplete}%`,
                  backgroundColor: getProgressColor(activity.percentComplete),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>{activity.percentComplete}%</Text>
        </View>
      </View>

      {/* Float Badge */}
      <View
        style={[
          styles.floatBadge,
          activity.totalFloat === 0 && styles.floatBadgeZero,
        ]}
      >
        <Text style={styles.floatValue}>{activity.totalFloat}</Text>
        <Text style={styles.floatLabel}>Float</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
  },
  headerStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.sectionFamily,
  },
  statLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 1,
  },
  dateRange: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  dateValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  pathContainer: {
    gap: 0,
  },
  activityNode: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: SemanticColors.feedbackError,
    gap: Spacing.sm,
  },
  activityNodeHighlighted: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  activityNodeFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  activityNodeLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  positionBadge: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
    backgroundColor: SemanticColors.feedbackError,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    color: Palette.white,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
  },
  activityDetails: {
    flex: 1,
    gap: 4,
  },
  activityName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  activityMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  activityMetaText: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
    minWidth: 30,
    textAlign: 'right',
  },
  floatBadge: {
    alignItems: 'center',
    padding: 4,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 6,
    minWidth: 40,
  },
  floatBadgeZero: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  floatValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.sectionFamily,
  },
  floatLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize - 3,
  },
  connector: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  connectorLine: {
    width: 2,
    height: 8,
    backgroundColor: SemanticColors.feedbackError,
  },
  bottlenecksSection: {
    gap: 8,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  bottleneckItem: {
    flexDirection: 'row',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackErrorBg,
    borderRadius: 6,
  },
  bottleneckSeverity: {
    width: 4,
    borderRadius: 2,
  },
  bottleneckContent: {
    flex: 1,
  },
  bottleneckName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },
  bottleneckReason: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  nearCriticalSection: {
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm,
  },
  nearCriticalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nearCriticalTitle: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  nearCriticalSubtext: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    marginTop: 2,
  },
  // Compact styles
  compactContainer: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: 8,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    flex: 1,
  },
  compactDuration: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
  },
  compactPath: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactActivityWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactActivity: {
    padding: 6,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SemanticColors.feedbackError,
    minWidth: 80,
    maxWidth: 100,
  },
  compactActivityHighlighted: {
    backgroundColor: SemanticColors.feedbackErrorBg,
  },
  compactActivityName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.labelFamily,
  },
  compactProgressBar: {
    height: 2,
    backgroundColor: SemanticColors.borderDefault,
    borderRadius: 1,
    marginTop: 4,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 1,
  },
  compactArrow: {
    marginHorizontal: 2,
  },
});
