// Mock Data for Site Lead Features - Dispatch, Teams, Reports

import type {
  Worker,
  DispatchJob,
  Team,
  ProjectPhase,
  SiteInspection,
  SiteLeadReport,
  SiteLeadDashboardData,
  ScheduleAlert,
} from '../types/sitelead';

// ============================================
// WORKERS
// ============================================

export const MOCK_WORKERS: Worker[] = [
  {
    id: 'worker-001',
    name: 'Jan de Vries',
    phone: '+31 6 1234 5678',
    email: 'jan@vasco.dev',
    trade: 'Electrician',
    certifications: ['VCA', 'NEN 1010', 'EV Charging'],
    hourlyRate: 55,
    status: 'on-job',
    currentLocation: { lat: 52.3676, lng: 4.9041, updatedAt: '2024-02-01T09:30:00Z' },
    rating: 4.8,
    jobsCompleted: 156,
  },
  {
    id: 'worker-002',
    name: 'Pieter Bakker',
    phone: '+31 6 2345 6789',
    email: 'pieter@vasco.dev',
    trade: 'Plumber',
    certifications: ['VCA', 'STEK', 'Gas Safe'],
    hourlyRate: 52,
    status: 'available',
    rating: 4.6,
    jobsCompleted: 98,
  },
  {
    id: 'worker-003',
    name: 'Kees Jansen',
    phone: '+31 6 3456 7890',
    email: 'kees@vasco.dev',
    trade: 'Carpenter',
    certifications: ['VCA', 'Timber Frame'],
    hourlyRate: 48,
    status: 'traveling',
    currentLocation: { lat: 52.3702, lng: 4.8952, updatedAt: '2024-02-01T09:45:00Z' },
    rating: 4.9,
    jobsCompleted: 203,
  },
  {
    id: 'worker-004',
    name: 'Willem Smit',
    phone: '+31 6 4567 8901',
    email: 'willem@vasco.dev',
    trade: 'Painter',
    certifications: ['VCA'],
    hourlyRate: 42,
    status: 'on-job',
    rating: 4.5,
    jobsCompleted: 87,
  },
  {
    id: 'worker-005',
    name: 'Thomas Berg',
    phone: '+31 6 5678 9012',
    email: 'thomas@vasco.dev',
    trade: 'HVAC Technician',
    certifications: ['VCA', 'F-Gas', 'Heat Pump'],
    hourlyRate: 58,
    status: 'break',
    rating: 4.7,
    jobsCompleted: 134,
  },
  {
    id: 'worker-006',
    name: 'Erik Visser',
    phone: '+31 6 6789 0123',
    email: 'erik@vasco.dev',
    trade: 'General Contractor',
    certifications: ['VCA', 'First Aid'],
    hourlyRate: 45,
    status: 'off-duty',
    rating: 4.4,
    jobsCompleted: 67,
  },
];

// ============================================
// DISPATCH JOBS
// ============================================

export const MOCK_DISPATCH_JOBS: DispatchJob[] = [
  {
    id: 'dispatch-001',
    title: 'Electrical Panel Upgrade',
    description: 'Upgrade main electrical panel from 3x25A to 3x35A. Install new distribution board.',
    priority: 'high',
    address: 'Herengracht 123, Amsterdam',
    coordinates: { lat: 52.3702, lng: 4.8952 },
    scheduledDate: '2024-02-01',
    scheduledTime: '08:00',
    estimatedDuration: 240,
    assignedWorkers: ['worker-001'],
    requiredSkills: ['Electrician', 'NEN 1010'],
    status: 'in-progress',
    startedAt: '2024-02-01T08:15:00Z',
    customerId: 'cust-001',
    customerName: 'Van den Berg B.V.',
    customerPhone: '+31 20 123 4567',
    estimatedValue: 1850,
    notes: ['Building has old wiring - may need additional inspection', 'Parking available in courtyard'],
    photos: [],
  },
  {
    id: 'dispatch-002',
    title: 'Kitchen Plumbing Renovation',
    description: 'Install new sink, dishwasher connection, and replace under-sink pipes.',
    priority: 'medium',
    address: 'Prinsengracht 456, Amsterdam',
    coordinates: { lat: 52.3676, lng: 4.9041 },
    scheduledDate: '2024-02-01',
    scheduledTime: '10:00',
    estimatedDuration: 180,
    assignedWorkers: ['worker-002'],
    requiredSkills: ['Plumber'],
    status: 'assigned',
    customerId: 'cust-002',
    customerName: 'Familie Mulder',
    customerPhone: '+31 6 9876 5432',
    estimatedValue: 680,
    notes: ['Customer prefers communication via WhatsApp'],
    photos: [],
  },
  {
    id: 'dispatch-003',
    title: 'Window Frame Repair',
    description: 'Repair rotted window frames on 2nd floor. 3 windows total.',
    priority: 'low',
    address: 'Keizersgracht 789, Amsterdam',
    scheduledDate: '2024-02-01',
    scheduledTime: '13:00',
    estimatedDuration: 300,
    assignedWorkers: ['worker-003'],
    requiredSkills: ['Carpenter'],
    status: 'en-route',
    customerId: 'cust-003',
    customerName: 'Woningcorporatie Eigen Haard',
    customerPhone: '+31 20 555 1234',
    estimatedValue: 1200,
    notes: ['Tenant will be home. Ring doorbell at arrival.', 'Heritage building - use matching wood'],
    photos: [],
  },
  {
    id: 'dispatch-004',
    title: 'Living Room Repaint',
    description: 'Full repaint of living room including ceiling. Color: RAL 9010.',
    priority: 'medium',
    address: 'Vondelstraat 321, Amsterdam',
    scheduledDate: '2024-02-01',
    scheduledTime: '09:00',
    estimatedDuration: 360,
    assignedWorkers: ['worker-004'],
    requiredSkills: ['Painter'],
    status: 'in-progress',
    startedAt: '2024-02-01T09:10:00Z',
    customerId: 'cust-004',
    customerName: 'Dhr. Janssen',
    customerPhone: '+31 6 1111 2222',
    estimatedValue: 890,
    notes: ['Furniture already covered by customer'],
    photos: [],
  },
  {
    id: 'dispatch-005',
    title: 'Heat Pump Maintenance',
    description: 'Annual maintenance of air-source heat pump. Check refrigerant levels.',
    priority: 'high',
    address: 'Amstelveenseweg 555, Amsterdam',
    scheduledDate: '2024-02-01',
    scheduledTime: '14:00',
    estimatedDuration: 120,
    assignedWorkers: [],
    requiredSkills: ['HVAC Technician', 'F-Gas'],
    status: 'unassigned',
    customerId: 'cust-005',
    customerName: 'Green Living Apartments',
    customerPhone: '+31 20 999 8888',
    estimatedValue: 320,
    notes: ['Access code for roof: 4521'],
    photos: [],
  },
];

// ============================================
// TEAMS
// ============================================

export const MOCK_TEAMS: Team[] = [
  {
    id: 'team-001',
    name: 'Alpha Electrical',
    leaderId: 'worker-001',
    leaderName: 'Jan de Vries',
    members: ['worker-001'],
    primaryTrade: 'Electrical',
    averageRating: 4.8,
    jobsThisMonth: 23,
    revenueThisMonth: 34500,
    availableToday: 1,
    totalMembers: 2,
  },
  {
    id: 'team-002',
    name: 'Beta Plumbing',
    leaderId: 'worker-002',
    leaderName: 'Pieter Bakker',
    members: ['worker-002'],
    primaryTrade: 'Plumbing',
    averageRating: 4.6,
    jobsThisMonth: 18,
    revenueThisMonth: 22400,
    availableToday: 1,
    totalMembers: 2,
  },
  {
    id: 'team-003',
    name: 'Finishing Crew',
    leaderId: 'worker-003',
    leaderName: 'Kees Jansen',
    members: ['worker-003', 'worker-004'],
    primaryTrade: 'Carpentry & Painting',
    averageRating: 4.7,
    jobsThisMonth: 31,
    revenueThisMonth: 28900,
    availableToday: 2,
    totalMembers: 3,
  },
];

// ============================================
// PROJECT PHASES (Gantt Chart Data)
// ============================================

export const MOCK_PROJECT_PHASES: ProjectPhase[] = [
  {
    id: 'phase-001',
    projectId: 'proj-001',
    name: 'Foundation',
    description: 'Site preparation and foundation works',
    plannedStart: '2024-01-15',
    plannedEnd: '2024-02-15',
    actualStart: '2024-01-15',
    progressPercent: 85,
    dependsOn: [],
    assignedTeams: ['team-003'],
    estimatedHours: 480,
    actualHours: 412,
    status: 'in-progress',
    milestones: [
      { id: 'ms-001', name: 'Site cleared', dueDate: '2024-01-20', completedDate: '2024-01-19', isComplete: true, isCriticalPath: true },
      { id: 'ms-002', name: 'Foundation poured', dueDate: '2024-02-01', isComplete: false, isCriticalPath: true },
      { id: 'ms-003', name: 'Foundation cured', dueDate: '2024-02-15', isComplete: false, isCriticalPath: true },
    ],
  },
  {
    id: 'phase-002',
    projectId: 'proj-001',
    name: 'Structural Framework',
    description: 'Steel and timber frame erection',
    plannedStart: '2024-02-16',
    plannedEnd: '2024-03-31',
    progressPercent: 0,
    dependsOn: ['phase-001'],
    assignedTeams: ['team-003'],
    estimatedHours: 720,
    actualHours: 0,
    status: 'not-started',
    milestones: [
      { id: 'ms-004', name: 'Steel delivery', dueDate: '2024-02-16', isComplete: false, isCriticalPath: true },
      { id: 'ms-005', name: 'Frame complete', dueDate: '2024-03-20', isComplete: false, isCriticalPath: true },
      { id: 'ms-006', name: 'Roof on', dueDate: '2024-03-31', isComplete: false, isCriticalPath: true },
    ],
  },
  {
    id: 'phase-003',
    projectId: 'proj-001',
    name: 'MEP First Fix',
    description: 'Mechanical, Electrical, Plumbing rough-in',
    plannedStart: '2024-03-15',
    plannedEnd: '2024-04-30',
    progressPercent: 0,
    dependsOn: ['phase-002'],
    assignedTeams: ['team-001', 'team-002'],
    estimatedHours: 560,
    actualHours: 0,
    status: 'not-started',
    milestones: [
      { id: 'ms-007', name: 'Electrical rough-in', dueDate: '2024-04-10', isComplete: false, isCriticalPath: false },
      { id: 'ms-008', name: 'Plumbing rough-in', dueDate: '2024-04-15', isComplete: false, isCriticalPath: false },
      { id: 'ms-009', name: 'MEP inspection passed', dueDate: '2024-04-30', isComplete: false, isCriticalPath: true },
    ],
  },
  {
    id: 'phase-004',
    projectId: 'proj-001',
    name: 'Interior Finishing',
    description: 'Drywall, painting, flooring',
    plannedStart: '2024-05-01',
    plannedEnd: '2024-06-15',
    progressPercent: 0,
    dependsOn: ['phase-003'],
    assignedTeams: ['team-003'],
    estimatedHours: 640,
    actualHours: 0,
    status: 'not-started',
    milestones: [
      { id: 'ms-010', name: 'Drywall complete', dueDate: '2024-05-20', isComplete: false, isCriticalPath: false },
      { id: 'ms-011', name: 'Paint complete', dueDate: '2024-06-05', isComplete: false, isCriticalPath: false },
      { id: 'ms-012', name: 'Flooring installed', dueDate: '2024-06-15', isComplete: false, isCriticalPath: true },
    ],
  },
];

// ============================================
// INSPECTIONS
// ============================================

export const MOCK_INSPECTIONS: SiteInspection[] = [
  {
    id: 'insp-001',
    siteId: 'site-001',
    type: 'safety',
    scheduledDate: '2024-02-05',
    inspector: 'H. van Dam',
    inspectorType: 'internal',
    status: 'scheduled',
    findings: [],
    photos: [],
    followUpRequired: false,
  },
  {
    id: 'insp-002',
    siteId: 'site-001',
    type: 'regulatory',
    scheduledDate: '2024-02-15',
    inspector: 'Municipality Inspector',
    inspectorType: 'government',
    status: 'scheduled',
    findings: [],
    photos: [],
    followUpRequired: false,
  },
  {
    id: 'insp-003',
    siteId: 'site-001',
    type: 'quality',
    scheduledDate: '2024-01-25',
    completedDate: '2024-01-25',
    inspector: 'Quality Assurance Team',
    inspectorType: 'internal',
    status: 'passed',
    overallScore: 92,
    findings: [
      {
        id: 'find-001',
        category: 'Workmanship',
        severity: 'minor',
        description: 'Small gap in insulation at corner joint',
        location: 'North wall, section B2',
        status: 'resolved',
        resolvedDate: '2024-01-26',
        resolvedBy: 'worker-003',
        photos: [],
        correctiveAction: 'Additional insulation installed and sealed',
      },
    ],
    photos: [],
    followUpRequired: false,
  },
];

// ============================================
// ALERTS
// ============================================

export const MOCK_ALERTS: ScheduleAlert[] = [
  {
    id: 'alert-001',
    type: 'weather',
    severity: 'warning',
    title: 'Rain Expected Tomorrow',
    message: 'Heavy rain forecast for Feb 2nd. Consider rescheduling outdoor work.',
    affectedJobs: ['dispatch-003'],
    createdAt: '2024-02-01T07:00:00Z',
  },
  {
    id: 'alert-002',
    type: 'resource',
    severity: 'info',
    title: 'HVAC Job Unassigned',
    message: 'Heat pump maintenance at Amstelveenseweg needs technician assignment.',
    affectedJobs: ['dispatch-005'],
    createdAt: '2024-02-01T08:00:00Z',
  },
  {
    id: 'alert-003',
    type: 'inspection',
    severity: 'warning',
    title: 'Upcoming Safety Inspection',
    message: 'Safety inspection scheduled for Feb 5th. Ensure all documentation is ready.',
    affectedJobs: [],
    createdAt: '2024-02-01T06:00:00Z',
  },
];

// ============================================
// SITE LEAD REPORT
// ============================================

export const MOCK_SITE_REPORT: SiteLeadReport = {
  id: 'report-001',
  siteId: 'site-001',
  period: 'week',
  generatedAt: '2024-02-01T00:00:00Z',

  overview: {
    totalRevenue: 28450,
    totalCosts: 18200,
    grossProfit: 10250,
    grossMargin: 36,

    jobsCompleted: 24,
    jobsScheduled: 28,
    onTimeRate: 89,

    customerSatisfaction: 4.7,
    repeatCustomerRate: 45,
  },

  workforce: {
    totalHours: 312,
    billableHours: 268,
    utilizationRate: 86,
    overtimeHours: 18,

    workerCount: 6,
    averageProductivity: 82,

    topPerformers: [
      { workerId: 'worker-003', workerName: 'Kees Jansen', jobsCompleted: 8, revenue: 9600, rating: 4.9 },
      { workerId: 'worker-001', workerName: 'Jan de Vries', jobsCompleted: 6, revenue: 11100, rating: 4.8 },
      { workerId: 'worker-002', workerName: 'Pieter Bakker', jobsCompleted: 5, revenue: 4080, rating: 4.6 },
    ],
  },

  materials: {
    totalSpend: 6840,
    budgetVariance: -320,
    wastePercent: 4.2,

    topMaterials: [
      { name: 'Electrical Cable (3x2.5mm)', quantity: 450, cost: 890, trend: 'stable' },
      { name: 'PVC Pipe (40mm)', quantity: 120, cost: 340, trend: 'up' },
      { name: 'Premium Wall Paint', quantity: 45, cost: 1125, trend: 'down' },
    ],
  },

  safety: {
    incidentCount: 0,
    nearMissCount: 1,
    safetyScore: 98,
    lastIncidentDate: '2023-11-15',
    daysSinceIncident: 78,
  },

  schedule: {
    plannedVsActual: 94,
    averageDelayDays: 0.3,
    criticalPathStatus: 'on-track',

    upcomingMilestones: [
      { name: 'Foundation poured', dueDate: '2024-02-01', daysUntil: 0, status: 'on-track' },
      { name: 'Foundation cured', dueDate: '2024-02-15', daysUntil: 14, status: 'on-track' },
      { name: 'Steel delivery', dueDate: '2024-02-16', daysUntil: 15, status: 'at-risk' },
    ],
  },
};

// ============================================
// DASHBOARD DATA
// ============================================

export const MOCK_DASHBOARD_DATA: SiteLeadDashboardData = {
  today: {
    date: '2024-02-01',
    weather: {
      condition: 'cloudy',
      temperature: 8,
      workable: true,
    },
    workersOnSite: 4,
    jobsInProgress: 3,
    jobsCompleted: 1,
    revenueToday: 4620,
  },

  alerts: MOCK_ALERTS,

  teamStatus: {
    available: 1,
    working: 2,
    traveling: 1,
    onBreak: 1,
    offDuty: 1,
  },

  weekProgress: {
    jobsPlanned: 28,
    jobsCompleted: 18,
    percentComplete: 64,
    onSchedule: true,
  },

  metrics: {
    utilizationRate: 86,
    onTimeRate: 89,
    customerSatisfaction: 4.7,
    safetyScore: 98,
  },

  upcomingInspections: MOCK_INSPECTIONS.filter((i) => i.status === 'scheduled'),
  upcomingMilestones: MOCK_PROJECT_PHASES.flatMap((p) =>
    p.milestones.filter((m) => !m.isComplete)
  ).slice(0, 5),
};
