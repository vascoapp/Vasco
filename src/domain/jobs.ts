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

/**
 * One logged stretch of work on a job.
 *
 * Persisted as JSONB on `jobs.time_entries` (migration 20260507000002); both
 * mappers already round-trip the whole array, so a new field INSIDE the entry
 * needs no migration. This was typed `never[]`, which meant the column could
 * be read but never legally written — every writer went through `as any`.
 *
 * `workerId` is which crew member did the work. Undefined = the contractor
 * themselves, which covers every solo install and every entry logged before
 * crews existed. It is deliberately a copy taken at logging time and NOT read
 * from `job.assignedWorkerId`: assignment is who is on the job *now*, so
 * reading it live would silently re-attribute last week's wages the moment a
 * job is handed to someone else.
 */
export type JobTimeEntry = {
  id: string;
  /** Local date key `YYYY-MM-DD` — the day WORKED, not the day recorded. */
  date: string;
  hours: number;
  workerId?: string;
  clockIn?: string;
  clockOut?: string;
};

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
  timeEntries: JobTimeEntry[];
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

/**
 * Whether a job dated `date` is work the contractor will actually do that day.
 *
 * Two queue cards answered "what is on tomorrow?" with different rules — one
 * counted every job in `scheduled` status regardless of date, the other every
 * dated job that was not completed (cancelled included) — and a French device
 * showed "Demain: 1 chantiers planifiés" beside "Aucun chantier demain". One
 * rule, used by both: dated that day, and not cancelled or already finished.
 * Takes a loose status string because both callers also see the legacy Dutch
 * values ('gereed').
 */
export function isWorkOnDay(
  job: { status?: string; scheduledDate?: string; startDate?: string },
  dayKey: string,
): boolean {
  const date = (job.scheduledDate || job.startDate || '').slice(0, 10);
  if (date !== dayKey) return false;
  return job.status !== 'cancelled' && !isJobFinished(job.status);
}

/**
 * The work is done — whatever happened to the money since. A finished job moves
 * on to invoiced and then paid; a reader that only accepted `completed` treated
 * every invoiced or paid job as NOT done, and the Profil "Abschlussrate" (and
 * the score built on it) fell as the contractor billed their work. Accepts the
 * legacy Dutch lifecycle spellings too.
 */
export function isJobFinished(status: string | null | undefined): boolean {
  return ['completed', 'gereed', 'invoiced', 'gefactureerd', 'paid', 'betaald'].includes(status ?? '');
}
