// =============================================================================
// HOURS SAVED CARD - Time Savings Dashboard Widget
// =============================================================================
// Displays automation time savings in contractor-friendly format
// a16z pattern: ROI expressed in hard operational metrics
// =============================================================================

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useHoursSavedDisplay, useROIDashboard } from '../../services';

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_CONFIG: Record<string, { icon: IconName; color: string }> = {
  'Quote Automation': { icon: 'document-text', color: '#8B5CF6' },
  'Invoice Collection': { icon: 'receipt', color: SemanticColors.feedbackSuccess },
  'Scheduling': { icon: 'calendar', color: SemanticColors.feedbackInfo },
  'Document Processing': { icon: 'folder-open', color: Palette.hermesOrange },
  'Customer Communication': { icon: 'chatbubble', color: '#EC4899' },
  'Compliance': { icon: 'shield-checkmark', color: SemanticColors.feedbackWarning },
};

interface HoursSavedCardProps {
  onPress?: () => void;
  compact?: boolean;
}

export function HoursSavedCard({ onPress, compact = false }: HoursSavedCardProps) {
  const displayData = useHoursSavedDisplay();
  const dashboard = useROIDashboard();
  const isLoading = !displayData;

  if (isLoading || !displayData) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.loadingPlaceholder} />
      </View>
    );
  }

  const trendIcon: IconName =
    displayData.trendDirection === 'up'
      ? 'trending-up'
      : displayData.trendDirection === 'down'
        ? 'trending-down'
        : 'remove';

  const trendColor =
    displayData.trendDirection === 'up'
      ? SemanticColors.feedbackSuccess
      : displayData.trendDirection === 'down'
        ? SemanticColors.feedbackError
        : SemanticColors.textSecondary;

  if (compact) {
    return (
      <Pressable style={[styles.container, styles.containerCompact]} onPress={onPress}>
        <View style={styles.compactHeader}>
          <View style={styles.iconBadge}>
            <Ionicons name="time" size={18} color={Palette.hermesOrange} />
          </View>
          <View style={styles.compactContent}>
            <Text style={styles.compactValue}>
              {dashboard?.hoursSavedThisWeek || 0}h
            </Text>
            <Text style={styles.compactLabel}>Saved this week</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={SemanticColors.textTertiary} />
        </View>
        <View style={styles.compactValueRow}>
          <Ionicons name={trendIcon} size={14} color={trendColor} />
          <Text style={[styles.compactTrend, { color: trendColor }]}>
            {displayData.trendText}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <View style={styles.heroIcon}>
          <Ionicons name="time" size={28} color={Palette.hermesOrange} />
        </View>
        <View style={styles.heroContent}>
          <Text style={styles.heroHeadline}>{displayData.headline}</Text>
          <Text style={styles.heroSubheadline}>{displayData.subheadline}</Text>
        </View>
      </View>

      {/* Breakdown Grid */}
      <View style={styles.breakdownGrid}>
        {displayData.breakdown.slice(0, 4).map((item: any, index: number) => {
          const config = CATEGORY_CONFIG[item.category] || {
            icon: 'ellipsis-horizontal',
            color: SemanticColors.textSecondary,
          };
          return (
            <View key={index} style={styles.breakdownItem}>
              <View style={[styles.breakdownIcon, { backgroundColor: config.color + '15' }]}>
                <Ionicons name={config.icon} size={16} color={config.color} />
              </View>
              <View style={styles.breakdownContent}>
                <Text style={styles.breakdownHours}>
                  {item.hours < 1 ? `${Math.round(item.hours * 60)}m` : `${item.hours.toFixed(1)}h`}
                </Text>
                <Text style={styles.breakdownCategory} numberOfLines={1}>
                  {item.category}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Comparison & Trend */}
      <View style={styles.footer}>
        <View style={styles.comparison}>
          <Ionicons name="flash" size={14} color={Palette.hermesOrange} />
          <Text style={styles.comparisonText}>
            {displayData.comparison.value}
          </Text>
        </View>
        <View style={styles.trend}>
          <Ionicons name={trendIcon} size={14} color={trendColor} />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {displayData.trendText}
          </Text>
        </View>
      </View>

      {/* CTA */}
      {displayData.ctaText && onPress && (
        <Pressable style={styles.ctaButton} onPress={onPress}>
          <Text style={styles.ctaText}>{displayData.ctaText}</Text>
          <Ionicons name="chevron-forward" size={14} color={SemanticColors.actionPrimary} />
        </Pressable>
      )}
    </Pressable>
  );
}

// Simplified widget for dashboard
export function HoursSavedWidget({ onPress }: { onPress?: () => void }) {
  const dashboard = useROIDashboard();

  if (!dashboard) return null;

  return (
    <Pressable style={styles.widget} onPress={onPress}>
      <View style={styles.widgetIcon}>
        <Ionicons name="time" size={22} color={Palette.hermesOrange} />
      </View>
      <View style={styles.widgetContent}>
        <Text style={styles.widgetValue}>
          {dashboard.hoursSavedThisMonth.toFixed(1)}h
        </Text>
        <Text style={styles.widgetLabel}>Hours saved this month</Text>
      </View>
      <View style={styles.widgetValueBadge}>
        <Text style={styles.widgetValueText}>
          €{dashboard.moneyValueThisMonth.toLocaleString(undefined)}
        </Text>
      </View>
    </Pressable>
  );
}

// Mini stat chip for quick reference
export function HoursSavedChip() {
  const dashboard = useROIDashboard();

  if (!dashboard) return null;

  return (
    <View style={styles.chip}>
      <Ionicons name="time-outline" size={12} color={Palette.hermesOrange} />
      <Text style={styles.chipText}>
        {dashboard.hoursSavedThisWeek}h saved
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.md,
  },
  containerCompact: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  loadingPlaceholder: {
    height: 120,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 12,
  },
  // Hero Section
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flex: 1,
    gap: 4,
  },
  heroHeadline: {
    fontSize: 17,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  heroSubheadline: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  // Breakdown Grid
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: Spacing.xs,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 10,
    padding: Spacing.sm,
  },
  breakdownIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownContent: {
    flex: 1,
  },
  breakdownHours: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  breakdownCategory: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.borderDefault,
  },
  comparison: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  comparisonText: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
    backgroundColor: SemanticColors.actionPrimary + '10',
    borderRadius: 10,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.actionPrimary,
  },
  // Compact styles
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Palette.hermesOrange + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
  },
  compactValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  compactLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  compactValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 52,
  },
  compactTrend: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Widget styles
  widget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.hermesOrange + '10',
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '30',
    gap: Spacing.sm,
  },
  widgetIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetContent: {
    flex: 1,
    gap: 2,
  },
  widgetValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  widgetLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  widgetValueBadge: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  widgetValueText: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
  },
  // Chip styles
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
});
