// =============================================================================
// SUPPLIER ALERT BANNER
// =============================================================================
// Displays urgent supplier reliability alerts as a dismissible banner
// Used in contractor material selection and purchasing screens
// =============================================================================

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import type { DriftAlert, DriftSeverity } from '../../types/supplier-reliability';

interface SupplierAlertBannerProps {
  alert: DriftAlert;
  onDismiss?: () => void;
  onViewDetails?: () => void;
  onViewAlternatives?: () => void;
}

export function SupplierAlertBanner({
  alert,
  onDismiss,
  onViewDetails,
  onViewAlternatives,
}: SupplierAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const getSeverityConfig = (severity: DriftSeverity) => {
    switch (severity) {
      case 'critical':
        return {
          backgroundColor: SemanticColors.feedbackErrorBg,
          borderColor: SemanticColors.feedbackErrorBorder,
          iconColor: SemanticColors.feedbackError,
          icon: 'alert-circle' as const,
        };
      case 'high':
        return {
          backgroundColor: SemanticColors.feedbackWarningBg,
          borderColor: SemanticColors.feedbackWarningBorder,
          iconColor: SemanticColors.feedbackWarning,
          icon: 'warning' as const,
        };
      case 'medium':
        return {
          backgroundColor: SemanticColors.feedbackInfoBg,
          borderColor: SemanticColors.feedbackInfoBorder,
          iconColor: SemanticColors.feedbackInfo,
          icon: 'information-circle' as const,
        };
      default:
        return {
          backgroundColor: SemanticColors.surfaceSecondary,
          borderColor: SemanticColors.borderDefault,
          iconColor: SemanticColors.textSecondary,
          icon: 'information-circle' as const,
        };
    }
  };

  const config = getSeverityConfig(alert.severity);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
      ]}
    >
      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={24} color={config.iconColor} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.supplierName}>{alert.supplierName}</Text>
          <View style={[styles.severityBadge, { backgroundColor: config.iconColor }]}>
            <Text style={styles.severityText}>
              {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
            </Text>
          </View>
        </View>

        {/* Message */}
        <Text style={styles.message}>{alert.message}</Text>

        {/* Metrics Change */}
        <View style={styles.metricsRow}>
          <Text style={styles.metricLabel}>{alert.metricName}:</Text>
          <Text style={styles.metricValue}>
            {alert.previousValue}% → {alert.currentValue}%
          </Text>
          <Text style={[styles.metricChange, { color: SemanticColors.feedbackError }]}>
            ({alert.changePercentage}%)
          </Text>
        </View>

        {/* Recommendation */}
        <Text style={styles.recommendation}>{alert.recommendation}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          {onViewAlternatives && (
            <Pressable style={styles.actionButton} onPress={onViewAlternatives}>
              <Ionicons name="swap-horizontal" size={14} color={SemanticColors.actionPrimary} />
              <Text style={styles.actionButtonText}>View Alternatives</Text>
            </Pressable>
          )}
          {onViewDetails && (
            <Pressable style={styles.actionButton} onPress={onViewDetails}>
              <Ionicons name="analytics" size={14} color={SemanticColors.actionPrimary} />
              <Text style={styles.actionButtonText}>View Details</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Dismiss Button */}
      <Pressable style={styles.dismissButton} onPress={handleDismiss}>
        <Ionicons name="close" size={18} color={SemanticColors.textTertiary} />
      </Pressable>
    </View>
  );
}

// Compact version for inline display
interface SupplierAlertChipProps {
  alert: DriftAlert;
  onPress?: () => void;
}

export function SupplierAlertChip({ alert, onPress }: SupplierAlertChipProps) {
  const getSeverityColor = (severity: DriftSeverity) => {
    switch (severity) {
      case 'critical':
        return SemanticColors.feedbackError;
      case 'high':
        return SemanticColors.feedbackWarning;
      default:
        return SemanticColors.feedbackInfo;
    }
  };

  const color = getSeverityColor(alert.severity);

  return (
    <Pressable
      style={[styles.chipContainer, { backgroundColor: color + '20', borderColor: color }]}
      onPress={onPress}
    >
      <Ionicons
        name={alert.severity === 'critical' ? 'alert-circle' : 'warning'}
        size={12}
        color={color}
      />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {alert.supplierName}: {alert.message}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  iconContainer: {
    paddingTop: 2,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  supplierName: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.titleFamily,
  },
  severityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    color: Palette.white,
    fontSize: TYPE.tinySize - 1,
    fontFamily: TYPE.titleFamily,
  },
  message: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.captionSize,
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metricLabel: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
  },
  metricValue: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  metricChange: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
  },
  recommendation: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  actionButtonText: {
    color: SemanticColors.actionPrimary,
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
  },
  dismissButton: {
    padding: 4,
  },
  // Chip styles
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    flex: 1,
  },
});
