// Extended Contractor Features - Pricebook, Smart Purchasing, Payments

// ============================================
// PRICEBOOK - Service Catalog
// ============================================

export type ServiceCategory =
  | 'preparation'
  | 'painting'
  | 'repairs'
  | 'finishing'
  | 'specialty'
  | 'consultation';

export interface PricebookItem {
  id: string;
  contractorId: string;

  // Item Details
  name: string;
  description: string;
  category: ServiceCategory;

  // Pricing
  pricingType: 'fixed' | 'per-unit' | 'hourly';
  basePrice: number;
  unit?: string; // "sqm", "meter", "hour", "each"

  // Cost Breakdown
  laborMinutes?: number;
  laborRate?: number;
  materialsCost?: number;
  materialsMarkup?: number; // percentage

  // Calculated
  totalCost: number;
  margin: number; // percentage

  // Variants for Good-Better-Best
  variants?: PricebookVariant[];

  // Metadata
  isActive: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PricebookVariant {
  id: string;
  tier: 'good' | 'better' | 'best';
  name: string;
  description: string;
  priceModifier: number; // multiplier (1.0, 1.3, 1.6)
  price: number;
  features: string[];
  isRecommended?: boolean;
}

// ============================================
// GOOD-BETTER-BEST QUOTING
// ============================================

export interface TieredQuote {
  id: string;
  contractorId: string;
  customerId: string;

  // Quote Info
  reference: string;
  title: string;
  description: string;

  // Tiers
  tiers: QuoteTier[];

  // Selected (after customer chooses)
  selectedTier?: 'good' | 'better' | 'best';

  // Terms
  validUntil: string;
  paymentTerms: string;
  estimatedDuration: string;

  // Status
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;

  createdAt: string;
}

export interface QuoteTier {
  tier: 'good' | 'better' | 'best';
  name: string; // "Basic", "Standard", "Premium"
  tagline: string; // "Gets the job done", "Most popular", "Best value"

  // Line Items
  lineItems: TierLineItem[];

  // Totals
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;

  // Features/Benefits
  features: string[];
  excludes?: string[]; // What's NOT included

  // Display
  isRecommended: boolean;
  savings?: string; // "Save €200 vs calling back later"
  guarantee?: string; // "3-year warranty included"
}

export interface TierLineItem {
  pricebookItemId?: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  includedInTier: boolean; // false = shown as excluded
}

// ============================================
// SMART MATERIALS PURCHASING
// ============================================

export interface MaterialSupplier {
  id: string;
  name: string;
  type: 'bigbox' | 'specialist' | 'online' | 'wholesaler';
  website?: string;
  location?: string;
  deliveryAvailable: boolean;
  deliveryFee?: number;
  minimumOrder?: number;
  accountNumber?: string;
  discountTier?: string; // "Trade Pro", "Gold Member"
  rating: number;
}

export interface MaterialPrice {
  id: string;
  materialId: string;
  supplierId: string;
  supplier?: MaterialSupplier;

  // Pricing
  price: number;
  pricePerUnit: number;
  unit: string;
  packSize: number;

  // Availability
  inStock: boolean;
  stockLevel?: 'low' | 'medium' | 'high';
  leadTimeDays?: number;

  // Promotions
  onSale: boolean;
  salePrice?: number;
  saleEnds?: string;
  bulkDiscount?: {
    minQuantity: number;
    discountPercent: number;
  };

  // Tracking
  lastChecked: string;
  priceHistory: { date: string; price: number }[];
}

export interface MaterialCatalogItem {
  id: string;

  // Product Info
  name: string;
  brand: string;
  sku?: string;
  category: string;
  subcategory?: string;

  // Specifications
  specs: Record<string, string>;
  coveragePerUnit?: number; // sqm per liter, etc.

  // Pricing across suppliers
  prices: MaterialPrice[];
  lowestPrice?: number;
  averagePrice?: number;

  // Usage
  usageCount: number;
  lastUsed?: string;
  preferredSupplierId?: string;

  // AI Insights
  pricetrend: 'rising' | 'stable' | 'falling';
  buyRecommendation?: PurchaseRecommendation;
}

export interface PurchaseRecommendation {
  action: 'buy-now' | 'wait' | 'bulk-buy' | 'switch-supplier';
  reason: string;
  confidence: number; // 0-100

  // Savings opportunity
  currentPrice: number;
  recommendedPrice?: number;
  potentialSavings?: number;
  savingsPercent?: number;

  // Timing
  bestBuyWindow?: { start: string; end: string };

  // Alternative
  alternativeMaterialId?: string;
  alternativeName?: string;
  alternativeSavings?: number;
}

export interface SmartPurchaseAlert {
  id: string;
  type: 'price-drop' | 'bulk-opportunity' | 'stock-low' | 'sale-ending' | 'reorder-reminder';
  materialId: string;
  materialName: string;

  title: string;
  message: string;

  // Action
  actionLabel: string;
  supplierId?: string;
  supplierName?: string;

  // Savings
  savingsAmount?: number;
  savingsPercent?: number;

  // Urgency
  priority: 'low' | 'medium' | 'high';
  expiresAt?: string;

  // Status
  isRead: boolean;
  isDismissed: boolean;
  isActioned: boolean;

  createdAt: string;
}

export interface UpcomingMaterialNeed {
  materialId: string;
  materialName: string;

  // Demand
  totalNeeded: number;
  unit: string;

  // Source Jobs
  jobs: {
    jobId: string;
    jobTitle: string;
    scheduledDate: string;
    quantityNeeded: number;
  }[];

  // Current Inventory
  currentStock: number;
  needToPurchase: number;

  // Recommendation
  recommendation: PurchaseRecommendation;
}

// ============================================
// INTEGRATED PAYMENTS
// ============================================

export type PaymentProvider = 'mollie' | 'stripe';

export type PaymentMethodType =
  | 'ideal'
  | 'bancontact'
  | 'creditcard'
  | 'paypal'
  | 'applepay'
  | 'googlepay'
  | 'klarna'
  | 'bank-transfer';

export interface PaymentSettings {
  contractorId: string;

  // Provider
  provider: PaymentProvider;
  isConnected: boolean;
  accountId?: string;

  // Enabled Methods
  enabledMethods: PaymentMethodType[];

  // Preferences
  defaultPaymentTermsDays: number;
  autoSendReminders: boolean;
  reminderDays: number[]; // [7, 3, 1, 0] days before due

  // Fees
  absorbFees: boolean; // Contractor pays fees vs pass to customer

  // Deposit
  requireDeposit: boolean;
  depositPercent: number;

  // Tipping
  enableTipping: boolean;
  suggestedTips: number[]; // [10, 15, 20] percent
}

export interface PaymentLink {
  id: string;
  invoiceId: string;

  // Link
  url: string;
  shortUrl?: string;
  qrCodeUrl?: string;

  // Amount
  amount: number;
  currency: 'EUR' | 'GBP';

  // Status
  status: 'pending' | 'paid' | 'expired' | 'cancelled';

  // Expiry
  expiresAt: string;

  // Payment Details (when paid)
  paidAt?: string;
  paidAmount?: number;
  paymentMethod?: PaymentMethodType;
  transactionId?: string;

  // Fees
  providerFee?: number;
  netAmount?: number;

  createdAt: string;
}

export interface PaymentReminder {
  id: string;
  invoiceId: string;
  customerId: string;

  // Reminder
  type: 'upcoming' | 'due-today' | 'overdue';
  daysDue: number; // negative = overdue

  // Message
  subject: string;
  message: string;

  // Delivery
  channel: 'email' | 'sms' | 'whatsapp';
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;

  // Response
  paymentLinkClicked: boolean;
  clickedAt?: string;
}

// ============================================
// CONTRACTOR INSIGHTS
// ============================================

export interface ContractorInsights {
  contractorId: string;
  period: 'week' | 'month' | 'quarter' | 'year';

  // Revenue
  revenue: number;
  revenueGrowth: number; // vs previous period
  averageJobValue: number;

  // Profitability
  materialsCost: number;
  laborCost: number;
  grossProfit: number;
  grossMargin: number;

  // Efficiency
  hoursWorked: number;
  hourlyEarnings: number;
  utilizationRate: number; // billable hours / available hours

  // Sales
  quotessSent: number;
  quotesAccepted: number;
  conversionRate: number;
  averageQuoteValue: number;

  // Good-Better-Best Performance
  tierBreakdown: {
    good: { count: number; revenue: number };
    better: { count: number; revenue: number };
    best: { count: number; revenue: number };
  };
  upsellRate: number; // % choosing better/best

  // Payments
  averagePaymentDays: number;
  overdueAmount: number;

  // Materials
  materialSpend: number;
  savingsFromSmartPurchasing: number;

  // Customers
  newCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  averageRating: number;
}
