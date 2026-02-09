// =============================================================================
// BESPAREN - Premium Contractor Savings & Cost Management Dashboard
// =============================================================================
// Pro-grade fintech savings hub with hero card, actionable tips with
// Vasco reasoning, and intelligent price alerts
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { SmartPurchasing } from '../../src/components/contractor/SmartPurchasing';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';
import { useSavingsAggregation, useSavingsTimeline } from '../../src/services/savingsAggregatorService';
import { usePredictiveSavings } from '../../src/services/predictiveSavingsService';
import { hapticSuccess } from '../../src/utils/haptics';
import { recordScreenVisit } from '../../src/intelligence/learningStorage';

// P2: Cost tracking
import { useJobCostSummary } from '../../src/services/jobCostTrackingService';

type IconName = keyof typeof Ionicons.glyphMap;

// ============================================
// TYPES & DATA
// ============================================

interface PriceAlert {
  id: string;
  materialName: string;
  supplierName: string;
  type: 'price-drop' | 'bulk-opportunity' | 'sale-ending';
  currentPrice: number;
  previousPrice: number;
  savingsPercent: number;
  expiresIn?: string;
}

const MOCK_ALERTS: PriceAlert[] = [
  {
    id: 'alert_1',
    materialName: 'Dulux Trade Eggshell 5L',
    supplierName: 'Bouwmaat',
    type: 'price-drop',
    currentPrice: 23.40,
    previousPrice: 28.50,
    savingsPercent: 18,
    expiresIn: '12u',
  },
  {
    id: 'alert_2',
    materialName: 'Sigma S2U Allure 2.5L',
    supplierName: 'Verfwinkel',
    type: 'bulk-opportunity',
    currentPrice: 42.00,
    previousPrice: 45.00,
    savingsPercent: 7,
  },
];

function getAlertAccentColor(type: PriceAlert['type']): string {
  switch (type) {
    case 'price-drop': return SemanticColors.feedbackSuccess;
    case 'bulk-opportunity': return Palette.hermesOrange;
    case 'sale-ending': return SemanticColors.feedbackError;
  }
}

// Vasco reasoning explanations per tip type
const VASCO_REASONING: Record<string, string> = {
  'pred_1': 'Op basis van je bestelhistorie zie ik dat je materiaalkosten stijgen rond seizoenswisselingen. Door nu in te kopen bespaar je gemiddeld 12% op bulktarieven.',
  'pred_2': 'Je bestelt bij 3 verschillende leveranciers dezelfde categorieën. Door te consolideren naar vaste besteldagen kun je verzendkosten en tijd besparen.',
  'pred_3': 'Facturen die automatisch betaald worden binnen 14 dagen krijgen gemiddeld 2% korting. Dit bespaart je €180/jaar zonder extra moeite.',
  'pred_4': 'Ik vergelijk continu je materiaalkosten met marktprijzen. Momenteel zijn koppelingen en fittingen 8-15% goedkoper bij alternatieve leveranciers.',
  'pred_5': 'Je huidige contracttarieven zijn 6 maanden oud. Op basis van marktontwikkelingen kun je bij heronderhandeling betere voorwaarden krijgen.',
};

// ============================================
// MAIN SCREEN
// ============================================

// Circular Progress Ring
function SavingsRing({ current, goal, size = 120, strokeWidth = 10 }: { current: number; goal: number; size?: number; strokeWidth?: number }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const progress = Math.min(current / goal, 1);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // For RN, we approximate with a View-based ring
  const rotation = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: Palette.hermesOrange + '15',
      }} />
      {/* Progress ring - using overlapping half-circles */}
      <View style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: Palette.hermesOrange,
        borderTopColor: progress > 0.25 ? Palette.hermesOrange : 'transparent',
        borderRightColor: progress > 0.5 ? Palette.hermesOrange : 'transparent',
        borderBottomColor: progress > 0.75 ? Palette.hermesOrange : 'transparent',
        borderLeftColor: 'transparent',
        transform: [{ rotate: '-90deg' }],
      }} />
      {progress > 0 && progress <= 0.25 && (
        <View style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: 'transparent',
          borderTopColor: Palette.hermesOrange,
          transform: [{ rotate: `${-90 + progress * 360}deg` }],
        }} />
      )}
      {/* Center content */}
      <View style={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: Palette.hermesOrange, fontVariant: ['tabular-nums'] }}>
          {'\u20AC'}{current.toLocaleString('nl-NL')}
        </Text>
        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
          van {'\u20AC'}{goal.toLocaleString('nl-NL')}
        </Text>
      </View>
    </View>
  );
}

export default function BesparenScreen() {
  const router = useRouter();
  const [showFullPurchasing, setShowFullPurchasing] = useState(false);
  const [expandedTipId, setExpandedTipId] = useState<string | null>(null);
  const [actionedTips, setActionedTips] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const inlineInsight = useInlineInsight('contractor', 'savings', 'overview');

  // Screen visit tracking
  useEffect(() => { recordScreenVisit('savings'); }, []);

  // AI Cost-Saving Services
  const savings = useSavingsAggregation();
  const timeline = useSavingsTimeline();
  const predictive = usePredictiveSavings({ urgency: 'high' });
  const allPredictive = usePredictiveSavings();

  // P2: Cost tracking summary
  const costSummary = useJobCostSummary();

  const totalPotential = predictive.reduce((s, p) => s + p.potentialSaving, 0);
  const totalKansen = MOCK_ALERTS.length + allPredictive.length;

  // Sort tips by biggest saving impact first
  const sortedTips = [...allPredictive].sort((a, b) => b.potentialSaving - a.potentialSaving);

  // Monthly savings goal
  const monthlyGoal = 5000;
  const remaining = Math.max(0, monthlyGoal - savings.totalSavedThisMonth);

  // Month-over-month comparison
  const currentMonthAmount = timeline.length > 0 ? timeline[timeline.length - 1].amount : 0;
  const prevMonthAmount = timeline.length > 1 ? timeline[timeline.length - 2].amount : 0;
  const momDelta = prevMonthAmount > 0 ? Math.round(((currentMonthAmount - prevMonthAmount) / prevMonthAmount) * 100) : 0;
  const momColor = momDelta > 0 ? '#16A34A' : momDelta < 0 ? '#DC2626' : '#999';
  const momIcon = momDelta > 0 ? 'arrow-up' : momDelta < 0 ? 'arrow-down' : 'remove';

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      hapticSuccess();
    }, 800);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Besparen</Text>
        <Pressable
          style={styles.headerButton}
          onPress={() => setShowFullPurchasing(true)}
        >
          <Ionicons name="analytics" size={20} color={Palette.hermesOrange} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Palette.hermesOrange} />
        }
      >
        {/* ============================================ */}
        {/* 1. HERO SAVINGS CARD with Goal Ring          */}
        {/* ============================================ */}
        <View style={styles.heroCard}>
          <View style={styles.heroAccent} />
          <View style={styles.heroContent}>
            <View style={styles.heroMain}>
              <SavingsRing current={savings.totalSavedThisMonth} goal={monthlyGoal} />
              <Text style={styles.heroSubtitle}>deze maand bespaard</Text>
              {remaining > 0 && (
                <Text style={styles.heroRemaining}>
                  Nog {'\u20AC'}{remaining.toLocaleString('nl-NL')} te gaan
                </Text>
              )}
            </View>

            {/* Month-over-month comparison */}
            <View style={[styles.momStrip, { backgroundColor: momColor + '10' }]}>
              <Ionicons name={momIcon as IconName} size={12} color={momColor} />
              <Text style={[styles.momText, { color: momColor }]}>
                {momDelta > 0 ? '+' : ''}{momDelta}% vs vorige maand
              </Text>
            </View>

            <View style={styles.heroChips}>
              <View style={styles.heroChip}>
                <Ionicons name="bulb" size={13} color={Palette.hermesOrange} />
                <View>
                  <Text style={styles.heroChipValue}>{'\u20AC'}{totalPotential.toLocaleString('nl-NL')}</Text>
                  <Text style={styles.heroChipLabel}>Potentieel</Text>
                </View>
              </View>
              <View style={styles.heroChipDivider} />
              <View style={styles.heroChip}>
                <Ionicons name="notifications" size={13} color={SemanticColors.feedbackInfo} />
                <View>
                  <Text style={styles.heroChipValue}>{totalKansen}</Text>
                  <Text style={styles.heroChipLabel}>Kansen</Text>
                </View>
              </View>
              <View style={styles.heroChipDivider} />
              <View style={styles.heroChip}>
                <Ionicons name="trending-up" size={13} color={SemanticColors.feedbackSuccess} />
                <View>
                  <Text style={[styles.heroChipValue, { color: SemanticColors.feedbackSuccess }]}>+{savings.trendPercent}%</Text>
                  <Text style={styles.heroChipLabel}>Trend</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* 1b. MARGE-LEK DEZE MAAND (P2)              */}
        {/* ============================================ */}
        {costSummary.totalMarginLeakage > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Marge-lek deze maand</Text>
              <View style={[styles.alertBadge, { backgroundColor: '#DC262614' }]}>
                <Text style={[styles.alertBadgeText, { color: '#DC2626' }]}>
                  -{'\u20AC'}{costSummary.totalMarginLeakage.toLocaleString('nl-NL')}
                </Text>
              </View>
            </View>
            <View style={styles.marginLeakCard}>
              {costSummary.topVarianceReasons.map((reason, idx) => {
                const icons: Record<string, IconName> = {
                  uren: 'time',
                  materiaal: 'cube',
                  reistijd: 'car',
                  herwerk: 'refresh',
                  onvoorzien: 'alert-circle',
                };
                return (
                  <View key={reason.category} style={[
                    styles.marginLeakRow,
                    idx < costSummary.topVarianceReasons.length - 1 && styles.alertItemBorder,
                  ]}>
                    <View style={[styles.toolIcon, { backgroundColor: '#DC262610', width: 28, height: 28, borderRadius: 8 }]}>
                      <Ionicons name={icons[reason.category] || 'help-circle'} size={13} color="#DC2626" />
                    </View>
                    <Text style={styles.marginLeakCategory}>{reason.category.charAt(0).toUpperCase() + reason.category.slice(1)}</Text>
                    <Text style={styles.marginLeakAmount}>-{'\u20AC'}{reason.amount.toLocaleString('nl-NL')}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* 2. BESPAARTIPS VAN VASCO (actionable)       */}
        {/* ============================================ */}
        {(sortedTips.length > 0 || MOCK_ALERTS.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bespaartips van Vasco</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{sortedTips.length + MOCK_ALERTS.filter(a => !dismissedAlerts.has(a.id)).length} kansen</Text>
              </View>
            </View>
            <View style={styles.alertsList}>
              {sortedTips.slice(0, 3).map((tip, index) => {
                const isExpanded = expandedTipId === tip.id;
                return (
                  <View key={tip.id}>
                    <Pressable
                      style={[styles.alertItem, (!isExpanded && (index < Math.min(sortedTips.length, 3) - 1 || MOCK_ALERTS.some(a => !dismissedAlerts.has(a.id)))) && styles.alertItemBorder]}
                      onPress={() => setExpandedTipId(isExpanded ? null : tip.id)}
                    >
                      <View style={[styles.toolIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
                        <Ionicons name={tip.icon as IconName} size={20} color={Palette.hermesOrange} />
                      </View>
                      <View style={styles.toolContent}>
                        <Text style={styles.toolTitle} numberOfLines={1}>{tip.title}</Text>
                        <Text style={styles.toolDesc} numberOfLines={1}>{tip.description}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: SemanticColors.feedbackSuccess }}>{'\u20AC'}{tip.potentialSaving}</Text>
                        <Text style={{ fontSize: 10, color: SemanticColors.textTertiary }}>{tip.confidence}% zeker</Text>
                      </View>
                    </Pressable>

                    {/* Expanded detail with reasoning + action */}
                    {isExpanded && (
                      <View style={[styles.tipDetail, (index < Math.min(sortedTips.length, 3) - 1 || MOCK_ALERTS.some(a => !dismissedAlerts.has(a.id))) && styles.alertItemBorder]}>
                        <Text style={styles.tipDetailDesc}>{tip.description}</Text>

                        {/* Vasco reasoning */}
                        <View style={styles.tipReasoningBox}>
                          <View style={styles.tipReasoningHeader}>
                            <Ionicons name="sparkles" size={14} color={Palette.hermesOrange} />
                            <Text style={styles.tipReasoningTitle}>Waarom deze tip?</Text>
                          </View>
                          <Text style={styles.tipReasoningText}>
                            {VASCO_REASONING[tip.id] || 'Vasco analyseert je uitgavenpatronen en marktprijzen om besparingskansen te identificeren.'}
                          </Text>
                        </View>

                        {/* Stats row */}
                        <View style={styles.tipStatsRow}>
                          <View style={styles.tipStat}>
                            <Text style={styles.tipStatValue}>{'\u20AC'}{tip.potentialSaving}</Text>
                            <Text style={styles.tipStatLabel}>Besparing</Text>
                          </View>
                          <View style={styles.tipStatDivider} />
                          <View style={styles.tipStat}>
                            <Text style={styles.tipStatValue}>{tip.confidence}%</Text>
                            <Text style={styles.tipStatLabel}>Betrouwbaar</Text>
                          </View>
                          <View style={styles.tipStatDivider} />
                          <View style={styles.tipStat}>
                            <Text style={styles.tipStatValue}>{tip.timeframe}</Text>
                            <Text style={styles.tipStatLabel}>Termijn</Text>
                          </View>
                        </View>

                        {/* Action button */}
                        {actionedTips.has(tip.id) ? (
                          <View style={[styles.tipActionButton, { backgroundColor: '#16A34A' }]}>
                            <Ionicons name="checkmark-done" size={18} color="#fff" />
                            <Text style={styles.tipActionText}>Ingepland</Text>
                          </View>
                        ) : (
                          <Pressable
                            style={styles.tipActionButton}
                            onPress={() => {
                              setActionedTips(prev => new Set(prev).add(tip.id));
                              setExpandedTipId(null);
                              Alert.alert('Actie ingepland', `"${tip.actionLabel}" is ingepland. Vasco houdt de voortgang bij.`);
                            }}
                          >
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                            <Text style={styles.tipActionText} numberOfLines={1}>{tip.actionLabel}</Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Price alerts merged into tips */}
              {MOCK_ALERTS.filter(a => !dismissedAlerts.has(a.id)).map((alert, index, arr) => (
                <View
                  key={alert.id}
                  style={[styles.alertItem, index < arr.length - 1 && styles.alertItemBorder]}
                >
                  <View style={[styles.toolIcon, { backgroundColor: getAlertAccentColor(alert.type) + '15' }]}>
                    <Ionicons name="pricetag" size={18} color={getAlertAccentColor(alert.type)} />
                  </View>
                  <View style={styles.toolContent}>
                    <Text style={styles.toolTitle} numberOfLines={1}>{alert.materialName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Text style={styles.toolDesc}>{alert.supplierName}</Text>
                      <View style={[styles.alertSavingsPill, { backgroundColor: getAlertAccentColor(alert.type) + '18' }]}>
                        <Ionicons name="arrow-down" size={10} color={getAlertAccentColor(alert.type)} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: getAlertAccentColor(alert.type) }}>{alert.savingsPercent}%</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Pressable
                      style={styles.alertInlineCTA}
                      onPress={() => {
                        setDismissedAlerts(prev => new Set(prev).add(alert.id));
                        Alert.alert('Besteld', `${alert.materialName} toegevoegd aan je bestelling.`);
                      }}
                    >
                      <Text style={styles.alertInlineCTAText} numberOfLines={1}>Bestel nu</Text>
                    </Pressable>
                    <Pressable onPress={() => Alert.alert('Prijsalert', `Alert ingesteld voor ${alert.materialName}. Je krijgt bericht als de prijs verder daalt.`)}>
                      <Text style={styles.alertInlineLink} numberOfLines={1}>Alert instellen</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* 3. INLINE INSIGHT                            */}
        {/* ============================================ */}
        {inlineInsight && (
          <InlineInsight
            icon={inlineInsight.icon as IconName}
            message={inlineInsight.message}
            actionLabel={inlineInsight.actionLabel}
            actionRoute={inlineInsight.actionRoute}
          />
        )}

        {/* ============================================ */}
        {/* 4. INKOOP                                    */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inkoop</Text>
          <Pressable
            style={styles.inkoopButton}
            onPress={() => router.push('/contractor/inkoop' as any)}
          >
            <Ionicons name="storefront" size={22} color="#fff" />
            <Text style={styles.inkoopButtonText} numberOfLines={1}>Inkoop beheren</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" style={{ marginLeft: 'auto' }} />
          </Pressable>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Full Purchasing Modal */}
      <Modal
        visible={showFullPurchasing}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SmartPurchasing onClose={() => setShowFullPurchasing(false)} />
      </Modal>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.salmonLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Palette.hermesOrange + '0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SafeArea.content,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },

  // ============================================
  // HERO SAVINGS CARD
  // ============================================
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heroAccent: {
    height: 4,
    backgroundColor: Palette.hermesOrange,
  },
  heroContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  heroMain: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: Palette.hermesOrange,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as any,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  heroRemaining: {
    fontSize: 12,
    color: '#BBB',
    marginTop: 2,
  },
  momStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  momText: {
    fontSize: 13,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums'] as any,
  },
  heroChips: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  heroChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  heroChipDivider: {
    width: 1,
    height: 28,
    backgroundColor: SemanticColors.borderDefault,
  },
  heroChipValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  heroChipLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ============================================
  // SECTIONS
  // ============================================
  section: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertBadge: {
    backgroundColor: Palette.hermesOrange + '12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // ============================================
  // ALERTS LIST (shared container)
  // ============================================
  alertsList: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  alertItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderMuted,
  },

  // ============================================
  // TIP EXPANDED DETAIL
  // ============================================
  tipDetail: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tipDetailDesc: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  tipReasoningBox: {
    backgroundColor: Palette.hermesOrange + '08',
    borderRadius: 10,
    padding: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Palette.hermesOrange,
    gap: 6,
  },
  tipReasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipReasoningTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Palette.hermesOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tipReasoningText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
  },
  tipStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
  },
  tipStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  tipStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
  },
  tipStatLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
  },
  tipStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: SemanticColors.borderDefault,
  },
  tipActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    paddingVertical: 12,
  },
  tipActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },

  // ============================================
  // ALERT INLINE CTAs (merged into tips)
  // ============================================
  alertSavingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alertInlineCTA: {
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  alertInlineCTAText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  alertInlineLink: {
    fontSize: 10,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },

  // ============================================
  // INKOOP BUTTON
  // ============================================
  inkoopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#D2691E',
    borderRadius: 14,
    padding: Spacing.md,
    paddingVertical: 16,
  },
  inkoopButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // ============================================
  // SHARED ROW STYLES (for lists)
  // ============================================
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolContent: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  toolDesc: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 1,
  },

  // Marge-lek (P2)
  marginLeakCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  marginLeakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.xs,
  },
  marginLeakCategory: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  marginLeakAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    fontVariant: ['tabular-nums'] as any,
  },

});
