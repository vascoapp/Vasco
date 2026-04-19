// Hub: Leveranciers — Supplier performance dashboard
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import type { Supplier } from '../../src/domain/suppliers';

type IconName = keyof typeof Ionicons.glyphMap;

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  active: { bg: '#16A34A12', fg: '#16A34A', label: 'Actief' },
  inactive: { bg: '#6B728012', fg: '#6B7280', label: 'Inactief' },
  pending: { bg: '#F59E0B12', fg: '#F59E0B', label: 'In afwachting' },
  blocked: { bg: '#EF444412', fg: '#EF4444', label: 'Geblokkeerd' },
};

function scoreColor(score: number | undefined): string {
  if (score == null) return '#999';
  if (score >= 90) return '#16A34A';
  if (score >= 70) return '#F59E0B';
  return '#EF4444';
}

function formatCurrency(amount: number): string {
  return `\u20AC${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Supplier Detail Panel ────────────────────────────────

function SupplierDetailPanel({ supplier }: { supplier: Supplier }) {
  const { jobMaterials, materials } = useAppState();

  // Find materials supplied by this supplier
  const suppliedMaterialIds = useMemo(() => {
    const ids = new Set<string>();
    for (const jms of Object.values(jobMaterials)) {
      for (const jm of jms) {
        if (jm.supplierId === supplier.id) ids.add(jm.materialId);
      }
    }
    return ids;
  }, [jobMaterials, supplier.id]);

  const suppliedMaterials = materials.filter((m) => suppliedMaterialIds.has(m.id));

  return (
    <View style={styles.detailPanel}>
      {/* Performance metrics */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Betrouwbaarheid</Text>
          <Text style={[styles.metricValue, { color: scoreColor(supplier.reliabilityScore) }]}>
            {supplier.reliabilityScore != null ? `${supplier.reliabilityScore}%` : '-'}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Op tijd</Text>
          <Text style={[styles.metricValue, { color: scoreColor(supplier.onTimeDeliveryRate != null ? supplier.onTimeDeliveryRate * 100 : undefined) }]}>
            {supplier.onTimeDeliveryRate != null ? `${Math.round(supplier.onTimeDeliveryRate * 100)}%` : '-'}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Kwaliteit</Text>
          <Text style={[styles.metricValue, { color: scoreColor(supplier.qualityScore) }]}>
            {supplier.qualityScore != null ? `${supplier.qualityScore}` : '-'}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Levertijd</Text>
          <Text style={styles.metricValue}>
            {supplier.avgLeadTimeDays != null ? `${supplier.avgLeadTimeDays}d` : '-'}
          </Text>
        </View>
      </View>

      {/* Pricing */}
      <View style={styles.pricingRow}>
        {supplier.avgPriceVsMarket != null && (
          <View style={[styles.priceBadge, {
            backgroundColor: supplier.avgPriceVsMarket <= 0.95 ? '#16A34A12' : supplier.avgPriceVsMarket <= 1.05 ? '#F59E0B12' : '#EF444412',
          }]}>
            <Ionicons
              name={supplier.avgPriceVsMarket <= 0.95 ? 'trending-down' : supplier.avgPriceVsMarket <= 1.05 ? 'remove' : 'trending-up'}
              size={12}
              color={supplier.avgPriceVsMarket <= 0.95 ? '#16A34A' : supplier.avgPriceVsMarket <= 1.05 ? '#F59E0B' : '#EF4444'}
            />
            <Text style={[styles.priceText, {
              color: supplier.avgPriceVsMarket <= 0.95 ? '#16A34A' : supplier.avgPriceVsMarket <= 1.05 ? '#F59E0B' : '#EF4444',
            }]}>
              {supplier.avgPriceVsMarket <= 0.95
                ? `${Math.round((1 - supplier.avgPriceVsMarket) * 100)}% onder markt`
                : supplier.avgPriceVsMarket <= 1.05
                  ? 'Marktconform'
                  : `${Math.round((supplier.avgPriceVsMarket - 1) * 100)}% boven markt`}
            </Text>
          </View>
        )}
        {supplier.discountTier && (
          <View style={styles.tierBadge}>
            <Ionicons name="star" size={10} color={Palette.hermesOrange} />
            <Text style={styles.tierText}>{supplier.discountTier}</Text>
          </View>
        )}
      </View>

      {/* Commercial terms */}
      <View style={styles.termsRow}>
        {supplier.creditTerms != null && supplier.creditTerms > 0 && (
          <View style={styles.termItem}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.termText}>{supplier.creditTerms} dagen betaaltermijn</Text>
          </View>
        )}
        {supplier.apiEnabled && (
          <View style={styles.termItem}>
            <Ionicons name="code-slash" size={14} color="#3B82F6" />
            <Text style={[styles.termText, { color: '#3B82F6' }]}>API gekoppeld</Text>
          </View>
        )}
      </View>

      {/* Materials from this supplier */}
      {suppliedMaterials.length > 0 && (
        <View style={styles.materialsSection}>
          <Text style={styles.sectionTitle}>Geleverde materialen</Text>
          {suppliedMaterials.map((mat) => (
            <View key={mat.id} style={styles.materialChip}>
              <Text style={styles.materialChipText} numberOfLines={1}>{mat.name}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────

export default function SuppliersHubScreen() {
  const router = useRouter();
  const { suppliers, isLoading } = useAppState();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sort by reliability score descending
  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => (b.reliabilityScore ?? 0) - (a.reliabilityScore ?? 0)),
    [suppliers],
  );

  // Aggregate stats
  const totalSpend = useMemo(() => suppliers.reduce((sum, s) => sum + s.totalSpend, 0), [suppliers]);
  const avgReliability = useMemo(() => {
    const scored = suppliers.filter((s) => s.reliabilityScore != null);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, s) => sum + (s.reliabilityScore ?? 0), 0) / scored.length);
  }, [suppliers]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const renderSupplierItem = useCallback(({ item }: { item: Supplier }) => {
    const statusStyle = STATUS_COLORS[item.accountStatus] ?? STATUS_COLORS.active;
    const isExpanded = expandedId === item.id;

    return (
      <Pressable style={styles.supplierCard} onPress={() => toggleExpand(item.id)}>
        <View style={styles.supplierHeader}>
          <View style={styles.supplierIcon}>
            <Ionicons name="business" size={18} color={Palette.hermesOrange} />
          </View>
          <View style={styles.supplierInfo}>
            <Text style={styles.supplierName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.supplierMeta}>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.fg }]}>{statusStyle.label}</Text>
              </View>
              <Text style={styles.spendText}>
                {formatCurrency(item.totalSpend)} besteed
              </Text>
            </View>
          </View>
          {item.reliabilityScore != null && (
            <View style={styles.reliabilityCircle}>
              <Text style={[styles.reliabilityValue, { color: scoreColor(item.reliabilityScore) }]}>
                {item.reliabilityScore}
              </Text>
            </View>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#999"
          />
        </View>
        {isExpanded && <SupplierDetailPanel supplier={item} />}
      </Pressable>
    );
  }, [expandedId, toggleExpand]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#1A1A1A" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Leveranciers</Text>
          <Text style={styles.headerSubtitle}>
            {suppliers.length} leveranciers
          </Text>
        </View>
      </View>

      {/* Summary Strip */}
      {suppliers.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatCurrency(totalSpend)}</Text>
            <Text style={styles.summaryLabel}>Totaal besteed</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: scoreColor(avgReliability) }]}>
              {avgReliability}%
            </Text>
            <Text style={styles.summaryLabel}>Gem. betrouwbaarheid</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {suppliers.filter((s) => s.apiEnabled).length}
            </Text>
            <Text style={styles.summaryLabel}>API gekoppeld</Text>
          </View>
        </View>
      )}

      {/* Supplier List */}
      {sortedSuppliers.length > 0 ? (
        <FlatList
          data={sortedSuppliers}
          keyExtractor={(item) => item.id}
          renderItem={renderSupplierItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : !isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Ionicons name="business-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>Nog geen leveranciers</Text>
            <Text style={styles.emptySubtext}>
              Leveranciers worden automatisch toegevoegd bij het importeren van facturen
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: SafeArea.side,
    paddingTop: SafeArea.top,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FAFAF8',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#14181F",
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: "#FFFFFF", textTransform: 'uppercase', letterSpacing: 1.2 },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },

  // Summary
  summaryStrip: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: "#14181F",
    borderRadius: 14,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: "#FFFFFF",
  },
  summaryLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#F0EDE8',
    marginVertical: 2,
  },

  // List
  listContent: {
    padding: Spacing.md,
    gap: 8,
    paddingBottom: 40,
  },
  supplierCard: {
    backgroundColor: "#14181F",
    borderRadius: 14,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  supplierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  supplierIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Palette.hermesOrange + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierInfo: {
    flex: 1,
    gap: 4,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: '600',
    color: "#FFFFFF",
  },
  supplierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  spendText: {
    fontSize: 12,
    color: '#999',
  },
  reliabilityCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAFAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reliabilityValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Detail Panel
  detailPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE8',
    gap: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#FAFAF8',
    borderRadius: 10,
    padding: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: '#999',
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: "#FFFFFF",
  },
  pricingRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Palette.hermesOrange + '12',
  },
  tierText: {
    fontSize: 11,
    fontWeight: '600',
    color: Palette.hermesOrange,
  },
  termsRow: {
    gap: 6,
  },
  termItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  termText: {
    fontSize: 12,
    color: '#666',
  },
  materialsSection: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  materialChip: {
    backgroundColor: '#F0EDE8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  materialChipText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: '500',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyCard: {
    backgroundColor: "#14181F",
    borderRadius: 16,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
