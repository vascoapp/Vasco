/**
 * DemoBanner — subtle indicator shown at the top of the app when running in demo mode.
 * Renders nothing when DEMO_MODE is false.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { DEMO_MODE, SCREENSHOT_MODE } from '../../config/demo';
import { Palette } from '../../theme/colors';
import { DK } from '../../theme/draftkings';

// This banner is the root's first child — it sits outside RootLayoutNav, so
// there is no SafeAreaProvider above it and useSafeAreaInsets is unavailable
// here. Both platforms start content at y=0 (Android is edge-to-edge from API
// 35+; iOS draws under the notch), so without an inset "Demo Mode" renders
// inside the status-bar band, level with the clock and battery.
//
// I originally set iOS to 0 on the assumption that the banner "already lands
// below the notch there". Walking it on the simulator disproved that: the
// banner drew at y≈27, inside the status bar. Assumption corrected by looking
// at it.
//
// `initialWindowMetrics` is the provider-free inset source — it is captured at
// app start and needs no SafeAreaProvider, which is exactly this case.
// StatusBar.currentHeight covers Android, where initialWindowMetrics can be 0
// before the first layout pass.
const TOP_INSET =
  Platform.OS === 'android'
    ? StatusBar.currentHeight ?? 24
    : initialWindowMetrics?.insets.top ?? 47;

// 11pt line + 3pt padding top and bottom.
const BANNER_HEIGHT = 17;

// Sit in the LAST band of the inset rather than below it. The inset region is
// blank on every screen (that is what makes it safe area), so the banner costs
// nothing there — whereas hanging below it clipped the first line of content.
// Not above it either: that is where the Dynamic Island is, and the text would
// disappear behind the pill.
const BANNER_TOP = Math.max(TOP_INSET - BANNER_HEIGHT, 0);

export function DemoBanner() {
  // SCREENSHOT_MODE keeps the fixtures and drops the strip — see the note on
  // the flag. It is never set in a shipping profile.
  if (!DEMO_MODE || SCREENSHOT_MODE) return null;

  return (
    // OVERLAY, not a layout row. As a flex child this banner occupied
    // TOP_INSET + its own height at the top of every screen, and the screen
    // below it then applied the top inset AGAIN — so demo mode rendered with a
    // tall black band that production never has. That is worse than ugly: it
    // means every screen I walk on the simulator is laid out differently from
    // the one a real user sees. Absolute keeps demo and production pixel-identical.
    //
    // pointerEvents none so it never eats a tap meant for the header beneath it.
    <View style={styles.inset} pointerEvents="none">
      {/* The fill matters as much as the padding: the banner tint is only ~9%
          opaque, and the window background behind the status bar is white, so
          an unfilled strip rendered as a bright cream band above a near-black app. */}
      <View style={styles.banner}>
        <Text style={styles.text}>Demo Mode</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inset: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: BANNER_TOP,
    backgroundColor: DK.colors.bg,
    zIndex: 999,
  },
  banner: {
    backgroundColor: Palette.hermesOrange + '18',
    paddingVertical: 3,
    alignItems: 'center',
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.hermesOrange,
    letterSpacing: 0.5,
  },
});
