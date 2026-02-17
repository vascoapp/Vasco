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
  quotedAmount?: number;
  agreedAmount?: number;
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
  // Timestamps
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};
