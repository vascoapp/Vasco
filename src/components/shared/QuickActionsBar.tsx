import { StyleSheet, View } from 'react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import { ActionCard } from './ActionCard';

type QuickAction = {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
  badge?: number;
  color?: string;
};

type QuickActionsBarProps = {
  actions: QuickAction[];
  roleColor?: string;
};

export function QuickActionsBar({ actions, roleColor = Colors.accentDeep }: QuickActionsBarProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.accent, { backgroundColor: roleColor }]} />
      <View style={styles.actionsRow}>
        {actions.slice(0, 3).map((action) => (
          <ActionCard
            key={action.id}
            label={action.label}
            icon={action.icon}
            onPress={action.onPress}
            badge={action.badge}
            color={action.color || roleColor}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  accent: {
    height: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
});
