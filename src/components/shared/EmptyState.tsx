import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string;
}

export function EmptyState({
  icon = 'document-outline',
  title,
  description,
  actionLabel,
  onAction,
  accentColor = Palette.hermesOrange,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {/* Layered icon composition */}
      <View style={styles.iconWrapper}>
        <View style={[styles.iconRingOuter, { borderColor: accentColor + '10' }]} />
        <View style={[styles.iconRingInner, { backgroundColor: accentColor + '08' }]}>
          <Ionicons name={icon} size={36} color={accentColor + '60'} />
        </View>
        {/* Small decorative dot */}
        <View style={[styles.iconDot, { backgroundColor: accentColor + '30' }]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <Pressable
          style={({ pressed }) => [styles.button, { backgroundColor: accentColor }, pressed && { transform: [{ scale: 0.97 }] }]}
          onPress={onAction}
        >
          <Ionicons name="add" size={16} color={Palette.white} />
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  iconWrapper: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    position: 'relative',
  },
  iconRingOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
  },
  iconRingInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    top: 4,
    right: 8,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Manrope_400Regular',
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  button: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: Palette.white,
    fontSize: 14,
    fontFamily: 'Manrope_600SemiBold',
  },
});
