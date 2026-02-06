// =============================================================================
// BESPAREN - Premium Contractor Savings & Cost Management Dashboard
// =============================================================================
// Pro-grade fintech savings hub with hero card, visual breakdowns,
// and intelligent price alerts
// =============================================================================

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing } from '../../src/theme/spacing';
import { SmartPurchasing } from '../../src/components/contractor/SmartPurchasing';
import { ReceiptScanner } from '../../src/components/contractor/ReceiptScanner';
import { InlineInsight } from '../../src/components/shared/VascoInsightCard';
import { ReasoningMode, useReasoningMode } from '../../src/components/shared/ReasoningMode';
import { useInlineInsight } from '../../src/services/vascoGuidanceService';
import { useSavingsAggregation, useSavingsTimeline } from '../../src/services/savingsAggregatorService';
import { usePredictiveSavings } from '../../src/services/predictiveSavingsService';
import { useSupplierNegotiation } from '../../src/services/supplierNegotiationService';
import { useTCOSummary } from '../../src/services/tcoCalculatorService';

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

interface ToolItem {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  route?: string;
  onPress?: () => void;
  color: string;
  stat?: string;
}

// ============================================
// MAIN SCREEN
// ============================================

export default function BesparenScreen() {
  const router = useRouter();
  const [showFullPurchasing, setShowFullPurchasing] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const inlineInsight = useInlineInsight('contractor', 'savings', 'overview');

  // AI Cost-Saving Services
  const savings = useSavingsAggregation();
  const predictive = usePredictiveSavings({ urgency: 'high' });
  const allPredictive = usePredictiveSavings();
  const negotiation = useSupplierNegotiation();
  const tco = useTCOSummary();
  const timeline = useSavingsTimeline();

  // AI Reasoning
  const savingsReasoning = useReasoningMode('savings_total');
  const potentialReasoning = useReasoningMode('savings_potential');

  const totalPotential = predictive.reduce((s, p) => s + p.potentialSaving, 0);
  const totalKansen = MOCK_ALERTS.length + allPredictive.length;

  const savingsTools: ToolItem[] = [
    {
      id: 'scan',
      icon: 'camera',
      title: 'Bon Scanner',
      description: 'Scan bonnen voor administratie',
      onPress: () => setShowReceiptScanner(true),
      color: SemanticColors.feedbackSuccess,
    },
    {
      id: 'suppliers',
      icon: 'storefront',
      title: 'Leveranciers',
      description: 'Beheer & vergelijk leveranciers',
      route: '/contractor/purchasing',
      color: SemanticColors.feedbackInfo,
    },
    {
      id: 'reorder',
      icon: 'refresh-circle',
      title: 'Herbestellen',
      description: 'Slim herbestellen',
      route: '/contractor/reorder',
      color: '#3B82F6',
    },
    {
      id: 'benchmark',
      icon: 'analytics',
      title: 'Benchmarking',
      description: 'Vergelijk kosten',
      route: '/contractor/benchmark',
      color: '#8B5CF6',
    },
  ];


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Besparen</Text>
        <Pressable
          style={styles.headerButton}
          onPress={() => setShowFullPurchasing(true)}
        >
          <Ionicons name="analytics" size={20} color={SemanticColors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================ */}
        {/* 1. HERO SAVINGS CARD                        */}
        {/* ============================================ */}
        <View style={styles.heroCard}>
          <View style={styles.heroAccent} />
          <View style={styles.heroContent}>
            <View style={styles.heroMain}>
              <Text style={styles.heroAmount}>
                {'\u20AC'}{savings.totalSavedThisMonth.toLocaleString('nl-NL')}
              </Text>
              <Text style={styles.heroSubtitle}>deze maand bespaard</Text>
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

        {/* Reasoning chips */}
        <View style={styles.reasoningRow}>
          <ReasoningMode reasoning={savingsReasoning} label="Waarom deze besparing?" />
          <ReasoningMode reasoning={potentialReasoning} label="Potentieel?" variant="chip" />
        </View>

        {/* ============================================ */}
        {/* 6. INLINE INSIGHT (moved up)                */}
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
        {/* 2. UPGRADED PRICE ALERTS                    */}
        {/* ============================================ */}
        {MOCK_ALERTS.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Prijsalerts</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{MOCK_ALERTS.length} actief</Text>
              </View>
            </View>
            <View style={styles.alertsList}>
              {MOCK_ALERTS.map((alert, index) => (
                <View
                  key={alert.id}
                  style={[
                    styles.alertItemUpgraded,
                    index < MOCK_ALERTS.length - 1 && styles.alertItemBorder,
                  ]}
                >
                  {/* Colored left accent */}
                  <View style={[styles.alertLeftAccent, { backgroundColor: getAlertAccentColor(alert.type) }]} />
                  <View style={styles.alertContentUpgraded}>
                    <View style={styles.alertTop}>
                      <Text style={styles.alertMaterial} numberOfLines={1}>{alert.materialName}</Text>
                      {/* Prominent savings badge */}
                      <View style={[styles.alertSavingsBadge, { backgroundColor: getAlertAccentColor(alert.type) + '18' }]}>
                        <Ionicons name="arrow-down" size={14} color={getAlertAccentColor(alert.type)} />
                        <Text style={[styles.alertSavingsBadgeText, { color: getAlertAccentColor(alert.type) }]}>{alert.savingsPercent}%</Text>
                      </View>
                    </View>
                    <Text style={styles.alertSupplier}>{alert.supplierName}</Text>
                    <View style={styles.alertPrices}>
                      <Text style={styles.alertCurrentPrice}>{'\u20AC'}{alert.currentPrice.toFixed(2)}</Text>
                      <Text style={styles.alertOldPrice}>{'\u20AC'}{alert.previousPrice.toFixed(2)}</Text>
                      {alert.expiresIn && (
                        <View style={styles.alertExpiry}>
                          <Ionicons name="time-outline" size={10} color={SemanticColors.feedbackWarning} />
                          <Text style={styles.alertExpiryText}>{alert.expiresIn}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {/* CTA button */}
                  <Pressable
                    style={styles.alertCTAButton}
                    onPress={() => Alert.alert(
                      'Toevoegen aan winkelwagen',
                      `${alert.materialName} van ${alert.supplierName} voor \u20AC${alert.currentPrice.toFixed(2)}?`,
                      [
                        { text: 'Annuleren', style: 'cancel' },
                        { text: 'Toevoegen', onPress: () => Alert.alert('Toegevoegd', `${alert.materialName} is toegevoegd aan je winkelwagen.`) },
                      ]
                    )}
                  >
                    <Ionicons name="cart" size={14} color="#fff" />
                    <Text style={styles.alertCTAText}>Bestel nu</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ============================================ */}
        {/* 3. SAVINGS BREAKDOWN BAR                    */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Waar je bespaart</Text>
          <View style={[styles.alertsList, { padding: Spacing.md }]}>
            {/* Stacked horizontal bar */}
            <View style={styles.breakdownBar}>
              <View style={{ flex: 45, backgroundColor: SemanticColors.feedbackSuccess }} />
              <View style={{ flex: 25, backgroundColor: Palette.hermesOrange }} />
              <View style={{ flex: 20, backgroundColor: SemanticColors.feedbackInfo }} />
              <View style={{ flex: 10, backgroundColor: '#8B5CF6' }} />
            </View>
            {/* Legend */}
            {([
              { label: 'Materialen', amount: '\u20AC1.840', percent: '45%', color: SemanticColors.feedbackSuccess },
              { label: 'Leveranciers', amount: '\u20AC1.020', percent: '25%', color: Palette.hermesOrange },
              { label: 'Effici\u00EBntie', amount: '\u20AC820', percent: '20%', color: SemanticColors.feedbackInfo },
              { label: 'Overig', amount: '\u20AC410', percent: '10%', color: '#8B5CF6' },
            ] as const).map((item) => (
              <View key={item.label} style={styles.breakdownLegendRow}>
                <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownAmount}>{item.amount}</Text>
                <Text style={styles.breakdownPercent}>{item.percent}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ============================================ */}
        {/* 4. UPGRADED SAVINGS TIMELINE                */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Besparingsverloop</Text>
          <View style={[styles.alertsList, { padding: Spacing.md }]}>
            {/* Top row: total + trend */}
            <View style={styles.timelineHeader}>
              <View>
                <Text style={styles.timelineTotalLabel}>Totaal bespaard dit jaar</Text>
                <Text style={styles.timelineTotal}>{'\u20AC'}{savings.totalSavedThisYear.toLocaleString('nl-NL')}</Text>
              </View>
              <View style={styles.timelineTrend}>
                <Ionicons name="arrow-up" size={14} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.timelineTrendText}>+{savings.trendPercent}%</Text>
              </View>
            </View>
            {/* Bar chart */}
            <View style={styles.timelineChart}>
              {timeline.map((m, idx) => {
                const maxVal = Math.max(...timeline.map(t => t.amount));
                const barH = Math.max(8, (m.amount / maxVal) * 80);
                const isCurrentMonth = idx === timeline.length - 1;
                return (
                  <View key={m.month} style={styles.timelineBarCol}>
                    {/* Value label on current month */}
                    {isCurrentMonth && (
                      <Text style={styles.timelineBarValue}>{'\u20AC'}{m.amount.toLocaleString('nl-NL')}</Text>
                    )}
                    <View
                      style={[
                        styles.timelineBar,
                        {
                          height: barH,
                          backgroundColor: SemanticColors.feedbackSuccess,
                          opacity: isCurrentMonth ? 1 : 0.4,
                        },
                        isCurrentMonth && styles.timelineBarCurrent,
                      ]}
                    />
                    <Text style={[
                      styles.timelineBarLabel,
                      isCurrentMonth && styles.timelineBarLabelActive,
                    ]}>{m.month}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ============================================ */}
        {/* 5. COMPACT TOOL GRID                        */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inkoop & Kosten</Text>
          <View style={styles.toolGrid}>
            {savingsTools.map((tool) => (
              <Pressable
                key={tool.id}
                style={styles.toolGridCard}
                onPress={() => {
                  if (tool.onPress) tool.onPress();
                  else if (tool.route) router.push(tool.route as any);
                }}
              >
                <View style={[styles.toolGridIcon, { backgroundColor: tool.color + '15' }]}>
                  <Ionicons name={tool.icon} size={18} color={tool.color} />
                </View>
                <Text style={styles.toolGridTitle}>{tool.title}</Text>
                <Text style={styles.toolGridDesc}>{tool.description}</Text>
                {tool.stat && (
                  <Text style={[styles.toolGridStat, { color: tool.color }]}>{tool.stat}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Predictive Savings — from predictiveSavingsService */}
        {allPredictive.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bespaartips van Vasco</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{allPredictive.length} tips</Text>
              </View>
            </View>
            <View style={styles.alertsList}>
              {allPredictive.slice(0, 3).map((tip, index) => (
                <Pressable
                  key={tip.id}
                  style={[styles.alertItem, index < Math.min(allPredictive.length, 3) - 1 && styles.alertItemBorder]}
                  onPress={() => Alert.alert(tip.title, `${tip.description}\n\nPotenti\u00EBle besparing: \u20AC${tip.potentialSaving}\nBetrouwbaarheid: ${tip.confidence}%`)}
                >
                  <View style={[styles.toolIcon, { backgroundColor: Palette.hermesOrange + '15' }]}>
                    <Ionicons name={tip.icon as IconName} size={20} color={Palette.hermesOrange} />
                  </View>
                  <View style={styles.toolContent}>
                    <Text style={styles.toolTitle}>{tip.title}</Text>
                    <Text style={styles.toolDesc} numberOfLines={1}>{tip.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: SemanticColors.feedbackSuccess }}>{'\u20AC'}{tip.potentialSaving}</Text>
                    <Text style={{ fontSize: 10, color: SemanticColors.textTertiary }}>{tip.confidence}% zeker</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Supplier Negotiation — from supplierNegotiationService */}
        {negotiation.quickWins.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Onderhandelingskansen</Text>
            <View style={styles.alertsList}>
              {negotiation.quickWins.map((win, index) => (
                <Pressable
                  key={win.supplier}
                  style={[styles.alertItem, index < negotiation.quickWins.length - 1 && styles.alertItemBorder]}
                  onPress={() => Alert.alert(
                    `${win.supplier} \u2014 Actie`,
                    `${win.action}\n\nGeschatte besparing: \u20AC${win.saving}/jaar`,
                    [{ text: 'Later' }, { text: 'Contact opnemen', onPress: () => Alert.alert('Herinnering ingesteld', `We herinneren je om contact op te nemen met ${win.supplier}.`) }]
                  )}
                >
                  <View style={[styles.toolIcon, { backgroundColor: '#8B5CF6' + '15' }]}>
                    <Ionicons name="business" size={20} color="#8B5CF6" />
                  </View>
                  <View style={styles.toolContent}>
                    <Text style={styles.toolTitle}>{win.supplier}</Text>
                    <Text style={styles.toolDesc} numberOfLines={1}>{win.action}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: SemanticColors.feedbackSuccess }}>{'\u20AC'}{win.saving}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* TCO Calculator — from tcoCalculatorService */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TCO Vergelijking</Text>
          <View style={styles.alertsList}>
            {tco.comparisons.map((comp, index) => (
              <Pressable
                key={comp.category}
                style={[styles.alertItem, index < tco.comparisons.length - 1 && styles.alertItemBorder]}
                onPress={() => Alert.alert(
                  `TCO: ${comp.category}`,
                  `${comp.customerPitch}\n\nAanbeveling: ${comp.recommendation.name} (${comp.recommendation.brand})\nTCO/jaar: \u20AC${comp.recommendation.tcoPerYear} vs \u20AC${comp.materials[0].tcoPerYear} (budget)\n\nBesparing: \u20AC${comp.savingsVsBudget}/jaar`,
                )}
              >
                <View style={[styles.toolIcon, { backgroundColor: SemanticColors.feedbackInfo + '15' }]}>
                  <Ionicons name="calculator" size={20} color={SemanticColors.feedbackInfo} />
                </View>
                <View style={styles.toolContent}>
                  <Text style={styles.toolTitle}>{comp.category}</Text>
                  <Text style={styles.toolDesc} numberOfLines={1}>{comp.recommendation.brand} {comp.recommendation.name} — beste TCO</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: SemanticColors.feedbackSuccess }}>-{'\u20AC'}{comp.savingsVsBudget}/jr</Text>
                  <Text style={{ fontSize: 10, color: SemanticColors.textTertiary }}>vs budget</Text>
                </View>
              </Pressable>
            ))}
          </View>
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

      {/* Receipt Scanner Modal */}
      <Modal
        visible={showReceiptScanner}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <ReceiptScanner onClose={() => setShowReceiptScanner(false)} />
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
    backgroundColor: SemanticColors.surfaceBackground,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: SemanticColors.surfacePrimary,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.borderDefault,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SemanticColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // ============================================
  // HERO SAVINGS CARD
  // ============================================
  heroCard: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
  },
  heroAccent: {
    height: 3,
    backgroundColor: SemanticColors.feedbackSuccess,
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
    color: SemanticColors.feedbackSuccess,
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  heroChips: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SemanticColors.surfaceSecondary,
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
  },
  heroChipLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // ============================================
  // REASONING CHIPS
  // ============================================
  reasoningRow: {
    flexDirection: 'row',
    gap: 8,
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
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },

  // ============================================
  // ALERTS LIST (shared container)
  // ============================================
  alertsList: {
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
    overflow: 'hidden',
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
  // UPGRADED PRICE ALERTS
  // ============================================
  alertItemUpgraded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingRight: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  alertLeftAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  alertContentUpgraded: {
    flex: 1,
    paddingLeft: Spacing.xs,
  },
  alertTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertMaterial: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    flex: 1,
    marginRight: Spacing.sm,
  },
  alertSavingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  alertSavingsBadgeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  alertSupplier: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  alertPrices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  alertCurrentPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  alertOldPrice: {
    fontSize: 13,
    color: SemanticColors.textTertiary,
    textDecorationLine: 'line-through',
  },
  alertExpiry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 'auto',
  },
  alertExpiryText: {
    fontSize: 11,
    color: SemanticColors.feedbackWarning,
    fontWeight: '500',
  },
  alertCTAButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.hermesOrange,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  alertCTAText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // ============================================
  // SAVINGS BREAKDOWN
  // ============================================
  breakdownBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  breakdownLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
    color: SemanticColors.textPrimary,
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginRight: 8,
  },
  breakdownPercent: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    width: 32,
  },

  // ============================================
  // SAVINGS TIMELINE
  // ============================================
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  timelineTotalLabel: {
    fontSize: 12,
    color: SemanticColors.textTertiary,
    marginBottom: 2,
  },
  timelineTotal: {
    fontSize: 22,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  timelineTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timelineTrendText: {
    fontSize: 13,
    fontWeight: '600',
    color: SemanticColors.feedbackSuccess,
  },
  timelineChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 110,
  },
  timelineBarCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  timelineBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 8,
  },
  timelineBarCurrent: {
    shadowColor: SemanticColors.feedbackSuccess,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  timelineBarValue: {
    fontSize: 11,
    fontWeight: '700',
    color: SemanticColors.feedbackSuccess,
    marginBottom: 4,
  },
  timelineBarLabel: {
    fontSize: 10,
    color: SemanticColors.textTertiary,
    marginTop: 6,
  },
  timelineBarLabelActive: {
    color: SemanticColors.textPrimary,
    fontWeight: '600',
  },

  // ============================================
  // COMPACT TOOL GRID (2 columns)
  // ============================================
  toolGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  toolGridCard: {
    width: '48%' as any,
    backgroundColor: SemanticColors.surfacePrimary,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: SemanticColors.borderDefault,
  },
  toolGridIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  toolGridTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  toolGridDesc: {
    fontSize: 11,
    color: SemanticColors.textTertiary,
    marginTop: 2,
  },
  toolGridStat: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
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
});
