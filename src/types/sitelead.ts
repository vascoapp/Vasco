// Site Lead Features - Dispatch, Calendar, Team Management, Reporting
// ServiceTitan-level features for construction site management

// ============================================
// DISPATCH & SCHEDULING
// ============================================

export type WorkerStatus = 'available' | 'on-job' | 'traveling' | 'break' | 'off-duty';

export interface Worker {
  id: string;
  name: string;
  phone: string;
  email: string;
  trade: string;
  certifications: string[];
  hourlyRate: number;
  status: WorkerStatus;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  avatar?: string;
  rating: number;
  jobsCompleted: number;
}

export interface DispatchJob {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Location
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };

  // Scheduling
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number; // minutes

  // Assignment
  assignedWorkers: string[]; // Worker IDs
  requiredSkills: string[];

  // Status
  status: 'unassigned' | 'assigned' | 'en-route' | 'in-progress' | 'completed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;

  // Customer
  customerId: string;
  customerName: string;
  customerPhone: string;

  // Value
  estimatedValue: number;
  actualValue?: number;

  // Notes
  notes: string[];
  photos: string[];
}

export interface DispatchSlot {
  id: string;
  workerId: string;
  date: string;
  startTime: string;
  endTime: string;
  jobId?: string;
  type: 'job' | 'break' | 'travel' | 'blocked';
}

// ============================================
// CALENDAR / GANTT VIEW
// ============================================

export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  description: string;

  // Timeline
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;

  // Progress
  progressPercent: number;

  // Dependencies
  dependsOn: string[]; // Phase IDs

  // Resources
  assignedTeams: string[];
  estimatedHours: number;
  actualHours: number;

  // Status
  status: 'not-started' | 'in-progress' | 'delayed' | 'completed' | 'blocked';
  delayDays?: number;
  delayReason?: string;

  // Milestones
  milestones: PhaseMilestone[];
}

export interface PhaseMilestone {
  id: string;
  name: string;
  dueDate: string;
  completedDate?: string;
  isComplete: boolean;
  isCriticalPath: boolean;
}

export interface DailySchedule {
  date: string;
  weather?: {
    condition: 'sunny' | 'cloudy' | 'rain' | 'storm';
    temperature: number;
    workable: boolean;
  };

  // Capacity
  totalWorkers: number;
  availableWorkers: number;

  // Jobs
  scheduledJobs: number;
  completedJobs: number;

  // Alerts
  alerts: ScheduleAlert[];
}

export interface ScheduleAlert {
  id: string;
  type: 'weather' | 'delay' | 'resource' | 'material' | 'inspection';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  affectedJobs: string[];
  createdAt: string;
}

// ============================================
// DEEP REPORTING / ANALYTICS
// ============================================

export interface SiteLeadReport {
  id: string;
  siteId: string;
  period: 'day' | 'week' | 'month' | 'quarter';
  generatedAt: string;

  // Overview
  overview: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    grossMargin: number;

    jobsCompleted: number;
    jobsScheduled: number;
    onTimeRate: number;

    customerSatisfaction: number;
    repeatCustomerRate: number;
  };

  // Workforce
  workforce: {
    totalHours: number;
    billableHours: number;
    utilizationRate: number;
    overtimeHours: number;

    workerCount: number;
    averageProductivity: number;

    topPerformers: {
      workerId: string;
      workerName: string;
      jobsCompleted: number;
      revenue: number;
      rating: number;
    }[];
  };

  // Materials
  materials: {
    totalSpend: number;
    budgetVariance: number;
    wastePercent: number;

    topMaterials: {
      name: string;
      quantity: number;
      cost: number;
      trend: 'up' | 'stable' | 'down';
    }[];
  };

  // Safety
  safety: {
    incidentCount: number;
    nearMissCount: number;
    safetyScore: number;
    lastIncidentDate?: string;
    daysSinceIncident: number;
  };

  // Schedule Performance
  schedule: {
    plannedVsActual: number; // percentage
    averageDelayDays: number;
    criticalPathStatus: 'on-track' | 'at-risk' | 'delayed';

    upcomingMilestones: {
      name: string;
      dueDate: string;
      daysUntil: number;
      status: 'on-track' | 'at-risk' | 'overdue';
    }[];
  };
}

export interface ProductivityMetric {
  id: string;
  workerId: string;
  workerName: string;
  date: string;

  // Time
  clockIn: string;
  clockOut: string;
  hoursWorked: number;
  breakTime: number;

  // Output
  jobsCompleted: number;
  tasksCompleted: number;
  revenueGenerated: number;

  // Quality
  reworkRequired: boolean;
  customerRating?: number;

  // Efficiency
  productivityScore: number; // 0-100
  travelTime: number;
  idleTime: number;
}

// ============================================
// TEAM MANAGEMENT
// ============================================

export interface Team {
  id: string;
  name: string;
  leaderId: string;
  leaderName: string;

  members: string[]; // Worker IDs
  primaryTrade: string;

  // Performance
  averageRating: number;
  jobsThisMonth: number;
  revenueThisMonth: number;

  // Availability
  availableToday: number;
  totalMembers: number;
}

export interface ShiftPattern {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakDuration: number;
  daysOfWeek: number[]; // 0-6, Sunday = 0
}

export interface TimeOffRequest {
  id: string;
  workerId: string;
  workerName: string;

  type: 'vacation' | 'sick' | 'personal' | 'training';
  startDate: string;
  endDate: string;

  status: 'pending' | 'approved' | 'denied';
  approvedBy?: string;
  approvedAt?: string;

  notes?: string;
  createdAt: string;
}

// ============================================
// INSPECTION & COMPLIANCE
// ============================================

export interface SiteInspection {
  id: string;
  siteId: string;

  type: 'safety' | 'quality' | 'regulatory' | 'client';
  scheduledDate: string;
  completedDate?: string;

  inspector: string;
  inspectorType: 'internal' | 'external' | 'government';

  status: 'scheduled' | 'in-progress' | 'passed' | 'failed' | 'conditional';

  // Findings
  findings: InspectionFinding[];
  overallScore?: number;

  // Documents
  reportUrl?: string;
  photos: string[];

  // Follow-up
  followUpRequired: boolean;
  followUpDate?: string;
  followUpNotes?: string;
}

export interface InspectionFinding {
  id: string;
  category: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  location: string;

  status: 'open' | 'in-progress' | 'resolved';
  resolvedDate?: string;
  resolvedBy?: string;

  photos: string[];
  correctiveAction?: string;
}

// ============================================
// SITE LEAD DASHBOARD
// ============================================

export interface SiteLeadDashboardData {
  // Today's Overview
  today: {
    date: string;
    weather: DailySchedule['weather'];
    workersOnSite: number;
    jobsInProgress: number;
    jobsCompleted: number;
    revenueToday: number;
  };

  // Alerts
  alerts: ScheduleAlert[];

  // Team Status
  teamStatus: {
    available: number;
    working: number;
    traveling: number;
    onBreak: number;
    offDuty: number;
  };

  // This Week
  weekProgress: {
    jobsPlanned: number;
    jobsCompleted: number;
    percentComplete: number;
    onSchedule: boolean;
  };

  // Key Metrics
  metrics: {
    utilizationRate: number;
    onTimeRate: number;
    customerSatisfaction: number;
    safetyScore: number;
  };

  // Upcoming
  upcomingInspections: SiteInspection[];
  upcomingMilestones: PhaseMilestone[];
}
