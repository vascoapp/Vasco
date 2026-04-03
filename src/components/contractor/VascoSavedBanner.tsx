// =============================================================================
// VASCO SAVED BANNER — Instacart-style "saved you X" notification
// =============================================================================
// Clean, minimal banner: one hero number, tap to see breakdown.
// Slides in after dashboard loads → dismissable → rate-limited.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, SemanticColors } from '../../theme/colors';
import { TYPE, RADIUS } from '../../theme/tabStyles';
import { Spacing } from '../../theme/spacing';
import { useSavingsAggregation } from '../../services/savingsAggregatorService';
import { useROIDashboard } from '../../services/roiMetricsService';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../i18n/formatting';
import AsyncStorage from '@react-native-async-storage/async-storage';

type IconName = keyof typeof Ionicons.glyphMap;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAST_SHOWN_KEY = '@vasco_saved_banner_last_shown';
const SHOW_INTERVAL_MS = 4 * 60 * 60 * 1000;

const CATEGORY_ICONS: Record<string, IconName> = {
  time: 'time',
  purchasing: 'cart',
  'faster-payments': 'cash',
  conversion: 'trending-up',
  audit: 'shield-checkmark',
  materials: 'construct',
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

  useEffect(() => {
    (async () => {
      try {
        const lastShown = await AsyncStorage.getItem(LAST_SHOWN_KEY);
        const now = Date.now();
        if (lastShown && now - parseInt(lastShown, 10) < SHOW_INTERVAL_MS) return;
        if (savings.totalSavedThisMonth < 50) return;
        await AsyncStorage.setItem(LAST_SHOWN_KEY, String(now));
        setVisible(true);
      } catch {}
    })();
  }, [savings.totalSavedThisMonth]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 20,
        stiffness: 180,
      }).start();
    }, 600);
    return () => clearTimeout(timer);
  }, [visible]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
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
    .slice(0, 3);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 0],
  });
  const opacity = slideAnim;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <Pressable style={styles.banner} onPress={handleToggleExpand}>
        {/* Hero number */}
        <View style={styles.heroRow}>
          <Ionicons name="sparkles" size={16} color={Palette.white} />
          <Text style={styles.heroText}>
            {t('savings.banner.hero', {
              defaultValue: 'Vasco saved you {{hours}}h and {{money}} this month',
              hours: hours.toFixed(1),
              money: formatCurrency(money),
            })}
          </Text>
          <Pressable onPress={handleDismiss} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={14} color={Palette.white + '80'} />
          </Pressable>
        </View>

        {/* Trend line */}
        {savings.trendPercent > 0 && (
          <View style={styles.trendRow}>
            <Ionicons name="arrow-up" size={11} color={Palette.white + 'CC'} />
            <Text style={styles.trendText}>
              {t('savings.banner.trend', {
                defaultValue: '{{percent}}% more than last month',
                percent: savings.trendPercent,
              })}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Expanded: top 3 categories */}
      {expanded && (
        <View style={styles.breakdown}>
          {topCategories.map((cat) => (
            <View key={cat.id} style={styles.breakdownRow}>
              <Ionicons
                name={CATEGORY_ICONS[cat.id] || 'ellipsis-horizontal'}
                size={13}
                color={Palette.white + 'BB'}
              />
              <Text style={styles.breakdownLabel} numberOfLines={1}>{cat.label}</Text>
              <Text style={styles.breakdownAmount}>{formatCurrency(cat.amount)}</Text>
            </View>
          ))}
          {onViewDetails && (
            <Pressable style={styles.detailsBtn} onPress={onViewDetails}>
              <Text style={styles.detailsBtnText}>
                {t('savings.banner.viewDetails', 'View breakdown')}
              </Text>
              <Ionicons name="arrow-forward" size={12} color={Palette.white} />
            </Pressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: RADIUS.md,
    backgroundColor: Palette.hermesOrange,
    overflow: 'hidden',
  },
  banner: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 4,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroText: {
    flex: 1,
    fontSize: TYPE.bodySize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 24,
  },
  trendText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.labelFamily,
    color: Palette.white + 'BB',
  },
  // Breakdown
  breakdown: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Palette.white + '25',
    paddingTop: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.bodyFamily,
    color: Palette.white + 'DD',
  },
  breakdownAmount: {
    fontSize: TYPE.captionSize,
    fontFamily: TYPE.sectionFamily,
    color: Palette.white,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
    backgroundColor: Palette.white + '18',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  detailsBtnText: {
    fontSize: TYPE.labelSize,
    fontFamily: TYPE.titleFamily,
    color: Palette.white,
  },
});
