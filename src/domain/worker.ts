// =============================================================================
// WORKER — Crew member entity (R86 US Phase 5 — crew dispatch lite)
// =============================================================================
// A worker is a tech / installer / journeyman on the contractor's crew.
// Solo contractors don't use this — for them workers[] is empty and the
// `assignedWorkerId` on Job stays undefined.
//
// Persisted to `workers` table via migration 20260520000004. RLS owner-
// only — only the contractor sees their own crew.
//
// "Lite" because we ship the bare entity model + assignment, no GPS
// tracking, no shift scheduling, no payroll. Those are heavier follow-
// ups; this scaffold gets multi-tech crews routed to the right jobs.
// =============================================================================

export type WorkerRole =
  | 'owner'        // the contractor themselves (auto-seeded)
  | 'lead_tech'    // senior tech, can be assigned jobs solo
  | 'tech'         // standard installer
  | 'apprentice'   // junior, usually shadows a lead
  | 'subcontractor'; // 1099 contractor, separate tax treatment

export interface Worker {
  id: string;
  name: string;
  role: WorkerRole;
  email?: string;
  phone?: string;
  // Trade specialization — useful for the smart-scheduler to route the
  // right tech to the right job (HVAC apprentice doesn't get a master-
  // electrician job).
  trade?: string;
  // Hourly cost to the contractor — used for job profitability math.
  // Distinct from what the contractor BILLS the customer per hour.
  hourlyCost?: number;
  // Active = currently on payroll, gets shown in dispatch UI. Inactive
  // = ex-employee, kept for historical job records but doesn't appear
  // in assignment pickers.
  isActive: boolean;
  // Color hint for the schedule view (renders per-worker swimlane).
  color?: string;
  createdAt: string;
  updatedAt: string;
}
