import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { RADIUS } from '../../theme/tabStyles';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
}

export function GradientButton({ label, onPress, icon, loading, disabled, size = 'lg' }: GradientButtonProps) {
  const isDisabled = disabled || loading;

  const gradientColors: [string, string] = isDisabled
    ? [SemanticColors.textDisabled, SemanticColors.textTertiary]
    : [Palette.hermesOrange, Palette.terracotta];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.wrapper,
        size === 'md' && styles.wrapperMd,
        isDisabled && styles.wrapperDisabled,
        pressed && !isDisabled && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, size === 'md' && styles.gradientMd]}
      >
        {loading ? (
          <ActivityIndicator color={Palette.white} />
        ) : (
          <View style={styles.content}>
            {icon && <Ionicons name={icon} size={size === 'md' ? 16 : 18} color={Palette.white} />}
            <Text style={[styles.label, size === 'md' && styles.labelMd]}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: RADIUS.lg,
  },
  wrapperMd: {
    borderRadius: RADIUS.md,
  },
  wrapperDisabled: {
    opacity: 0.6,
  },
  gradient: {
    borderRadius: RADIUS.lg,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientMd: {
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: Palette.white,
    fontSize: 16,
    fontFamily: 'Archivo_800ExtraBold',
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: 14,
  },
});
