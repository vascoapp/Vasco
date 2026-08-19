import type { DocumentRow, LineItemRow, BusinessSettingsRow, CustomerRow, JobRow, MaterialCatalogRow, SupplierRow, JobMaterialRow, PriceObservationRow, LeadRow } from './database.types';
import type { Quote, Invoice } from '../domain/documents';
import type { QuoteLineItem } from '../domain/lineItems';
import type { BusinessProfile } from '../domain/business';
import type { Customer } from '../domain/customers';
import type { Job, JobStatus, JobPriority } from '../domain/jobs';
import type { Project } from '../types/project';
import { isUuid } from './idShape';
import type { Material, DemandPattern, JobMaterial, JobMaterialStatus, PriceObservation } from '../domain/materials';
import type { Supplier, SupplierStatus } from '../domain/suppliers';
import type { Lead } from '../domain/lead';

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
    // Rule #8: sent_at/created_at were written (markQuoteSent) but never read
    // back → undefined on cold start, silently disabling the stale-quote /
    // follow-up automation (staleQuoteService skips `if (!q.sentAt)`).
    sentAt: row.sent_at ?? undefined,
    createdAt: row.created_at,
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
    // R66 round 13: hydrate notes (was always undefined — UI lost notes
    // on every cold start).
    notes: row.notes ?? undefined,
    // R66 round 47: hydrate persisted leveringsdatum so the PDF render
    // path reads it back on cold start (was lost when linked job
    // deleted post-invoice). Stored as a date string in BE; surface as
    // ISO so callers can `new Date(...)` it.
    deliveryDate: row.delivery_date ?? undefined,
    // Rule #8 step 5. Without hydration the EVE queue re-proposes an e-invoice
    // submission for the same invoice after every cold start.
    einvoiceSubmitted: row.einvoice_submitted ?? undefined,
    // Hydrate paid_at — was written by AppState.markInvoicePaid but never
    // read back. Cold-start would lose the actual paid-on date, breaking
    // ageing analytics and customer ledger views. Rule #8 violation.
    paidAt: row.paid_at ?? undefined,
    // Rule #8: these three were written but never read back → undefined on cold
    // start. sentAt/createdAt drive DSO/aging/cashflow (fall back to a
    // non-parseable relative string → NaN); dueDate is the exportable due date
    // in every e-invoice format (rendered empty without this).
    sentAt: row.sent_at ?? undefined,
    dueDate: row.due_date ?? undefined,
    createdAt: row.created_at,
    // Progress billing (rule #8 step 5). Without these an instalment invoice
    // forgets which project and which term it belongs to on cold start, and
    // the retentie withheld from it is silently lost -- which is real money.
    projectId: row.project_id ?? undefined,
    billingTermId: row.billing_term_id ?? undefined,
    changeOrderId: row.change_order_id ?? undefined,
    retentionAmount: row.retention_amount != null ? Number(row.retention_amount) : undefined,
    isRetentionRelease: row.is_retention_release || undefined,
    // Rule #8 step 5 again, and the reason this one survived every previous
    // sweep: the writer is an edge function (mollie-webhook / stripe-webhook),
    // not AppState, so "who writes this field" came up empty on the client.
    paymentMethod: row.payment_method ?? undefined,
    paymentProvider: row.payment_provider ?? undefined,
    paymentId: row.payment_id ?? undefined,
  };
}

// ── Line Items ───────────────────────────────────────────────

export function lineItemRowToQuoteLineItem(row: LineItemRow): QuoteLineItem {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    // R66 round 47: hydrate per-line VAT rate from documents.line_items.vat_rate.
    // Survives cold start so mixed-rate quotes don't lose the per-line distinction.
    vatRate: row.vat_rate != null ? Number(row.vat_rate) : undefined,
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
    province: row.province ?? undefined,
    fiscalRegime: row.fiscal_regime ?? undefined,
    personType: (row.person_type as 'F' | 'J' | null) ?? undefined,
    website: row.website ?? undefined,
    invoicePrefix: row.invoice_prefix ?? undefined,
    quotePrefix: row.quote_prefix ?? undefined,
    defaultPaymentTerms: row.default_payment_terms ?? undefined,
    // R66 round 24: hydrate the 5 onboarding-captured fields. Pre-R24
    // these were silently undefined on every cold start, reverting KOR /
    // Kleinunternehmer contractors to standard VAT.
    vatScheme: (row.vat_scheme as BusinessProfile['vatScheme']) ?? undefined,
    businessType: row.business_type ?? undefined,
    teamSize: (row.team_size as BusinessProfile['teamSize']) ?? undefined,
    trade: row.trade ?? undefined,
    registrationNumber: row.registration_number ?? undefined,
    // R83 US Phase 5 audit fix: hydrate the 4 US-specific fields. Pre-R83
    // these were silently undefined on every cold start, breaking the US
    // invoice PDF (empty Routing # / Account #) and the license-expiry
    // warning (zero licenses loaded). Migration 20260520000003 added the
    // state + ACH columns; 20260520000001 added licenses jsonb.
    state: row.state ?? undefined,
    routingNumber: row.routing_number ?? undefined,
    // undefined (not []) when the column is null, so the caller's
    // `?? allPaymentMethods` fallback still fires for an unconfigured profile.
    enabledPaymentMethods: row.enabled_payment_methods ?? undefined,
    bankAccountNumber: row.bank_account_number ?? undefined,
    licenses: row.licenses
      ? (row.licenses as unknown as BusinessProfile['licenses'])
      : undefined,
  };
}

// ── Customers ───────────────────────────────────────────────

/**
 * camelCase Customer patch -> customers row payload.
 *
 * Rule #8 step 4. Before the fiscal-address columns landed every Customer
 * field happened to be spelled the same in both worlds (name, email, phone,
 * address), so `updateCustomer` passed the patch straight through and nothing
 * needed translating. `vatId` and `einvoiceRouting` break that: PostgREST
 * rejects an unknown column and rejects the WHOLE statement with it, so one
 * camelCase key would have silently killed every customer edit that touched it.
 *
 * Nullish-only (`!== undefined`), so a caller can clear a field with `null`
 * but an absent key never overwrites. ⚠️ This is the #143 trap in reverse —
 * check that a field the UI can CLEAR is sent as null, not omitted.
 */
export function customerUpdatesToRowPayload(updates: Partial<Customer>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const map: Array<[keyof Customer, string]> = [
    ['name', 'name'], ['email', 'email'], ['phone', 'phone'], ['address', 'address'],
    ['city', 'city'], ['postcode', 'postcode'], ['country', 'country'],
    ['province', 'province'], ['vatId', 'vat_id'], ['taxId', 'tax_id'],
    ['einvoiceRouting', 'einvoice_routing'], ['einvoiceEmail', 'einvoice_email'],
  ];
  for (const [from, to] of map) {
    if (updates[from] !== undefined) out[to] = updates[from];
  }
  return out;
}

export function customerRowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    // Rule #8 step 5. Without these the buyer address on every structured
    // invoice is a street line and nothing else — XRechnung BR-DE-8/9 require
    // city and post code as separate elements.
    city: row.city ?? undefined,
    postcode: row.postcode ?? undefined,
    country: row.country ?? undefined,
    province: row.province ?? undefined,
    vatId: row.vat_id ?? undefined,
    taxId: row.tax_id ?? undefined,
    einvoiceRouting: row.einvoice_routing ?? undefined,
    einvoiceEmail: row.einvoice_email ?? undefined,
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
  // `'x' in updates` decides whether the caller MENTIONED the field; `?? null`
  // decides whether an explicit `undefined` can EMPTY it. They are two separate
  // halves and only having the first is a silent bug: a bare `undefined` leaves
  // a key that JSON.stringify drops, so the column keeps its old value and the
  // cleared field reappears on the next cold start (learnings #143, hit twice —
  // Project.targetEndDate and then Job.siteContact one file later).
  //
  // Every NULLABLE column below therefore coalesces. The exceptions are
  // deliberate: `title` and `status` are NOT NULL in the schema, so nulling
  // them would be rejected by the database rather than clear anything, and
  // `time_entries` is NOT NULL with an array default (`?? []`).
  const out: Record<string, unknown> = {};
  if ('customerId' in updates)         out.customer_id = updates.customerId ?? null;
  if ('title' in updates)              out.title = updates.title;          // NOT NULL
  if ('description' in updates)        out.description = updates.description ?? null;
  if ('status' in updates)             out.status = updates.status;        // NOT NULL
  if ('siteContact' in updates)        out.site_contact = updates.siteContact ?? null;
  if ('sitePhone' in updates)          out.site_phone = updates.sitePhone ?? null;
  if ('scheduledDate' in updates)      out.scheduled_date = updates.scheduledDate ?? null;
  if ('scheduledStartTime' in updates) out.scheduled_start_time = updates.scheduledStartTime ?? null;
  if ('scheduledEndTime' in updates)   out.scheduled_end_time = updates.scheduledEndTime ?? null;
  // Numbers coalesce on NULLISH only, so a real 0 still writes 0 — clearing an
  // estimate and estimating zero are different statements.
  if ('estimatedDuration' in updates)  out.estimated_duration = updates.estimatedDuration ?? null;
  if ('quotedAmount' in updates)       out.quoted_amount = updates.quotedAmount ?? null;
  if ('agreedAmount' in updates)       out.agreed_amount = updates.agreedAmount ?? null;
  if ('trade' in updates)              out.trade = updates.trade ?? null;
  if ('quoteId' in updates)            out.quote_id = updates.quoteId ?? null;
  if ('priority' in updates)           out.priority = updates.priority ?? null;
  if ('roomsAreas' in updates)         out.rooms_areas = updates.roomsAreas ?? null;
  if ('specifications' in updates)     out.specifications = updates.specifications ?? null;
  if ('completedAt' in updates)        out.completed_at = updates.completedAt ?? null;
  if ('signatureSvg' in updates)       out.signature_svg = updates.signatureSvg ?? null;
  if ('customerSignoffAt' in updates)  out.customer_signoff_at = updates.customerSignoffAt ?? null;
  // R86 crew dispatch lite: write through worker assignment to BE.
  if ('assignedWorkerId' in updates)   out.assigned_worker_id = updates.assignedWorkerId ?? null;
  // R66 round 12: timeEntries was previously dropped here ("separate table")
  // but no such table existed — every contractor's logged hours were lost
  // on cold start. Now persisted as JSONB on jobs.time_entries.
  if ('timeEntries' in updates)        out.time_entries = updates.timeEntries ?? [];
  // Address is a nested object on Job; flatten to address_*
  if ('address' in updates && updates.address) {
    // All six are nullable — same coalesce rule as above so a cleared address
    // line actually empties instead of silently keeping the old street.
    if ('street' in updates.address)       out.address_street = updates.address.street ?? null;
    if ('city' in updates.address)         out.address_city = updates.address.city ?? null;
    if ('postcode' in updates.address)     out.address_postcode = updates.address.postcode ?? null;
    if ('country' in updates.address)      out.address_country = updates.address.country ?? null;
    if ('accessNotes' in updates.address)  out.address_access_notes = updates.address.accessNotes ?? null;
    if ('parkingNotes' in updates.address) out.address_parking_notes = updates.address.parkingNotes ?? null;
  }
  // FE-only / separate-table fields are intentionally dropped:
  //   invoiceId                  — derived
  //   (quoteId is NO LONGER derived — jobs.quote_id, migration 20260806000005)
  //   actualHours, actualCost    — derived from time/material entries
  //   materials                  — separate table (job_materials)
  //   photos                     — separate table (job_photos)
  //   notes                      — separate table
  //   recurringPattern           — separate table (R254)
  // timeEntries: now persisted via jobs.time_entries JSONB (R66/R12 above).
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
    // Which quote this job came from. Was listed below as "FE-only derived",
    // which meant it never survived a cold start and the quote→job→invoice
    // chain could not actually be followed in the data.
    quoteId: row.quote_id ?? undefined,
    priority: (row.priority as JobPriority) ?? 'normal',
    roomsAreas: row.rooms_areas ?? undefined,
    specifications: row.specifications ?? undefined,
    photos: [],
    notes: [],
    // R66 round 12: hydrate from jobs.time_entries JSONB (was always [],
    // throwing away every cross-device hour read).
    timeEntries: Array.isArray(row.time_entries) ? (row.time_entries as any) : [],
    // The write mapper drops `actualHours` as "derived from time entries" —
    // but nothing ever derived it, so every hour logged through the job
    // screen was local-only and vanished on the next refreshData(), taking
    // project labour cost and margin back to zero with it. Deriving it here
    // is what makes that comment true.
    actualHours: Array.isArray(row.time_entries) && row.time_entries.length > 0
      ? Math.round(
          (row.time_entries as Array<{ hours?: number }>)
            .reduce((s, e) => s + (e.hours ?? 0), 0) * 100,
        ) / 100
      : undefined,
    materials: [],
    // R301: signature columns wired through after migration
    // 20260502000003_job_signature_columns.sql
    signatureSvg: (row as any).signature_svg ?? undefined,
    customerSignoffAt: (row as any).customer_signoff_at ?? undefined,
    // R86 crew dispatch lite: hydrate worker assignment from
    // jobs.assigned_worker_id (migration 20260520000004).
    assignedWorkerId: row.assigned_worker_id ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// R86 crew dispatch lite. workers row → domain Worker.
import type { WorkerRow } from './database.types';
import type { Worker } from '../domain/worker';

// R96 — leads cold-start hydration. Without this, the leads table is
// write-only from the client's perspective — a contractor's lead pipeline
// resets to empty every cold-start.
export function leadRowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? undefined,
    customerEmail: row.customer_email ?? undefined,
    customerId: row.customer_id ?? undefined,
    jobDescription: row.job_description ?? undefined,
    estimatedValue: row.estimated_value ?? undefined,
    notes: row.notes ?? undefined,
    sourceQuoteId: row.source_quote_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contactedAt: row.contacted_at ?? undefined,
    convertedAt: row.converted_at ?? undefined,
  };
}

export function workerRowToWorker(row: WorkerRow): Worker {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    trade: row.trade ?? undefined,
    hourlyCost: row.hourly_cost ?? undefined,
    isActive: row.is_active,
    color: row.color ?? undefined,
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

// ---------------------------------------------------------------------------
// PROJECTS
// ---------------------------------------------------------------------------

/**
 * camelCase Project patch -> projects row payload.
 *
 * Lifted out of an inline block inside AppState.updateProject. A rule computed
 * inline in a component or a closure is unreachable by every test in the suite
 * (#138), and this one had already gone wrong: it guarded on `!== undefined`,
 * which can SET a field but never CLEAR one. Removing a promised handover
 * updated the local copy through the spread and never reached the patch, so
 * the date came back on the next cold start.
 *
 * Same two-part rule as `jobUpdatesToRowPayload`: `'x' in updates` decides
 * whether the caller MENTIONED the field, `?? null` decides whether an explicit
 * `undefined` can EMPTY it. A key holding `undefined` does not survive
 * JSON.stringify, so without the coalesce the clear silently never happens.
 *
 * NOT NULL columns keep their bare assignment or a non-null default:
 * `name` and `status` cannot take null, and `milestones`, `billing_terms`,
 * `change_orders`, `retention_percent` are NOT NULL with defaults.
 *
 * Deliberately unchanged from the inline version: `customerId`, `totalQuoted`,
 * `totalInvoiced` and `totalPaid` are still not written here. The first has no
 * edit surface and the rest are derived from invoices — adding them would be a
 * behaviour change, not a guard fix.
 */
export function projectUpdatesToRowPayload(updates: Partial<Project>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // `customer_id` is `uuid references customers(id)`, so anything that is not a
  // uuid must become null rather than reach the database — every other write
  // site (addProject and the four offline-queue payloads) already guards this
  // way, and the create screen can still hand us a free-typed NAME.
  if ('customerId' in updates)       out.customer_id = isUuid(updates.customerId) ? updates.customerId : null;
  if ('title' in updates)            out.name = updates.title;               // NOT NULL
  if ('description' in updates)      out.description = updates.description ?? null;
  if ('status' in updates)           out.status = updates.status;            // NOT NULL
  if ('startDate' in updates)        out.start_date = updates.startDate ?? null;
  if ('targetEndDate' in updates)    out.target_end_date = updates.targetEndDate ?? null;
  if ('actualEndDate' in updates)    out.actual_end_date = updates.actualEndDate ?? null;
  // Nullish-only: a project budgeted at 0 is not a project with no budget.
  if ('totalBudget' in updates)      out.total_budget = updates.totalBudget ?? null;
  if ('address' in updates)          out.address = updates.address ?? null;
  if ('milestones' in updates)       out.milestones = updates.milestones ?? [];        // NOT NULL
  if ('billingTerms' in updates)     out.billing_terms = updates.billingTerms ?? [];   // NOT NULL
  if ('retentionPercent' in updates) out.retention_percent = updates.retentionPercent ?? 0; // NOT NULL
  if ('changeOrders' in updates)     out.change_orders = updates.changeOrders ?? [];   // NOT NULL
  return out;
}
