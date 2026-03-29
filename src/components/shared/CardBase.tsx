import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { RADIUS } from '../../theme/tabStyles';

type CardVariant = 'flat' | 'default' | 'elevated' | 'outlined' | 'hero';

interface CardBaseProps {
  variant?: CardVariant;
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function CardBase({ variant = 'default', children, style, padding }: CardBaseProps) {
  return (
    <View style={[styles.base, variantStyles[variant], padding != null && { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
    padding: Spacing.sm,
  },
});

const variantStyles = StyleSheet.create({
  flat: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  default: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  elevated: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  outlined: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  hero: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: RADIUS.xl,
  },
});
