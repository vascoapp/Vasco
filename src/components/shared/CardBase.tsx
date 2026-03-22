import { View, StyleSheet, type ViewStyle } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

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
    borderRadius: 14,
    padding: Spacing.sm,
  },
});

const variantStyles = StyleSheet.create({
  flat: {
    backgroundColor: SemanticColors.surfacePrimary,
  },
  default: {
    backgroundColor: SemanticColors.surfacePrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  elevated: {
    backgroundColor: SemanticColors.surfacePrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  outlined: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  hero: {
    backgroundColor: SemanticColors.surfacePrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderRadius: 18,
  },
});
