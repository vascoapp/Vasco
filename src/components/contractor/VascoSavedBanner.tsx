// =============================================================================
// VASCO SAVED BANNER — Instacart-style "saved you X" notification
// =============================================================================
// Animated banner that shows cumulative time & money savings.
// Slides in on dashboard load → tap to expand breakdown → auto-collapses.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { TYPE, RADIUS, GRID } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { useSavingsAggregation } from '../../services/savingsAggregatorService';
import { useROIDashboard } from '../../services/roiMetricsService';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../i18n/formatting';
import AsyncStorage from '@react-native-async-storage/async-storage';

type IconName = keyof typeof Ionicons.glyphMap;

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const DISMISS_KEY = '@vasco_saved_banner_dismissed';
const LAST_SHOWN_KEY = '@vasco_saved_banner_last_shown';
const SHOW_INTERVAL_MS = 4 * 60 * 60 * 1000; // Show at most every 4 hours

const CATEGORY_ICONS: Record<string, { icon: IconName; color: string }> = {
  time: { icon: 'time', color: '#8B5CF6' },
  purchasing: { icon: 'cart', color: SemanticColors.feedbackSuccess },
  'faster-payments': { icon: 'cash', color: SemanticColors.feedbackInfo },
  conversion: { icon: 'trending-up', color: Palette.hermesOrange },
  audit: { icon: 'shield-checkmark', color: SemanticColors.feedbackWarning },
  materials: { icon: 'construct', color: '#EC4899' },
};

interface VascoSavedBannerProps {
  onViewDetails?: () => void;
}

export function VascoSavedBanner({ onViewDetails }: VascoSavedBannerProps) {
  const { t } = useTranslation();
  const savings = useSavingsAggregation();
  const dashboard = useROIDashboard();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Check if we should show the banner (rate-limited)
  useEffect(() => {
    (async () => {
      try {
        const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
        const now = Date.now();
        if (lastShown && now - parseInt(lastShown, 10) < SHOW_INTERVAL_MS) return;

        // Only show if there are meaningful savings
        if (savings.totalSavedThisMonth < 50) return;

        await AsyncStorage.setItem(LAST_SHOWN_KEY, String(now));
        setVisible(true);
      } catch {}
    })();
  }, [savings.totalSavedThisMonth]);

  // Slide-in animation
  useEffect(() => {
    if (!visible) return;

    // Delay entrance by 800ms so dashboard loads first
    const timer = setTimeout(() => {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 160,
      }).start();

      // Animate the progress bar
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1200,
        delay: 300,
        useNativeDriver: false,
      }).start();
    }, 800);

    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }, [slideAnim]);

  const handleToggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  if (!visible || !dashboard) return null;

  const hours = dashboard.hoursSavedThisMonth;
  const money = savings.totalSavedThisMonth;
  const topCategories = savings.breakdown
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const opacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  // Monthly target progress (€5,000/month savings goal)
  const monthlyTarget = 5000;
  const progressPct = Math.min(money / monthlyTarget, 1);
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${Math.round(progressPct * 100)}%`],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      {/* Main banner — always visible */}
      <Pressable style={styles.bannerContent} onPress={handleToggleExpand}>
        {/* Left: shield icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="rocket" size={22} color={Palette.white} />
        </View>

        {/* Center: headline */}
        <View style={styles.textContent}>
          <Text style={styles.headline}>
            {t('savings.banner.headline', {
              defaultValue: 'Vasco saved you {{hours}}h + {{money}}',
              hours: hours.toFixed(1),
              money: formatCurrency(money),
            })}
          </Text>
          <Text style={styles.subline}>
            {t('savings.banner.subline', {
              defaultValue: 'This month · {{trend}}% vs last month',
              trend: savings.trendPercent > 0 ? `+${savings.trendPercent}` : String(savings.trendPercent),
            })}
          </Text>
        </View>

        {/* Right: expand arrow + dismiss */}
        <View style={styles.actions}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Palette.white + 'CC'}
          />
        </View>
      </Pressable>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth as any }]} />
      </View>

      {/* Expanded breakdown */}
      {expanded && (
        <View style={styles.breakdownSection}>
          {topCategories.map((cat) => {
            const iconCfg = CATEGORY_ICONS[cat.id] || { icon: 'ellipsis-horizontal' as IconName, color: SemanticColors.textSecondary };
            return (
              <View key={cat.id} style={styles.breakdownRow}>
                <View style={[styles.breakdownDot, { backgroundColor: iconCfg.color }]} />
                <Ionicons name={iconCfg.icon} size={14} color={Palette.white + 'CC'} />
                <Text style={styles.breakdownLabel} numberOfLines={1}>{cat.label}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(cat.amount)}</Text>
                {cat.trend === 'up' && (
                  <View style={styles.trendBadge}>
                    <Ionicons name="arrow-up" size={10} color={SemanticColors.feedbackSuccess} />
                    <Text style={styles.trendText}>{cat.trendPercent}%</Text>
                  </View>
                )}
              </View>
            );
          })}

          {/* CTA row */}
          <View style={styles.ctaRow}>
            <Pressable style={styles.detailsButton} onPress={onViewDetails}>
              <Text style={styles.detailsButtonText}>
                {t('savings.banner.viewDetails', 'View full breakdown')}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={Palette.white} />
            </Pressable>
            <Pressable style={styles.dismissButton} onPress={handleDismiss} hitSlop={8}>
              <Ionicons name="close" size={16} color={Palette.white + '99'} />
            </Pressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: Palette.hermesOrange,
    overflow: 'hidden',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Palette.white + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContent: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  subline: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.white + 'CC',
  },
  actions: {
    paddingLeft: Spacing.xs,
  },
  // Progress bar
  progressTrack: {
    height: 3,
    backgroundColor: Palette.white + '20',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: 2,
  },
  progressFill: {
    height: 3,
    backgroundColor: Palette.white + '90',
    borderRadius: 2,
  },
  // Breakdown
  breakdownSection: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Palette.white + '15',
    paddingTop: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.white + 'DD',
  },
  breakdownAmount: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Palette.white + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendText: {
    fontSize: TYPE.tinySize,
    fontFamily: TYPE.labelFamily,
    color: SemanticColors.feedbackSuccess,
  },
  // CTA
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.white + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  detailsButtonText: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.white + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
