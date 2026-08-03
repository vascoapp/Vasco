/**
 * DemoBanner — subtle indicator shown at the top of the app when running in demo mode.
 * Renders nothing when DEMO_MODE is false.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { DEMO_MODE } from '../../config/demo';
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

export function DemoBanner() {
  if (!DEMO_MODE) return null;

  return (
    // The outer fill matters as much as the padding: the banner tint is only
    // ~9% opaque, and the window background behind the status bar is white, so
    // an unfilled strip rendered as a bright cream band above a near-black app.
    <View style={styles.inset}>
      <View style={styles.banner}>
        <Text style={styles.text}>Demo Mode</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inset: {
    paddingTop: TOP_INSET,
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
