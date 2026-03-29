// =============================================================================
// OFFLINE BANNER — Shows connectivity status, queue size, and sync progress
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../theme/colors';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOnline, syncStatus, queueSize } = useNetworkStatus();
  const spinAnim = useRef(new Animated.Value(0)).current;

  // Spin animation for sync icon
  useEffect(() => {
    if (syncStatus === 'syncing') {
      const loop = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [syncStatus, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Demo mode banner
  if (!isSupabaseConfigured) {
    return (
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={13} color={SemanticColors.feedbackWarning} />
        <Text style={styles.text}>{t('common.demoMode', 'Demo mode — data saved locally')}</Text>
      </View>
    );
  }

  // Syncing state — processing queued actions
  if (syncStatus === 'syncing') {
    return (
      <View style={[styles.banner, styles.syncingBanner]}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Ionicons name="sync-outline" size={13} color={Palette.white} />
        </Animated.View>
        <Text style={[styles.text, styles.syncingText]}>
          {t('common.syncing', 'Syncing {{count}} changes...', { count: queueSize })}
        </Text>
      </View>
    );
  }

  // Just finished syncing — brief confirmation
  if (syncStatus === 'synced') {
    return (
      <View style={[styles.banner, styles.syncedBanner]}>
        <Ionicons name="checkmark-circle-outline" size={13} color={SemanticColors.feedbackSuccess} />
        <Text style={[styles.text, styles.syncedText]}>
          {t('common.allSynced', 'All changes synced')}
        </Text>
      </View>
    );
  }

  // Sync error — some actions failed
  if (syncStatus === 'error') {
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <Ionicons name="alert-circle-outline" size={13} color={Palette.white} />
        <Text style={[styles.text, styles.offlineText]}>
          {t('common.syncError', 'Sync error — {{count}} pending', { count: queueSize })}
        </Text>
      </View>
    );
  }

  // Network offline banner with queue count
  if (!isOnline) {
    const message = queueSize > 0
      ? t('common.offlineQueued', 'Offline — {{count}} changes queued', { count: queueSize })
      : t('common.offline', 'No connection — changes saved locally');
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <Ionicons name="wifi-outline" size={13} color={Palette.white} />
        <Text style={[styles.text, styles.offlineText]}>{message}</Text>
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
  syncingBanner: {
    backgroundColor: SemanticColors.feedbackInfo,
  },
  syncedBanner: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: SemanticColors.feedbackWarning,
  },
  offlineText: {
    color: Palette.white,
  },
  syncingText: {
    color: Palette.white,
  },
  syncedText: {
    color: SemanticColors.feedbackSuccess,
  },
});
