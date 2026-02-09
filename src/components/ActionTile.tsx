import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';
import type { AttentionTone } from '../domain/attention';

type ActionTileProps = {
  title: string;
  subtitle?: string;
  why?: string;
  impact?: string;
  tag?: string;
  tone?: AttentionTone;
  onPress?: () => void;
};

const toneColors = {
  default: {
    background: Colors.surface,
    border: Colors.border,
    badge: Colors.surfaceElevated,
    badgeText: Colors.text,
    impact: Colors.accentMuted,
  },
  warning: {
    background: Colors.warning + '08',
    border: Colors.warning + '30',
    badge: Colors.warning + '20',
    badgeText: Colors.warning,
    impact: Colors.warning,
  },
  danger: {
    background: Colors.danger + '08',
    border: Colors.danger + '30',
    badge: Colors.danger + '20',
    badgeText: Colors.danger,
    impact: Colors.danger,
  },
};

export function ActionTile({
  title,
  subtitle,
  why,
  impact,
  tag,
  tone = 'default',
  onPress,
}: ActionTileProps) {
  const colors = toneColors[tone];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: colors.background, borderColor: colors.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.left}>
        <View style={[styles.iconBadge, { backgroundColor: colors.badge }]}>
          <Text style={[styles.iconText, { color: colors.badgeText }]}>{tag ?? 'A'}</Text>
        </View>
        <View style={styles.content}>
          <Text style={Typography.subtitle}>{title}</Text>
          {subtitle ? <Text style={Typography.muted} numberOfLines={1}>{subtitle}</Text> : null}
          {why ? <Text style={styles.why} numberOfLines={2}>{why}</Text> : null}
        </View>
      </View>
      <View style={styles.right}>
        {impact ? (
          <View style={[styles.impactBadge, { backgroundColor: colors.badge }]}>
            <Text style={[styles.impactText, { color: colors.impact }]}>{impact}</Text>
          </View>
        ) : null}
        <View style={styles.chevronContainer}>
          <Text style={styles.chevron}>→</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  content: {
    flexShrink: 1,
    gap: 2,
  },
  iconBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  impactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  impactText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  why: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  chevronContainer: {
    width: 24,
    height: 24,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
});
