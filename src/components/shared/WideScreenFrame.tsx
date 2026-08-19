// =============================================================================
// WideScreenFrame — one centred column on a screen wider than a phone
// =============================================================================
// `ios.supportsTablet` is true, so the app runs at iPad point size rather than
// as a scaled-up phone. Nothing in this codebase branches on width, so every
// screen rendered edge to edge at 1194pt: two KPI cards ~590pt wide holding a
// single number each, action rows whose button sat a full screen-width from
// its own label, tab-bar icons adrift.
//
// This is NOT an iPad layout. A real one is master-detail, a sidebar, more
// than one column — a redesign across 79 screens, for a device no user has
// asked for yet. This is the cheap, honest thing instead: hold the app at a
// phone-shaped measure and centre it, which is what most mobile-first apps do
// on a tablet and reads as deliberate rather than broken.
//
// Deliberately dumb, for three reasons:
//   · `useWindowDimensions` (not a module-level `Dimensions.get`) so it stays
//     correct through rotation and Split View resizes. Five module-level
//     snapshots elsewhere in the codebase do NOT — see memory/ipad-tablet-
//     support.md. They are harmless while rotation is locked, and this
//     component must not become the sixth.
//   · Below the breakpoint it renders `children` with no wrapper View at all,
//     so on every phone the tree is byte-for-byte what it was. A regression
//     here would hit 100% of real users to serve 0% of them.
//   · The gutters are the page background, not a distinct colour. The app
//     should look like it is sitting on the screen, not framed by a chrome
//     someone has to explain.
// =============================================================================

import type { ReactNode } from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { DK } from '../../theme/draftkings';

/**
 * Widest the app is allowed to get. 820 is a little over an iPad Pro 11"
 * portrait half (834) — wide enough that iPad portrait is essentially
 * unchanged and only genuinely wide canvases (landscape, 13") get gutters.
 */
export const WIDE_SCREEN_MAX_WIDTH = 820;

export function WideScreenFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();

  // No wrapper at all on a phone — see header.
  if (width <= WIDE_SCREEN_MAX_WIDTH) return <>{children}</>;

  return (
    <View style={styles.gutter}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  gutter: {
    flex: 1,
    backgroundColor: DK.colors.bg,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: WIDE_SCREEN_MAX_WIDTH,
  },
});
