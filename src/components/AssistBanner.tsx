import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SemanticColors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../theme/tabStyles';
type AssistBannerProps = {
  title: string;
  description: string;
  actionLabel: string;
  onPress?: () => void;
  meta?: string;
};

export function AssistBanner({ title, description, actionLabel, onPress, meta }: AssistBannerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={Typography.subtitle}>{title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Text style={[Typography.muted, styles.description]}>{description}</Text>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
        <Text style={styles.ctaText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SemanticColors.surfacePrimary,
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
  description: {
    lineHeight: 18,
  },
  cta: {
    marginTop: Spacing.xs,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  ctaText: {
    color: SemanticColors.textPrimary,
    fontWeight: '600',
    fontSize: TYPE.bodySize,
  },
  pressed: {
    opacity: 0.9,
  },
});
