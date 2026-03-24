// =============================================================================
// INKOOP - Full Purchasing Hub
// =============================================================================
// Combined leveranciers + herbestellen with predictive planning,
// bon scanner, and savings insights. Benchmarking intelligence drives
// Vasco tips behind the scenes (not shown in UI).
// =============================================================================

import { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useSavingsAggregation, useSavingsTimeline } from '../../src/services/savingsAggregatorService';
import { useInventory, useReorderSuggestions } from '../../src/services/reorderService';
import { ReceiptScanner } from '../../src/components/contractor/ReceiptScanner';
import { feedPricingMoat, type ScannedInvoice } from '../../src/services/invoiceScanService';

export default function InkoopScreen() {
  const router = useRouter();
  const savings = useSavingsAggregation();
  const timeline = useSavingsTimeline();
  const { inventory, lowStockCount } = useInventory();
  const { suggestions, criticalCount, markOrdered, statistics } = useReorderSuggestions();
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return SemanticColors.feedbackError;
      case 'high': return Palette.hermesOrange;
      case 'medium': return Palette.burntSienna;
      default: return SemanticColors.textTertiary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>Inkoop</Text>
        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {criticalCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{criticalCount}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ============================================ */}
        {/* 0. QUICK ACTIONS                            */}
        {/* ============================================ */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActions}>
          <Pressable style={styles.quickChip} onPress={() => setShowReceiptScanner(true)}>
            <Ionicons name="scan" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>Bon Scanner</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => {
            if (criticalCount > 0) {
              scrollRef.current?.scrollTo({ y: 200, animated: true });
            } else {
              Alert.alert('Voorraad op orde', 'Er zijn geen herbestellingen nodig.');
            }
          }}>
            <Ionicons name="repeat" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>Herbestellen</Text>
            {criticalCount > 0 && <View style={styles.chipBadge}><Text style={styles.chipBadgeText}>{criticalCount}</Text></View>}
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => {
            const suppliers = [...new Set(inventory.map(i => i.preferredSupplier).filter(Boolean))];
            Alert.alert('Leveranciers', suppliers.length > 0 ? `Je werkt met ${suppliers.length} leveranciers:\n\n${suppliers.join('\n')}` : 'Nog geen leveranciers gekoppeld.');
          }}>
            <Ionicons name="storefront" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>Leveranciers</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => router.push('/contractor/market-prices' as any)}>
            <Ionicons name="bar-chart" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>Benchmarking</Text>
          </Pressable>
        </ScrollView>

        {/* ============================================ */}
        {/* 1. HERO STATS                               */}
        {/* ============================================ */}
        <View style={styles.heroRow}>
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="shield-checkmark" size={18} color={SemanticColors.feedbackSuccess} />
            </View>
            <Text style={styles.heroValue}>{statistics.stockoutsAvoided}</Text>
            <Text style={styles.heroLabel}>Stockouts{'\n'}voorkomen</Text>
          </View>
          <View style={styles.heroCard}>
            <View style={[styles.heroIconWrap, { backgroundColor: Palette.hermesOrange + '12' }]}>
              <Ionicons name="wallet" size={18} color={Palette.hermesOrange} />
            </View>
            <Text style={styles.heroValue}>€{statistics.totalSavings}</Text>
            <Text style={styles.heroLabel}>Totaal{'\n'}bespaard</Text>
          </View>
          <View style={styles.heroCard}>
            <View style={[styles.heroIconWrap, { backgroundColor: '#3B82F612' }]}>
              <Ionicons name="analytics" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.heroValue}>{statistics.accuracyRate}%</Text>
            <Text style={styles.heroLabel}>Voorspel{'\n'}nauwkeurig</Text>
          </View>
        </View>

        {/* ============================================ */}
        {/* 2. LEVERANCIERS & VOORRAAD                  */}
        {/* ============================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Voorraad</Text>
            {lowStockCount > 0 && (
              <View style={styles.alertPill}>
                <View style={styles.alertDot} />
                <Text style={styles.alertPillText}>{lowStockCount} laag</Text>
              </View>
            )}
          </View>

          {suggestions.length > 0 ? (
            suggestions.slice(0, 5).map(suggestion => {
              const item = inventory.find(i => i.materialId === suggestion.materialId);
              const stockPercent = Math.min(100, ((item?.currentStock || 0) / (item?.optimalStock || 1)) * 100);
              const isLow = (item?.currentStock || 0) <= (item?.minimumStock || 0);

              return (
                <View key={suggestion.id} style={styles.supplierCard}>
                  <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(suggestion.priority) }]} />
                  <View style={styles.supplierContent}>
                    <View style={styles.supplierTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.materialName} numberOfLines={1}>{suggestion.materialName}</Text>
                        <View style={styles.supplierMeta}>
                          <Ionicons name="storefront" size={11} color="#999" />
                          <Text style={styles.supplierText}>{item?.preferredSupplier || 'Leverancier'}</Text>
                          <Text style={styles.categoryDot}>·</Text>
                          <Text style={styles.supplierText}>{suggestion.category}</Text>
                        </View>
                      </View>
                      <View style={[styles.urgencyChip, { backgroundColor: getPriorityColor(suggestion.priority) + '12' }]}>
                        <Text style={[styles.urgencyValue, { color: getPriorityColor(suggestion.priority) }]}>
                          {suggestion.daysUntilStockout === 0 ? 'Op!' : `${suggestion.daysUntilStockout}d`}
                        </Text>
                      </View>
                    </View>

                    {/* Stock indicator */}
                    <View style={styles.stockRow}>
                      <View style={styles.stockTrack}>
                        <View style={[styles.stockFill, {
                          width: `${stockPercent}%`,
                          backgroundColor: isLow ? SemanticColors.feedbackError : Palette.hermesOrange,
                        }]} />
                      </View>
                      <Text style={styles.stockText}>{item?.currentStock || 0}/{item?.optimalStock || 0}</Text>
                    </View>

                    <Text style={styles.reasonText} numberOfLines={1}>{suggestion.reason}</Text>

                    <View style={styles.supplierBottom}>
                      <View style={styles.costRow}>
                        <Text style={styles.qtyText}>{suggestion.suggestedQuantity}×</Text>
                        <Text style={styles.costText}>€{suggestion.estimatedCost.toFixed(0)}</Text>
                        {suggestion.bulkDiscount && (
                          <View style={styles.savingsChip}>
                            <Text style={styles.savingsChipText}>-{suggestion.bulkDiscount.discountPercent}%</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        style={styles.orderBtn}
                        onPress={() => {
                          markOrdered(suggestion.id);
                          Alert.alert('Besteld', `${suggestion.materialName} is besteld.`);
                        }}
                      >
                        <Ionicons name="cart" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle" size={28} color={SemanticColors.feedbackSuccess} />
              <Text style={styles.emptyText}>Voorraad op orde!</Text>
            </View>
          )}
        </View>

        {/* ============================================ */}
        {/* 3. BON SCANNER                              */}
        {/* ============================================ */}
        <Pressable style={styles.scannerCard} onPress={() => setShowReceiptScanner(true)}>
          <View style={styles.scannerIcon}>
            <Ionicons name="scan" size={20} color={Palette.hermesOrange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scannerTitle}>Bon Scanner</Text>
            <Text style={styles.scannerSub}>Scan een bon om kosten te verwerken</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </Pressable>

        {/* ============================================ */}
        {/* 4. BESPARINGEN                              */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Besparingen</Text>

          {/* Savings breakdown */}
          <View style={styles.card}>
            <View style={styles.breakdownBar}>
              <View style={{ flex: 45, backgroundColor: Palette.hermesOrange }} />
              <View style={{ flex: 25, backgroundColor: Palette.burntSienna }} />
              <View style={{ flex: 20, backgroundColor: Palette.pastelOrange }} />
              <View style={{ flex: 10, backgroundColor: '#DDD' }} />
            </View>
            {([
              { label: 'Materialen', amount: '€1.840', pct: '45%', color: Palette.hermesOrange },
              { label: 'Leveranciers', amount: '€1.020', pct: '25%', color: Palette.burntSienna },
              { label: 'Efficiëntie', amount: '€820', pct: '20%', color: Palette.pastelOrange },
              { label: 'Overig', amount: '€410', pct: '10%', color: '#CCC' },
            ] as const).map(r => (
              <View key={r.label} style={styles.legendRow}>
                <View style={[styles.legendDot, { backgroundColor: r.color }]} />
                <Text style={styles.legendLabel}>{r.label}</Text>
                <Text style={styles.legendAmount}>{r.amount}</Text>
                <Text style={styles.legendPct}>{r.pct}</Text>
              </View>
            ))}
          </View>

          {/* Savings timeline */}
          <View style={styles.card}>
            <View style={styles.timelineTop}>
              <View>
                <Text style={styles.timelineLabel}>Bespaard dit jaar</Text>
                <Text style={styles.timelineAmount}>€{savings.totalSavedThisYear.toLocaleString(undefined)}</Text>
              </View>
              <View style={styles.trendPill}>
                <Ionicons name="arrow-up" size={12} color={SemanticColors.feedbackSuccess} />
                <Text style={styles.trendText}>+{savings.trendPercent}%</Text>
              </View>
            </View>
            <View style={styles.chartRow}>
              {timeline.map((m, idx) => {
                const maxVal = Math.max(...timeline.map(t => t.amount));
                const barH = Math.max(6, (m.amount / maxVal) * 72);
                const isCurrent = idx === timeline.length - 1;
                return (
                  <View key={m.month} style={styles.barCol}>
                    {isCurrent && (
                      <Text style={styles.barValue}>€{m.amount.toLocaleString(undefined)}</Text>
                    )}
                    <View style={[styles.bar, {
                      height: barH,
                      backgroundColor: isCurrent ? Palette.hermesOrange : Palette.pastelOrange,
                      opacity: isCurrent ? 1 : 0.5,
                    }]} />
                    <Text style={[styles.barLabel, isCurrent && styles.barLabelActive]}>{m.month}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Receipt Scanner Modal */}
      <Modal visible={showReceiptScanner} animationType="slide" presentationStyle="fullScreen">
        <ReceiptScanner
          onClose={() => setShowReceiptScanner(false)}
          onComplete={(result: any) => {
            if (result?.success && result.invoice) {
              const scanned: ScannedInvoice = {
                id: `scan-${Date.now()}`,
                documentType: result.invoice.type ?? 'invoice',
                supplierName: result.invoice.supplier?.name ?? 'Onbekend',
                documentNumber: result.invoice.header?.documentNumber,
                documentDate: result.invoice.header?.date ?? new Date().toISOString().split('T')[0],
                lineItems: (result.invoice.lineItems ?? []).map((li: any) => ({
                  description: li.description ?? '',
                  articleNumber: li.articleNumber,
                  brand: li.brand,
                  category: li.category ?? 'general',
                  quantity: li.quantity ?? 1,
                  unit: li.unit ?? 'stuk',
                  unitPrice: li.unitPrice ?? 0,
                  vatRate: li.vatRate ?? 21,
                  totalPrice: li.totalPrice ?? 0,
                  confidence: li.confidence ?? 70,
                })),
                subtotal: result.invoice.totals?.subtotal ?? 0,
                vatAmount: result.invoice.totals?.vatAmount ?? 0,
                total: result.invoice.totals?.total ?? 0,
                confidence: result.confidence ?? 70,
                scannedAt: new Date().toISOString(),
              };
              feedPricingMoat(scanned).catch(() => {});
            }
            setShowReceiptScanner(false);
          }}
        />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: SafeArea.top,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Manrope_700Bold',
    color: '#1A1A1A',
  },
  headerBadge: {
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: 12,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 11,
    fontFamily: 'Manrope_700Bold',
    color: '#fff',
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 24,
  },

  // Quick Actions
  quickActions: {
    gap: 8,
    paddingVertical: 2,
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange + '0C',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hermesOrange + '20',
  },
  quickChipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#1A1A1A',
  },
  chipBadge: {
    backgroundColor: SemanticColors.feedbackError,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chipBadgeText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold' as const,
    color: '#fff',
  },

  // Hero stats
  heroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroValue: {
    fontSize: 17,
    fontFamily: 'Manrope_800ExtraBold',
    color: '#1A1A1A',
  },
  heroLabel: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },

  // Sections
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: '#999',
    letterSpacing: 0.8,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SemanticColors.feedbackError + '10',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SemanticColors.feedbackError,
  },
  alertPillText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: SemanticColors.feedbackError,
  },

  // Supplier cards
  supplierCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  priorityBar: { width: 4 },
  supplierContent: {
    flex: 1,
    padding: 14,
    gap: 8,
  },
  supplierTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  materialName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#1A1A1A',
  },
  supplierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  supplierText: {
    fontSize: 11,
    color: '#999',
  },
  categoryDot: {
    fontSize: 11,
    color: '#CCC',
  },
  urgencyChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  urgencyValue: {
    fontSize: 12,
    fontFamily: 'Manrope_800ExtraBold',
  },

  // Stock bar
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  stockFill: {
    height: '100%',
    borderRadius: 2,
  },
  stockText: {
    fontSize: 10,
    color: '#BBB',
    fontFamily: 'Inter_600SemiBold',
    minWidth: 32,
  },
  reasonText: {
    fontSize: 12,
    color: '#777',
    lineHeight: 16,
  },
  supplierBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyText: {
    fontSize: 13,
    fontFamily: 'Manrope_700Bold',
    color: '#1A1A1A',
  },
  costText: {
    fontSize: 13,
    color: '#777',
  },
  savingsChip: {
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsChipText: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.feedbackSuccess,
  },
  orderBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Palette.hermesOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#999',
  },

  // Scanner
  scannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  scannerIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: Palette.hermesOrange + '10',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#1A1A1A',
  },
  scannerSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },

  // Breakdown
  breakdownBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontSize: 13,
    color: '#444',
  },
  legendAmount: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: '#1A1A1A',
    marginRight: 8,
  },
  legendPct: {
    fontSize: 12,
    color: '#BBB',
    width: 32,
  },

  // Timeline
  timelineTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  timelineAmount: {
    fontSize: 22,
    fontFamily: 'Manrope_800ExtraBold',
    color: '#1A1A1A',
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: SemanticColors.feedbackSuccessBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trendText: {
    fontSize: 12,
    fontFamily: 'Manrope_700Bold',
    color: SemanticColors.feedbackSuccess,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 100,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 6,
  },
  barValue: {
    fontSize: 10,
    fontFamily: 'Manrope_700Bold',
    color: Palette.hermesOrange,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#CCC',
    marginTop: 6,
  },
  barLabelActive: {
    color: '#1A1A1A',
    fontFamily: 'Manrope_700Bold',
  },
});
