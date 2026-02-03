import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';

type DashboardHeaderProps = {
  greeting: string;
  title: string;
  roleLabel: string;
  roleColor: string;
};

export function DashboardHeader({ greeting, title, roleLabel, roleColor }: DashboardHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: roleColor + '20' }]}>
        <Text style={[styles.badgeText, { color: roleColor }]}>{roleLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  textContainer: {
    flex: 1,
  },
  greeting: {
    color: Colors.muted,
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
