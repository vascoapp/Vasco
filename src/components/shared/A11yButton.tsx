import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';

/**
 * A Pressable wrapper that enforces the minimum-viable accessibility contract:
 *   - accessibilityRole (default 'button')
 *   - accessibilityLabel required
 *   - hit slop grows the 44x44 target area when the visible control is smaller
 *
 * Use this for any new tappable UI. Leaves existing Pressables alone.
 */
export interface A11yButtonProps extends PressableProps {
  accessibilityLabel: string;
  accessibilityHint?: string;
}

export const A11yButton = forwardRef<View, A11yButtonProps>(function A11yButton(
  { accessibilityLabel, accessibilityHint, hitSlop, accessibilityRole, ...rest },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      accessible
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={hitSlop ?? 8}
      {...rest}
    />
  );
});
