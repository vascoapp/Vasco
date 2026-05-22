import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SemanticColors, Palette } from '../../theme/colors';
import { PAGE_BG, TYPE, RADIUS, GRID } from '../../theme/tabStyles';
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface VascoButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

const SIZE_CONFIG: Record<ButtonSize, { height: number; fontSize: number; iconSize: number; px: number; radius: number }> = {
  sm: { height: 34, fontSize: TYPE.captionSize, iconSize: 16, px: 12, radius: 8 },
  md: { height: 44, fontSize: TYPE.bodySize, iconSize: 18, px: 16, radius: 10 },
  lg: { height: 52, fontSize: TYPE.titleSize + 1, iconSize: 20, px: 20, radius: 12 },
};

export function VascoButton({
  variant = 'primary',
  size = 'md',
  label,
  onPress,
  loading,
  disabled,
  icon,
}: VascoButtonProps) {
  const sizeConfig = SIZE_CONFIG[size];
  const isDisabled = disabled || loading;

  const getColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: isDisabled ? SemanticColors.actionPrimaryDisabled : Palette.hermesOrange,
          text: Palette.white,
          border: 'transparent',
        };
      case 'secondary':
        return {
          bg: 'transparent',
          text: isDisabled ? SemanticColors.textDisabled : Palette.hermesOrange,
          border: isDisabled ? SemanticColors.borderDisabled : Palette.hermesOrange,
        };
      case 'danger':
        return {
          bg: isDisabled ? SemanticColors.actionPrimaryDisabled : SemanticColors.feedbackError,
          text: Palette.white,
          border: 'transparent',
        };
      case 'ghost':
        return {
          bg: 'transparent',
          text: isDisabled ? SemanticColors.textDisabled : SemanticColors.textPrimary,
          border: 'transparent',
        };
    }
  };

  const colors = getColors();

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: sizeConfig.height,
          paddingHorizontal: sizeConfig.px,
          borderRadius: sizeConfig.radius,
          backgroundColor: colors.bg,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        pressed && !isDisabled && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={sizeConfig.iconSize} color={colors.text} />}
          <Text
            style={{
              fontSize: sizeConfig.fontSize,
              fontFamily: 'Inter_600SemiBold',
              color: colors.text,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
