// Hub: Materialen — Material catalog browser with search, filters, and supplier info
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Palette } from '../../src/theme/colors';
import { Spacing, SafeArea } from '../../src/theme/spacing';
import { useAppState } from '../../src/state/AppState';
import type { Material } from '../../src/domain/materials';

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_ICONS: Record<string, { icon: IconName; color: string }> = {
  paint: { icon: 'color-palette', color: '#3B82F6' },
  filler: { icon: 'layers', color: '#8B5CF6' },
  tape: { icon: 'bandage', color: '#F59E0B' },
  abrasive: { icon: 'disc', color: '#6B7280' },
  tools: { icon: 'construct', color: '#10B981' },
  plumbing: { icon: 'water', color: '#06B6D4' },
  electrical: { icon: 'flash', color: '#EF4444' },
};

function getCategoryStyle(category?: string): { icon: IconName; color: string } {
  if (!category) return { icon: 'cube', color: '#999' };
  const key = category.toLowerCase();
  return CATEGORY_ICONS[key] ?? { icon: 'cube', color: '#6B7280' };
}

// ── Material Detail Panel (expanded) ─────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function MaterialDetailPanel({ material }: { material: Material }) {
  const { suppliers, jobMaterials, priceObservations } = useAppState();

  // Price observations for this material
  const prices = priceObservations[material.id] ?? [];

  // Count how many jobs use this material
  const jobCount = useMemo(() => {
    let count = 0;
    for (const jms of Object.values(jobMaterials)) {
      if (jms.some((jm) => jm.materialId === material.id)) count++;
    }
    return count;
  }, [jobMaterials, material.id]);

  // Find suppliers that have delivered this material
  const usedSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const jms of Object.values(jobMaterials)) {
      for (const jm of jms) {
        if (jm.materialId === material.id && jm.supplierId) ids.add(jm.supplierId);
      }
    }
    return ids;
  }, [jobMaterials, material.id]);

  const linkedSuppliers = suppliers.filter((s) => usedSupplierIds.has(s.id));

  return (
    <View style={styles.detailPanel}>
      {/* Specs */}
      {material.specifications && Object.keys(material.specifications).length > 0 && (
        <View style={styles.specsSection}>
          <Text style={styles.detailSectionTitle}>Specificaties</Text>
          {Object.entries(material.specifications).map(([key, value]) => (
            <View key={key} style={styles.specRow}>
              <Text style={styles.specKey}>{key}</Text>
              <Text style={styles.specValue}>{value}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Usage stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{material.avgMonthlyUsage ?? '-'}</Text>
          <Text style={styles.statLabel}>{material.baseUnit}/mnd</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{material.reorderPoint ?? '-'}</Text>
          <Text style={styles.statLabel}>Bestelpunt</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{jobCount}</Text>
          <Text style={styles.statLabel}>Klussen</Text>
        </View>
      </View>

      {/* Demand pattern badge */}
      <View style={styles.demandBadge}>
        <Ionicons
          name={material.demandPattern === 'seasonal' ? 'partly-sunny' : material.demandPattern === 'project_based' ? 'briefcase' : 'trending-up'}
          size={12}
          color="#666"
        />
        <Text style={styles.demandText}>
          {material.demandPattern === 'steady' ? 'Regelmatig' : material.demandPattern === 'seasonal' ? 'Seizoensgebonden' : 'Projectmatig'}
        </Text>
      </View>

      {/* Price history */}
      {prices.length > 0 && (
        <View style={styles.priceSection}>
          <View style={styles.priceSectionHeader}>
            <Text style={styles.detailSectionTitle}>Prijshistorie</Text>
            {prices.length >= 2 && (() => {
              const latest = prices[0].price;
              const previous = prices[1].price;
              const trendColor = latest > previous ? '#EF4444' : latest < previous ? '#16A34A' : '#999';
              const trendLabel = latest > previous ? 'Stijgend' : latest < previous ? 'Dalend' : 'Stabiel';
              return (
                <View style={[styles.trendBadge, { backgroundColor: trendColor + '12' }]}>
                  <Ionicons
                    name={latest > previous ? 'arrow-up' : latest < previous ? 'arrow-down' : 'remove'}
                    size={10}
                    color={trendColor}
                  />
                  <Text style={[styles.trendText, { color: trendColor }]}>{trendLabel}</Text>
                </View>
              );
            })()}
          </View>
          {prices.slice(0, 5).map((po) => (
            <View key={po.id} style={styles.priceRow}>
              <Text style={styles.priceSupplier} numberOfLines={1}>
                {po.supplierName ?? 'Onbekend'}
              </Text>
              <Text style={styles.priceAmount}>
                {'\u20AC'}{po.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              {po.isSale && (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleText}>Sale</Text>
                </View>
              )}
              <Text style={styles.priceDate}>{formatDate(po.observedAt)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Linked suppliers */}
      {linkedSuppliers.length > 0 && (
        <View style={styles.suppliersSection}>
          <Text style={styles.detailSectionTitle}>Leveranciers</Text>
          {linkedSuppliers.map((sup) => (
            <View key={sup.id} style={styles.supplierRow}>
              <View style={styles.supplierDot} />
              <Text style={styles.supplierName} numberOfLines={1}>{sup.name}</Text>
              {sup.reliabilityScore != null && (
                <View style={[styles.scoreBadge, {
                  backgroundColor: sup.reliabilityScore >= 90 ? '#16A34A12' : sup.reliabilityScore >= 70 ? '#F59E0B12' : '#EF444412',
                }]}>
                  <Text style={[styles.scoreText, {
                    color: sup.reliabilityScore >= 90 ? '#16A34A' : sup.reliabilityScore >= 70 ? '#F59E0B' : '#EF4444',
                  }]}>
                    {sup.reliabilityScore}%
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────

export default function MaterialsHubScreen() {
  const router = useRouter();
  const { materials, isLoading } = useAppState();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Derive categories from materials
  const categories = useMemo(() => {
    const cats = new Set(materials.map((m) => m.category));
    return Array.from(cats).sort();
  }, [materials]);

  // Filter materials by query and category
  const filteredMaterials = useMemo(() => {
    let result = materials;
    if (selectedCategory) {
      result = result.filter((m) => m.category === selectedCategory);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.brand && m.brand.toLowerCase().includes(q)) ||
          (m.sku && m.sku.toLowerCase().includes(q)) ||
          m.aliases.some((a) => a.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [materials, selectedCategory, query]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const renderMaterialItem = useCallback(({ item }: { item: Material }) => {
    const catStyle = getCategoryStyle(item.category);
    const isExpanded = expandedId === item.id;

    return (
      <Pressable style={styles.materialCard} onPress={() => toggleExpand(item.id)}>
        <View style={styles.materialHeader}>
          <View style={[styles.categoryDot, { backgroundColor: catStyle.color + '18' }]}>
            <Ionicons name={catStyle.icon} size={16} color={catStyle.color} />
          </View>
          <View style={styles.materialInfo}>
            <Text style={styles.materialName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.materialMeta}>
              {item.brand ? (
                <Text style={styles.materialBrand}>{item.brand}</Text>
              ) : null}
              {item.sku ? (
                <Text style={styles.materialSku}>{item.sku}</Text>
              ) : null}
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#999"
          />
        </View>
        {isExpanded && <MaterialDetailPanel material={item} />}
      </Pressable>
    );
  }, [expandedId, toggleExpand]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Materialen</Text>
          <Text style={styles.headerSubtitle}>
            {materials.length} items in catalogus
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Zoek materiaal, merk of SKU..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#CCC" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category Filter Chips */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={styles.chipContainer}
        >
          <Pressable
            style={[
              styles.chip,
              !selectedCategory && styles.chipSelected,
            ]}
            onPress={() => setSelectedCategory(undefined)}
          >
            <Text style={[
              styles.chipText,
              !selectedCategory && styles.chipTextSelected,
            ]}>
              Alles
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat}
              style={[
                styles.chip,
                selectedCategory === cat && styles.chipSelected,
              ]}
              onPress={() => setSelectedCategory(selectedCategory === cat ? undefined : cat)}
            >
              <Text style={[
                styles.chipText,
                selectedCategory === cat && styles.chipTextSelected,
              ]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Material List */}
      {filteredMaterials.length > 0 ? (
        <FlatList
          data={filteredMaterials}
          keyExtractor={(item) => item.id}
          renderItem={renderMaterialItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : !isLoading ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={48} color="#CCC" />
            <Text style={styles.emptyText}>
              {query || selectedCategory ? 'Geen resultaten' : 'Nog geen materialen'}
            </Text>
            <Text style={styles.emptySubtext}>
              {query || selectedCategory
                ? 'Probeer een andere zoekopdracht'
                : 'Importeer facturen of catalogi om je materialen-database op te bouwen'}
            </Text>
            {!query && !selectedCategory && (
              <Pressable
                style={styles.emptyButton}
                onPress={() => router.push('/(modals)/ingestion')}
              >
                <Ionicons name="scan" size={18} color="#fff" />
                <Text style={styles.emptyButtonText}>Importeren</Text>
              </Pressable>
            )}
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
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
    padding: 0,
  },

  // Category chips
  chipContainer: {
    maxHeight: 44,
  },
  chipRow: {
    paddingHorizontal: Spacing.md,
    gap: 6,
    paddingBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E4DF',
  },
  chipSelected: {
    backgroundColor: Palette.hermesOrange,
    borderColor: Palette.hermesOrange,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  chipTextSelected: {
    color: '#fff',
  },

  // Material list
  listContent: {
    padding: Spacing.md,
    gap: 8,
    paddingBottom: 40,
  },
  materialCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryDot: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialInfo: {
    flex: 1,
    gap: 2,
  },
  materialName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  materialMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  materialBrand: {
    fontSize: 12,
    color: '#999',
  },
  materialSku: {
    fontSize: 12,
    color: '#BBB',
  },

  // Detail Panel (expanded)
  detailPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EDE8',
    gap: 12,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  specsSection: {
    gap: 2,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  specKey: {
    fontSize: 13,
    color: '#999',
    textTransform: 'capitalize',
  },
  specValue: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FAFAF8',
    borderRadius: 10,
    padding: 10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  demandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#F0EDE8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  demandText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
  },
  priceSection: {
    gap: 4,
  },
  priceSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  priceSupplier: {
    flex: 1,
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  priceAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  saleBadge: {
    backgroundColor: '#16A34A12',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  saleText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
  },
  priceDate: {
    fontSize: 11,
    color: '#999',
    minWidth: 50,
    textAlign: 'right',
  },
  suppliersSection: {
    gap: 4,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  supplierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.hermesOrange,
  },
  supplierName: {
    flex: 1,
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  scoreBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyCard: {
    backgroundColor: '#fff',
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
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Palette.hermesOrange,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
