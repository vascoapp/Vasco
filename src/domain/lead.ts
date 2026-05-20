// =============================================================================
// LEAD — sales-pipeline entity (R81 US Phase 4)
// =============================================================================
// Per us-market-research.md Section A: US contractors think like
// small-business owners obsessed with lead flow. EU contractors mostly
// run reactive quoting; US ones run a proactive pipeline. This entity
// captures pre-customer interest so it can be tracked, contacted,
// converted (becomes a Customer + Quote + Job), or written off.
//
// Sources roughly mirror Housecall Pro / Jobber. Status is the Kanban
// column the lead is in.
//
// Persisted to `leads` table via migration 20260520000002 — fields
// match this shape 1:1.
// =============================================================================

export type LeadStatus =
  // Just landed — inbound form, referral, manual entry. Untouched.
  | 'new'
  // Outreach in flight — contractor has texted/called/emailed.
  | 'contacted'
  // Estimate has been sent and customer hasn't responded yet.
  | 'estimate_sent'
  // Estimate accepted — lead is now a Customer + Job, but the row stays
  // visible in the Won column for the lifecycle dashboard.
  | 'won'
  // Customer said no, ghosted past 30 days, or rejected the estimate.
  | 'lost';

export type LeadSource =
  | 'website_form'
  | 'phone_inbound'
  | 'referral'
  | 'social'   // Instagram, TikTok DM, Google review
  | 'google_lsa' // Google Local Service Ads
  | 'angi'
  | 'thumbtack'
  | 'manual'    // contractor typed it in
  | 'rejected_estimate' // auto-created when a quote was rejected (R81)
  | 'other';

export interface Lead {
  id: string;
  status: LeadStatus;
  source: LeadSource;

  // Customer-facing fields. `customerId` is set only after conversion
  // (status === 'won'). Until then `customerName` is the lead's
  // self-reported name + we don't pollute the Customer table.
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;

  // What the job is. Short free-text the contractor scribbles.
  jobDescription?: string;
  // Contractor's gut-feel ticket size — used for pipeline value totals.
  estimatedValue?: number;
  // Contractor's private notes. Not customer-facing.
  notes?: string;

  // Backlink: when this lead was auto-created from a rejected quote
  // (R81 auto-lead pattern), this is the quote id.
  sourceQuoteId?: string;

  createdAt: string;
  updatedAt: string;
  // First outbound action (text/call/email) recorded.
  contactedAt?: string;
  // Status transitioned to 'won' or 'lost'.
  convertedAt?: string;
}

// Display ordering for the Kanban — left-to-right.
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'new',
  'contacted',
  'estimate_sent',
  'won',
  'lost',
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  estimate_sent: 'Estimate sent',
  won: 'Won',
  lost: 'Lost',
};

// Color hints for the Kanban column header — kept here so it's a single
// source of truth, not duplicated in the screen.
export const LEAD_STATUS_TONE: Record<LeadStatus, 'neutral' | 'info' | 'amber' | 'success' | 'danger'> = {
  new: 'info',
  contacted: 'amber',
  estimate_sent: 'amber',
  won: 'success',
  lost: 'danger',
};

// Helper — Kanban grouping. Returns leads bucketed by their current
// status, with stable ordering matching LEAD_STATUS_ORDER.
export function groupLeadsByStatus(leads: Lead[]): Record<LeadStatus, Lead[]> {
  const grouped: Record<LeadStatus, Lead[]> = {
    new: [], contacted: [], estimate_sent: [], won: [], lost: [],
  };
  for (const l of leads) grouped[l.status].push(l);
  // Sort each column most-recent-first (so newly-added rows surface).
  for (const k of Object.keys(grouped) as LeadStatus[]) {
    grouped[k].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return grouped;
}

// Pipeline value = sum of estimatedValue for everything not lost.
// Won counts at full value, in-flight counts at estimatedValue (the
// contractor's gut estimate). Mirrors how Pipedrive / Housecall surface
// it.
export function pipelineValue(leads: Lead[]): number {
  return leads
    .filter((l) => l.status !== 'lost')
    .reduce((sum, l) => sum + (l.estimatedValue ?? 0), 0);
}

// Win rate over the last `days` days. Used for the pipeline KPI strip.
export function winRate(leads: Lead[], days = 90): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const closed = leads.filter((l) => {
    if (l.status !== 'won' && l.status !== 'lost') return false;
    const ts = new Date(l.convertedAt ?? l.updatedAt).getTime();
    return ts >= cutoff;
  });
  if (closed.length === 0) return 0;
  const won = closed.filter((l) => l.status === 'won').length;
  return Math.round((won / closed.length) * 100);
}
