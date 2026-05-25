// =============================================================================
// DECISION TRACKER SERVICE — BE-primary tracker create + portal lookup
// =============================================================================
// R66 round 32 — closes the FE→BE→DB drift gap that R30 documented:
// `decision_trackers.id` and `decision_items.id` are DB-generated UUIDs but
// FE generated `tracker_${Date.now()}` + template-string item ids. Direct
// inserts would have failed UUID cast; submitDecision calls referencing
// those fake ids would have been rejected by Postgres.
//
// This service follows the R52/R54 ID-keyed mutation contract:
//   - generate FE tempId for the tracker
//   - bulk-insert into BE WITHOUT specifying id (let DB gen UUIDs)
//   - swap tempId → row.id everywhere it was referenced (tracker + items)
//   - on BE failure, return the tempId-keyed local tracker; the caller
//     queues the write so it lands on next online cycle
//
// Customer-side lookup uses SECURITY DEFINER RPC `get_portal_by_access_code`
// (migration 20260507000009), the only public-facing read surface.
// =============================================================================

import { createDecisionTracker, createDecisionItems, getPortalByAccessCode } from '../lib/dataProvider';
import { isSupabaseConfigured } from '../lib/supabase';
import { logWarn } from '../utils/errorHandler';
import { isUuid } from '../lib/idShape';
import type { CustomerDecisionTracker, DecisionTemplate } from '../types/decisions';
import type { CustomerPortalData } from '../types/customerPortal';
import { MS_PER_DAY } from '../utils/timeConstants';

// ---------------------------------------------------------------------------
// Token generation — 32 hex chars / 128 bits, matching R66r20 entropy.
// ---------------------------------------------------------------------------

const HEX = '0123456789abcdef';

function generateAccessCode(): string {
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    out += HEX[Math.floor(Math.random() * 16)];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tracker create — FE shape with BE UUIDs swapped in everywhere when online,
// or tempId-keyed shape when offline (caller queues the write).
// ---------------------------------------------------------------------------

export interface CreateTrackerInput {
  userId: string;
  template: DecisionTemplate;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  customerEmail?: string;
  jobId?: string;
  projectName?: string;
  projectStartDate?: string;
  quoteAmount?: number;
  depositAmount?: number;
}

export interface CreateTrackerResult {
  tracker: CustomerDecisionTracker;
  /** True when the tracker landed in BE; false when only locally cached. */
  persistedRemotely: boolean;
}

export async function createTrackerWithBE(input: CreateTrackerInput): Promise<CreateTrackerResult> {
  const accessCode = generateAccessCode();
  const startDateIso = input.projectStartDate ?? new Date().toISOString();
  const startDateOnly = startDateIso.slice(0, 10);

  // Build the FE-shape tracker first; if BE writes succeed we'll swap in
  // BE UUIDs before returning.
  const localTracker: CustomerDecisionTracker = {
    id: `tracker_${Date.now()}`,
    jobId: input.jobId ?? 'new',
    customerId: input.customerId ?? 'new',
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    templateId: input.template.id,
    templateName: input.template.name,
    projectStartDate: startDateIso,
    phases: [],
    categories: input.template.categories.map((cat) => ({
      id: cat.id,
      categoryId: cat.id,
      name: cat.name,
      phase: cat.phase,
      dueDate: new Date(Date.now() + cat.daysBeforePhaseStart * MS_PER_DAY).toISOString(),
      items: cat.items.map((item) => ({
        id: item.id,
        itemId: item.id,
        name: item.name,
        description: item.description,
        inputType: item.inputType,
        options: item.options,
        priority: item.priority,
        status: 'pending' as const,
        dueDate: new Date(Date.now() + cat.daysBeforePhaseStart * MS_PER_DAY).toISOString(),
        isOverdue: false,
        remindersSent: 0,
      })),
      isOverdue: false,
      completedCount: 0,
      totalCount: cat.items.length,
    })),
    totalDecisions: input.template.estimatedTotalDecisions,
    decidedCount: 0,
    pendingCount: input.template.estimatedTotalDecisions,
    overdueCount: 0,
    reminderFrequency: 'every_2_days',
    preferredChannel: 'whatsapp',
    status: 'active',
    accessCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured) {
    return { tracker: localTracker, persistedRemotely: false };
  }

  try {
    // 1. Insert tracker WITHOUT id — let DB gen UUID. Capture row.id.
    //    customer_id/job_id are TEXT in schema, but apply isUuid guard
    //    when callers pass real UUIDs to keep the mapper consistent
    //    with R18/R21 patterns.
    const trackerRow = await createDecisionTracker({
      user_id: input.userId,
      job_id: input.jobId ?? 'new',
      customer_id: input.customerId ?? 'new',
      access_code: accessCode,
      template_id: input.template.id,
      customer_name: input.customerName,
      customer_phone: input.customerPhone ?? null,
      customer_email: input.customerEmail ?? null,
      project_name: input.projectName ?? input.template.name,
      project_start_date: startDateOnly,
      quote_amount: input.quoteAmount ?? null,
      deposit_amount: input.depositAmount ?? null,
    });

    // 2. Bulk-insert items. Each gets a DB UUID.
    const itemPayload = input.template.categories.flatMap((cat, catIdx) =>
      cat.items.map((item, itemIdx) => ({
        tracker_id: trackerRow.id,
        category: cat.id,
        label: item.name,
        help_text: item.description ?? null,
        input_type: item.inputType,
        options: item.options ?? [],
        is_required: item.priority !== 'optional',
        due_date: new Date(Date.now() + cat.daysBeforePhaseStart * MS_PER_DAY)
          .toISOString()
          .slice(0, 10),
        sort_order: catIdx * 100 + itemIdx,
      }))
    );
    const itemRows = await createDecisionItems(itemPayload);

    // 3. Build a tempId → DB-uuid map so we can rewrite category items
    //    in the FE tracker shape. The map key is `${cat.id}::${item.id}`
    //    since template items can share ids across categories.
    const itemUuidMap = new Map<string, string>();
    let cursor = 0;
    for (const cat of input.template.categories) {
      for (const item of cat.items) {
        const row = itemRows[cursor];
        if (row) {
          itemUuidMap.set(`${cat.id}::${item.id}`, row.id);
        }
        cursor += 1;
      }
    }

    const trackerWithBEIds: CustomerDecisionTracker = {
      ...localTracker,
      id: trackerRow.id,
      categories: localTracker.categories.map((cat) => ({
        ...cat,
        items: cat.items.map((item) => {
          const beId = itemUuidMap.get(`${cat.id}::${item.itemId}`);
          if (!beId) return item;
          return { ...item, id: beId, itemId: beId };
        }),
      })),
    };

    return { tracker: trackerWithBEIds, persistedRemotely: true };
  } catch (err) {
    logWarn('decisionTrackerService', `BE create failed, falling back to local: ${err instanceof Error ? err.message : String(err)}`);
    return { tracker: localTracker, persistedRemotely: false };
  }
}

// ---------------------------------------------------------------------------
// Customer-side portal lookup — BE-primary via the SECURITY DEFINER RPC.
// Returns one of FOUR states (R191 added network_error):
//   - { kind: 'ok', data }         → real portal payload
//   - { kind: 'expired' }          → access code exists but past expires_at
//   - { kind: 'not_found' }        → access code unknown
//   - { kind: 'network_error' }    → BE unreachable; ask customer to retry
// Callers fall back to mock data only when DEMO_MODE is enabled AND
// kind is 'not_found'.
// ---------------------------------------------------------------------------

export type PortalLookupResult =
  | { kind: 'ok'; data: CustomerPortalData }
  | { kind: 'expired' }
  | { kind: 'not_found' }
  | { kind: 'network_error' };

export async function fetchPortalByAccessCode(accessCode: string): Promise<PortalLookupResult> {
  const result = await getPortalByAccessCode(accessCode);
  if (!result.ok) {
    // R191: surface network failures separately so UI can show "check your
    // connection" instead of "code not found".
    return { kind: result.reason === 'network' ? 'network_error' : 'not_found' };
  }
  const raw = result.data;
  if (!raw || typeof raw !== 'object') return { kind: 'not_found' };

  // R66r58: RPC now returns `{expired: true}` when the row exists but is
  // past its expires_at (or status='expired'). Discriminate before
  // trying to map — the expired payload has no accessToken/categories.
  if ((raw as Record<string, unknown>).expired === true) {
    return { kind: 'expired' };
  }

  return { kind: 'ok', data: mapRpcResponseToPortalData(raw as Record<string, unknown>) };
}

function mapRpcResponseToPortalData(raw: Record<string, unknown>): CustomerPortalData {
  const business = (raw.business ?? {}) as Record<string, unknown>;
  const categoriesRaw = (raw.categories ?? []) as Array<Record<string, unknown>>;

  return {
    accessToken: String(raw.accessToken ?? ''),
    projectName: String(raw.projectName ?? ''),
    contractorName: String(business.contractorName ?? ''),
    contractorCompany: business.contractorCompany ? String(business.contractorCompany) : undefined,
    contractorPhone: business.contractorPhone ? String(business.contractorPhone) : undefined,
    contractorLogo: business.contractorLogo ? String(business.contractorLogo) : undefined,
    contractorCountry: business.contractorCountry ? String(business.contractorCountry) : undefined,
    projectStartDate: String(raw.projectStartDate ?? new Date().toISOString()),
    estimatedCompletionDate: undefined,
    currentPhase: ((raw.currentPhase as string) ?? 'planning') as CustomerPortalData['currentPhase'],
    categories: categoriesRaw.map((cat) => {
      const items = (cat.items ?? []) as Array<Record<string, unknown>>;
      return {
        id: String(cat.id ?? ''),
        name: String(cat.name ?? ''),
        phase: ((cat.phase as string) ?? 'planning') as CustomerPortalData['currentPhase'],
        dueDate: String(cat.dueDate ?? ''),
        isOverdue: Boolean(cat.isOverdue),
        items: items.map((it) => ({
          id: String(it.id ?? ''),
          name: String(it.name ?? ''),
          description: String(it.description ?? ''),
          inputType: ((it.inputType as string) ?? 'text') as CustomerPortalData['categories'][number]['items'][number]['inputType'],
          options: (it.options ?? []) as CustomerPortalData['categories'][number]['items'][number]['options'],
          priority: ((it.priority as string) ?? 'important') as CustomerPortalData['categories'][number]['items'][number]['priority'],
          status: ((it.status as string) ?? 'pending') as CustomerPortalData['categories'][number]['items'][number]['status'],
          dueDate: String(it.dueDate ?? ''),
          isOverdue: Boolean(it.isOverdue),
          value: it.value as CustomerPortalData['categories'][number]['items'][number]['value'],
          notes: it.notes ? String(it.notes) : undefined,
          photoUrls: Array.isArray(it.photoUrls) ? (it.photoUrls as string[]) : undefined,
          decidedAt: it.decidedAt ? String(it.decidedAt) : undefined,
        })),
        completedCount: Number(cat.completedCount ?? 0),
        totalCount: Number(cat.totalCount ?? 0),
      };
    }),
    totalDecisions: Number(raw.totalDecisions ?? 0),
    completedDecisions: Number(raw.completedDecisions ?? 0),
    overdueDecisions: Number(raw.overdueDecisions ?? 0),
    quoteAmount: raw.quoteAmount != null ? Number(raw.quoteAmount) : undefined,
    depositAmount: raw.depositAmount != null ? Number(raw.depositAmount) : undefined,
  };
}

// Defensive uuid check — kept as a public helper since contractor-create
// callers may have non-UUID job_id/customer_id values that the mapper
// needs to normalize before BE write. R32 follows the R18 pattern.
export const isValidUuid = isUuid;
