// =============================================================================
// PRICING DATABASE SCHEMA
// =============================================================================
// These types define the database structure for the pricing intelligence moat.
// Every price observation becomes a reference point for smarter recommendations.
// =============================================================================

// ============================================
// CORE TABLES
// ============================================

/**
 * materials - Canonical material catalog
 * The single source of truth for material identity
 */
export interface MaterialRecord {
  id: string;                      // UUID primary key
  name: string;                    // Canonical name
  brand: string | null;
  category_id: string;             // FK to categories
  subcategory_id: string | null;

  // Identification codes
  sku: string | null;              // Internal SKU
  ean: string | null;              // EAN/UPC barcode
  manufacturer_code: string | null;

  // Normalized unit
  base_unit: string;               // 'liter', 'kg', 'sqm', 'each', etc.

  // Demand characteristics
  demand_pattern: 'steady' | 'seasonal' | 'project_based';
  avg_monthly_usage: number | null;
  reorder_point: number | null;
  safety_stock: number | null;

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // Vector embedding for similarity search
  embedding_id: string | null;
}

/**
 * material_aliases - Entity resolution mappings
 * Maps various names/codes to canonical material IDs
 */
export interface MaterialAliasRecord {
  id: string;
  material_id: string;             // FK to materials
  alias: string;                   // The alternative name
  alias_type: 'name' | 'sku' | 'ean' | 'supplier_code' | 'user_input';
  supplier_id: string | null;      // Supplier-specific code
  confidence: number;              // 0-1, how confident the resolution is
  usage_count: number;             // How often this alias is used
  created_at: string;
}

/**
 * suppliers - Supplier profiles
 */
export interface SupplierRecord {
  id: string;
  name: string;
  code: string;                    // Short code for references

  // Contact
  website: string | null;
  api_endpoint: string | null;
  api_key_encrypted: string | null;

  // Account details
  account_number: string | null;
  credit_terms_days: number | null;
  discount_tier: string | null;

  // Computed performance metrics (denormalized for speed)
  reliability_score: number;       // 0-100
  avg_lead_time_days: number;
  on_time_delivery_rate: number;   // 0-1
  quality_score: number;           // 0-100
  avg_price_vs_market: number;     // Percentage +/-
  price_consistency: number;       // 0-1

  // Relationship
  status: 'active' | 'inactive' | 'pending' | 'blocked';
  first_order_date: string | null;
  last_order_date: string | null;
  total_orders: number;
  total_spend: number;

  created_at: string;
  updated_at: string;
}

/**
 * price_observations - Raw price data points
 * The core data that powers everything
 */
export interface PriceObservationRecord {
  id: string;
  material_id: string;             // FK to materials
  supplier_id: string;             // FK to suppliers

  // Price
  price: number;                   // Decimal
  currency: string;                // 'EUR', 'USD', etc.
  unit: string;                    // Unit this price is for
  unit_quantity: number;           // e.g., price is for 5 liters

  // Normalized for comparison
  normalized_price: number;        // Price per base_unit
  normalized_unit: string;         // Same as material.base_unit

  // Context
  observed_at: string;             // When we saw this price
  source: 'manual' | 'api' | 'scrape' | 'invoice' | 'quote' | 'catalog';
  source_document_id: string | null;
  confidence: number;              // 0-1

  // Promo/sale info
  is_sale: boolean;
  sale_end_date: string | null;
  regular_price: number | null;

  // Availability
  in_stock: boolean | null;
  stock_level: 'low' | 'medium' | 'high' | null;
  lead_time_days: number | null;

  // Quantity pricing
  min_quantity: number | null;

  // Who recorded it
  user_id: string | null;

  created_at: string;

  // Indexes: (material_id, observed_at), (supplier_id, observed_at), (observed_at)
}

/**
 * bulk_price_tiers - Quantity break pricing
 */
export interface BulkPriceTierRecord {
  id: string;
  observation_id: string;          // FK to price_observations
  min_quantity: number;
  max_quantity: number | null;
  price: number;
  discount_percent: number;
}

/**
 * price_references - Computed aggregates for fast lookups
 * Materialized view updated periodically
 */
export interface PriceReferenceRecord {
  material_id: string;             // PK

  // Aggregates
  avg_price_7d: number | null;
  avg_price_30d: number | null;
  avg_price_90d: number | null;
  min_price_30d: number | null;
  max_price_30d: number | null;

  // Current best
  current_best_price: number | null;
  current_best_supplier_id: string | null;

  // Trend analysis
  trend: 'rising' | 'stable' | 'falling';
  trend_strength: number;          // 0-1
  trend_change_30d: number;        // Percentage
  volatility: number;              // Std dev

  // Data quality
  observation_count_30d: number;
  supplier_count: number;
  last_observation_at: string | null;

  computed_at: string;
}

/**
 * user_price_profiles - Per-user price analytics
 * Tracks each user's purchasing behavior
 */
export interface UserPriceProfileRecord {
  user_id: string;
  material_id: string;

  // Their behavior
  avg_purchase_price: number;
  last_purchase_price: number;
  last_purchase_date: string;
  preferred_supplier_id: string | null;
  total_purchases: number;
  total_spend: number;

  // vs Market
  price_vs_market_avg: number;     // Percentage +/-
  percentile_vs_market: number;    // 0-100

  // Potential
  potential_savings_annual: number;

  updated_at: string;
}

/**
 * market_benchmarks - Cross-user anonymized data
 * Aggregated from all users for market intelligence
 */
export interface MarketBenchmarkRecord {
  id: string;
  material_id: string;
  region: string;                  // Geographic region
  period: string;                  // 'YYYY-MM' format

  // Aggregated metrics
  avg_price: number;
  median_price: number;
  p25_price: number;
  p75_price: number;
  min_price: number;
  max_price: number;

  // Volume
  total_observations: number;
  unique_suppliers: number;
  unique_buyers: number;           // Anonymized count

  // Trend
  mom_change: number;              // Month-over-month percentage

  computed_at: string;
}

// ============================================
// AGENT TABLES
// ============================================

/**
 * pricing_recommendations - Generated recommendations
 */
export interface PricingRecommendationRecord {
  id: string;
  user_id: string;
  material_id: string;

  // Recommendation
  action: 'buy_now' | 'wait' | 'bulk_buy' | 'switch_supplier' | 'negotiate';
  confidence: number;
  urgency: 'immediate' | 'today' | 'this_week' | 'when_convenient';

  // Opportunity
  current_best_price: number;
  current_best_supplier_id: string;
  user_typical_price: number;
  savings_amount: number;
  savings_percent: number;

  // Reasoning (JSON)
  reasoning: string[];             // Array of reasons
  data_points_used: number;

  // For specific actions
  bulk_quantity: number | null;
  bulk_savings: number | null;
  alternative_supplier_id: string | null;
  alternative_price: number | null;

  // Lifecycle
  status: 'active' | 'accepted' | 'rejected' | 'expired';
  valid_until: string | null;
  created_at: string;
  actioned_at: string | null;
}

/**
 * recommendation_outcomes - Learning from user actions
 */
export interface RecommendationOutcomeRecord {
  id: string;
  recommendation_id: string;       // FK to pricing_recommendations

  // What happened
  action_taken: 'accepted' | 'rejected' | 'ignored' | 'expired';
  actual_price: number | null;
  actual_supplier_id: string | null;
  actual_quantity: number | null;

  // Savings achieved
  actual_savings: number | null;

  // Feedback
  user_feedback: string | null;
  was_helpful: boolean | null;

  created_at: string;
}

/**
 * pricing_agent_models - Trained model metadata
 */
export interface PricingAgentModelRecord {
  id: string;
  model_type: 'price_prediction' | 'buy_timing' | 'supplier_selection' | 'demand_forecast';

  // Version
  version: string;
  is_active: boolean;

  // Training
  trained_at: string;
  training_data_count: number;
  training_date_range_start: string;
  training_date_range_end: string;

  // Performance
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;

  // Storage
  model_path: string;
  feature_importance: Record<string, number>;

  created_at: string;
}

// ============================================
// INGESTION TABLES
// ============================================

/**
 * supplier_catalogs - Cached supplier catalog data
 */
export interface SupplierCatalogRecord {
  id: string;
  supplier_id: string;

  // Sync status
  last_sync_at: string | null;
  last_sync_status: 'success' | 'partial' | 'failed';
  last_sync_error: string | null;
  items_synced: number;

  // Schedule
  sync_frequency_hours: number;
  next_sync_at: string;

  created_at: string;
  updated_at: string;
}

/**
 * document_extractions - Prices extracted from documents
 */
export interface DocumentExtractionRecord {
  id: string;
  document_id: string;             // FK to documents table
  document_type: 'invoice' | 'quote' | 'catalog' | 'price_list';

  // Extraction results
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_count: number;
  needs_review_count: number;
  error_message: string | null;

  // Link to created observations
  observation_ids: string[];       // Array of created observation IDs

  processed_at: string | null;
  created_at: string;
}

// ============================================
// INDEXES & VIEWS (for documentation)
// ============================================

/**
 * Key indexes for performance:
 *
 * price_observations:
 *   - idx_po_material_date: (material_id, observed_at DESC)
 *   - idx_po_supplier_date: (supplier_id, observed_at DESC)
 *   - idx_po_date: (observed_at DESC)
 *   - idx_po_source: (source, observed_at DESC)
 *
 * price_references:
 *   - Primary key on material_id
 *
 * material_aliases:
 *   - idx_ma_alias: (alias) for lookup
 *   - idx_ma_material: (material_id)
 *
 * pricing_recommendations:
 *   - idx_pr_user_status: (user_id, status, created_at DESC)
 *   - idx_pr_material: (material_id, status)
 */

/**
 * Materialized views for analytics:
 *
 * mv_daily_price_stats:
 *   - material_id, date, avg_price, min_price, max_price, observation_count
 *
 * mv_supplier_performance:
 *   - supplier_id, period, total_orders, avg_price_vs_market, on_time_rate
 *
 * mv_category_trends:
 *   - category_id, period, avg_price_change, volume_change
 */

// ============================================
// HELPER TYPES
// ============================================

export type PriceTrend = 'rising' | 'stable' | 'falling';
export type DemandPattern = 'steady' | 'seasonal' | 'project_based';
export type RecommendationAction = 'buy_now' | 'wait' | 'bulk_buy' | 'switch_supplier' | 'negotiate';
export type RecommendationUrgency = 'immediate' | 'today' | 'this_week' | 'when_convenient';
export type PriceSource = 'manual' | 'api' | 'scrape' | 'invoice' | 'quote' | 'catalog';
export type SupplierStatus = 'active' | 'inactive' | 'pending' | 'blocked';
