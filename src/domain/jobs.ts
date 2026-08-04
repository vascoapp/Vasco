export type JobStatus =
  | 'lead'
  | 'quoted'
  | 'accepted'
  | 'scheduled'
  | 'in-progress'
  | 'completed'
  | 'invoiced'
  | 'paid'
  | 'cancelled';

export type JobAddress = {
  street: string;
  city: string;
  postcode: string;
  country: string;
  accessNotes?: string;
  parkingNotes?: string;
};

export type JobPriority = 'low' | 'normal' | 'high' | 'emergency';

// Re-export for convenience — job materials live in AppState.jobMaterials (keyed by jobId)
export type { JobMaterial } from './materials';

export type Job = {
  id: string;
  customerId: string | null;
  title: string;
  description: string | null;
  status: JobStatus;
  // Address
  address?: JobAddress;
  siteContact?: string;
  sitePhone?: string;
  // Scheduling
  scheduledDate?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  estimatedDuration?: number;
  // Financial
  quoteId?: string;
  invoiceId?: string;
  quotedAmount?: number;
  agreedAmount?: number;
  actualHours?: number;
  actualCost?: number;
  // Work details
  trade?: string;
  priority: JobPriority;
  roomsAreas?: string[];
  specifications?: string;
  // Stub arrays (loaded from separate tables in future)
  photos: never[];
  notes: never[];
  timeEntries: never[];
  materials: never[];
  // Recurring
  recurringPattern?: {
    frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
    nextDate: string;
    endDate?: string;
    autoInvoice: boolean;
    templateJobId: string;
  };
  // Customer-handover signature (R301).
  // signatureSvg is base64-encoded PNG captured by SignaturePad at completion.
  // customerSignoffAt timestamps when the customer accepted the work.
  // Both persist to BE via migration 20260502000003_job_signature_columns.sql.
  signatureSvg?: string;
  customerSignoffAt?: string;
  // R86 crew dispatch lite: worker assignment. References workers.id from
  // migration 20260520000004. Optional — solo contractors don't need to
  // touch this. Multi-tech crews use it to route the day's schedule.
  assignedWorkerId?: string;
  // Timestamps
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * The completion timestamp to persist when a job moves to `status`.
 *
 * Returns undefined for every status except `completed`, so callers can spread
 * it without branching.
 *
 * This is a legal rule, not bookkeeping: `addInvoiceFromJob` snapshots the
 * invoice's leveringsdatum from `job.completedAt` (NL Belastingdienst Art. 35
 * lid 1.b). Nothing wrote the field until 2026-08-04 — only seeded jobs carried
 * one — so every invoice raised from a real job persisted delivery_date = null.
 *
 * An existing stamp is preserved rather than refreshed: re-completing a job
 * must not move a date an invoice has already snapshotted and reported.
 */
export function completionStampFor(
  status: JobStatus,
  existing: string | undefined,
  now: () => string = () => new Date().toISOString(),
): string | undefined {
  if (status !== 'completed') return undefined;
  return existing ?? now();
}
