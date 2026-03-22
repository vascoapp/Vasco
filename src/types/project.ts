// =============================================================================
// PROJECT TYPE — Groups multiple jobs under one renovation/construction project
// =============================================================================
// Used by aannemers (general contractors) managing multi-trade projects.
// Solo tradespeople can ignore projects — jobs work standalone.
// =============================================================================

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export interface ProjectMilestone {
  id: string;
  title: string;
  trade?: string;
  weekNumber: number; // week offset from project start (1-based)
  completed: boolean;
  jobIds: string[]; // linked jobs
}

export interface Project {
  id: string;
  title: string;
  customerId: string;
  customerName?: string;
  status: ProjectStatus;
  description?: string;

  // Location
  address?: {
    street: string;
    city: string;
    postcode: string;
    country: string;
  };

  // Schedule
  startDate?: string; // ISO date
  targetEndDate?: string;
  actualEndDate?: string;

  // Financial
  totalBudget: number;
  totalQuoted: number;
  totalInvoiced: number;
  totalPaid: number;

  // Multi-trade scheduling
  milestones: ProjectMilestone[];

  // Linked entities
  jobIds: string[];
  quoteIds: string[];
  invoiceIds: string[];
  subcontractorIds: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

// Computed from linked jobs + invoices
export interface ProjectPnL {
  projectId: string;
  revenue: number;           // total invoiced
  materialCosts: number;     // sum of job materials
  laborCosts: number;        // sum of time entries × rate
  subcontractorCosts: number;// sum of subcontractor invoices
  otherCosts: number;
  grossProfit: number;
  grossMargin: number;       // percentage
  budgetVariance: number;    // budget - actual costs
  budgetVariancePct: number;
}
