// =============================================================================
// OFFLINE BANNER — Shows when Supabase is not configured (local/demo mode)
// =============================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SemanticColors } from '../../theme/colors';
import { isSupabaseConfigured } from '../../lib/supabase';

export function OfflineBanner() {
  if (isSupabaseConfigured) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline modus — gegevens worden lokaal opgeslagen</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 28,
    backgroundColor: SemanticColors.feedbackWarningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.feedbackWarning,
  },
});
