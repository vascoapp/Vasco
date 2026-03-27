import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Radius } from '../../theme/radius';
import { TYPE, GRID } from '../../theme/tabStyles';

type ActionCardProps = {
  label: string;
  icon: string;
  onPress: () => void;
  badge?: number;
  color?: string;
  disabled?: boolean;
};

export function ActionCard({ label, icon, onPress, badge, color = SemanticColors.actionPrimary, disabled = false }: ActionCardProps) {
  return (
    <Pressable
      style={[
        styles.container,
        disabled && styles.containerDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Text style={styles.icon}>{icon}</Text>
        {badge !== undefined && badge > 0 && (
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, disabled && styles.labelDisabled]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 80,
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRID.sm,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  icon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    color: SemanticColors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelDisabled: {
    color: SemanticColors.textSecondary,
  },
});
