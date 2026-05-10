// =============================================================================
// SUPPLIER INTEGRATION SERVICE
// =============================================================================
// Manages supplier connections, real-time pricing, and ordering
// Aggregates supplier data to create competitive intelligence advantage
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { getCurrentCountry } from '../lib/currentUser';
import { getStandardVatRate, type BusinessProfile } from '../domain/business';

// ============================================
// TYPES
// ============================================

export interface Supplier {
  id: string;
  name: string;
  logo?: string;
  type: 'wholesaler' | 'manufacturer' | 'retailer';

  // Integration status
  integrationStatus: 'connected' | 'pending' | 'available' | 'unavailable';
  apiEnabled: boolean;
  lastSyncAt?: string;

  // Categories
  categories: string[];
  productCount: number;

  // Performance
  avgDeliveryDays: number;
  reliabilityScore: number; // 0-100
  priceCompetitiveness: number; // 0-100, relative to others

  // Ordering
  minOrderValue?: number;
  freeDeliveryThreshold?: number;
  paymentTerms: string;

  // Contact
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  accountManager?: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  supplierName: string;
  sku: string;
  name: string;
  brand?: string;
  category: string;

  // Pricing
  price: number;
  listPrice?: number;
  discountPercent?: number;
  bulkPrices?: Array<{ minQty: number; price: number }>;

  // Stock
  inStock: boolean;
  stockLevel: 'high' | 'medium' | 'low' | 'out';
  stockQuantity?: number;
  expectedRestock?: string;

  // Delivery
  deliveryDays: number;
  deliveryOptions: Array<{ method: string; days: number; cost: number }>;

  // Metadata
  lastUpdated: string;
  priceHistory?: Array<{ date: string; price: number }>;
}

export interface PriceComparison {
  productId: string;
  productName: string;
  brand?: string;
  category: string;
  suppliers: Array<{
    supplierId: string;
    supplierName: string;
    price: number;
    inStock: boolean;
    deliveryDays: number;
    isBestPrice: boolean;
    isFastest: boolean;
  }>;
  bestPrice: number;
  avgPrice: number;
  priceRange: { min: number; max: number };
  recommendation?: string;
}

export interface Order {
  id: string;
  supplierId: string;
  supplierName: string;
  status: 'draft' | 'submitted' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

  // Items
  items: Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;

  // Totals
  subtotal: number;
  deliveryCost: number;
  tax: number;
  total: number;

  // Dates
  createdAt: string;
  submittedAt?: string;
  expectedDelivery?: string;
  deliveredAt?: string;

  // Reference
  supplierOrderNumber?: string;
  projectId?: string;
  notes?: string;
}

export interface Cart {
  supplierId: string;
  supplierName: string;
  items: Array<{
    product: SupplierProduct;
    quantity: number;
  }>;
  subtotal: number;
  deliveryCost: number;
  total: number;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: 'sup_bouwmaat',
    name: 'Bouwmaat',
    type: 'retailer',
    integrationStatus: 'connected',
    apiEnabled: true,
    lastSyncAt: '2025-01-31T08:00:00Z',
    categories: ['Verf', 'Gereedschap', 'Bevestigingsmaterialen', 'Hout'],
    productCount: 12500,
    avgDeliveryDays: 2,
    reliabilityScore: 92,
    priceCompetitiveness: 78,
    minOrderValue: 50,
    freeDeliveryThreshold: 150,
    paymentTerms: '30 dagen',
    website: 'https://www.bouwmaat.nl',
    accountManager: 'Jeroen de Vries',
  },
  {
    id: 'sup_technische_unie',
    name: 'Technische Unie',
    type: 'wholesaler',
    integrationStatus: 'connected',
    apiEnabled: true,
    lastSyncAt: '2025-01-31T07:30:00Z',
    categories: ['Elektra', 'Sanitair', 'HVAC', 'Gereedschap'],
    productCount: 85000,
    avgDeliveryDays: 1,
    reliabilityScore: 95,
    priceCompetitiveness: 85,
    freeDeliveryThreshold: 100,
    paymentTerms: '14 dagen',
    website: 'https://www.technischeunie.nl',
    accountManager: 'Sandra Bakker',
  },
  {
    id: 'sup_verfwinkel',
    name: 'Verfwinkel.nl',
    type: 'retailer',
    integrationStatus: 'connected',
    apiEnabled: true,
    lastSyncAt: '2025-01-31T06:00:00Z',
    categories: ['Verf', 'Lakken', 'Kwasten', 'Schildersbenodigdheden'],
    productCount: 8500,
    avgDeliveryDays: 1,
    reliabilityScore: 88,
    priceCompetitiveness: 92,
    minOrderValue: 25,
    freeDeliveryThreshold: 75,
    paymentTerms: 'Direct',
    website: 'https://www.verfwinkel.nl',
  },
  {
    id: 'sup_hornbach',
    name: 'Hornbach',
    type: 'retailer',
    integrationStatus: 'pending',
    apiEnabled: false,
    categories: ['Bouwmaterialen', 'Tuin', 'Verf', 'Gereedschap'],
    productCount: 50000,
    avgDeliveryDays: 3,
    reliabilityScore: 85,
    priceCompetitiveness: 80,
    paymentTerms: 'Direct',
    website: 'https://www.hornbach.nl',
  },
  {
    id: 'sup_sanitairwinkel',
    name: 'Sanitairwinkel.nl',
    type: 'retailer',
    integrationStatus: 'available',
    apiEnabled: false,
    categories: ['Sanitair', 'Badkamer', 'Kranen', 'Tegels'],
    productCount: 25000,
    avgDeliveryDays: 2,
    reliabilityScore: 90,
    priceCompetitiveness: 88,
    freeDeliveryThreshold: 200,
    paymentTerms: '14 dagen',
    website: 'https://www.sanitairwinkel.nl',
  },
];

const MOCK_PRODUCTS: SupplierProduct[] = [
  {
    id: 'prod_dulux_1',
    supplierId: 'sup_bouwmaat',
    supplierName: 'Bouwmaat',
    sku: 'DLX-EGG-WHT-5L',
    name: 'Dulux Trade Eggshell White 5L',
    brand: 'Dulux',
    category: 'Verf',
    price: 26.95,
    listPrice: 29.95,
    discountPercent: 10,
    bulkPrices: [
      { minQty: 5, price: 24.95 },
      { minQty: 10, price: 22.95 },
    ],
    inStock: true,
    stockLevel: 'high',
    stockQuantity: 150,
    deliveryDays: 2,
    deliveryOptions: [
      { method: 'Standaard', days: 2, cost: 6.95 },
      { method: 'Express', days: 1, cost: 12.95 },
    ],
    lastUpdated: '2025-01-31T08:00:00Z',
  },
  {
    id: 'prod_dulux_2',
    supplierId: 'sup_verfwinkel',
    supplierName: 'Verfwinkel.nl',
    sku: 'VW-DULUX-EGG-5L',
    name: 'Dulux Trade Eggshell White 5L',
    brand: 'Dulux',
    category: 'Verf',
    price: 23.40,
    listPrice: 28.00,
    discountPercent: 16,
    inStock: true,
    stockLevel: 'medium',
    stockQuantity: 45,
    deliveryDays: 1,
    deliveryOptions: [
      { method: 'Standaard', days: 1, cost: 4.95 },
    ],
    lastUpdated: '2025-01-31T06:00:00Z',
  },
  {
    id: 'prod_grohe_1',
    supplierId: 'sup_technische_unie',
    supplierName: 'Technische Unie',
    sku: 'TU-GROHE-ES-KC',
    name: 'Grohe Eurosmart Keukenkraan',
    brand: 'Grohe',
    category: 'Sanitair',
    price: 89.00,
    listPrice: 99.00,
    discountPercent: 10,
    inStock: true,
    stockLevel: 'high',
    stockQuantity: 85,
    deliveryDays: 1,
    deliveryOptions: [
      { method: 'Standaard', days: 1, cost: 0 },
      { method: 'Express', days: 0, cost: 15.00 },
    ],
    lastUpdated: '2025-01-31T07:30:00Z',
  },
  {
    id: 'prod_grohe_2',
    supplierId: 'sup_sanitairwinkel',
    supplierName: 'Sanitairwinkel.nl',
    sku: 'SW-GROHE-ES-KC',
    name: 'Grohe Eurosmart Keukenkraan',
    brand: 'Grohe',
    category: 'Sanitair',
    price: 92.50,
    inStock: true,
    stockLevel: 'medium',
    deliveryDays: 2,
    deliveryOptions: [
      { method: 'Standaard', days: 2, cost: 5.95 },
    ],
    lastUpdated: '2025-01-30T12:00:00Z',
  },
  {
    id: 'prod_sigma_1',
    supplierId: 'sup_verfwinkel',
    supplierName: 'Verfwinkel.nl',
    sku: 'VW-SIGMA-S2U-2.5L',
    name: 'Sigma S2U Allure 2.5L',
    brand: 'Sigma',
    category: 'Verf',
    price: 42.00,
    listPrice: 46.00,
    discountPercent: 9,
    inStock: true,
    stockLevel: 'low',
    stockQuantity: 12,
    deliveryDays: 1,
    deliveryOptions: [
      { method: 'Standaard', days: 1, cost: 4.95 },
    ],
    lastUpdated: '2025-01-31T06:00:00Z',
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'ord_1',
    supplierId: 'sup_verfwinkel',
    supplierName: 'Verfwinkel.nl',
    status: 'delivered',
    items: [
      { productId: 'prod_dulux_2', productName: 'Dulux Trade Eggshell White 5L', sku: 'VW-DULUX-EGG-5L', quantity: 6, unitPrice: 23.40, totalPrice: 140.40 },
      { productId: 'prod_sigma_1', productName: 'Sigma S2U Allure 2.5L', sku: 'VW-SIGMA-S2U-2.5L', quantity: 2, unitPrice: 42.00, totalPrice: 84.00 },
    ],
    subtotal: 224.40,
    deliveryCost: 0,
    tax: 47.12,
    total: 271.52,
    createdAt: '2025-01-20T10:00:00Z',
    submittedAt: '2025-01-20T10:05:00Z',
    expectedDelivery: '2025-01-21',
    deliveredAt: '2025-01-21T14:30:00Z',
    supplierOrderNumber: 'VW-2025-4521',
    projectId: 'proj_badkamer_smit',
  },
  {
    id: 'ord_2',
    supplierId: 'sup_technische_unie',
    supplierName: 'Technische Unie',
    status: 'shipped',
    items: [
      { productId: 'prod_grohe_1', productName: 'Grohe Eurosmart Keukenkraan', sku: 'TU-GROHE-ES-KC', quantity: 2, unitPrice: 89.00, totalPrice: 178.00 },
    ],
    subtotal: 178.00,
    deliveryCost: 0,
    tax: 37.38,
    total: 215.38,
    createdAt: '2025-01-29T09:00:00Z',
    submittedAt: '2025-01-29T09:10:00Z',
    expectedDelivery: '2025-01-30',
    supplierOrderNumber: 'TU-2025-78432',
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class SupplierIntegrationService {
  private suppliers: Map<string, Supplier> = new Map();
  private products: Map<string, SupplierProduct> = new Map();
  private orders: Map<string, Order> = new Map();
  private carts: Map<string, Cart> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    // R31: dropped MOCK_SUPPLIERS + MOCK_PRODUCTS + MOCK_ORDERS seeds.
    // Test setups call __seedMockData.
  }

  /** @internal Test-only mock seeder. */
  __seedMockData(): void {
    MOCK_SUPPLIERS.forEach((s) => this.suppliers.set(s.id, s));
    MOCK_PRODUCTS.forEach((p) => this.products.set(p.id, p));
    MOCK_ORDERS.forEach((o) => this.orders.set(o.id, o));
  }

  // -----------------------------------------
  // Supplier Management
  // -----------------------------------------

  /**
   * Get all suppliers
   */
  getSuppliers(filter?: { status?: Supplier['integrationStatus']; category?: string }): Supplier[] {
    let suppliers = Array.from(this.suppliers.values());

    if (filter?.status) {
      suppliers = suppliers.filter((s) => s.integrationStatus === filter.status);
    }
    if (filter?.category) {
      suppliers = suppliers.filter((s) => s.categories.includes(filter.category!));
    }

    return suppliers.sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  }

  /**
   * Get connected suppliers
   */
  getConnectedSuppliers(): Supplier[] {
    return this.getSuppliers({ status: 'connected' });
  }

  /**
   * Get supplier by ID
   */
  getSupplier(supplierId: string): Supplier | undefined {
    return this.suppliers.get(supplierId);
  }

  /**
   * Connect to a supplier
   */
  connectSupplier(supplierId: string): void {
    const supplier = this.suppliers.get(supplierId);
    if (supplier && supplier.integrationStatus === 'available') {
      supplier.integrationStatus = 'pending';
      this.notifyListeners();

      trackUserAction('supplier_connection_requested', { supplierId });

      // Simulate approval after delay
      setTimeout(() => {
        supplier.integrationStatus = 'connected';
        supplier.apiEnabled = true;
        supplier.lastSyncAt = new Date().toISOString();
        this.notifyListeners();
      }, 2000);
    }
  }

  /**
   * Sync supplier data
   */
  syncSupplier(supplierId: string): void {
    const supplier = this.suppliers.get(supplierId);
    if (supplier && supplier.integrationStatus === 'connected') {
      supplier.lastSyncAt = new Date().toISOString();
      this.notifyListeners();

      trackUserAction('supplier_synced', { supplierId });
    }
  }

  // -----------------------------------------
  // Product Search & Comparison
  // -----------------------------------------

  /**
   * Search products across all connected suppliers
   */
  searchProducts(params: {
    query?: string;
    category?: string;
    supplierId?: string;
    inStockOnly?: boolean;
  }): SupplierProduct[] {
    let products = Array.from(this.products.values());

    // Filter by connected suppliers only
    const connectedIds = new Set(this.getConnectedSuppliers().map((s) => s.id));
    products = products.filter((p) => connectedIds.has(p.supplierId));

    if (params.query) {
      const q = params.query.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      );
    }
    if (params.category) {
      products = products.filter((p) => p.category === params.category);
    }
    if (params.supplierId) {
      products = products.filter((p) => p.supplierId === params.supplierId);
    }
    if (params.inStockOnly) {
      products = products.filter((p) => p.inStock);
    }

    return products.sort((a, b) => a.price - b.price);
  }

  /**
   * Compare prices for a product across suppliers
   */
  comparePrices(productName: string): PriceComparison | null {
    const products = this.searchProducts({ query: productName });
    if (products.length === 0) return null;

    const prices = products.map((p) => p.price);
    const bestPrice = Math.min(...prices);
    const fastestDelivery = Math.min(...products.map((p) => p.deliveryDays));

    const suppliers = products.map((p) => ({
      supplierId: p.supplierId,
      supplierName: p.supplierName,
      price: p.price,
      inStock: p.inStock,
      deliveryDays: p.deliveryDays,
      isBestPrice: p.price === bestPrice,
      isFastest: p.deliveryDays === fastestDelivery,
    }));

    const sample = products[0];
    return {
      productId: sample.id,
      productName: sample.name,
      brand: sample.brand,
      category: sample.category,
      suppliers,
      bestPrice,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
      recommendation: this.generateRecommendation(suppliers),
    };
  }

  private generateRecommendation(
    suppliers: PriceComparison['suppliers']
  ): string {
    const bestPrice = suppliers.find((s) => s.isBestPrice && s.inStock);
    const fastest = suppliers.find((s) => s.isFastest && s.inStock);

    if (bestPrice && fastest && bestPrice.supplierId === fastest.supplierId) {
      return `${bestPrice.supplierName} biedt de beste prijs én snelste levering.`;
    }
    if (bestPrice) {
      return `Beste prijs bij ${bestPrice.supplierName}. ${fastest ? `Snelste levering bij ${fastest.supplierName}.` : ''}`;
    }
    return 'Vergelijk leveranciers voor de beste deal.';
  }

  // -----------------------------------------
  // Cart Management
  // -----------------------------------------

  /**
   * Get cart for a supplier
   */
  getCart(supplierId: string): Cart | undefined {
    return this.carts.get(supplierId);
  }

  /**
   * Get all carts
   */
  getAllCarts(): Cart[] {
    return Array.from(this.carts.values());
  }

  /**
   * Add item to cart
   */
  addToCart(product: SupplierProduct, quantity: number): void {
    let cart = this.carts.get(product.supplierId);

    if (!cart) {
      cart = {
        supplierId: product.supplierId,
        supplierName: product.supplierName,
        items: [],
        subtotal: 0,
        deliveryCost: 0,
        total: 0,
      };
      this.carts.set(product.supplierId, cart);
    }

    const existingItem = cart.items.find((i) => i.product.id === product.id);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ product, quantity });
    }

    this.recalculateCart(cart);
    this.notifyListeners();

    trackUserAction('product_added_to_cart', {
      productId: product.id,
      supplierId: product.supplierId,
      quantity,
    });
  }

  /**
   * Update cart item quantity
   */
  updateCartItem(supplierId: string, productId: string, quantity: number): void {
    const cart = this.carts.get(supplierId);
    if (!cart) return;

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.product.id !== productId);
    } else {
      const item = cart.items.find((i) => i.product.id === productId);
      if (item) item.quantity = quantity;
    }

    this.recalculateCart(cart);
    if (cart.items.length === 0) {
      this.carts.delete(supplierId);
    }
    this.notifyListeners();
  }

  /**
   * Clear cart
   */
  clearCart(supplierId: string): void {
    this.carts.delete(supplierId);
    this.notifyListeners();
  }

  private recalculateCart(cart: Cart): void {
    cart.subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    const supplier = this.suppliers.get(cart.supplierId);
    if (supplier?.freeDeliveryThreshold && cart.subtotal >= supplier.freeDeliveryThreshold) {
      cart.deliveryCost = 0;
    } else {
      cart.deliveryCost = 6.95;
    }

    cart.total = cart.subtotal + cart.deliveryCost;
  }

  // -----------------------------------------
  // Order Management
  // -----------------------------------------

  /**
   * Get all orders
   */
  getOrders(filter?: { status?: Order['status']; supplierId?: string }): Order[] {
    let orders = Array.from(this.orders.values());

    if (filter?.status) {
      orders = orders.filter((o) => o.status === filter.status);
    }
    if (filter?.supplierId) {
      orders = orders.filter((o) => o.supplierId === filter.supplierId);
    }

    return orders.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Submit order from cart
   */
  submitOrder(supplierId: string, projectId?: string, notes?: string): Order | null {
    const cart = this.carts.get(supplierId);
    if (!cart || cart.items.length === 0) return null;

    const order: Order = {
      id: `ord_${Date.now()}`,
      supplierId: cart.supplierId,
      supplierName: cart.supplierName,
      status: 'submitted',
      items: cart.items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitPrice: item.product.price,
        totalPrice: item.product.price * item.quantity,
      })),
      subtotal: cart.subtotal,
      deliveryCost: cart.deliveryCost,
      // R66r51: country-aware VAT (was NL 21% hardcoded).
      tax: cart.subtotal * (getStandardVatRate((getCurrentCountry() as BusinessProfile['country']) ?? 'NL') / 100),
      total: cart.total * (1 + getStandardVatRate((getCurrentCountry() as BusinessProfile['country']) ?? 'NL') / 100),
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      expectedDelivery: this.calculateExpectedDelivery(cart),
      projectId,
      notes,
    };

    this.orders.set(order.id, order);
    this.carts.delete(supplierId);
    this.notifyListeners();

    trackUserAction('order_submitted', {
      orderId: order.id,
      supplierId,
      total: order.total,
      itemCount: order.items.length,
    });

    // Simulate order confirmation
    setTimeout(() => {
      order.status = 'confirmed';
      order.supplierOrderNumber = `${cart.supplierName.substring(0, 2).toUpperCase()}-2025-${Math.floor(Math.random() * 90000) + 10000}`;
      this.notifyListeners();
    }, 1500);

    return order;
  }

  private calculateExpectedDelivery(cart: Cart): string {
    const maxDeliveryDays = Math.max(...cart.items.map((i) => i.product.deliveryDays));
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + maxDeliveryDays);
    return deliveryDate.toISOString().split('T')[0];
  }

  // -----------------------------------------
  // Statistics
  // -----------------------------------------

  /**
   * Get supplier statistics
   */
  getStatistics(): {
    connectedSuppliers: number;
    totalProducts: number;
    ordersThisMonth: number;
    totalSpentThisMonth: number;
    avgSavings: number;
  } {
    const orders = this.getOrders();
    const thisMonth = orders.filter((o) => {
      const orderDate = new Date(o.createdAt);
      const now = new Date();
      return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
    });

    return {
      connectedSuppliers: this.getConnectedSuppliers().length,
      totalProducts: this.products.size,
      ordersThisMonth: thisMonth.length,
      totalSpentThisMonth: thisMonth.reduce((sum, o) => sum + o.total, 0),
      avgSavings: 12, // Percentage saved vs list prices
    };
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const supplierIntegrationService = new SupplierIntegrationService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useSuppliers(filter?: { status?: Supplier['integrationStatus']; category?: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(() =>
    supplierIntegrationService.getSuppliers(filter)
  );

  useEffect(() => {
    const unsubscribe = supplierIntegrationService.subscribe(() => {
      setSuppliers(supplierIntegrationService.getSuppliers(filter));
    });
    return unsubscribe;
  }, [filter?.status, filter?.category]);

  const connectSupplier = useCallback((supplierId: string) => {
    supplierIntegrationService.connectSupplier(supplierId);
  }, []);

  const syncSupplier = useCallback((supplierId: string) => {
    supplierIntegrationService.syncSupplier(supplierId);
  }, []);

  return {
    suppliers,
    connectedCount: suppliers.filter((s) => s.integrationStatus === 'connected').length,
    connectSupplier,
    syncSupplier,
    statistics: supplierIntegrationService.getStatistics(),
  };
}

export function useProductSearch(params: {
  query?: string;
  category?: string;
  supplierId?: string;
  inStockOnly?: boolean;
}) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);

  useEffect(() => {
    const results = supplierIntegrationService.searchProducts(params);
    setProducts(results);
  }, [params.query, params.category, params.supplierId, params.inStockOnly]);

  const comparePrices = useCallback((productName: string) => {
    return supplierIntegrationService.comparePrices(productName);
  }, []);

  return { products, comparePrices };
}

export function useCart() {
  const [carts, setCarts] = useState<Cart[]>(() =>
    supplierIntegrationService.getAllCarts()
  );

  useEffect(() => {
    const unsubscribe = supplierIntegrationService.subscribe(() => {
      setCarts(supplierIntegrationService.getAllCarts());
    });
    return unsubscribe;
  }, []);

  const addToCart = useCallback((product: SupplierProduct, quantity: number) => {
    supplierIntegrationService.addToCart(product, quantity);
  }, []);

  const updateCartItem = useCallback(
    (supplierId: string, productId: string, quantity: number) => {
      supplierIntegrationService.updateCartItem(supplierId, productId, quantity);
    },
    []
  );

  const clearCart = useCallback((supplierId: string) => {
    supplierIntegrationService.clearCart(supplierId);
  }, []);

  const submitOrder = useCallback(
    (supplierId: string, projectId?: string, notes?: string) => {
      return supplierIntegrationService.submitOrder(supplierId, projectId, notes);
    },
    []
  );

  const totalItems = useMemo(
    () => carts.reduce((sum, cart) => sum + cart.items.reduce((s, i) => s + i.quantity, 0), 0),
    [carts]
  );

  return {
    carts,
    totalItems,
    addToCart,
    updateCartItem,
    clearCart,
    submitOrder,
  };
}

export function useOrders(filter?: { status?: Order['status']; supplierId?: string }) {
  const [orders, setOrders] = useState<Order[]>(() =>
    supplierIntegrationService.getOrders(filter)
  );

  useEffect(() => {
    const unsubscribe = supplierIntegrationService.subscribe(() => {
      setOrders(supplierIntegrationService.getOrders(filter));
    });
    return unsubscribe;
  }, [filter?.status, filter?.supplierId]);

  return { orders };
}
