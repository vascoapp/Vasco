// =============================================================================
// SKELETON LIST — Multiple skeleton cards with staggered animation
// =============================================================================
// Shows N skeleton cards stacked vertically. Each card fades in with a
// slight delay for a polished cascading effect.
// =============================================================================

import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { GRID } from '../../theme/tabStyles';
import { PAGE_BG } from '../../theme/tabStyles';
import { SafeArea } from '../../theme/spacing';
import { SkeletonCard } from './SkeletonCard';

interface SkeletonListProps {
  /** Number of skeleton cards to show (default 3) */
  count?: number;
  /** Show avatar on each card (default false) */
  showAvatar?: boolean;
  /** Show action area on each card (default false) */
  showAction?: boolean;
  /** Number of body lines per card (default 2) */
  lines?: number;
}

function StaggeredCard({
  index,
  showAvatar,
  showAction,
  lines,
}: {
  index: number;
  showAvatar: boolean;
  showAction: boolean;
  lines: number;
}) {
  const translateY = useRef(new Animated.Value(12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 80;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <SkeletonCard
        showAvatar={showAvatar}
        showAction={showAction}
        lines={lines}
      />
    </Animated.View>
  );
}

export function SkeletonList({
  count = 3,
  showAvatar = false,
  showAction = false,
  lines = 2,
}: SkeletonListProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <StaggeredCard
          key={i}
          index={i}
          showAvatar={showAvatar}
          showAction={showAction}
          lines={lines}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
    paddingHorizontal: SafeArea.side,
    paddingTop: GRID.md,
    gap: GRID.sm + 4, // 12px between cards
  },
});
