import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
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
            {/* `flex: 1`, NOT `flexShrink: 1`. Shrink leaves the Text at its
                own MEASURED intrinsic width, and a Text sized to exactly its
                measurement still ellipsizes on iOS when letterSpacing is set —
                the trailing spacing is not in the measured advance. Verified on
                device 2026-08-26: the box was 127.67pt, the string measured
                127.67pt, and English "Create account" — the shortest of the six
                — rendered "Create acc…" on the FIRST screen of the app. `flex`
                gives the Text the whole 296pt the icon leaves, so no locale is
                a hair short. Same class as DKLabel's R106 note. */}
            <Text
              style={[styles.label, size === 'md' && styles.labelMd]}
              numberOfLines={2}
            >
              {label}
            </Text>
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
    // Horizontal padding so a long label cannot run under the rounded corner.
    paddingHorizontal: 16,
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
    justifyContent: 'center',
    gap: 8,
    // `alignSelf: 'stretch'`, NOT `maxWidth: '100%'`. The gradient centres its
    // children, so the row was sized by its own content and a percentage max
    // resolved against a box that had not been laid out yet — the label ended
    // up with a fraction of the ~318pt actually available and truncated at
    // "Account aanm…" on a button wide enough for three times that. Stretch is
    // a definite width, so the text gets the real remaining space.
    alignSelf: 'stretch',
  },
  label: {
    color: Palette.white,
    fontSize: 16,
    fontFamily: 'Archivo_800ExtraBold',
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'center',
  },
  labelMd: {
    fontSize: 14,
  },
});
