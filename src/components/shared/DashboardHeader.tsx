import { StyleSheet, Text, View } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import { TYPE, GRID } from '../../theme/tabStyles';

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
    color: SemanticColors.textSecondary,
    fontSize: TYPE.bodySize - 1,
    marginBottom: GRID.xs,
  },
  title: {
    color: SemanticColors.textPrimary,
    fontSize: TYPE.displaySize - 4,
    fontFamily: TYPE.sectionFamily,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.sectionFamily,
  },
});
