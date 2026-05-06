/**
 * TypeScript types matching supabase/schema.sql (6 tables).
 * Regenerate with `npx supabase gen types typescript` once connected.
 */

// ── Row types (what you read) ────────────────────────────────

export type BusinessSettingsRow = {
  id: string;
  user_id: string;
  business_name: string | null;
  kvk_number: string | null;
  vat_number: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  // R66 NL launch: payment + locale columns from
  // `20260415000001_business_profiles.sql` migration. Pre-R66 the FE
  // type didn't declare these so the mapper dropped them on read and
  // the UI couldn't write them. NL invoice PDFs went out with no IBAN.
  iban: string | null;
  bic: string | null;
  country: string | null;
  postcode: string | null;
  city: string | null;
  website: string | null;
  invoice_prefix: string | null;
  quote_prefix: string | null;
  default_payment_terms: number | null;
  // R61 SOW tone preset.
  quote_tone: 'formal' | 'friendly' | 'detailed' | 'concise' | null;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  user_id: string;
  customer_id: string | null;
  title: string;
  description: string | null;
  status: string;
  // Address
  address_street: string | null;
  address_city: string | null;
  address_postcode: string | null;
  address_country: string | null;
  address_access_notes: string | null;
  address_parking_notes: string | null;
  // Scheduling
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  estimated_duration: number | null;
  // Financial
  quoted_amount: number | null;
  agreed_amount: number | null;
  // Work details
  trade: string | null;
  priority: string | null;
  rooms_areas: string[] | null;
  specifications: string | null;
  site_contact: string | null;
  site_phone: string | null;
  // Timestamps
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentRow = {
  id: string;
  user_id: string;
  doc_type: 'quote' | 'invoice';
  status: 'draft' | 'sent' | 'paid';
  customer_id: string | null;
  job_id: string | null;
  source_document_id: string | null;
  document_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  total_amount: number;
  // R63 / Package D4: AI-generated scope-of-work narrative. Column added
  // in 20260505000001_sow_columns.sql.
  scope_text: string | null;
  created_at: string;
  updated_at: string;
};

export type LineItemRow = {
  id: string;
  user_id: string;
  document_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export type DocumentCounterRow = {
  id: string;
  user_id: string;
  doc_type: string;
  current_number: number;
  updated_at: string;
};

export type MaterialCatalogRow = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  sku: string | null;
  ean: string | null;
  manufacturer_code: string | null;
  base_unit: string;
  unit_conversions: Record<string, number> | null;
  aliases: string[];
  specifications: Record<string, string> | null;
  demand_pattern: string;
  avg_monthly_usage: number | null;
  reorder_point: number | null;
  created_at: string;
  updated_at: string;
};

export type SupplierRow = {
  id: string;
  user_id: string;
  name: string;
  account_status: string;
  credit_terms: number | null;
  discount_tier: string | null;
  reliability_score: number | null;
  avg_lead_time_days: number | null;
  on_time_delivery_rate: number | null;
  quality_score: number | null;
  avg_price_vs_market: number | null;
  price_consistency: number | null;
  total_spend: number;
  total_orders: number;
  last_order_date: string | null;
  api_enabled: boolean;
  catalog_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PriceObservationRow = {
  id: string;
  user_id: string;
  material_id: string;
  material_name: string;
  supplier_id: string | null;
  supplier_name: string | null;
  price: number;
  currency: string;
  unit: string;
  source: string;
  confidence: number;
  is_sale: boolean | null;
  sale_end_date: string | null;
  regular_price: number | null;
  in_stock: boolean | null;
  stock_level: string | null;
  lead_time_days: number | null;
  min_quantity: number | null;
  bulk_pricing: unknown | null;
  observed_at: string;
  created_at: string;
};

export type JobMaterialRow = {
  id: string;
  user_id: string;
  job_id: string;
  material_id: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  total_price: number | null;
  supplier_id: string | null;
  status: string;
  notes: string | null;
  ordered_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

// R278: projects table (migration 20260501000001 — promoted from
// AsyncStorage to BE-backed for aannemer multi-job grouping).
export type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  customer_id: string | null;
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled';
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  total_budget: number | null;
  total_quoted: number | null;
  total_invoiced: number | null;
  total_paid: number | null;
  address: { street?: string; city?: string; postcode?: string; country?: string } | null;
  milestones: unknown[];
  created_at: string;
  updated_at: string;
};

// ── Database interface (for Supabase client generic) ─────────

export interface Database {
  public: {
    Tables: {
      business_settings: {
        Row: BusinessSettingsRow;
        Insert: Partial<BusinessSettingsRow> & {
          business_name?: string | null;
        };
        Update: Partial<Omit<BusinessSettingsRow, 'id' | 'user_id' | 'created_at'>>;
      };
      customers: {
        Row: CustomerRow;
        Insert: Partial<CustomerRow> & {
          name: string;
          user_id: string;
        };
        Update: Partial<Omit<CustomerRow, 'id' | 'user_id' | 'created_at'>>;
      };
      jobs: {
        Row: JobRow;
        Insert: Partial<JobRow> & {
          title: string;
          user_id: string;
        };
        Update: Partial<Omit<JobRow, 'id' | 'user_id' | 'created_at'>>;
      };
      documents: {
        Row: DocumentRow;
        Insert: Partial<DocumentRow> & {
          doc_type: 'quote' | 'invoice';
          status: 'draft' | 'sent' | 'paid';
          user_id: string;
        };
        Update: Partial<Omit<DocumentRow, 'id' | 'user_id' | 'created_at'>>;
      };
      line_items: {
        Row: LineItemRow;
        Insert: Partial<LineItemRow> & {
          description: string;
          user_id: string;
        };
        Update: Partial<Omit<LineItemRow, 'id' | 'user_id' | 'created_at'>>;
      };
      document_counters: {
        Row: DocumentCounterRow;
        Insert: Partial<DocumentCounterRow> & {
          doc_type: string;
          user_id: string;
        };
        Update: Partial<Omit<DocumentCounterRow, 'id' | 'user_id'>>;
      };
      material_catalog: {
        Row: MaterialCatalogRow;
        Insert: Partial<MaterialCatalogRow> & {
          name: string;
          user_id: string;
        };
        Update: Partial<Omit<MaterialCatalogRow, 'id' | 'user_id' | 'created_at'>>;
      };
      suppliers: {
        Row: SupplierRow;
        Insert: Partial<SupplierRow> & {
          name: string;
          user_id: string;
        };
        Update: Partial<Omit<SupplierRow, 'id' | 'user_id' | 'created_at'>>;
      };
      job_materials: {
        Row: JobMaterialRow;
        Insert: Partial<JobMaterialRow> & {
          job_id: string;
          material_id: string;
          user_id: string;
        };
        Update: Partial<Omit<JobMaterialRow, 'id' | 'user_id' | 'created_at'>>;
      };
      projects: {
        Row: ProjectRow;
        Insert: Partial<ProjectRow> & {
          name: string;
          user_id: string;
        };
        Update: Partial<Omit<ProjectRow, 'id' | 'user_id' | 'created_at'>>;
      };
    };
    Functions: {
      next_document_number: {
        Args: { p_doc_type: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
  };
}
