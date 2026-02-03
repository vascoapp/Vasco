import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';

type IconName = keyof typeof Ionicons.glyphMap;

interface HubNavigationCardProps {
  title: string;
  icon: IconName;
  route: string;
  stat?: string;
  statLabel?: string;
  roleColor: string;
}

export function HubNavigationCard({
  title,
  icon,
  route,
  stat,
  statLabel,
  roleColor,
}: HubNavigationCardProps) {
  const router = useRouter();

  return (
    <Pressable
      style={[styles.card, { borderColor: roleColor + '30' }]}
      onPress={() => router.push(route as any)}
    >
      <View style={[styles.iconContainer, { backgroundColor: roleColor + '15' }]}>
        <Ionicons name={icon} size={22} color={roleColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {stat && (
        <View style={styles.statContainer}>
          <Text style={[styles.statValue, { color: roleColor }]}>{stat}</Text>
          {statLabel && <Text style={styles.statLabel}>{statLabel}</Text>}
        </View>
      )}
      <View style={styles.chevronContainer}>
        <Ionicons name="chevron-forward" size={16} color={Colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  statContainer: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 10,
    marginTop: 2,
  },
  chevronContainer: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
  },
});
