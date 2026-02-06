// =============================================================================
// SUPPLIER HUB COMPONENT
// =============================================================================
// Central hub for supplier management, product search, and ordering
// Provides real-time pricing and stock availability across suppliers
// =============================================================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SemanticColors } from '../../theme/colors';
import {
  useSuppliers,
  useProductSearch,
  useCart,
  useOrders,
  Supplier,
  SupplierProduct,
  Order,
  Cart,
} from '../../services/supplierIntegrationService';

// ============================================
// MAIN COMPONENT
// ============================================

export function SupplierHub() {
  const [activeTab, setActiveTab] = useState<'suppliers' | 'products' | 'orders' | 'cart'>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SupplierProduct | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { suppliers, connectedCount, connectSupplier, syncSupplier, statistics } = useSuppliers();
  const { products, comparePrices } = useProductSearch({ query: searchQuery, inStockOnly: true });
  const { carts, totalItems, addToCart, updateCartItem, submitOrder, clearCart } = useCart();
  const { orders } = useOrders();

  const tabs = [
    { key: 'suppliers' as const, label: 'Leveranciers', icon: 'business-outline' as const },
    { key: 'products' as const, label: 'Producten', icon: 'cube-outline' as const },
    { key: 'orders' as const, label: 'Bestellingen', icon: 'receipt-outline' as const },
    { key: 'cart' as const, label: 'Winkelwagen', icon: 'cart-outline' as const, badge: totalItems > 0 ? totalItems : undefined },
  ];

  return (
    <View style={styles.container}>
      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{connectedCount}</Text>
          <Text style={styles.statLabel}>Leveranciers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{statistics.ordersThisMonth}</Text>
          <Text style={styles.statLabel}>Bestellingen</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: SemanticColors.feedbackSuccess }]}>
            {statistics.avgSavings}%
          </Text>
          <Text style={styles.statLabel}>Bespaard</Text>
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
              color={activeTab === tab.key ? SemanticColors.actionPrimary : SemanticColors.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {tab.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar (for products tab) */}
      {activeTab === 'products' && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={SemanticColors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Zoek producten..."
            placeholderTextColor={SemanticColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={SemanticColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'suppliers' && (
          <SuppliersTab
            suppliers={suppliers}
            onSelect={setSelectedSupplier}
            onConnect={connectSupplier}
            onSync={syncSupplier}
          />
        )}
        {activeTab === 'products' && (
          <ProductsTab
            products={products}
            searchQuery={searchQuery}
            onSelect={setSelectedProduct}
            onAddToCart={addToCart}
            comparePrices={comparePrices}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab orders={orders} onSelect={setSelectedOrder} />
        )}
        {activeTab === 'cart' && (
          <CartTab
            carts={carts}
            onUpdateItem={updateCartItem}
            onClearCart={clearCart}
            onSubmitOrder={submitOrder}
          />
        )}
      </ScrollView>

      {/* Supplier Detail Modal */}
      <Modal
        visible={!!selectedSupplier}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedSupplier(null)}
      >
        {selectedSupplier && (
          <SupplierDetailModal
            supplier={selectedSupplier}
            onConnect={() => {
              connectSupplier(selectedSupplier.id);
              setSelectedSupplier(null);
            }}
            onSync={() => syncSupplier(selectedSupplier.id)}
            onClose={() => setSelectedSupplier(null)}
          />
        )}
      </Modal>

      {/* Product Detail Modal */}
      <Modal
        visible={!!selectedProduct}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedProduct(null)}
      >
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onAddToCart={(qty) => {
              addToCart(selectedProduct, qty);
              setSelectedProduct(null);
              Alert.alert('Toegevoegd', `${qty}x ${selectedProduct.name} toegevoegd aan winkelwagen.`);
            }}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </Modal>

      {/* Order Detail Modal */}
      <Modal
        visible={!!selectedOrder}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedOrder(null)}
      >
        {selectedOrder && (
          <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
        )}
      </Modal>
    </View>
  );
}

// ============================================
// TAB COMPONENTS
// ============================================

function SuppliersTab({
  suppliers,
  onSelect,
  onConnect,
  onSync,
}: {
  suppliers: Supplier[];
  onSelect: (s: Supplier) => void;
  onConnect: (id: string) => void;
  onSync: (id: string) => void;
}) {
  const connected = suppliers.filter((s) => s.integrationStatus === 'connected');
  const available = suppliers.filter((s) => s.integrationStatus === 'available' || s.integrationStatus === 'pending');

  return (
    <View style={styles.tabContent}>
      {/* Connected Suppliers */}
      <Text style={styles.sectionTitle}>Verbonden ({connected.length})</Text>
      {connected.map((supplier) => (
        <SupplierCard
          key={supplier.id}
          supplier={supplier}
          onPress={() => onSelect(supplier)}
          onSync={() => onSync(supplier.id)}
        />
      ))}

      {/* Available Suppliers */}
      {available.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Beschikbaar ({available.length})</Text>
          {available.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              onPress={() => onSelect(supplier)}
              onConnect={() => onConnect(supplier.id)}
            />
          ))}
        </>
      )}
    </View>
  );
}

function SupplierCard({
  supplier,
  onPress,
  onConnect,
  onSync,
}: {
  supplier: Supplier;
  onPress: () => void;
  onConnect?: () => void;
  onSync?: () => void;
}) {
  const getStatusColor = (status: Supplier['integrationStatus']) => {
    switch (status) {
      case 'connected': return SemanticColors.feedbackSuccess;
      case 'pending': return SemanticColors.feedbackWarning;
      case 'available': return SemanticColors.actionPrimary;
      default: return SemanticColors.textSecondary;
    }
  };

  const getStatusLabel = (status: Supplier['integrationStatus']) => {
    switch (status) {
      case 'connected': return 'Verbonden';
      case 'pending': return 'In behandeling';
      case 'available': return 'Beschikbaar';
      default: return 'Niet beschikbaar';
    }
  };

  return (
    <TouchableOpacity style={styles.supplierCard} onPress={onPress}>
      <View style={styles.supplierLogo}>
        <Ionicons name="business" size={28} color={SemanticColors.actionPrimary} />
      </View>
      <View style={styles.supplierInfo}>
        <Text style={styles.supplierName}>{supplier.name}</Text>
        <Text style={styles.supplierCategories} numberOfLines={1}>
          {supplier.categories.slice(0, 3).join(' • ')}
        </Text>
        <View style={styles.supplierMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.metaText}>{supplier.productCount.toLocaleString()} producten</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="car-outline" size={14} color={SemanticColors.textSecondary} />
            <Text style={styles.metaText}>{supplier.avgDeliveryDays}d levering</Text>
          </View>
        </View>
      </View>
      <View style={styles.supplierActions}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(supplier.integrationStatus) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(supplier.integrationStatus) }]}>
            {getStatusLabel(supplier.integrationStatus)}
          </Text>
        </View>
        {supplier.integrationStatus === 'connected' && onSync && (
          <TouchableOpacity style={styles.syncButton} onPress={(e) => { e.stopPropagation(); onSync(); }}>
            <Ionicons name="sync" size={18} color={SemanticColors.actionPrimary} />
          </TouchableOpacity>
        )}
        {supplier.integrationStatus === 'available' && onConnect && (
          <TouchableOpacity style={styles.connectButton} onPress={(e) => { e.stopPropagation(); onConnect(); }}>
            <Text style={styles.connectButtonText}>Verbinden</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ProductsTab({
  products,
  searchQuery,
  onSelect,
  onAddToCart,
  comparePrices,
}: {
  products: SupplierProduct[];
  searchQuery: string;
  onSelect: (p: SupplierProduct) => void;
  onAddToCart: (p: SupplierProduct, qty: number) => void;
  comparePrices: (name: string) => ReturnType<typeof useProductSearch>['comparePrices'] extends (n: string) => infer R ? R : never;
}) {
  if (!searchQuery) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search" size={64} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyTitle}>Zoek producten</Text>
        <Text style={styles.emptyText}>
          Zoek op productnaam, merk of artikelnummer om prijzen te vergelijken.
        </Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="alert-circle-outline" size={64} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyTitle}>Geen resultaten</Text>
        <Text style={styles.emptyText}>
          Probeer een andere zoekterm of controleer de spelling.
        </Text>
      </View>
    );
  }

  // Group products by name for comparison
  const comparison = comparePrices(searchQuery);

  return (
    <View style={styles.tabContent}>
      {comparison && (
        <View style={styles.comparisonBox}>
          <View style={styles.comparisonHeader}>
            <Text style={styles.comparisonTitle}>Prijsvergelijking</Text>
            <Text style={styles.comparisonProduct}>{comparison.productName}</Text>
          </View>
          <View style={styles.comparisonStats}>
            <View style={styles.comparisonStat}>
              <Text style={styles.comparisonStatLabel}>Beste prijs</Text>
              <Text style={[styles.comparisonStatValue, { color: SemanticColors.feedbackSuccess }]}>
                €{comparison.bestPrice.toFixed(2)}
              </Text>
            </View>
            <View style={styles.comparisonStat}>
              <Text style={styles.comparisonStatLabel}>Gemiddeld</Text>
              <Text style={styles.comparisonStatValue}>€{comparison.avgPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.comparisonStat}>
              <Text style={styles.comparisonStatLabel}>Bereik</Text>
              <Text style={styles.comparisonStatValue}>
                €{comparison.priceRange.min.toFixed(2)} - €{comparison.priceRange.max.toFixed(2)}
              </Text>
            </View>
          </View>
          {comparison.recommendation && (
            <View style={styles.recommendationBox}>
              <Ionicons name="bulb" size={16} color={SemanticColors.actionPrimary} />
              <Text style={styles.recommendationText}>{comparison.recommendation}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Resultaten ({products.length})</Text>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          isBestPrice={comparison?.suppliers.find((s) => s.supplierId === product.supplierId)?.isBestPrice}
          onPress={() => onSelect(product)}
          onAddToCart={() => onAddToCart(product, 1)}
        />
      ))}
    </View>
  );
}

function ProductCard({
  product,
  isBestPrice,
  onPress,
  onAddToCart,
}: {
  product: SupplierProduct;
  isBestPrice?: boolean;
  onPress: () => void;
  onAddToCart: () => void;
}) {
  const getStockColor = (level: SupplierProduct['stockLevel']) => {
    switch (level) {
      case 'high': return SemanticColors.feedbackSuccess;
      case 'medium': return SemanticColors.feedbackWarning;
      case 'low': return '#FF9500';
      default: return SemanticColors.feedbackError;
    }
  };

  return (
    <TouchableOpacity style={styles.productCard} onPress={onPress}>
      {isBestPrice && (
        <View style={styles.bestPriceBadge}>
          <Ionicons name="trophy" size={12} color="#FFFFFF" />
          <Text style={styles.bestPriceText}>Beste prijs</Text>
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.productSupplier}>{product.supplierName}</Text>
        <View style={styles.productMeta}>
          <View style={[styles.stockIndicator, { backgroundColor: getStockColor(product.stockLevel) }]} />
          <Text style={styles.productStock}>
            {product.inStock ? 'Op voorraad' : 'Niet op voorraad'}
          </Text>
          <Text style={styles.productDelivery}>• {product.deliveryDays}d levering</Text>
        </View>
      </View>
      <View style={styles.productPricing}>
        <Text style={styles.productPrice}>€{product.price.toFixed(2)}</Text>
        {product.listPrice && product.listPrice > product.price && (
          <Text style={styles.productListPrice}>€{product.listPrice.toFixed(2)}</Text>
        )}
        {product.discountPercent && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>-{product.discountPercent}%</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.addToCartButton}
          onPress={(e) => { e.stopPropagation(); onAddToCart(); }}
        >
          <Ionicons name="cart" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function OrdersTab({
  orders,
  onSelect,
}: {
  orders: Order[];
  onSelect: (o: Order) => void;
}) {
  if (orders.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="receipt-outline" size={64} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyTitle}>Geen bestellingen</Text>
        <Text style={styles.emptyText}>
          Je hebt nog geen bestellingen geplaatst via de Supplier Hub.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} onPress={() => onSelect(order)} />
      ))}
    </View>
  );
}

function OrderCard({
  order,
  onPress,
}: {
  order: Order;
  onPress: () => void;
}) {
  const getStatusColor = (status: Order['status']) => {
    switch (status) {
      case 'delivered': return SemanticColors.feedbackSuccess;
      case 'shipped': return SemanticColors.actionPrimary;
      case 'confirmed': return '#FF9500';
      case 'submitted': return SemanticColors.feedbackWarning;
      default: return SemanticColors.textSecondary;
    }
  };

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'draft': return 'Concept';
      case 'submitted': return 'Verzonden';
      case 'confirmed': return 'Bevestigd';
      case 'shipped': return 'Onderweg';
      case 'delivered': return 'Geleverd';
      case 'cancelled': return 'Geannuleerd';
      default: return status;
    }
  };

  return (
    <TouchableOpacity style={styles.orderCard} onPress={onPress}>
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderSupplier}>{order.supplierName}</Text>
          <Text style={styles.orderNumber}>
            {order.supplierOrderNumber || order.id}
          </Text>
        </View>
        <View style={[styles.orderStatusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Text style={[styles.orderStatusText, { color: getStatusColor(order.status) }]}>
            {getStatusLabel(order.status)}
          </Text>
        </View>
      </View>
      <View style={styles.orderItems}>
        <Text style={styles.orderItemsText}>
          {order.items.length} item{order.items.length > 1 ? 's' : ''} • €{order.total.toFixed(2)}
        </Text>
      </View>
      <View style={styles.orderFooter}>
        <Text style={styles.orderDate}>
          {new Date(order.createdAt).toLocaleDateString('nl-NL')}
        </Text>
        {order.expectedDelivery && order.status !== 'delivered' && (
          <Text style={styles.orderDelivery}>
            Verwacht: {new Date(order.expectedDelivery).toLocaleDateString('nl-NL')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function CartTab({
  carts,
  onUpdateItem,
  onClearCart,
  onSubmitOrder,
}: {
  carts: Cart[];
  onUpdateItem: (supplierId: string, productId: string, quantity: number) => void;
  onClearCart: (supplierId: string) => void;
  onSubmitOrder: (supplierId: string) => Order | null;
}) {
  if (carts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="cart-outline" size={64} color={SemanticColors.textSecondary} />
        <Text style={styles.emptyTitle}>Winkelwagen leeg</Text>
        <Text style={styles.emptyText}>
          Zoek producten en voeg ze toe aan je winkelwagen.
        </Text>
      </View>
    );
  }

  const handleSubmit = (cart: Cart) => {
    Alert.alert(
      'Bestelling plaatsen',
      `Wil je deze bestelling bij ${cart.supplierName} plaatsen?\n\nTotaal: €${(cart.total * 1.21).toFixed(2)} incl. BTW`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Bestellen',
          onPress: () => {
            const order = onSubmitOrder(cart.supplierId);
            if (order) {
              Alert.alert('Bestelling geplaatst!', `Je bestelling is verzonden naar ${cart.supplierName}.`);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.tabContent}>
      {carts.map((cart) => (
        <View key={cart.supplierId} style={styles.cartSection}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartSupplier}>{cart.supplierName}</Text>
            <TouchableOpacity onPress={() => onClearCart(cart.supplierId)}>
              <Text style={styles.clearCartText}>Leegmaken</Text>
            </TouchableOpacity>
          </View>

          {cart.items.map((item) => (
            <View key={item.product.id} style={styles.cartItem}>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.product.name}</Text>
                <Text style={styles.cartItemPrice}>€{item.product.price.toFixed(2)} per stuk</Text>
              </View>
              <View style={styles.cartItemQuantity}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => onUpdateItem(cart.supplierId, item.product.id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={18} color={SemanticColors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => onUpdateItem(cart.supplierId, item.product.id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={18} color={SemanticColors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.cartItemTotal}>
                €{(item.product.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}

          <View style={styles.cartTotals}>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Subtotaal</Text>
              <Text style={styles.cartTotalValue}>€{cart.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>Verzending</Text>
              <Text style={styles.cartTotalValue}>
                {cart.deliveryCost === 0 ? 'Gratis' : `€${cart.deliveryCost.toFixed(2)}`}
              </Text>
            </View>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>BTW (21%)</Text>
              <Text style={styles.cartTotalValue}>€{(cart.subtotal * 0.21).toFixed(2)}</Text>
            </View>
            <View style={[styles.cartTotalRow, styles.cartTotalFinal]}>
              <Text style={styles.cartFinalLabel}>Totaal</Text>
              <Text style={styles.cartFinalValue}>€{(cart.total * 1.21).toFixed(2)}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.checkoutButton} onPress={() => handleSubmit(cart)}>
            <Ionicons name="card" size={20} color="#FFFFFF" />
            <Text style={styles.checkoutText}>Bestelling plaatsen</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ============================================
// MODALS
// ============================================

function SupplierDetailModal({
  supplier,
  onConnect,
  onSync,
  onClose,
}: {
  supplier: Supplier;
  onConnect: () => void;
  onSync: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{supplier.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          {/* Stats */}
          <View style={styles.supplierStats}>
            <View style={styles.supplierStatItem}>
              <Text style={styles.supplierStatValue}>{supplier.productCount.toLocaleString()}</Text>
              <Text style={styles.supplierStatLabel}>Producten</Text>
            </View>
            <View style={styles.supplierStatDivider} />
            <View style={styles.supplierStatItem}>
              <Text style={styles.supplierStatValue}>{supplier.avgDeliveryDays}d</Text>
              <Text style={styles.supplierStatLabel}>Levering</Text>
            </View>
            <View style={styles.supplierStatDivider} />
            <View style={styles.supplierStatItem}>
              <Text style={styles.supplierStatValue}>{supplier.reliabilityScore}%</Text>
              <Text style={styles.supplierStatLabel}>Betrouwbaar</Text>
            </View>
          </View>

          {/* Categories */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Categorieën</Text>
            <View style={styles.categoryChips}>
              {supplier.categories.map((cat) => (
                <View key={cat} style={styles.categoryChip}>
                  <Text style={styles.categoryChipText}>{cat}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Details */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Details</Text>
            {supplier.minOrderValue && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Minimale bestelling</Text>
                <Text style={styles.detailValue}>€{supplier.minOrderValue}</Text>
              </View>
            )}
            {supplier.freeDeliveryThreshold && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Gratis verzending vanaf</Text>
                <Text style={styles.detailValue}>€{supplier.freeDeliveryThreshold}</Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Betaaltermijn</Text>
              <Text style={styles.detailValue}>{supplier.paymentTerms}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Prijsconcurrentie</Text>
              <Text style={styles.detailValue}>{supplier.priceCompetitiveness}/100</Text>
            </View>
          </View>

          {/* Contact */}
          {(supplier.accountManager || supplier.contactEmail) && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Contact</Text>
              {supplier.accountManager && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Accountmanager</Text>
                  <Text style={styles.detailValue}>{supplier.accountManager}</Text>
                </View>
              )}
              {supplier.website && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Website</Text>
                  <Text style={[styles.detailValue, { color: SemanticColors.actionPrimary }]}>{supplier.website}</Text>
                </View>
              )}
            </View>
          )}

          {/* Last Sync */}
          {supplier.lastSyncAt && (
            <Text style={styles.lastSync}>
              Laatste sync: {new Date(supplier.lastSyncAt).toLocaleString('nl-NL')}
            </Text>
          )}
        </ScrollView>

        <View style={styles.modalActions}>
          {supplier.integrationStatus === 'connected' ? (
            <TouchableOpacity style={styles.syncModalButton} onPress={onSync}>
              <Ionicons name="sync" size={20} color="#FFFFFF" />
              <Text style={styles.syncModalText}>Synchroniseren</Text>
            </TouchableOpacity>
          ) : supplier.integrationStatus === 'available' ? (
            <TouchableOpacity style={styles.connectModalButton} onPress={onConnect}>
              <Ionicons name="link" size={20} color="#FFFFFF" />
              <Text style={styles.connectModalText}>Verbinden</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function ProductDetailModal({
  product,
  onAddToCart,
  onClose,
}: {
  product: SupplierProduct;
  onAddToCart: (qty: number) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Product Details</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          <Text style={styles.productDetailName}>{product.name}</Text>
          {product.brand && <Text style={styles.productDetailBrand}>{product.brand}</Text>}
          <Text style={styles.productDetailSupplier}>
            <Ionicons name="business-outline" size={14} /> {product.supplierName}
          </Text>

          {/* Pricing */}
          <View style={styles.pricingSection}>
            <View style={styles.mainPrice}>
              <Text style={styles.priceLabel}>Prijs</Text>
              <Text style={styles.priceValue}>€{product.price.toFixed(2)}</Text>
              {product.listPrice && product.listPrice > product.price && (
                <Text style={styles.listPriceValue}>€{product.listPrice.toFixed(2)}</Text>
              )}
            </View>
            {product.bulkPrices && product.bulkPrices.length > 0 && (
              <View style={styles.bulkPrices}>
                <Text style={styles.bulkPricesTitle}>Staffelprijzen</Text>
                {product.bulkPrices.map((bp, idx) => (
                  <View key={idx} style={styles.bulkPriceRow}>
                    <Text style={styles.bulkPriceQty}>Vanaf {bp.minQty} stuks</Text>
                    <Text style={styles.bulkPriceValue}>€{bp.price.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Stock & Delivery */}
          <View style={styles.stockSection}>
            <View style={styles.stockRow}>
              <Ionicons
                name={product.inStock ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={product.inStock ? SemanticColors.feedbackSuccess : SemanticColors.feedbackError}
              />
              <Text style={styles.stockText}>
                {product.inStock
                  ? `Op voorraad${product.stockQuantity ? ` (${product.stockQuantity})` : ''}`
                  : 'Niet op voorraad'}
              </Text>
            </View>
            <View style={styles.deliveryRow}>
              <Ionicons name="car-outline" size={20} color={SemanticColors.textSecondary} />
              <Text style={styles.deliveryText}>
                Levering in {product.deliveryDays} werkdag{product.deliveryDays > 1 ? 'en' : ''}
              </Text>
            </View>
          </View>

          {/* Quantity Selector */}
          <View style={styles.quantitySection}>
            <Text style={styles.quantitySectionTitle}>Aantal</Text>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.quantitySelectorButton}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Ionicons name="remove" size={24} color={SemanticColors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.quantitySelectorValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.quantitySelectorButton}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Ionicons name="add" size={24} color={SemanticColors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.quantityTotal}>
              Totaal: €{(product.price * quantity).toFixed(2)}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={styles.addToCartModalButton}
            onPress={() => onAddToCart(quantity)}
          >
            <Ionicons name="cart" size={20} color="#FFFFFF" />
            <Text style={styles.addToCartModalText}>Toevoegen aan winkelwagen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function OrderDetailModal({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Bestelling</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={24} color={SemanticColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          <View style={styles.orderDetailHeader}>
            <Text style={styles.orderDetailSupplier}>{order.supplierName}</Text>
            <Text style={styles.orderDetailNumber}>{order.supplierOrderNumber || order.id}</Text>
          </View>

          {/* Items */}
          <View style={styles.orderDetailItems}>
            <Text style={styles.orderDetailItemsTitle}>Items</Text>
            {order.items.map((item, idx) => (
              <View key={idx} style={styles.orderDetailItem}>
                <View style={styles.orderDetailItemInfo}>
                  <Text style={styles.orderDetailItemName}>{item.productName}</Text>
                  <Text style={styles.orderDetailItemSku}>{item.sku}</Text>
                </View>
                <Text style={styles.orderDetailItemQty}>{item.quantity}x</Text>
                <Text style={styles.orderDetailItemPrice}>€{item.totalPrice.toFixed(2)}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.orderDetailTotals}>
            <View style={styles.orderDetailTotalRow}>
              <Text style={styles.orderDetailTotalLabel}>Subtotaal</Text>
              <Text style={styles.orderDetailTotalValue}>€{order.subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.orderDetailTotalRow}>
              <Text style={styles.orderDetailTotalLabel}>Verzending</Text>
              <Text style={styles.orderDetailTotalValue}>€{order.deliveryCost.toFixed(2)}</Text>
            </View>
            <View style={styles.orderDetailTotalRow}>
              <Text style={styles.orderDetailTotalLabel}>BTW</Text>
              <Text style={styles.orderDetailTotalValue}>€{order.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.orderDetailTotalRow, styles.orderDetailTotalFinal]}>
              <Text style={styles.orderDetailFinalLabel}>Totaal</Text>
              <Text style={styles.orderDetailFinalValue}>€{order.total.toFixed(2)}</Text>
            </View>
          </View>

          {/* Timeline */}
          <View style={styles.orderTimeline}>
            <Text style={styles.orderTimelineTitle}>Status</Text>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineLabel}>Besteld</Text>
                <Text style={styles.timelineDate}>
                  {new Date(order.createdAt).toLocaleString('nl-NL')}
                </Text>
              </View>
            </View>
            {order.submittedAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Verzonden naar leverancier</Text>
                  <Text style={styles.timelineDate}>
                    {new Date(order.submittedAt).toLocaleString('nl-NL')}
                  </Text>
                </View>
              </View>
            )}
            {order.status === 'delivered' && order.deliveredAt && (
              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: SemanticColors.feedbackSuccess }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Geleverd</Text>
                  <Text style={styles.timelineDate}>
                    {new Date(order.deliveredAt).toLocaleString('nl-NL')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SemanticColors.surfaceBackground },
  statsHeader: { flexDirection: 'row', backgroundColor: SemanticColors.surfaceBackground, paddingVertical: 16, paddingHorizontal: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: SemanticColors.textPrimary },
  statLabel: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: SemanticColors.borderDefault, marginVertical: 8 },
  tabBar: { flexDirection: 'row', backgroundColor: SemanticColors.surfaceBackground, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: SemanticColors.actionPrimary },
  tabLabel: { fontSize: 12, color: SemanticColors.textSecondary },
  tabLabelActive: { color: SemanticColors.actionPrimary, fontWeight: '600' },
  badge: { backgroundColor: SemanticColors.feedbackError, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfaceBackground, margin: 16, marginBottom: 0, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 12 },
  searchInput: { flex: 1, fontSize: 15, color: SemanticColors.textPrimary },
  content: { flex: 1 },
  tabContent: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: SemanticColors.textPrimary, marginBottom: 12, marginTop: 8 },
  emptyState: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: SemanticColors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: SemanticColors.textSecondary, textAlign: 'center', marginTop: 8 },
  supplierCard: { flexDirection: 'row', backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16, marginBottom: 12 },
  supplierLogo: { width: 56, height: 56, borderRadius: 12, backgroundColor: SemanticColors.actionPrimary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  supplierInfo: { flex: 1 },
  supplierName: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  supplierCategories: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 2 },
  supplierMeta: { flexDirection: 'row', marginTop: 8, gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: SemanticColors.textSecondary },
  supplierActions: { alignItems: 'flex-end', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  syncButton: { padding: 8 },
  connectButton: { backgroundColor: SemanticColors.actionPrimary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  connectButtonText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  comparisonBox: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16, marginBottom: 16 },
  comparisonHeader: { marginBottom: 12 },
  comparisonTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary },
  comparisonProduct: { fontSize: 13, color: SemanticColors.textSecondary, marginTop: 2 },
  comparisonStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  comparisonStat: { alignItems: 'center' },
  comparisonStatLabel: { fontSize: 11, color: SemanticColors.textSecondary },
  comparisonStatValue: { fontSize: 16, fontWeight: '700', color: SemanticColors.textPrimary, marginTop: 2 },
  recommendationBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: SemanticColors.actionPrimary + '10', padding: 12, borderRadius: 8 },
  recommendationText: { flex: 1, fontSize: 13, color: SemanticColors.textSecondary },
  productCard: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16, marginBottom: 12, flexDirection: 'row', position: 'relative' },
  bestPriceBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: SemanticColors.feedbackSuccess, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bestPriceText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: SemanticColors.textPrimary, marginTop: 16 },
  productSupplier: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 4 },
  productMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stockIndicator: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  productStock: { fontSize: 12, color: SemanticColors.textSecondary },
  productDelivery: { fontSize: 12, color: SemanticColors.textSecondary, marginLeft: 4 },
  productPricing: { alignItems: 'flex-end', marginLeft: 12 },
  productPrice: { fontSize: 18, fontWeight: '700', color: SemanticColors.textPrimary },
  productListPrice: { fontSize: 13, color: SemanticColors.textSecondary, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: SemanticColors.feedbackError, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  discountText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  addToCartButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: SemanticColors.actionPrimary, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  orderCard: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16, marginBottom: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderSupplier: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  orderNumber: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  orderStatusText: { fontSize: 11, fontWeight: '600' },
  orderItems: { marginTop: 12 },
  orderItemsText: { fontSize: 14, color: SemanticColors.textSecondary },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  orderDate: { fontSize: 12, color: SemanticColors.textSecondary },
  orderDelivery: { fontSize: 12, color: SemanticColors.actionPrimary },
  cartSection: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16, marginBottom: 16 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cartSupplier: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  clearCartText: { fontSize: 14, color: SemanticColors.feedbackError },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: '500', color: SemanticColors.textPrimary },
  cartItemPrice: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
  cartItemQuantity: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  quantityButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: SemanticColors.surfaceBackground, justifyContent: 'center', alignItems: 'center' },
  quantityText: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary, marginHorizontal: 12 },
  cartItemTotal: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary, width: 70, textAlign: 'right' },
  cartTotals: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartTotalLabel: { fontSize: 14, color: SemanticColors.textSecondary },
  cartTotalValue: { fontSize: 14, color: SemanticColors.textPrimary },
  cartTotalFinal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  cartFinalLabel: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  cartFinalValue: { fontSize: 18, fontWeight: '700', color: SemanticColors.textPrimary },
  checkoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SemanticColors.actionPrimary, paddingVertical: 16, borderRadius: 12, marginTop: 16 },
  checkoutText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: SemanticColors.surfaceBackground, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  modalTitle: { fontSize: 18, fontWeight: '600', color: SemanticColors.textPrimary },
  modalClose: { padding: 4 },
  modalBody: { padding: 16 },
  modalActions: { padding: 16, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  supplierStats: { flexDirection: 'row', backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16, marginBottom: 20 },
  supplierStatItem: { flex: 1, alignItems: 'center' },
  supplierStatValue: { fontSize: 20, fontWeight: '700', color: SemanticColors.textPrimary },
  supplierStatLabel: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 4 },
  supplierStatDivider: { width: 1, backgroundColor: SemanticColors.borderDefault },
  detailSection: { marginBottom: 20 },
  detailSectionTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary, marginBottom: 12 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { backgroundColor: SemanticColors.actionPrimary + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  categoryChipText: { fontSize: 13, color: SemanticColors.actionPrimary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: SemanticColors.borderDefault },
  detailLabel: { fontSize: 14, color: SemanticColors.textSecondary },
  detailValue: { fontSize: 14, fontWeight: '500', color: SemanticColors.textPrimary },
  lastSync: { fontSize: 12, color: SemanticColors.textSecondary, textAlign: 'center', marginTop: 16 },
  syncModalButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SemanticColors.actionPrimary, paddingVertical: 16, borderRadius: 12 },
  syncModalText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  connectModalButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SemanticColors.actionPrimary, paddingVertical: 16, borderRadius: 12 },
  connectModalText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  productDetailName: { fontSize: 20, fontWeight: '700', color: SemanticColors.textPrimary },
  productDetailBrand: { fontSize: 14, color: SemanticColors.actionPrimary, marginTop: 4 },
  productDetailSupplier: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 8 },
  pricingSection: { marginTop: 20, backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16 },
  mainPrice: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  priceLabel: { fontSize: 14, color: SemanticColors.textSecondary },
  priceValue: { fontSize: 28, fontWeight: '700', color: SemanticColors.textPrimary },
  listPriceValue: { fontSize: 16, color: SemanticColors.textSecondary, textDecorationLine: 'line-through' },
  bulkPrices: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  bulkPricesTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary, marginBottom: 8 },
  bulkPriceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  bulkPriceQty: { fontSize: 13, color: SemanticColors.textSecondary },
  bulkPriceValue: { fontSize: 13, fontWeight: '600', color: SemanticColors.feedbackSuccess },
  stockSection: { marginTop: 20 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  stockText: { fontSize: 14, color: SemanticColors.textPrimary },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deliveryText: { fontSize: 14, color: SemanticColors.textSecondary },
  quantitySection: { marginTop: 20 },
  quantitySectionTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary, marginBottom: 12 },
  quantitySelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  quantitySelectorButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: SemanticColors.surfaceBackground, justifyContent: 'center', alignItems: 'center' },
  quantitySelectorValue: { fontSize: 24, fontWeight: '700', color: SemanticColors.textPrimary, marginHorizontal: 24 },
  quantityTotal: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary, textAlign: 'center', marginTop: 16 },
  addToCartModalButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: SemanticColors.actionPrimary, paddingVertical: 16, borderRadius: 12 },
  addToCartModalText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  orderDetailHeader: { marginBottom: 20 },
  orderDetailSupplier: { fontSize: 20, fontWeight: '700', color: SemanticColors.textPrimary },
  orderDetailNumber: { fontSize: 14, color: SemanticColors.textSecondary, marginTop: 4 },
  orderDetailItems: { marginBottom: 20 },
  orderDetailItemsTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary, marginBottom: 12 },
  orderDetailItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: SemanticColors.surfaceBackground, padding: 12, borderRadius: 8, marginBottom: 8 },
  orderDetailItemInfo: { flex: 1 },
  orderDetailItemName: { fontSize: 14, color: SemanticColors.textPrimary },
  orderDetailItemSku: { fontSize: 11, color: SemanticColors.textSecondary, marginTop: 2 },
  orderDetailItemQty: { fontSize: 14, color: SemanticColors.textSecondary, marginHorizontal: 12 },
  orderDetailItemPrice: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary },
  orderDetailTotals: { backgroundColor: SemanticColors.surfaceBackground, borderRadius: 12, padding: 16, marginBottom: 20 },
  orderDetailTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderDetailTotalLabel: { fontSize: 14, color: SemanticColors.textSecondary },
  orderDetailTotalValue: { fontSize: 14, color: SemanticColors.textPrimary },
  orderDetailTotalFinal: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: SemanticColors.borderDefault },
  orderDetailFinalLabel: { fontSize: 16, fontWeight: '600', color: SemanticColors.textPrimary },
  orderDetailFinalValue: { fontSize: 18, fontWeight: '700', color: SemanticColors.textPrimary },
  orderTimeline: { marginBottom: 20 },
  orderTimelineTitle: { fontSize: 14, fontWeight: '600', color: SemanticColors.textPrimary, marginBottom: 12 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12, marginTop: 4 },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 14, color: SemanticColors.textPrimary },
  timelineDate: { fontSize: 12, color: SemanticColors.textSecondary, marginTop: 2 },
});

export default SupplierHub;
