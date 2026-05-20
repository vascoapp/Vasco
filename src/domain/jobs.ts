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
