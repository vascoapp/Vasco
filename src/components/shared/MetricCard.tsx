import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';

export type TrendDirection = 'up' | 'down' | 'neutral';

type MetricCardProps = {
  value: string | number;
  label: string;
  trend?: TrendDirection;
  trendValue?: string;
  color?: string;
  onPress?: () => void;
  size?: 'default' | 'large';
};

const TREND_CONFIG: Record<TrendDirection, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  up: { icon: 'trending-up', color: SemanticColors.feedbackSuccess },
  down: { icon: 'trending-down', color: SemanticColors.feedbackError },
  neutral: { icon: 'remove', color: SemanticColors.textSecondary },
};

export function MetricCard({
  value,
  label,
  trend,
  trendValue,
  color = SemanticColors.actionPrimary,
  onPress,
  size = 'default',
}: MetricCardProps) {
  const Content = (
    <View style={[styles.container, size === 'large' && styles.containerLarge]}>
      <Text
        style={[
          styles.value,
          size === 'large' && styles.valueLarge,
          { color },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.label, size === 'large' && styles.labelLarge]} numberOfLines={1}>
        {label}
      </Text>
      {trend && (
        <View style={styles.trendContainer}>
          <Ionicons
            name={TREND_CONFIG[trend].icon}
            size={14}
            color={TREND_CONFIG[trend].color}
          />
          {trendValue && (
            <Text style={[styles.trendValue, { color: TREND_CONFIG[trend].color }]}>
              {trendValue}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.pressable}>
        {Content}
      </Pressable>
    );
  }

  return Content;
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    minWidth: '45%',
  },
  container: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  containerLarge: {
    minHeight: 100,
    padding: Spacing.md,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
  },
  valueLarge: {
    fontSize: 28,
  },
  label: {
    color: SemanticColors.textSecondary,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  labelLarge: {
    fontSize: 12,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  trendValue: {
    fontSize: 11,
    fontWeight: '600',
  },
});
