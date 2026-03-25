// =============================================================================
// OFFLINE BANNER — Shows when device is offline or in demo mode
// =============================================================================

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import { isSupabaseConfigured } from '../../lib/supabase';

/** Lightweight network check — no external dependency needed */
function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Use fetch to a known endpoint as a connectivity check
    let mounted = true;
    const check = async () => {
      try {
        // Use a lightweight HEAD request — Google's generate_204 is standard for connectivity checks
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (mounted) setIsConnected(true);
      } catch {
        if (mounted) setIsConnected(false);
      }
    };

    check();
    const interval = setInterval(check, 30000); // Check every 30s
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return isConnected;
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const isConnected = useNetworkStatus();

  // Demo mode banner
  if (!isSupabaseConfigured) {
    return (
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={13} color={SemanticColors.feedbackWarning} />
        <Text style={styles.text}>{t('common.demoMode', 'Demo mode — data saved locally')}</Text>
      </View>
    );
  }

  // Network offline banner
  if (!isConnected) {
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <Ionicons name="wifi-outline" size={13} color="#fff" />
        <Text style={[styles.text, styles.offlineText]}>{t('common.offline', 'No connection — changes saved locally')}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    height: 28,
    backgroundColor: SemanticColors.feedbackWarningBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  offlineBanner: {
    backgroundColor: SemanticColors.feedbackError,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.feedbackWarning,
  },
  offlineText: {
    color: '#fff',
  },
});
