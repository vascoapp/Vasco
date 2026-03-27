import { Pressable, StyleSheet, Text } from 'react-native';
import { SemanticColors, Palette } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ label, onPress, disabled }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.label, disabled && styles.labelDisabled]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: SemanticColors.actionPrimary,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    minHeight: 44,
    minWidth: 44,
    ...Shadows.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    backgroundColor: SemanticColors.textDisabled,
    opacity: 0.6,
  },
  label: {
    color: SemanticColors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  labelDisabled: {
    color: SemanticColors.textTertiary,
  },
});
