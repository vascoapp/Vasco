/**
 * DemoBanner — subtle indicator shown at the top of the app when running in demo mode.
 * Renders nothing when DEMO_MODE is false.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DEMO_MODE } from '../../config/demo';
import { Palette } from '../../theme/colors';

export function DemoBanner() {
  if (!DEMO_MODE) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Demo Mode</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Palette.hermesOrange + '18',
    paddingVertical: 3,
    alignItems: 'center',
    zIndex: 999,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Palette.hermesOrange,
    letterSpacing: 0.5,
  },
});
