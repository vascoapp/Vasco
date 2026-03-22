import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../theme/colors';

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

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.wrapper,
        size === 'md' && styles.wrapperMd,
        isDisabled && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <LinearGradient
        colors={[Palette.hermesOrange, Palette.terracotta]}
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
    borderRadius: 14,
    shadowColor: Palette.hermesOrange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  wrapperMd: {
    borderRadius: 10,
  },
  gradient: {
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientMd: {
    borderRadius: 10,
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
    fontFamily: 'Manrope_700Bold',
    letterSpacing: 0.3,
  },
  labelMd: {
    fontSize: 14,
  },
});
