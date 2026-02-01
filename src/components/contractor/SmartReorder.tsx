// =============================================================================
// SMART REORDER COMPONENT
// =============================================================================
// Displays intelligent reorder suggestions based on inventory and usage patterns
// Includes bundles, price optimization, and bulk discount opportunities
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import {
  useInventory,
  useReorderSuggestions,
  ReorderSuggestion,
  ReorderBundle,
  MaterialInventory,
} from '../../services/reorderService';

// ============================================
// MAIN COMPONENT
// ============================================

export function SmartReorder() {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'inventory' | 'bundles'>('suggestions');
  const [selectedSuggestion, setSelectedSuggestion] = useState<ReorderSuggestion | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<ReorderBundle | null>(null);

  const { inventory, lowStockCount, updateStock } = useInventory();
  const {
    suggestions,
    criticalCount,
    markOrdered,
    dismissSuggestion,
    snoozeSuggestion,
    bundles,
    statistics,
  } = useReorderSuggestions();

  const tabs = [
    {
      key: 'suggestions' as const,
      label: 'Suggesties',
      icon: 'flash-outline' as const,
      badge: criticalCount > 0 ? criticalCount : undefined,
    },
    {
      key: 'inventory' as const,
      label: 'Voorraad',
      icon: 'cube-outline' as const,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      key: 'bundles' as const,
      label: 'Bundels',
      icon: 'gift-outline' as const,
      badge: bundles.length > 0 ? bundles.length : undefined,
    },
  ];

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.headerStats}>
        <View style={styles.headerStat}>
          <Ionicons name="shield-checkmark" size={24} color={SemanticColors.success} />
          <Text style={styles.headerStatValue}>{statistics.stockoutsAvoided}</Text>
          <Text style={styles.headerStatLabel}>Stockouts voorkomen</Text>
        </View>
        <View style={styles.headerStatDivider} />
        <View style={styles.headerStat}>
          <Ionicons name="wallet" size={24} color={SemanticColors.primary} />
          <Text style={styles.headerStatValue}>€{statistics.totalSavings}</Text>
          <Text style={styles.headerStatLabel}>Bespaard</Text>
        </View>
        <View style={styles.headerStatDivider} />
        <View style={styles.headerStat}>
          <Ionicons name="analytics" size={24} color="#FF9500" />
          <Text style={styles.headerStatValue}>{statistics.accuracyRate}%</Text>
          <Text style={styles.headerStatLabel}>Nauwkeurigheid</Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.key ? SemanticColors.primary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge && (
              <View style={[styles.badge, tab.key === 'suggestions' && styles.badgeUrgent]}>
                <Text style={styles.badgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'suggestions' && (
          <SuggestionsTab
            suggestions={suggestions}
            onSelect={setSelectedSuggestion}
            onMarkOrdered={markOrdered}
            onDismiss={dismissSuggestion}
            onSnooze={snoozeSuggestion}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab inventory={inventory} onUpdateStock={updateStock} />
        )}
        {activeTab === 'bundles' && (
          <BundlesTab bundles={bundles} onSelect={setSelectedBundle} />
        )}
      </ScrollView>

      {/* Suggestion Detail Modal */}
      <Modal
        visible={!!selectedSuggestion}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedSuggestion(null)}
      >
        {selectedSuggestion && (
          <SuggestionDetailModal
            suggestion={selectedSuggestion}
            onOrder={() => {
              markOrdered(selectedSuggestion.id);
              setSelectedSuggestion(null);
            }}
            onDismiss={(reason) => {
              dismissSuggestion(selectedSuggestion.id, reason);
              setSelectedSuggestion(null);
            }}
            onSnooze={(days) => {
              snoozeSuggestion(selectedSuggestion.id, days);
              setSelectedSuggestion(null);
            }}
            onClose={() => setSelectedSuggestion(null)}
          />
        )}
      </Modal>

      {/* Bundle Detail Modal */}
      <Modal
        visible={!!selectedBundle}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedBundle(null)}
      >
        {selectedBundle && (
          <BundleDetailModal
            bundle={selectedBundle}
            onOrder={() => {
              Alert.alert('Bestelling', 'Bundel toegevoegd aan winkelwagen');
              setSelectedBundle(null);
            }}
            onClose={() => setSelectedBundle(null)}
          />
        )}
      </Modal>
    </View>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function SuggestionsTab({
  suggestions,
  onSelect,
  onMarkOrdered,
  onDismiss,
  onSnooze,
}: {
  suggestions: ReorderSuggestion[];
  onSelect: (s: ReorderSuggestion) => void;
  onMarkOrdered: (id: string) => void;
  onDismiss: (id: string, reason?: string) => void;
  onSnooze: (id: string, days: number) => void;
}) {
  const critical = suggestions.filter((s) => s.priority === 'critical');
  const high = suggestions.filter((s) => s.priority === 'high');
  const other = suggestions.filter((s) => s.priority !== 'critical' && s.priority !== 'high');

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="checkmark-circle" size={64} color={SemanticColors.success} />
        <Text style={styles.emptyTitle}>Voorraad op orde!</Text>
        <Text style={styles.emptyText}>
          Er zijn momenteel geen bestelsugesties. We houden je voorraad in de gaten.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {critical.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle" size={20} color={SemanticColors.error} />
            <Text style={[styles.sectionTitle, { color: SemanticColors.error }]}>
              Kritiek ({critical.length})
            </Text>
          </View>
          {critical.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onPress={() => onSelect(suggestion)}
              onQuickOrder={() => onMarkOrdered(suggestion.id)}
            />
          ))}
        </>
      )}

      {high.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={20} color="#FF9500" />
            <Text style={[styles.sectionTitle, { color: '#FF9500' }]}>
              Hoge prioriteit ({high.length})
            </Text>
          </View>
          {high.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onPress={() => onSelect(suggestion)}
              onQuickOrder={() => onMarkOrdered(suggestion.id)}
            />
          ))}
        </>
      )}

      {other.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color={SemanticColors.textSecondary} />
            <Text style={styles.sectionTitle}>Binnenkort nodig ({other.length})</Text>
          </View>
          {other.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onPress={() => onSelect(suggestion)}
              onQuickOrder={() => onMarkOrdered(suggestion.id)}
            />
          ))}
        </>
      )}
    </View>
  );
}

function SuggestionCard({
  suggestion,
  onPress,
  onQuickOrder,
}: {
  suggestion: ReorderSuggestion;
  onPress: () => void;
  onQuickOrder: () => void;
}) {
  const getPriorityColor = (priority: ReorderSuggestion['priority']) => {
    switch (priority) {
      case 'critical':
        return SemanticColors.error;
      case 'high':
        return '#FF9500';
      case 'medium':
        return SemanticColors.warning;
      default:
        return SemanticColors.textSecondary;
    }
  };

  const getPriorityIcon = (priority: ReorderSuggestion['priority']): keyof typeof Ionicons.glyphMap => {
    switch (priority) {
      case 'critical':
        return 'alert-circle';
      case 'high':
        return 'warning';
      default:
        return 'time';
    }
  };

  return (
    <TouchableOpacity style={styles.suggestionCard} onPress={onPress}>
      <View style={styles.suggestionHeader}>
        <View
          style={[
            styles.priorityIndicator,
            { backgroundColor: getPriorityColor(suggestion.priority) },
          ]}
        />
        <View style={styles.suggestionInfo}>
          <Text style={styles.suggestionName} numberOfLines={1}>
            {suggestion.materialName}
          </Text>
          <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
        </View>
        <View style={styles.urgencyBadge}>
          <Ionicons
            name={getPriorityIcon(suggestion.priority)}
            size={14}
            color={getPriorityColor(suggestion.priority)}
          />
          <Text style={[styles.urgencyText, { color: getPriorityColor(suggestion.priority) }]}>
            {suggestion.daysUntilStockout === 0
              ? 'Op!'
              : `${suggestion.daysUntilStockout}d`}
          </Text>
        </View>
      </View>

      <Text style={styles.suggestionReason} numberOfLines={2}>
        {suggestion.reason}
      </Text>

      <View style={styles.suggestionFooter}>
        <View style={styles.suggestionQuantity}>
          <Text style={styles.quantityLabel}>Bestel:</Text>
          <Text style={styles.quantityValue}>{suggestion.suggestedQuantity}x</Text>
          <Text style={styles.costValue}>
            €{suggestion.estimatedCost.toFixed(2)}
          </Text>
        </View>

        {(suggestion.bulkDiscount || suggestion.priceOptimization) && (
          <View style={styles.savingsBadge}>
            <Ionicons name="pricetag" size={12} color={SemanticColors.success} />
            <Text style={styles.savingsText}>
              {suggestion.bulkDiscount
                ? `${suggestion.bulkDiscount.discountPercent}% korting`
                : `€${suggestion.priceOptimization?.savings.toFixed(2)} besparing`}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.quickOrderButton}
          onPress={(e) => {
            e.stopPropagation();
            onQuickOrder();
          }}
        >
          <Ionicons name="cart" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function InventoryTab({
  inventory,
  onUpdateStock,
}: {
  inventory: MaterialInventory[];
  onUpdateStock: (id: string, stock: number) => void;
}) {
  const categories = useMemo(() => {
    const cats = [...new Set(inventory.map((i) => i.category))];
    return cats.sort();
  }, [inventory]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredInventory = selectedCategory
    ? inventory.filter((i) => i.category === selectedCategory)
    : inventory;

  return (
    <View style={styles.tabContent}>
      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
        contentContainerStyle={styles.categoryFilterContent}
      >
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
            Alle
          </Text>
        </TouchableOpacity>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Inventory List */}
      {filteredInventory.map((item) => (
        <InventoryCard key={item.id} item={item} onUpdateStock={onUpdateStock} />
      ))}
    </View>
  );
}

function InventoryCard({
  item,
  onUpdateStock,
}: {
  item: MaterialInventory;
  onUpdateStock: (id: string, stock: number) => void;
}) {
  const stockLevel = item.currentStock / item.optimalStock;
  const stockColor =
    item.currentStock === 0
      ? SemanticColors.error
      : item.currentStock <= item.minimumStock
      ? '#FF9500'
      : SemanticColors.success;

  const getTrendIcon = (trend: MaterialInventory['usageTrend']): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'increasing':
        return 'trending-up';
      case 'decreasing':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  return (
    <View style={styles.inventoryCard}>
      <View style={styles.inventoryHeader}>
        <View style={styles.inventoryInfo}>
          <Text style={styles.inventoryName} numberOfLines={1}>
            {item.materialName}
          </Text>
          <Text style={styles.inventoryMeta}>
            {item.category} • {item.preferredSupplier}
          </Text>
        </View>
        <View style={styles.trendIndicator}>
          <Ionicons
            name={getTrendIcon(item.usageTrend)}
            size={16}
            color={
              item.usageTrend === 'increasing'
                ? SemanticColors.error
                : item.usageTrend === 'decreasing'
                ? SemanticColors.success
                : SemanticColors.textSecondary
            }
          />
        </View>
      </View>

      {/* Stock Bar */}
      <View style={styles.stockBarContainer}>
        <View style={styles.stockBar}>
          <View
            style={[
              styles.stockBarFill,
              {
                width: `${Math.min(stockLevel * 100, 100)}%`,
                backgroundColor: stockColor,
              },
            ]}
          />
          <View
            style={[
              styles.stockMinimumMarker,
              { left: `${(item.minimumStock / item.optimalStock) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.stockLabels}>
          <Text style={[styles.stockValue, { color: stockColor }]}>
            {item.currentStock} {item.unit}
          </Text>
          <Text style={styles.stockOptimal}>
            Optimaal: {item.optimalStock} {item.unit}
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.inventoryActions}>
        <View style={styles.usageInfo}>
          <Text style={styles.usageLabel}>Verbruik:</Text>
          <Text style={styles.usageValue}>
            {item.avgWeeklyUsage.toFixed(1)} {item.unit}/week
          </Text>
        </View>
        <View style={styles.stockButtons}>
          <TouchableOpacity
            style={styles.stockButton}
            onPress={() => onUpdateStock(item.id, Math.max(0, item.currentStock - 1))}
          >
            <Ionicons name="remove" size={18} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stockButton}
            onPress={() => onUpdateStock(item.id, item.currentStock + 1)}
          >
            <Ionicons name="add" size={18} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function BundlesTab({
  bundles,
  onSelect,
}: {
  bundles: ReorderBundle[];
  onSelect: (bundle: ReorderBundle) => void;
}) {
  if (bundles.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="gift-outline" size={64} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyTitle}>Geen bundels beschikbaar</Text>
        <Text style={styles.emptyText}>
          Op basis van je bestelsugesties zijn er momenteel geen relevante bundels.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Text style={styles.bundlesIntro}>
        Deze bundels zijn geselecteerd op basis van je huidige bestelsugesties en bieden extra korting.
      </Text>
      {bundles.map((bundle) => (
        <TouchableOpacity
          key={bundle.id}
          style={styles.bundleCard}
          onPress={() => onSelect(bundle)}
        >
          <View style={styles.bundleHeader}>
            <View style={styles.bundleInfo}>
              <Text style={styles.bundleName}>{bundle.name}</Text>
              <Text style={styles.bundleSupplier}>{bundle.supplier}</Text>
            </View>
            <View style={styles.bundleSavings}>
              <Text style={styles.bundleSavingsValue}>-{bundle.savingsPercent}%</Text>
              <Text style={styles.bundleSavingsAmount}>€{bundle.savings.toFixed(2)}</Text>
            </View>
          </View>

          <Text style={styles.bundleDescription}>{bundle.description}</Text>

          <View style={styles.bundleItems}>
            {bundle.items.slice(0, 3).map((item, idx) => (
              <View key={idx} style={styles.bundleItem}>
                <Text style={styles.bundleItemName} numberOfLines={1}>
                  {item.materialName}
                </Text>
                <Text style={styles.bundleItemQty}>{item.quantity}x</Text>
              </View>
            ))}
            {bundle.items.length > 3 && (
              <Text style={styles.bundleMoreItems}>
                +{bundle.items.length - 3} meer items
              </Text>
            )}
          </View>

          <View style={styles.bundleFooter}>
            <View style={styles.bundleTotal}>
              <Text style={styles.bundleTotalLabel}>Totaal</Text>
              <Text style={styles.bundleTotalValue}>
                €{bundle.totalValue.toFixed(2)}
              </Text>
            </View>
            <View style={styles.bundleValid}>
              <Ionicons name="time-outline" size={14} color={SemanticColors.textSecondary} />
              <Text style={styles.bundleValidText}>
                Geldig t/m {new Date(bundle.validUntil).toLocaleDateString('nl-NL')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ============================================
// MODAL COMPONENTS
// ============================================

function SuggestionDetailModal({
  suggestion,
  onOrder,
  onDismiss,
  onSnooze,
  onClose,
}: {
  suggestion: ReorderSuggestion;
  onOrder: () => void;
  onDismiss: (reason?: string) => void;
  onSnooze: (days: number) => void;
  onClose: () => void;
}) {
  const getPriorityLabel = (priority: ReorderSuggestion['priority']) => {
    switch (priority) {
      case 'critical':
        return 'Kritiek';
      case 'high':
        return 'Hoog';
      case 'medium':
        return 'Gemiddeld';
      default:
        return 'Laag';
    }
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Bestelsugestie</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          <Text style={styles.detailName}>{suggestion.materialName}</Text>
          <Text style={styles.detailCategory}>{suggestion.category}</Text>

          {/* Priority & Urgency */}
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Prioriteit</Text>
              <Text style={styles.detailValue}>{getPriorityLabel(suggestion.priority)}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Dagen tot stockout</Text>
              <Text style={styles.detailValue}>
                {suggestion.daysUntilStockout === 0 ? 'Nu!' : suggestion.daysUntilStockout}
              </Text>
            </View>
          </View>

          {/* Order Details */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Besteladvies</Text>
            <View style={styles.orderDetails}>
              <View style={styles.orderDetail}>
                <Text style={styles.orderDetailLabel}>Aanbevolen hoeveelheid</Text>
                <Text style={styles.orderDetailValue}>{suggestion.suggestedQuantity}x</Text>
              </View>
              <View style={styles.orderDetail}>
                <Text style={styles.orderDetailLabel}>Geschatte kosten</Text>
                <Text style={styles.orderDetailValue}>
                  €{suggestion.estimatedCost.toFixed(2)}
                </Text>
              </View>
              <View style={styles.orderDetail}>
                <Text style={styles.orderDetailLabel}>Bestel voor</Text>
                <Text style={styles.orderDetailValue}>
                  {new Date(suggestion.suggestedOrderDate).toLocaleDateString('nl-NL')}
                </Text>
              </View>
            </View>
          </View>

          {/* Bulk Discount */}
          {suggestion.bulkDiscount && (
            <View style={styles.savingsBox}>
              <Ionicons name="pricetag" size={24} color={SemanticColors.success} />
              <View style={styles.savingsContent}>
                <Text style={styles.savingsTitle}>Bulkkorting beschikbaar!</Text>
                <Text style={styles.savingsDescription}>
                  Bestel {suggestion.bulkDiscount.quantity}x en bespaar{' '}
                  {suggestion.bulkDiscount.discountPercent}% (€
                  {suggestion.bulkDiscount.savings.toFixed(2)})
                </Text>
              </View>
            </View>
          )}

          {/* Price Optimization */}
          {suggestion.priceOptimization && (
            <View style={styles.savingsBox}>
              <Ionicons name="swap-horizontal" size={24} color={SemanticColors.primary} />
              <View style={styles.savingsContent}>
                <Text style={styles.savingsTitle}>Betere prijs gevonden!</Text>
                <Text style={styles.savingsDescription}>
                  {suggestion.priceOptimization.betterSupplier} biedt €
                  {suggestion.priceOptimization.betterPrice.toFixed(2)} ipv €
                  {suggestion.priceOptimization.currentPrice.toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          {/* Confidence */}
          <View style={styles.confidenceSection}>
            <Text style={styles.confidenceTitle}>Betrouwbaarheid analyse</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[styles.confidenceFill, { width: `${suggestion.confidence * 100}%` }]}
              />
            </View>
            <Text style={styles.confidenceValue}>
              {Math.round(suggestion.confidence * 100)}% zekerheid
            </Text>
            <Text style={styles.confidenceBased}>
              Gebaseerd op: {suggestion.basedOn.join(', ')}
            </Text>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.snoozeButton} onPress={() => onSnooze(3)}>
            <Ionicons name="time" size={20} color={SemanticColors.textSecondary} />
            <Text style={styles.snoozeText}>3 dagen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={() => onDismiss()}>
            <Text style={styles.dismissText}>Afwijzen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.orderButton} onPress={onOrder}>
            <Ionicons name="cart" size={20} color="#FFFFFF" />
            <Text style={styles.orderText}>Bestellen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function BundleDetailModal({
  bundle,
  onOrder,
  onClose,
}: {
  bundle: ReorderBundle;
  onOrder: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Bundel Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          <View style={styles.bundleDetailHeader}>
            <Text style={styles.bundleDetailName}>{bundle.name}</Text>
            <View style={styles.bundleDetailSavings}>
              <Text style={styles.bundleDetailSavingsPercent}>-{bundle.savingsPercent}%</Text>
            </View>
          </View>
          <Text style={styles.bundleDetailSupplier}>
            <Ionicons name="storefront-outline" size={14} /> {bundle.supplier}
          </Text>
          <Text style={styles.bundleDetailDescription}>{bundle.description}</Text>

          {/* Items */}
          <View style={styles.bundleDetailItems}>
            <Text style={styles.bundleDetailItemsTitle}>Inhoud ({bundle.items.length} items)</Text>
            {bundle.items.map((item, idx) => (
              <View key={idx} style={styles.bundleDetailItem}>
                <View style={styles.bundleDetailItemInfo}>
                  <Text style={styles.bundleDetailItemName}>{item.materialName}</Text>
                  <Text style={styles.bundleDetailItemQty}>{item.quantity}x</Text>
                </View>
                <Text style={styles.bundleDetailItemPrice}>
                  €{(item.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Total */}
          <View style={styles.bundleDetailTotal}>
            <View style={styles.bundleDetailTotalRow}>
              <Text style={styles.bundleDetailTotalLabel}>Subtotaal</Text>
              <Text style={styles.bundleDetailTotalValue}>
                €{(bundle.totalValue + bundle.savings).toFixed(2)}
              </Text>
            </View>
            <View style={styles.bundleDetailTotalRow}>
              <Text style={[styles.bundleDetailTotalLabel, { color: SemanticColors.success }]}>
                Bundelkorting
              </Text>
              <Text style={[styles.bundleDetailTotalValue, { color: SemanticColors.success }]}>
                -€{bundle.savings.toFixed(2)}
              </Text>
            </View>
            <View style={styles.bundleDetailDivider} />
            <View style={styles.bundleDetailTotalRow}>
              <Text style={styles.bundleDetailFinalLabel}>Totaal</Text>
              <Text style={styles.bundleDetailFinalValue}>€{bundle.totalValue.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.bundleDetailValid}>
            <Ionicons name="calendar-outline" size={16} color={SemanticColors.textSecondary} />
            <Text style={styles.bundleDetailValidText}>
              Aanbieding geldig t/m {new Date(bundle.validUntil).toLocaleDateString('nl-NL')}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Annuleren</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.orderButton} onPress={onOrder}>
            <Ionicons name="cart" size={20} color="#FFFFFF" />
            <Text style={styles.orderText}>Bundel Bestellen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SemanticColors.background,
  },

  // Header Stats
  headerStats: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.cardBackground,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  headerStat: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    marginTop: 4,
  },
  headerStatLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  headerStatDivider: {
    width: 1,
    backgroundColor: SemanticColors.border,
    marginVertical: 8,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: SemanticColors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: SemanticColors.primary,
  },
  tabLabel: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  tabLabelActive: {
    color: SemanticColors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: SemanticColors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeUrgent: {
    backgroundColor: SemanticColors.error,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Content
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },

  // Suggestion Card
  suggestionCard: {
    backgroundColor: SemanticColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  suggestionCategory: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  urgencyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionReason: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  suggestionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quantityLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  quantityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  costValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.primary,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SemanticColors.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '600',
    color: SemanticColors.success,
  },
  quickOrderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SemanticColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Inventory
  categoryFilter: {
    marginBottom: 16,
  },
  categoryFilterContent: {
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SemanticColors.cardBackground,
  },
  categoryChipActive: {
    backgroundColor: SemanticColors.primary,
  },
  categoryChipText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inventoryCard: {
    backgroundColor: SemanticColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  inventoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  inventoryInfo: {
    flex: 1,
  },
  inventoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  inventoryMeta: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  trendIndicator: {
    padding: 4,
  },
  stockBarContainer: {
    marginBottom: 12,
  },
  stockBar: {
    height: 8,
    backgroundColor: SemanticColors.border,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  stockMinimumMarker: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    backgroundColor: SemanticColors.textSecondary,
  },
  stockLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stockValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockOptimal: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  inventoryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  usageLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  usageValue: {
    fontSize: 13,
    fontWeight: '500',
    color: SemanticColors.textPrimary,
  },
  stockButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  stockButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SemanticColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bundles
  bundlesIntro: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  bundleCard: {
    backgroundColor: SemanticColors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bundleInfo: {
    flex: 1,
  },
  bundleName: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  bundleSupplier: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  bundleSavings: {
    alignItems: 'flex-end',
  },
  bundleSavingsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.success,
  },
  bundleSavingsAmount: {
    fontSize: 12,
    color: SemanticColors.success,
  },
  bundleDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginBottom: 12,
  },
  bundleItems: {
    backgroundColor: SemanticColors.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  bundleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  bundleItemName: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  bundleItemQty: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
  bundleMoreItems: {
    fontSize: 12,
    color: SemanticColors.primary,
    marginTop: 4,
  },
  bundleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bundleTotal: {},
  bundleTotalLabel: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },
  bundleTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  bundleValid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bundleValidText: {
    fontSize: 11,
    color: SemanticColors.textSecondary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: SemanticColors.cardBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: SemanticColors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  modalClose: {
    padding: 4,
  },
  modalBody: {
    padding: 16,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: SemanticColors.border,
  },

  // Detail Modal
  detailName: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  detailCategory: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  orderDetails: {
    backgroundColor: SemanticColors.background,
    borderRadius: 12,
    padding: 16,
  },
  orderDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderDetailLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  orderDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  savingsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: SemanticColors.success + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  savingsContent: {
    flex: 1,
  },
  savingsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  savingsDescription: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
    marginTop: 4,
  },
  confidenceSection: {
    marginBottom: 16,
  },
  confidenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 8,
  },
  confidenceBar: {
    height: 6,
    backgroundColor: SemanticColors.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: SemanticColors.primary,
    borderRadius: 3,
  },
  confidenceValue: {
    fontSize: 13,
    color: SemanticColors.textPrimary,
    marginBottom: 4,
  },
  confidenceBased: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: SemanticColors.background,
  },
  snoozeText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: SemanticColors.background,
  },
  dismissText: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  orderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.primary,
  },
  orderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: SemanticColors.background,
  },
  cancelText: {
    fontSize: 16,
    color: SemanticColors.textSecondary,
  },

  // Bundle Detail Modal
  bundleDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bundleDetailName: {
    fontSize: 20,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
    flex: 1,
  },
  bundleDetailSavings: {
    backgroundColor: SemanticColors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  bundleDetailSavingsPercent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bundleDetailSupplier: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 8,
  },
  bundleDetailDescription: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  bundleDetailItems: {
    marginBottom: 20,
  },
  bundleDetailItemsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
    marginBottom: 12,
  },
  bundleDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SemanticColors.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  bundleDetailItemInfo: {
    flex: 1,
  },
  bundleDetailItemName: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  bundleDetailItemQty: {
    fontSize: 12,
    color: SemanticColors.textSecondary,
    marginTop: 2,
  },
  bundleDetailItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  bundleDetailTotal: {
    backgroundColor: SemanticColors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  bundleDetailTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bundleDetailTotalLabel: {
    fontSize: 14,
    color: SemanticColors.textSecondary,
  },
  bundleDetailTotalValue: {
    fontSize: 14,
    color: SemanticColors.textPrimary,
  },
  bundleDetailDivider: {
    height: 1,
    backgroundColor: SemanticColors.border,
    marginVertical: 8,
  },
  bundleDetailFinalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: SemanticColors.textPrimary,
  },
  bundleDetailFinalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: SemanticColors.textPrimary,
  },
  bundleDetailValid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: SemanticColors.background,
    borderRadius: 8,
  },
  bundleDetailValidText: {
    fontSize: 13,
    color: SemanticColors.textSecondary,
  },
});

export default SmartReorder;
