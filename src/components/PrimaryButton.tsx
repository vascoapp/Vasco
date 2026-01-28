import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors } from '../theme/colors';
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
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
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
