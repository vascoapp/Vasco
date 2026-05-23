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
  // R66 round 24: onboarding-captured fields (migration 20260507000007).
  // Pre-R24 these were silently dropped by updateBusinessProfile dbUpdates
  // and the contractor's KOR/Kleinunternehmer status reverted to standard
  // VAT after every cold start.
  vat_scheme: string | null;
  business_type: string | null;
  team_size: string | null;
  trade: string | null;
  registration_number: string | null;
  // R83 US Phase 5 audit fix: US-specific fields. Migration
  // 20260520000003 widens country CHECK to include 'US' and adds the
  // state + ACH-bank columns. Migration 20260520000001 adds licenses.
  state: string | null;
  routing_number: string | null;
  bank_account_number: string | null;
  // licenses is a JSONB array of { type, state, number, expiryDate,
  // issueDate?, issuingAuthority? }. Type is intentionally loose here —
  // the canonical ContractorLicense shape lives in src/domain/business.ts.
  licenses: Array<Record<string, unknown>> | null;
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
  // R66 round 12: time entries persisted as JSONB on jobs. Migration
  // 20260507000002_jobs_time_entries.sql. Was previously dropped by the
  // mapper (comment: "separate table") even though no such table existed.
  time_entries: Array<{ id: string; date: string; hours: number; clockIn?: string; clockOut?: string }>;
  // R86 crew dispatch lite: which Worker is on this job. NULL for solo
  // contractors. Migration 20260520000004 adds the column + FK to
  // workers(id) ON DELETE SET NULL.
  assigned_worker_id: string | null;
  // Timestamps
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

// R86 crew dispatch lite. Mirrors the workers table from migration
// 20260520000004 1:1. Domain shape lives in src/domain/worker.ts.
export type WorkerRow = {
  id: string;
  user_id: string;
  name: string;
  role: 'owner' | 'lead_tech' | 'tech' | 'apprentice' | 'subcontractor';
  email: string | null;
  phone: string | null;
  trade: string | null;
  hourly_cost: number | null;
  is_active: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
};

// R81 leads table. Mirrors migration 20260520000002 1:1. Domain shape in
// src/domain/lead.ts. Added in R96 — previously the leads table existed
// in DB but had no Row type, so cold-start hydration couldn't be wired.
export type LeadRow = {
  id: string;
  user_id: string;
  status: 'new' | 'contacted' | 'estimate_sent' | 'won' | 'lost';
  source:
    | 'website_form' | 'phone_inbound' | 'referral' | 'social'
    | 'google_lsa' | 'angi' | 'thumbtack' | 'manual'
    | 'rejected_estimate' | 'other';
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_id: string | null;
  job_description: string | null;
  estimated_value: number | null;
  notes: string | null;
  source_quote_id: string | null;
  created_at: string;
  updated_at: string;
  contacted_at: string | null;
  converted_at: string | null;
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
  // R66 round 8: soft-delete column. Active rows have deleted_at=null;
  // soft-deleted invoices keep the row for Belastingdienst Art. 52 AWR /
  // GoBD §147 HGB retention. RLS hides deleted rows from FE SELECT.
  deleted_at: string | null;
  // R66 round 13: internal contractor notes. The invoice detail screen
  // had a full notes UI with no backing column — every save was lost on
  // cold start. Migration 20260507000003_documents_notes.sql.
  notes: string | null;
  // R66 round 47: NL Belastingdienst Art. 35 lid 1.b leveringsdatum.
  // Migration 20260508000001 — closes R34 deferred. Persisted on invoice
  // create from linked job's completed_at; PDF render reads from here
  // (no longer joins jobs at render time).
  delivery_date: string | null;
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
  // R66 round 47: per-line VAT rate. Migration 20260508000001 closes R38
  // deferred — pre-R47 only the in-memory AutoInvoice carried the rate;
  // mixed-rate NL plumbing/materials lost the distinction across cold start.
  vat_rate: number | null;
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

// R66 round 14: expenses table (migration 20260507000004 — promoted from
// AsyncStorage to BE-backed for NL Belastingdienst Art. 52 AWR 7-year
// retention compliance). Mirrors the FE Expense type.
export type ExpenseRow = {
  id: string;
  user_id: string;
  description: string;
  category: string;
  amount: number;
  vat_amount: number;
  vat_rate: number;
  expense_date: string;
  supplier: string | null;
  receipt_url: string | null;
  job_id: string | null;
  job_title: string | null;
  deductible: boolean;
  deduction_percentage: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// R66 round 19: quote_acceptance_links table — customer-facing approval
// capability URLs (migration 20260507000006). Replaces the device-local
// AsyncStorage flow that couldn't cross from contractor to customer device.
// Anon role can SELECT by token + UPDATE pending → accepted/rejected.
export type QuoteAcceptanceLinkRow = {
  token: string;
  user_id: string;
  quote_id: string;
  customer_id: string | null;
  customer_name: string | null;
  quote_amount: number;
  quote_description: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  decline_reason: string | null;
  created_at: string;
  responded_at: string | null;
  expires_at: string;
};

// R66 round 15: gobd_audit_log table — append-only hash-chained audit
// trail (migration 20260507000005). NL AWR Art. 52 + DE GoBD § 146
// retention requirements. RLS: INSERT only, no UPDATE / DELETE policies.
export type GobdAuditLogRow = {
  id: string;
  user_id: string;
  entry_index: number;
  type: string;
  ref: string;
  content_hash: string;
  prev_hash: string;
  signed_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

// R66 round 31: decision_trackers — customer-decision portal access
// (migrations 003 + 20260507000009). The access_code field is the
// capability bearer credential; SECURITY DEFINER RPC
// `get_portal_by_access_code` is the only anon read surface.
export type DecisionTrackerRow = {
  id: string;
  user_id: string;
  job_id: string;
  customer_id: string;
  access_code: string;
  template_id: string | null;
  status: 'active' | 'completed' | 'expired';
  total_items: number;
  completed_items: number;
  // R66r31 additions — customer/project/payment metadata for portal UI.
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  project_name: string | null;
  project_start_date: string | null;
  quote_amount: number | null;
  deposit_amount: number | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DecisionItemRow = {
  id: string;
  tracker_id: string;
  category: string;
  label: string;
  help_text: string | null;
  input_type: string;
  options: unknown;
  is_required: boolean | null;
  due_date: string | null;
  sort_order: number | null;
  created_at: string;
};

export type DecisionSubmissionRow = {
  id: string;
  tracker_id: string;
  item_id: string;
  submitted_by: 'customer' | 'contractor';
  value: string | null;
  notes: string | null;
  photos: string[] | null;
  linked_product_url: string | null;
  time_to_decide_seconds: number | null;
  submitted_at: string;
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
      expenses: {
        Row: ExpenseRow;
        Insert: Partial<ExpenseRow> & {
          description: string;
          category: string;
          amount: number;
          user_id: string;
        };
        Update: Partial<Omit<ExpenseRow, 'id' | 'user_id' | 'created_at'>>;
      };
      gobd_audit_log: {
        Row: GobdAuditLogRow;
        Insert: Partial<GobdAuditLogRow> & {
          id: string;
          entry_index: number;
          type: string;
          ref: string;
          content_hash: string;
          prev_hash: string;
          signed_at: string;
        };
        // No Update — append-only.
        Update: never;
      };
      quote_acceptance_links: {
        Row: QuoteAcceptanceLinkRow;
        Insert: Partial<QuoteAcceptanceLinkRow> & {
          token: string;
          quote_id: string;
          expires_at: string;
        };
        Update: Partial<Omit<QuoteAcceptanceLinkRow, 'token' | 'user_id' | 'created_at'>>;
      };
      decision_trackers: {
        Row: DecisionTrackerRow;
        Insert: Partial<DecisionTrackerRow> & {
          user_id: string;
          job_id: string;
          customer_id: string;
          access_code: string;
        };
        Update: Partial<Omit<DecisionTrackerRow, 'id' | 'user_id' | 'created_at'>>;
      };
      decision_items: {
        Row: DecisionItemRow;
        Insert: Partial<DecisionItemRow> & {
          tracker_id: string;
          category: string;
          label: string;
        };
        Update: Partial<Omit<DecisionItemRow, 'id' | 'tracker_id' | 'created_at'>>;
      };
      decision_submissions: {
        Row: DecisionSubmissionRow;
        Insert: Partial<DecisionSubmissionRow> & {
          tracker_id: string;
          item_id: string;
        };
        Update: Partial<Omit<DecisionSubmissionRow, 'id' | 'tracker_id' | 'item_id'>>;
      };
    };
    Functions: {
      next_document_number: {
        Args: { p_doc_type: string };
        Returns: string;
      };
      get_portal_by_access_code: {
        Args: { p_access_code: string };
        // jsonb shape — see migration 20260507000009 for the exact
        // structure the FE customer portal consumes. Typed as `unknown`
        // here so callers explicitly cast to a domain type rather than
        // sliding shape drift through the type system.
        Returns: unknown;
      };
    };
    Enums: Record<string, never>;
  };
}
