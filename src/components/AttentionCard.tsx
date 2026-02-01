import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { PrimaryButton } from './PrimaryButton';

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
  default: Colors.surfaceElevated,
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
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  subtitle: {
    marginTop: 2,
  },
  reason: {
    color: Colors.muted,
    lineHeight: 18,
  },
});
