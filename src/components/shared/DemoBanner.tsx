/**
 * DemoBanner — subtle indicator shown at the top of the app when running in demo mode.
 * Renders nothing when DEMO_MODE is false.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { DEMO_MODE } from '../../config/demo';
import { Palette } from '../../theme/colors';
import { DK } from '../../theme/draftkings';

// Android targets API 35+, where the window is edge-to-edge and content starts
// at y=0 — behind the status bar. This banner is the root's first child (it
// sits outside RootLayoutNav, so there is no SafeAreaProvider above it and
// useSafeAreaInsets is unavailable here), which put "Demo Mode" directly on
// top of the clock and battery icons.
//
// StatusBar.currentHeight is the provider-free way to get that inset. iOS is
// left at 0: the banner already lands below the notch there, and adding an
// inset would push it into the middle of the screen.
const TOP_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0;

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
