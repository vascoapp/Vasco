import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing } from '../theme/spacing';
import { Typography } from '../theme/typography';

type ActionTileProps = {
  title: string;
  subtitle?: string;
  why?: string;
  impact?: string;
  tag?: string;
  onPress?: () => void;
};

export function ActionTile({ title, subtitle, why, impact, tag, onPress }: ActionTileProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={styles.left}>
        <View style={styles.iconBadge}>
          <Text style={styles.iconText}>{tag ?? 'A'}</Text>
        </View>
        <View>
          <Text style={Typography.subtitle}>{title}</Text>
          {subtitle ? <Text style={Typography.muted}>{subtitle}</Text> : null}
          {why ? <Text style={styles.why}>{why}</Text> : null}
        </View>
      </View>
      <View style={styles.right}>
        {impact ? <Text style={styles.impact}>{impact}</Text> : null}
        <Text style={styles.chevron}>{'>'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  pressed: {
    opacity: 0.9,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconText: {
    color: Colors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  impact: {
    color: Colors.accent,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  why: {
    color: Colors.muted,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  chevron: {
    color: Colors.muted,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
