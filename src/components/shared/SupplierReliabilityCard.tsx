// =============================================================================
// SUPPLIER RELIABILITY CARD
// =============================================================================
// Displays supplier reliability score and trend for quick assessment
// Used in COODashboard procurement tab and contractor material selection
// =============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../i18n/formatting';
import type { SupplierPerformance, SupplierRanking } from '../../types/supplier-reliability';

// Accept both SupplierPerformance and SupplierRanking types
type SupplierData = SupplierPerformance | SupplierRanking;

interface SupplierReliabilityCardProps {
  supplier: SupplierData;
  compact?: boolean;
  onPress?: () => void;
  showAlerts?: boolean;
}

// Helper to compute grade from score (for SupplierRanking which doesn't have grade)
function computeGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// Type guard to check if supplier has full performance data
function isFullPerformance(supplier: SupplierData): supplier is SupplierPerformance {
  return 'alerts' in supplier && 'reliabilityGrade' in supplier;
}

export function SupplierReliabilityCard({
  supplier,
  compact = false,
  onPress,
  showAlerts = true,
}: SupplierReliabilityCardProps) {
  // Get grade either from data or compute from score
  const grade = isFullPerformance(supplier)
    ? supplier.reliabilityGrade
    : computeGrade(supplier.reliabilityScore);

  // Get alerts array (may not exist on SupplierRanking)
  const alerts = isFullPerformance(supplier) ? supplier.alerts : [];

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return SemanticColors.feedbackSuccess;
      case 'B':
        return '#3B82F6';
      case 'C':
        return SemanticColors.feedbackWarning;
      case 'D':
        return '#F97316';
      case 'F':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.textTertiary;
    }
  };

  const getTrendIcon = (trend: string): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'improving':
        return 'trending-up';
      case 'declining':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return SemanticColors.feedbackSuccess;
      case 'declining':
        return SemanticColors.feedbackError;
      default:
        return SemanticColors.textTertiary;
    }
  };

  // formatCurrency imported from ../../i18n/formatting

  if (compact) {
    return (
      <Pressable
        style={styles.compactContainer}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.compactLeft}>
          <Text style={styles.compactName} numberOfLines={1}>
            {supplier.supplierName}
          </Text>
          <View style={styles.compactMeta}>
            <Text style={styles.compactCategory}>{supplier.category}</Text>
            {showAlerts && alerts.length > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{alerts.length}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.compactRight}>
          <View style={[styles.gradeBadge, { backgroundColor: getGradeColor(grade) + '20' }]}>
            <Text style={[styles.gradeText, { color: getGradeColor(grade) }]}>
              {grade}
            </Text>
          </View>
          <Ionicons
            name={getTrendIcon(supplier.trend)}
            size={14}
            color={getTrendColor(supplier.trend)}
          />
        </View>
      </Pressable>
    );
  }

  // For full card view, get optional metrics
  const hasFullData = isFullPerformance(supplier);
  const metrics = hasFullData ? supplier.metrics : null;
  const trendPercentage = hasFullData ? supplier.trendPercentage : 0;

  return (
    <Pressable
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.supplierName}>{supplier.supplierName}</Text>
          <Text style={styles.category}>{supplier.category}</Text>
        </View>
        <View style={[styles.gradeBadgeLarge, { backgroundColor: getGradeColor(grade) }]}>
          <Text style={styles.gradeTextLarge}>{grade}</Text>
        </View>
      </View>

      {/* Score */}
      <View style={styles.scoreSection}>
        <View style={styles.scoreMain}>
          <Text style={styles.scoreValue}>{supplier.reliabilityScore}</Text>
          <Text style={styles.scoreLabel}>Reliability Score</Text>
        </View>

        <View style={styles.trendSection}>
          <Ionicons
            name={getTrendIcon(supplier.trend)}
            size={18}
            color={getTrendColor(supplier.trend)}
          />
          <Text style={[styles.trendText, { color: getTrendColor(supplier.trend) }]}>
            {supplier.trend === 'improving' ? '+' : supplier.trend === 'declining' ? '' : ''}
            {trendPercentage}%
          </Text>
        </View>
      </View>

      {/* Metrics - only show if we have full data */}
      {metrics && (
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{Math.round(metrics.onTimeDeliveryRate)}%</Text>
            <Text style={styles.metricLabel}>On-Time</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{Math.round(metrics.qualityScore)}</Text>
            <Text style={styles.metricLabel}>Quality</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{supplier.totalOrders}</Text>
            <Text style={styles.metricLabel}>Orders</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {formatCurrency(supplier.totalSpend)}
            </Text>
            <Text style={styles.metricLabel}>Spend</Text>
          </View>
        </View>
      )}

      {/* Simple metrics for SupplierRanking without full data */}
      {!metrics && (
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{supplier.totalOrders}</Text>
            <Text style={styles.metricLabel}>Orders</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>
              {formatCurrency(supplier.totalSpend)}
            </Text>
            <Text style={styles.metricLabel}>Spend</Text>
          </View>
        </View>
      )}

      {/* Alerts */}
      {showAlerts && alerts.length > 0 && (
        <View style={styles.alertsSection}>
          <View style={styles.alertHeader}>
            <Ionicons name="warning" size={14} color={SemanticColors.feedbackWarning} />
            <Text style={styles.alertHeaderText}>
              {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {alerts.slice(0, 2).map((alert) => (
            <View key={alert.id} style={styles.alertItem}>
              <View
                style={[
                  styles.alertSeverity,
                  {
                    backgroundColor:
                      alert.severity === 'critical'
                        ? SemanticColors.feedbackError
                        : alert.severity === 'high'
                        ? SemanticColors.feedbackWarning
                        : SemanticColors.feedbackInfo,
                  },
                ]}
              />
              <Text style={styles.alertMessage} numberOfLines={1}>
                {alert.message}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
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
  supplierName: {
    color: SemanticColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  category: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  gradeBadgeLarge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeTextLarge: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scoreValue: {
    color: SemanticColors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
  },
  scoreLabel: {
    color: SemanticColors.textTertiary,
    fontSize: 12,
  },
  trendSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  metricLabel: {
    color: SemanticColors.textTertiary,
    fontSize: 10,
  },
  alertsSection: {
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: SemanticColors.feedbackWarningBg,
    borderRadius: 8,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertHeaderText: {
    color: SemanticColors.feedbackWarning,
    fontSize: 12,
    fontWeight: '600',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertSeverity: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  alertMessage: {
    color: SemanticColors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  compactLeft: {
    flex: 1,
  },
  compactName: {
    color: SemanticColors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactCategory: {
    color: SemanticColors.textTertiary,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gradeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertBadge: {
    backgroundColor: SemanticColors.feedbackError,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  alertBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
});
