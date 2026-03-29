// =============================================================================
// FRAGILITY SCORE CARD
// =============================================================================
// Displays schedule fragility score and key risk factors
// Used in COODashboard schedule tab and Director dashboard
// =============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import type { FragilityScore, FragilityLevel, FactorScore } from '../../types/schedule-fragility';

interface FragilityScoreCardProps {
  fragility: FragilityScore;
  compact?: boolean;
  onPress?: () => void;
  showFactors?: boolean;
  showAlerts?: boolean;
}

export function FragilityScoreCard({
  fragility,
  compact = false,
  onPress,
  showFactors = true,
  showAlerts = true,
}: FragilityScoreCardProps) {
  const getFragilityColor = (level: FragilityLevel) => {
    switch (level) {
      case 'low':
        return SemanticColors.feedbackSuccess;
      case 'moderate':
        return '#3B82F6';
      case 'high':
        return SemanticColors.feedbackWarning;
      case 'critical':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.textTertiary;
    }
  };

  const getFragilityIcon = (level: FragilityLevel): keyof typeof Ionicons.glyphMap => {
    switch (level) {
      case 'low':
        return 'shield-checkmark';
      case 'moderate':
        return 'shield-half';
      case 'high':
        return 'warning';
      case 'critical':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const getFactorStatusColor = (status: FactorScore['status']) => {
    switch (status) {
      case 'good':
        return SemanticColors.feedbackSuccess;
      case 'warning':
        return SemanticColors.feedbackWarning;
      case 'danger':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.textTertiary;
    }
  };

  const fragilityColor = getFragilityColor(fragility.fragility);

  if (compact) {
    return (
      <Pressable
        style={styles.compactContainer}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.compactLeft}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {fragility.projectName}
          </Text>
          <Text style={styles.compactMeta}>
            {fragility.criticalActivitiesCount} critical activities
          </Text>
        </View>

        <View style={styles.compactRight}>
          <View style={[styles.fragilityBadge, { backgroundColor: fragilityColor + '20' }]}>
            <Ionicons name={getFragilityIcon(fragility.fragility)} size={14} color={fragilityColor} />
            <Text style={[styles.fragilityBadgeText, { color: fragilityColor }]}>
              {fragility.overallScore}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.projectName}>{fragility.projectName}</Text>
          <Text style={styles.subtitle}>Schedule Fragility Analysis</Text>
        </View>
        <View style={[styles.fragilityIconContainer, { backgroundColor: fragilityColor + '20' }]}>
          <Ionicons name={getFragilityIcon(fragility.fragility)} size={24} color={fragilityColor} />
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreGauge}>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreValue, { color: fragilityColor }]}>
              {fragility.overallScore}
            </Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <View style={[styles.fragilityLabel, { backgroundColor: fragilityColor + '20' }]}>
            <Text style={[styles.fragilityLabelText, { color: fragilityColor }]}>
              {fragility.fragility.charAt(0).toUpperCase() + fragility.fragility.slice(1)} Fragility
            </Text>
          </View>
        </View>

        <View style={styles.statsColumn}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{fragility.criticalPathLength}</Text>
            <Text style={styles.statLabel}>CP Days</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{fragility.criticalActivitiesCount}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{fragility.alerts.length}</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
        </View>
      </View>

      {/* Factor Breakdown */}
      {showFactors && (
        <View style={styles.factorsSection}>
          <Text style={styles.sectionTitle}>Risk Factors</Text>
          <View style={styles.factorsList}>
            {Object.values(fragility.factors).slice(0, 4).map((factor: FactorScore) => (
              <View key={factor.name} style={styles.factorItem}>
                <View style={styles.factorHeader}>
                  <Text style={styles.factorName}>{factor.name}</Text>
                  <View style={styles.factorScore}>
                    <View
                      style={[
                        styles.factorStatusDot,
                        { backgroundColor: getFactorStatusColor(factor.status) },
                      ]}
                    />
                    <Text style={styles.factorScoreText}>{factor.score}</Text>
                  </View>
                </View>
                <View style={styles.factorBar}>
                  <View
                    style={[
                      styles.factorBarFill,
                      {
                        width: `${factor.score}%`,
                        backgroundColor: getFactorStatusColor(factor.status),
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Alerts Preview */}
      {showAlerts && fragility.alerts.length > 0 && (
        <View style={styles.alertsSection}>
          <View style={styles.alertsHeader}>
            <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
            <Text style={styles.alertsTitle}>
              {fragility.alerts.length} Active Alert{fragility.alerts.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {fragility.alerts.slice(0, 2).map((alert) => (
            <View key={alert.id} style={styles.alertItem}>
              <View
                style={[
                  styles.alertSeverityDot,
                  {
                    backgroundColor:
                      alert.severity === 'critical'
                        ? SemanticColors.feedbackError
                        : alert.severity === 'danger'
                        ? SemanticColors.feedbackError
                        : SemanticColors.feedbackWarning,
                  },
                ]}
              />
              <Text style={styles.alertMessage} numberOfLines={1}>
                {alert.title}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recommendations Preview */}
      {fragility.recommendations.length > 0 && (
        <View style={styles.recommendationsSection}>
          <Ionicons name="bulb" size={14} color={SemanticColors.feedbackInfo} />
          <Text style={styles.recommendationText} numberOfLines={1}>
            {fragility.recommendations[0].title}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={SemanticColors.textTertiary} />
        </View>
      )}
    </Pressable>
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
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  projectName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.titleSize,
    fontFamily: TYPE.titleFamily,
  },
  subtitle: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  fragilityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  scoreGauge: {
    alignItems: 'center',
    gap: 6,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 36,
    fontFamily: TYPE.sectionFamily,
  },
  scoreMax: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.bodySize - 1,
  },
  fragilityLabel: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.md,
  },
  fragilityLabelText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  statsColumn: {
    flex: 1,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  statLabel: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.labelSize,
  },
  factorsSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  sectionTitle: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  factorsList: {
    gap: 10,
  },
  factorItem: {
    gap: 4,
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
  },
  factorScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  factorStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  factorScoreText: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.titleFamily,
  },
  factorBar: {
    height: 4,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  factorBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  alertsSection: {
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: RADIUS.sm,
  },
  alertsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertsTitle: {
    color: SemanticColors.feedbackWarning,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertSeverityDot: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  alertMessage: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  recommendationsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackInfoBg,
    borderRadius: RADIUS.sm,
  },
  recommendationText: {
    color: SemanticColors.feedbackInfo,
    fontSize: TYPE.labelSize,
    flex: 1,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  compactLeft: {
    flex: 1,
  },
  compactTitle: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize - 1,
    fontFamily: TYPE.labelFamily,
  },
  compactMeta: {
    color: SemanticColors.textTertiary,
    fontSize: TYPE.tinySize,
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fragilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fragilityBadgeText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
  },
});
