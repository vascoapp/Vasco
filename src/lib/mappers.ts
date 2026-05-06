import type { DocumentRow, LineItemRow, BusinessSettingsRow, CustomerRow, JobRow, MaterialCatalogRow, SupplierRow, JobMaterialRow, PriceObservationRow } from './database.types';
import type { Quote, Invoice } from '../domain/documents';
import type { QuoteLineItem } from '../domain/lineItems';
import type { BusinessProfile } from '../domain/business';
import type { Customer } from '../domain/customers';
import type { Job, JobStatus, JobPriority } from '../domain/jobs';
import type { Material, DemandPattern, JobMaterial, JobMaterialStatus, PriceObservation } from '../domain/materials';
import type { Supplier, SupplierStatus } from '../domain/suppliers';

// ── Documents ────────────────────────────────────────────────

export function documentRowToQuote(row: DocumentRow): Quote {
  return {
    id: row.document_number ?? row.id,
    customer: row.customer_id ?? '',
    job: row.job_id ?? '',
    amount: Number(row.total_amount),
    status: row.status as Quote['status'],
    lastUpdated: formatRelativeDate(row.updated_at),
    // R63: pull the SOW narrative back from documents.scope_text so the
    // PDF generator at app/quotes/[id].tsx can render it. Without this,
    // the SOW lives only in BE — never reaches the customer.
    description: row.scope_text ?? undefined,
  };
}

export function documentRowToInvoice(row: DocumentRow): Invoice {
  const dueDays = row.due_date
    ? Math.ceil((new Date(row.due_date).getTime() - Date.now()) / 86_400_000)
    : 0;
  return {
    id: row.document_number ?? row.id,
    customer: row.customer_id ?? '',
    job: row.job_id ?? '',
    amount: Number(row.total_amount),
    status: row.status as Invoice['status'],
    dueInDays: dueDays,
  };
}

// ── Line Items ───────────────────────────────────────────────

export function lineItemRowToQuoteLineItem(row: LineItemRow): QuoteLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
  };
}

// ── Business Settings ────────────────────────────────────────

export function businessSettingsToProfile(row: BusinessSettingsRow | null): BusinessProfile {
  if (!row) return { isComplete: false, completenessPercent: 0 };

  // R66 NL launch: completeness now includes IBAN. Without it the
  // invoice PDF renders no bank details — a NL customer can't pay.
  // Adding it to the denominator makes the profile gauge tell the truth.
  const fields = [row.business_name, row.kvk_number, row.vat_number, row.address, row.email, row.phone, row.iban];
  const filled = fields.filter(Boolean).length;
  const percent = Math.round((filled / fields.length) * 100);

  return {
    isComplete: percent === 100,
    completenessPercent: percent,
    businessName: row.business_name ?? undefined,
    kvkNumber: row.kvk_number ?? undefined,
    vatNumber: row.vat_number ?? undefined,
    address: row.address ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    // R66 NL launch: payment + locale columns. Migration
    // 20260415000001_business_profiles.sql declared these but the
    // mapper silently dropped them, leaving every NL invoice without
    // bank details. Pulled through now.
    iban: row.iban ?? undefined,
    bic: row.bic ?? undefined,
    country: (row.country as BusinessProfile['country']) ?? undefined,
    postcode: row.postcode ?? undefined,
    city: row.city ?? undefined,
    website: row.website ?? undefined,
    invoicePrefix: row.invoice_prefix ?? undefined,
    quotePrefix: row.quote_prefix ?? undefined,
    defaultPaymentTerms: row.default_payment_terms ?? undefined,
  };
}

// ── Customers ───────────────────────────────────────────────

export function customerRowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
  };
}

// ── Jobs ────────────────────────────────────────────────────

// R304: REVERSE direction — Job updates → BE row payload.
// Before this mapper, `updateJob` cast the camelCase Partial<Job> directly to
// Record<string,unknown> and pushed it to Supabase, which silently dropped
// all unknown columns. Schedule edits (scheduledDate / scheduledStartTime /
// estimatedDuration / quotedAmount / etc.) never reached BE — local state
// updated, sync failed silently. Same bug class as R301 fixed for signatures.
//
// Skips fields stored in separate tables (timeEntries, materials, photos,
// notes, recurringPattern) and FE-only derived fields (quoteId, invoiceId).
export function jobUpdatesToRowPayload(updates: Partial<Job>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('customerId' in updates)         out.customer_id = updates.customerId;
  if ('title' in updates)              out.title = updates.title;
  if ('description' in updates)        out.description = updates.description;
  if ('status' in updates)             out.status = updates.status;
  if ('siteContact' in updates)        out.site_contact = updates.siteContact;
  if ('sitePhone' in updates)          out.site_phone = updates.sitePhone;
  if ('scheduledDate' in updates)      out.scheduled_date = updates.scheduledDate;
  if ('scheduledStartTime' in updates) out.scheduled_start_time = updates.scheduledStartTime;
  if ('scheduledEndTime' in updates)   out.scheduled_end_time = updates.scheduledEndTime;
  if ('estimatedDuration' in updates)  out.estimated_duration = updates.estimatedDuration;
  if ('quotedAmount' in updates)       out.quoted_amount = updates.quotedAmount;
  if ('agreedAmount' in updates)       out.agreed_amount = updates.agreedAmount;
  if ('trade' in updates)              out.trade = updates.trade;
  if ('priority' in updates)           out.priority = updates.priority;
  if ('roomsAreas' in updates)         out.rooms_areas = updates.roomsAreas;
  if ('specifications' in updates)     out.specifications = updates.specifications;
  if ('completedAt' in updates)        out.completed_at = updates.completedAt;
  if ('signatureSvg' in updates)       out.signature_svg = updates.signatureSvg;
  if ('customerSignoffAt' in updates)  out.customer_signoff_at = updates.customerSignoffAt;
  // Address is a nested object on Job; flatten to address_*
  if ('address' in updates && updates.address) {
    if ('street' in updates.address)       out.address_street = updates.address.street;
    if ('city' in updates.address)         out.address_city = updates.address.city;
    if ('postcode' in updates.address)     out.address_postcode = updates.address.postcode;
    if ('country' in updates.address)      out.address_country = updates.address.country;
    if ('accessNotes' in updates.address)  out.address_access_notes = updates.address.accessNotes;
    if ('parkingNotes' in updates.address) out.address_parking_notes = updates.address.parkingNotes;
  }
  // FE-only / separate-table fields are intentionally dropped:
  //   quoteId, invoiceId         — derived
  //   actualHours, actualCost    — derived from time/material entries
  //   timeEntries, materials,    — separate tables
  //   photos, notes              — separate tables
  //   recurringPattern           — separate table (R254)
  return out;
}

export function jobRowToJob(row: JobRow): Job {
  const hasAddress = row.address_street || row.address_city;
  return {
    id: row.id,
    customerId: row.customer_id,
    title: row.title,
    description: row.description,
    status: row.status as JobStatus,
    address: hasAddress
      ? {
          street: row.address_street ?? '',
          city: row.address_city ?? '',
          postcode: row.address_postcode ?? '',
          country: row.address_country ?? 'NL',
          accessNotes: row.address_access_notes ?? undefined,
          parkingNotes: row.address_parking_notes ?? undefined,
        }
      : undefined,
    siteContact: row.site_contact ?? undefined,
    sitePhone: row.site_phone ?? undefined,
    scheduledDate: row.scheduled_date ?? undefined,
    scheduledStartTime: row.scheduled_start_time ?? undefined,
    scheduledEndTime: row.scheduled_end_time ?? undefined,
    estimatedDuration: row.estimated_duration ?? undefined,
    quotedAmount: row.quoted_amount ?? undefined,
    agreedAmount: row.agreed_amount ?? undefined,
    trade: row.trade ?? undefined,
    priority: (row.priority as JobPriority) ?? 'normal',
    roomsAreas: row.rooms_areas ?? undefined,
    specifications: row.specifications ?? undefined,
    photos: [],
    notes: [],
    timeEntries: [],
    materials: [],
    // R301: signature columns wired through after migration
    // 20260502000003_job_signature_columns.sql
    signatureSvg: (row as any).signature_svg ?? undefined,
    customerSignoffAt: (row as any).customer_signoff_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Materials ──────────────────────────────────────────────

export function materialCatalogRowToMaterial(row: MaterialCatalogRow): Material {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    sku: row.sku ?? undefined,
    ean: row.ean ?? undefined,
    manufacturerCode: row.manufacturer_code ?? undefined,
    baseUnit: row.base_unit,
    unitConversions: row.unit_conversions ?? undefined,
    aliases: row.aliases ?? [],
    specifications: row.specifications ?? undefined,
    demandPattern: (row.demand_pattern as DemandPattern) ?? 'steady',
    avgMonthlyUsage: row.avg_monthly_usage ?? undefined,
    reorderPoint: row.reorder_point ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Suppliers ──────────────────────────────────────────────

export function supplierRowToSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    accountStatus: (row.account_status as SupplierStatus) ?? 'active',
    creditTerms: row.credit_terms ?? undefined,
    discountTier: row.discount_tier ?? undefined,
    reliabilityScore: row.reliability_score ?? undefined,
    avgLeadTimeDays: row.avg_lead_time_days ?? undefined,
    onTimeDeliveryRate: row.on_time_delivery_rate ?? undefined,
    qualityScore: row.quality_score ?? undefined,
    avgPriceVsMarket: row.avg_price_vs_market ?? undefined,
    priceConsistency: row.price_consistency ?? undefined,
    totalSpend: Number(row.total_spend),
    totalOrders: row.total_orders,
    lastOrderDate: row.last_order_date ?? undefined,
    apiEnabled: row.api_enabled,
    catalogUrl: row.catalog_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Job Materials ──────────────────────────────────────────

export function jobMaterialRowToJobMaterial(row: JobMaterialRow): JobMaterial {
  return {
    id: row.id,
    jobId: row.job_id,
    materialId: row.material_id,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : undefined,
    totalPrice: row.total_price != null ? Number(row.total_price) : undefined,
    supplierId: row.supplier_id ?? undefined,
    status: (row.status as JobMaterialStatus) ?? 'planned',
    notes: row.notes ?? undefined,
    orderedAt: row.ordered_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Price Observations ─────────────────────────────────────

export function priceObservationRowToPriceObservation(row: PriceObservationRow): PriceObservation {
  return {
    id: row.id,
    materialId: row.material_id,
    materialName: row.material_name,
    supplierId: row.supplier_id ?? undefined,
    supplierName: row.supplier_name ?? undefined,
    price: Number(row.price),
    currency: row.currency,
    unit: row.unit,
    source: row.source,
    confidence: Number(row.confidence),
    isSale: row.is_sale ?? false,
    saleEndDate: row.sale_end_date ?? undefined,
    regularPrice: row.regular_price != null ? Number(row.regular_price) : undefined,
    inStock: row.in_stock ?? undefined,
    stockLevel: row.stock_level ?? undefined,
    leadTimeDays: row.lead_time_days ?? undefined,
    minQuantity: row.min_quantity != null ? Number(row.min_quantity) : undefined,
    bulkPricing: row.bulk_pricing ?? undefined,
    observedAt: row.observed_at,
    createdAt: row.created_at,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}
