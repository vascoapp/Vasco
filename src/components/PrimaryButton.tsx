import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors } from '../theme/colors';
import { Radius } from '../theme/radius';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';

type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
};

export function PrimaryButton({ label, onPress }: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.accentDeep,
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
  label: {
    color: '#0B0C0F',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
