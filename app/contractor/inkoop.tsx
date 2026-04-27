// =============================================================================
// INKOOP - Full Purchasing Hub
// =============================================================================
// Combined leveranciers + herbestellen with predictive planning,
// bon scanner, and savings insights. Benchmarking intelligence drives
// Vasco tips behind the scenes (not shown in UI).
// =============================================================================

import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { SemanticColors, Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useSavingsAggregation, useSavingsTimeline } from '../../src/services/savingsAggregatorService';
import { useInventory, useReorderSuggestions } from '../../src/services/reorderService';
import { ReceiptScanner } from '../../src/components/contractor/ReceiptScanner';
import { feedPricingMoat, type ScannedInvoice } from '../../src/services/invoiceScanService';
import { parseDateanormV4, parseDateanormV5, importDatanormToMoat } from '../../src/integrations/datanorm';

export default function InkoopScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const savings = useSavingsAggregation();
  const timeline = useSavingsTimeline();
  const { inventory, lowStockCount } = useInventory();
  const { suggestions, criticalCount, markOrdered, statistics } = useReorderSuggestions();
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // -------------------------------------------------------
  // DATANORM file import
  // -------------------------------------------------------
  const handleDatanormImport = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setIsImporting(true);

      const file = new ExpoFile(asset.uri);
      const text = await file.text();

      if (!text || text.trim().length < 10) {
        Alert.alert(t('inkoop.importFailedTitle', 'Import failed'), t('inkoop.importFailedNoData', 'The file contains no valid data.'));
        setIsImporting(false);
        return;
      }

      // Auto-detect v4 vs v5: v5 files start with a V (version) record
      const firstLine = text.split(/\r?\n/)[0] ?? '';
      const isV5 = firstLine.trim().toUpperCase().startsWith('V;');
      const articles = isV5 ? parseDateanormV5(text) : parseDateanormV4(text);

      if (articles.length === 0) {
        Alert.alert(t('inkoop.noArticlesTitle', 'No articles'), t('inkoop.noArticlesDesc', 'No articles could be read from the file. Verify it is a valid DATANORM file.'));
        setIsImporting(false);
        return;
      }

      // Derive supplier name from filename (e.g. "richter_frenzel_2026.dat" → "Richter Frenzel")
      const rawName = (asset.name ?? 'supplier')
        .replace(/\.(txt|dat|csv|datanorm)$/i, '')
        .replace(/[_\-]+/g, ' ')
        .replace(/\d{4,}/g, '')
        .trim();
      const supplierName = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'DATANORM Supplier';
      const supplierId = supplierName.toLowerCase().replace(/\s+/g, '_');

      const { imported, skipped } = await importDatanormToMoat(articles, supplierId, {
        supplierName,
        trade: 'general',
      });

      Alert.alert(
        t('inkoop.importSuccessTitle', 'Import successful'),
        t('inkoop.importSuccessBody', '{{imported}} materials imported from {{supplier}}.{{skippedNote}}', {
          imported,
          supplier: supplierName,
          skippedNote: skipped > 0 ? `\n${t('inkoop.importSkipped', '{{count}} skipped (duplicates or invalid price).', { count: skipped })}` : '',
        }),
      );
    } catch {
      Alert.alert(t('inkoop.importFailedTitle', 'Import failed'), t('inkoop.importFailedRead', 'Something went wrong reading the file.'));
    } finally {
      setIsImporting(false);
    }
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return SemanticColors.feedbackError;
      case 'high': return Palette.hermesOrange;
      case 'medium': return Palette.hermesOrange;
      default: return SemanticColors.textTertiary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>{t('inkoop.title', 'Purchasing')}</Text>
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
            <Text style={styles.quickChipText}>{t('inkoop.receiptScanner', 'Receipt scanner')}</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => {
            if (criticalCount > 0) {
              // Route to material search with the first critical item as query
              const firstCritical = suggestions.find(s => s.priority === 'critical');
              router.push(firstCritical
                ? `/contractor/material-search?q=${encodeURIComponent(firstCritical.materialName)}` as any
                : '/contractor/material-search' as any);
            } else {
              Alert.alert(t('inkoop.stockOk', 'Stock is in order'), t('inkoop.noReorders', 'No reorders needed right now.'));
            }
          }}>
            <Ionicons name="repeat" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>{t('inkoop.reorder', 'Reorder')}</Text>
            {criticalCount > 0 && <View style={styles.chipBadge}><Text style={styles.chipBadgeText}>{criticalCount}</Text></View>}
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => {
            const suppliers = [...new Set(inventory.map(i => i.preferredSupplier).filter(Boolean))];
            Alert.alert(
              t('inkoop.suppliers', 'Suppliers'),
              suppliers.length > 0
                ? t('inkoop.suppliersList', 'You work with {{count}} suppliers:\n\n{{names}}', { count: suppliers.length, names: suppliers.join('\n') })
                : t('inkoop.suppliersEmpty', 'No suppliers linked yet.'),
            );
          }}>
            <Ionicons name="storefront" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>{t('inkoop.suppliers', 'Suppliers')}</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => router.push('/contractor/market-prices' as any)}>
            <Ionicons name="bar-chart" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>{t('inkoop.benchmarking', 'Benchmarking')}</Text>
          </Pressable>
          <Pressable
            style={[styles.quickChip, isImporting && { opacity: 0.5 }]}
            onPress={handleDatanormImport}
            disabled={isImporting}
          >
            <Ionicons name="cloud-upload" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>{isImporting ? t('inkoop.importing', 'Importing…') : 'DATANORM'}</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => router.push('/contractor/material-search' as any)}>
            <Ionicons name="search" size={16} color={Palette.hermesOrange} />
            <Text style={styles.quickChipText}>{t('inkoop.searchMaterial', 'Search material')}</Text>
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
            <Text style={styles.heroLabel}>{t('inkoop.stockoutsAvoided', 'Stockouts\navoided')}</Text>
          </View>
          <View style={styles.heroCard}>
            <View style={[styles.heroIconWrap, { backgroundColor: Palette.hermesOrange + '12' }]}>
              <Ionicons name="wallet" size={18} color={Palette.hermesOrange} />
            </View>
            <Text style={styles.heroValue}>€{statistics.totalSavings}</Text>
            <Text style={styles.heroLabel}>{t('inkoop.totalSaved', 'Total\nsaved')}</Text>
          </View>
          <View style={styles.heroCard}>
            <View style={[styles.heroIconWrap, { backgroundColor: '#3B82F612' }]}>
              <Ionicons name="analytics" size={18} color="#3B82F6" />
            </View>
            <Text style={styles.heroValue}>{statistics.accuracyRate}%</Text>
            <Text style={styles.heroLabel}>{t('inkoop.forecastAccuracy', 'Forecast\naccuracy')}</Text>
          </View>
        </View>

        {/* ============================================ */}
        {/* 2. LEVERANCIERS & VOORRAAD                  */}
        {/* ============================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('inkoop.stock', 'Stock')}</Text>
            {lowStockCount > 0 && (
              <View style={styles.alertPill}>
                <View style={styles.alertDot} />
                <Text style={styles.alertPillText}>{t('inkoop.lowCount', '{{count}} low', { count: lowStockCount })}</Text>
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
                          <Text style={styles.supplierText}>{item?.preferredSupplier || t('inkoop.supplier', 'Supplier')}</Text>
                          <Text style={styles.categoryDot}>·</Text>
                          <Text style={styles.supplierText}>{suggestion.category}</Text>
                        </View>
                      </View>
                      <View style={[styles.urgencyChip, { backgroundColor: getPriorityColor(suggestion.priority) + '12' }]}>
                        <Text style={[styles.urgencyValue, { color: getPriorityColor(suggestion.priority) }]}>
                          {suggestion.daysUntilStockout === 0 ? t('inkoop.outNow', 'Out!') : `${suggestion.daysUntilStockout}d`}
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
                          Alert.alert(t('inkoop.ordered', 'Ordered'), t('inkoop.orderedBody', '{{name}} has been ordered.', { name: suggestion.materialName }));
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
              <Text style={styles.emptyText}>{t('inkoop.stockOk', 'Stock is in order!')}</Text>
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
            <Text style={styles.scannerTitle}>{t('inkoop.receiptScanner', 'Receipt scanner')}</Text>
            <Text style={styles.scannerSub}>{t('inkoop.receiptScannerDesc', 'Scan a receipt to record costs')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#CCC" />
        </Pressable>

        {/* ============================================ */}
        {/* 4. BESPARINGEN                              */}
        {/* ============================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('inkoop.savings', 'Savings')}</Text>

          {/* Savings breakdown */}
          <View style={styles.card}>
            <View style={styles.breakdownBar}>
              <View style={{ flex: 45, backgroundColor: Palette.hermesOrange }} />
              <View style={{ flex: 25, backgroundColor: Palette.hermesOrange + 'CC' }} />
              <View style={{ flex: 20, backgroundColor: Palette.pastelOrange }} />
              <View style={{ flex: 10, backgroundColor: '#DDD' }} />
            </View>
            {([
              { label: t('inkoop.breakdown.materials', 'Materials'), amount: '€1.840', pct: '45%', color: Palette.hermesOrange },
              { label: t('inkoop.breakdown.suppliers', 'Suppliers'), amount: '€1.020', pct: '25%', color: Palette.hermesOrange + 'CC' },
              { label: t('inkoop.breakdown.efficiency', 'Efficiency'), amount: '€820', pct: '20%', color: Palette.pastelOrange },
              { label: t('inkoop.breakdown.other', 'Other'), amount: '€410', pct: '10%', color: '#CCC' },
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
                <Text style={styles.timelineLabel}>{t('inkoop.savedThisYear', 'Saved this year')}</Text>
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
    backgroundColor: "#14181F",
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
    fontFamily: 'Archivo_800ExtraBold',
    color: "#FFFFFF", textTransform: 'uppercase', letterSpacing: 1.2 },
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
    fontFamily: 'Archivo_800ExtraBold',
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
    color: "#FFFFFF",
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
    fontFamily: 'Archivo_800ExtraBold' as const,
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
    backgroundColor: "#14181F",
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
    fontFamily: 'Archivo_900Black',
    color: "#FFFFFF",
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
    fontFamily: 'Archivo_800ExtraBold',
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
    backgroundColor: "#14181F",
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
    color: "#FFFFFF",
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
    fontFamily: 'Archivo_900Black',
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
    fontFamily: 'Archivo_800ExtraBold',
    color: "#FFFFFF",
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
    fontFamily: 'Archivo_800ExtraBold',
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
    backgroundColor: "#14181F",
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
    backgroundColor: "#14181F",
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
    color: "#FFFFFF",
  },
  scannerSub: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: "#14181F",
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
    color: "#FFFFFF",
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
    fontFamily: 'Archivo_900Black',
    color: "#FFFFFF",
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
    fontFamily: 'Archivo_800ExtraBold',
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
    fontFamily: 'Archivo_800ExtraBold',
    color: Palette.hermesOrange,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 9,
    color: '#CCC',
    marginTop: 6,
  },
  barLabelActive: {
    color: "#FFFFFF",
    fontFamily: 'Archivo_800ExtraBold',
  },
});
