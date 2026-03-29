import { StyleSheet, Text, View } from 'react-native';
import { SemanticColors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { PrimaryButton } from './PrimaryButton';
import { TYPE, RADIUS } from '../theme/tabStyles';
type AttentionCardProps = {
  title: string;
  subtitle?: string;
  reason?: string;
  meta?: string;
  ctaLabel: string;
  onPress?: () => void;
  tone?: 'default' | 'warning' | 'danger';
};

const toneColors = {
  default: SemanticColors.surfaceSecondary,
  warning: '#2C2312',
  danger: '#2A1414',
};

export function AttentionCard({
  title,
  subtitle,
  reason,
  meta,
  ctaLabel,
  onPress,
  tone = 'default',
}: AttentionCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: toneColors[tone] }]}>
      <View style={styles.header}>
        <Text style={Typography.subtitle}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {subtitle ? <Text style={[Typography.muted, styles.subtitle]}>{subtitle}</Text> : null}
      {reason ? <Text style={[Typography.body, styles.reason]}>{reason}</Text> : null}
      <PrimaryButton label={ctaLabel} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    color: SemanticColors.textSecondary,
    fontSize: TYPE.labelSize,
    fontFamily: 'Inter_500Medium',
  },
  subtitle: {
    marginTop: 2,
  },
  reason: {
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
});
