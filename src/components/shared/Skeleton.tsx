// =============================================================================
// SKELETON — Base shimmer building block for loading states
// =============================================================================
// Animated opacity pulse using RN Animated API (60fps, native driver).
// All sizing uses theme tokens. Compose into cards, lists, screens.
// =============================================================================

import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { RADIUS } from '../../theme/tabStyles';

interface SkeletonProps {
  /** Width — number (px) or string ('60%') */
  width: number | string;
  /** Height in px */
  height: number;
  /** Border radius — defaults to RADIUS.sm (8) */
  borderRadius?: number;
  /** Extra style overrides */
  style?: ViewStyle;
}

export function Skeleton({
  width,
  height,
  borderRadius = RADIUS.sm,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: SemanticColors.borderMuted,
          opacity,
        },
        style,
      ]}
    />
  );
}
