// =============================================================================
// TEAM MANAGEMENT SERVICE
// =============================================================================
// Comprehensive team and employee management with productivity analytics
// =============================================================================

import { DEMO_MODE } from '../config/demo';
import { trackUserAction } from '../intelligence/intelligenceEngine';
import { registerSingletonReset } from './singletonReset';

// =============================================================================
// TYPES
// =============================================================================

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'owner' | 'foreman' | 'technician' | 'apprentice' | 'admin';
  avatar?: string;
  hireDate: Date;
  hourlyRate: number;
  skills: Skill[];
  certifications: Certification[];
  availability: WeeklyAvailability;
  status: 'active' | 'on_leave' | 'sick' | 'terminated';
  emergencyContact: EmergencyContact;
  performanceScore: number; // 0-100
}

export interface Skill {
  id: string;
  name: string;
  category: 'electrical' | 'plumbing' | 'hvac' | 'carpentry' | 'general';
  level: 'beginner' | 'intermediate' | 'expert';
  verified: boolean;
  verifiedDate?: Date;
}

export interface Certification {
  id: string;
  name: string;
  issuingBody: string;
  issueDate: Date;
  expiryDate: Date;
  certificateNumber: string;
  documentUrl?: string;
  status: 'valid' | 'expiring_soon' | 'expired';
}

export interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export interface DayAvailability {
  available: boolean;
  startTime?: string;
  endTime?: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface TimeEntry {
  id: string;
  memberId: string;
  date: Date;
  clockIn: Date;
  clockOut?: Date;
  breakMinutes: number;
  jobId?: string;
  jobName?: string;
  location?: GPSLocation;
  notes?: string;
  status: 'in_progress' | 'completed' | 'approved' | 'disputed';
  totalHours?: number;
  overtime?: number;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

export interface PayrollSummary {
  memberId: string;
  memberName: string;
  period: {
    start: Date;
    end: Date;
  };
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  deductions: Deduction[];
  netPay: number;
  status: 'draft' | 'approved' | 'paid';
}

export interface Deduction {
  type: string;
  amount: number;
  description: string;
}

export interface PerformanceMetrics {
  memberId: string;
  period: {
    start: Date;
    end: Date;
  };
  jobsCompleted: number;
  averageJobRating: number;
  onTimePercentage: number;
  callbackRate: number;
  revenueGenerated: number;
  hoursWorked: number;
  efficiency: number; // revenue per hour
  customerComplaints: number;
  skillImprovements: number;
}

export interface TeamScheduleEntry {
  id: string;
  memberId: string;
  memberName: string;
  date: Date;
  jobId: string;
  jobName: string;
  customerName: string;
  location: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  requiredSkills: string[];
}

export interface SkillMatch {
  memberId: string;
  memberName: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  availability: boolean;
  workload: number; // percentage of capacity
}

export interface TrainingRecord {
  id: string;
  memberId: string;
  trainingName: string;
  provider: string;
  completedDate: Date;
  hoursSpent: number;
  cost: number;
  skillsGained: string[];
  certificationsEarned: string[];
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  memberId: string;
  memberName: string;
  type: 'vacation' | 'sick' | 'personal' | 'training';
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason?: string;
  status: 'pending' | 'approved' | 'denied';
  approvedBy?: string;
  approvedDate?: Date;
}

// =============================================================================
// MOCK DATA
// =============================================================================

// Demo-only fixtures. These are FABRICATED PEOPLE with hourly rates
// ("Maria de Vries", "Anna Bakker", "Henk Jansen") rendered on the payroll
// screen — a solo contractor saw three employees they do not employ. Real
// installs start empty; the demo keeps them so the flow stays showable.
const DEMO_TEAMMEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    firstName: 'Jan',
    lastName: 'de Vries',
    email: 'jan@vascoinstallaties.nl',
    phone: '06-12345678',
    role: 'foreman',
    hireDate: new Date('2019-03-15'),
    hourlyRate: 45,
    skills: [
      { id: 's-1', name: 'CV-installatie', category: 'hvac', level: 'expert', verified: true, verifiedDate: new Date('2023-01-15') },
      { id: 's-2', name: 'Warmtepompen', category: 'hvac', level: 'expert', verified: true, verifiedDate: new Date('2023-06-20') },
      { id: 's-3', name: 'Loodgieterswerk', category: 'plumbing', level: 'intermediate', verified: true },
    ],
    certifications: [
      {
        id: 'c-1',
        name: 'F-gassen certificaat',
        issuingBody: 'STEK',
        issueDate: new Date('2021-05-10'),
        expiryDate: new Date('2026-05-10'),
        certificateNumber: 'STEK-2021-12345',
        status: 'valid',
      },
      {
        id: 'c-2',
        name: 'VCA Basis',
        issuingBody: 'SSVV',
        issueDate: new Date('2022-02-01'),
        expiryDate: new Date('2032-02-01'),
        certificateNumber: 'VCA-2022-67890',
        status: 'valid',
      },
    ],
    availability: {
      monday: { available: true, startTime: '07:00', endTime: '17:00' },
      tuesday: { available: true, startTime: '07:00', endTime: '17:00' },
      wednesday: { available: true, startTime: '07:00', endTime: '17:00' },
      thursday: { available: true, startTime: '07:00', endTime: '17:00' },
      friday: { available: true, startTime: '07:00', endTime: '15:00' },
      saturday: { available: false },
      sunday: { available: false },
    },
    status: 'active',
    emergencyContact: {
      name: 'Maria de Vries',
      relationship: 'Echtgenote',
      phone: '06-87654321',
    },
    performanceScore: 92,
  },
  {
    id: 'tm-2',
    firstName: 'Pieter',
    lastName: 'Bakker',
    email: 'pieter@vascoinstallaties.nl',
    phone: '06-23456789',
    role: 'technician',
    hireDate: new Date('2021-08-01'),
    hourlyRate: 38,
    skills: [
      { id: 's-4', name: 'CV-installatie', category: 'hvac', level: 'intermediate', verified: true },
      { id: 's-5', name: 'Vloerverwarming', category: 'hvac', level: 'expert', verified: true },
      { id: 's-6', name: 'Elektra basis', category: 'electrical', level: 'beginner', verified: false },
    ],
    certifications: [
      {
        id: 'c-3',
        name: 'VCA Basis',
        issuingBody: 'SSVV',
        issueDate: new Date('2021-08-15'),
        expiryDate: new Date('2031-08-15'),
        certificateNumber: 'VCA-2021-11111',
        status: 'valid',
      },
    ],
    availability: {
      monday: { available: true, startTime: '08:00', endTime: '17:00' },
      tuesday: { available: true, startTime: '08:00', endTime: '17:00' },
      wednesday: { available: true, startTime: '08:00', endTime: '17:00' },
      thursday: { available: true, startTime: '08:00', endTime: '17:00' },
      friday: { available: true, startTime: '08:00', endTime: '16:00' },
      saturday: { available: false },
      sunday: { available: false },
    },
    status: 'active',
    emergencyContact: {
      name: 'Anna Bakker',
      relationship: 'Zus',
      phone: '06-34567890',
    },
    performanceScore: 85,
  },
  {
    id: 'tm-3',
    firstName: 'Kevin',
    lastName: 'Jansen',
    email: 'kevin@vascoinstallaties.nl',
    phone: '06-34567890',
    role: 'apprentice',
    hireDate: new Date('2023-09-01'),
    hourlyRate: 18,
    skills: [
      { id: 's-7', name: 'CV-installatie', category: 'hvac', level: 'beginner', verified: false },
      { id: 's-8', name: 'Loodgieterswerk', category: 'plumbing', level: 'beginner', verified: false },
    ],
    certifications: [],
    availability: {
      monday: { available: true, startTime: '08:00', endTime: '17:00' },
      tuesday: { available: true, startTime: '08:00', endTime: '17:00' },
      wednesday: { available: false }, // School
      thursday: { available: true, startTime: '08:00', endTime: '17:00' },
      friday: { available: true, startTime: '08:00', endTime: '16:00' },
      saturday: { available: false },
      sunday: { available: false },
    },
    status: 'active',
    emergencyContact: {
      name: 'Henk Jansen',
      relationship: 'Vader',
      phone: '06-45678901',
    },
    performanceScore: 78,
  },
];

const mockTeamMembers: TeamMember[] = DEMO_MODE ? DEMO_TEAMMEMBERS : [];

const DEMO_TIMEENTRIES: TimeEntry[] = [
  {
    id: 'te-1',
    memberId: 'tm-1',
    date: new Date(),
    clockIn: new Date(new Date().setHours(7, 0, 0, 0)),
    clockOut: new Date(new Date().setHours(16, 30, 0, 0)),
    breakMinutes: 30,
    jobId: 'job-123',
    jobName: 'CV-ketel vervanging - Familie Smit',
    location: { latitude: 52.3676, longitude: 4.9041, accuracy: 10, timestamp: new Date() },
    status: 'completed',
    totalHours: 9,
    overtime: 0,
  },
  {
    id: 'te-2',
    memberId: 'tm-2',
    date: new Date(),
    clockIn: new Date(new Date().setHours(8, 0, 0, 0)),
    clockOut: new Date(new Date().setHours(17, 0, 0, 0)),
    breakMinutes: 30,
    jobId: 'job-124',
    jobName: 'Vloerverwarming - Nieuwbouw Den Berg',
    status: 'completed',
    totalHours: 8.5,
    overtime: 0,
  },
  {
    id: 'te-3',
    memberId: 'tm-3',
    date: new Date(),
    clockIn: new Date(new Date().setHours(8, 0, 0, 0)),
    status: 'in_progress',
    breakMinutes: 0,
    jobId: 'job-123',
    jobName: 'CV-ketel vervanging - Familie Smit',
  },
];

const mockTimeEntries: TimeEntry[] = DEMO_MODE ? DEMO_TIMEENTRIES : [];

const DEMO_PERFORMANCEMETRICS: PerformanceMetrics[] = [
  {
    memberId: 'tm-1',
    period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    jobsCompleted: 24,
    averageJobRating: 4.8,
    onTimePercentage: 96,
    callbackRate: 2,
    revenueGenerated: 28500,
    hoursWorked: 168,
    efficiency: 169.64,
    customerComplaints: 0,
    skillImprovements: 1,
  },
  {
    memberId: 'tm-2',
    period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    jobsCompleted: 18,
    averageJobRating: 4.5,
    onTimePercentage: 89,
    callbackRate: 5,
    revenueGenerated: 19200,
    hoursWorked: 160,
    efficiency: 120,
    customerComplaints: 1,
    skillImprovements: 2,
  },
  {
    memberId: 'tm-3',
    period: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
    jobsCompleted: 12,
    averageJobRating: 4.2,
    onTimePercentage: 83,
    callbackRate: 8,
    revenueGenerated: 8400,
    hoursWorked: 128,
    efficiency: 65.63,
    customerComplaints: 0,
    skillImprovements: 4,
  },
];

const mockPerformanceMetrics: PerformanceMetrics[] = DEMO_MODE ? DEMO_PERFORMANCEMETRICS : [];

const DEMO_LEAVEREQUESTS: LeaveRequest[] = [
  {
    id: 'lr-1',
    memberId: 'tm-1',
    memberName: 'Jan de Vries',
    type: 'vacation',
    startDate: new Date('2024-03-15'),
    endDate: new Date('2024-03-22'),
    totalDays: 5,
    reason: 'Familievakantie',
    status: 'approved',
    approvedBy: 'owner',
    approvedDate: new Date('2024-02-01'),
  },
  {
    id: 'lr-2',
    memberId: 'tm-2',
    memberName: 'Pieter Bakker',
    type: 'training',
    startDate: new Date('2024-02-20'),
    endDate: new Date('2024-02-21'),
    totalDays: 2,
    reason: 'F-gassen cursus',
    status: 'pending',
  },
];

const mockLeaveRequests: LeaveRequest[] = DEMO_MODE ? DEMO_LEAVEREQUESTS : [];

const mockTrainingRecords: TrainingRecord[] = [
  {
    id: 'tr-1',
    memberId: 'tm-1',
    trainingName: 'Warmtepompen Advanced',
    provider: 'Technische Unie',
    completedDate: new Date('2023-11-15'),
    hoursSpent: 16,
    cost: 850,
    skillsGained: ['Warmtepompen installatie', 'Warmtepompen onderhoud'],
    certificationsEarned: [],
  },
  {
    id: 'tr-2',
    memberId: 'tm-2',
    trainingName: 'VCA Basis',
    provider: 'SSVV',
    completedDate: new Date('2021-08-15'),
    hoursSpent: 8,
    cost: 250,
    skillsGained: ['Veilig werken'],
    certificationsEarned: ['VCA Basis'],
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type TeamListener = () => void;

class TeamManagementService {
  private static instance: TeamManagementService;
  private listeners: Set<TeamListener> = new Set();
  private teamMembers: TeamMember[] = [...mockTeamMembers];
  private timeEntries: TimeEntry[] = [...mockTimeEntries];
  private leaveRequests: LeaveRequest[] = [...mockLeaveRequests];
  private trainingRecords: TrainingRecord[] = [...mockTrainingRecords];

  static getInstance(): TeamManagementService {
    if (!TeamManagementService.instance) {
      TeamManagementService.instance = new TeamManagementService();
      registerSingletonReset(() => {
        const inst = TeamManagementService.instance;
        inst.teamMembers = [...mockTeamMembers];
        inst.timeEntries = [...mockTimeEntries];
        inst.leaveRequests = [...mockLeaveRequests];
        inst.trainingRecords = [...mockTrainingRecords];
        inst.listeners.forEach((l) => l());
      });
    }
    return TeamManagementService.instance;
  }

  subscribe(listener: TeamListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Team Members
  getTeamMembers(): TeamMember[] {
    return this.teamMembers;
  }

  getTeamMember(id: string): TeamMember | undefined {
    return this.teamMembers.find(m => m.id === id);
  }

  addTeamMember(member: Omit<TeamMember, 'id' | 'performanceScore'>): TeamMember {
    const newMember: TeamMember = {
      ...member,
      id: `tm-${Date.now()}`,
      performanceScore: 75,
    };
    this.teamMembers.push(newMember);

    trackUserAction('team_member_added', {
      role: member.role,
      skillCount: member.skills.length,
    });

    this.notify();
    return newMember;
  }

  updateTeamMember(id: string, updates: Partial<TeamMember>): TeamMember | undefined {
    const index = this.teamMembers.findIndex(m => m.id === id);
    if (index >= 0) {
      this.teamMembers[index] = { ...this.teamMembers[index], ...updates };

      trackUserAction('team_member_updated', { memberId: id });

      this.notify();
      return this.teamMembers[index];
    }
    return undefined;
  }

  // Time Tracking
  getTimeEntries(memberId?: string, date?: Date): TimeEntry[] {
    let entries = this.timeEntries;

    if (memberId) {
      entries = entries.filter(e => e.memberId === memberId);
    }

    if (date) {
      const dateStr = date.toDateString();
      entries = entries.filter(e => e.date.toDateString() === dateStr);
    }

    return entries;
  }

  clockIn(memberId: string, jobId?: string, location?: GPSLocation): TimeEntry {
    const member = this.getTeamMember(memberId);
    const entry: TimeEntry = {
      id: `te-${Date.now()}`,
      memberId,
      date: new Date(),
      clockIn: new Date(),
      breakMinutes: 0,
      jobId,
      jobName: jobId ? `Job ${jobId}` : undefined,
      location,
      status: 'in_progress',
    };

    this.timeEntries.push(entry);

    trackUserAction('team_clock_in', {
      memberId,
      hasLocation: !!location,
      hasJob: !!jobId,
    });

    this.notify();
    return entry;
  }

  clockOut(entryId: string, breakMinutes?: number): TimeEntry | undefined {
    const entry = this.timeEntries.find(e => e.id === entryId);
    if (entry && entry.status === 'in_progress') {
      entry.clockOut = new Date();
      entry.breakMinutes = breakMinutes || entry.breakMinutes;
      entry.status = 'completed';

      const hours = (entry.clockOut.getTime() - entry.clockIn.getTime()) / (1000 * 60 * 60);
      entry.totalHours = Math.round((hours - entry.breakMinutes / 60) * 100) / 100;
      entry.overtime = Math.max(0, entry.totalHours - 8);

      trackUserAction('team_clock_out', {
        memberId: entry.memberId,
        totalHours: entry.totalHours,
        overtime: entry.overtime,
      });

      this.notify();
      return entry;
    }
    return undefined;
  }

  approveTimeEntry(entryId: string): TimeEntry | undefined {
    const entry = this.timeEntries.find(e => e.id === entryId);
    if (entry && entry.status === 'completed') {
      entry.status = 'approved';
      this.notify();
      return entry;
    }
    return undefined;
  }

  // Payroll
  getPayrollSummary(memberId: string, startDate: Date, endDate: Date): PayrollSummary {
    const member = this.getTeamMember(memberId);
    const entries = this.timeEntries.filter(e =>
      e.memberId === memberId &&
      e.date >= startDate &&
      e.date <= endDate &&
      e.status === 'approved'
    );

    const regularHours = entries.reduce((sum, e) => sum + Math.min(e.totalHours || 0, 8), 0);
    const overtimeHours = entries.reduce((sum, e) => sum + (e.overtime || 0), 0);
    const hourlyRate = member?.hourlyRate || 0;

    const regularPay = regularHours * hourlyRate;
    const overtimePay = overtimeHours * hourlyRate * 1.5;
    const totalPay = regularPay + overtimePay;

    // Standard Dutch deductions (simplified)
    const deductions: Deduction[] = [
      { type: 'Loonheffing', amount: totalPay * 0.37, description: 'Belasting en premies' },
      { type: 'Pensioenpremie', amount: totalPay * 0.05, description: 'Werknemersdeel pensioen' },
    ];

    const totalDeductions = deductions.reduce((sum, d) => sum + d.amount, 0);

    trackUserAction('payroll_calculated', {
      memberId,
      regularHours,
      overtimeHours,
    });

    return {
      memberId,
      memberName: member ? `${member.firstName} ${member.lastName}` : 'Onbekend',
      period: { start: startDate, end: endDate },
      regularHours,
      overtimeHours,
      regularPay,
      overtimePay,
      totalPay,
      deductions,
      netPay: totalPay - totalDeductions,
      status: 'draft',
    };
  }

  // Performance
  getPerformanceMetrics(memberId: string): PerformanceMetrics | undefined {
    return mockPerformanceMetrics.find(m => m.memberId === memberId);
  }

  getTeamPerformance(): PerformanceMetrics[] {
    return mockPerformanceMetrics;
  }

  // Skill Matching
  findSkillMatches(requiredSkills: string[], date: Date): SkillMatch[] {
    trackUserAction('skill_match_search', {
      skillCount: requiredSkills.length,
      skills: requiredSkills,
    });

    return this.teamMembers
      .filter(m => m.status === 'active')
      .map(member => {
        const memberSkillNames = member.skills.map(s => s.name.toLowerCase());
        const matchedSkills = requiredSkills.filter(s =>
          memberSkillNames.includes(s.toLowerCase())
        );
        const missingSkills = requiredSkills.filter(s =>
          !memberSkillNames.includes(s.toLowerCase())
        );

        // Check availability for the date
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
        const dayAvailability = member.availability[dayName as keyof WeeklyAvailability];

        // R34: was `Math.random() * 100` — every contractor running team
        // assignment saw a different fake workload per render. Real
        // workload would derive from scheduled job hours per member /
        // capacity. Until that wire exists, return 0 (honest "unknown").
        const workload = 0;

        return {
          memberId: member.id,
          memberName: `${member.firstName} ${member.lastName}`,
          matchScore: Math.round((matchedSkills.length / requiredSkills.length) * 100),
          matchedSkills,
          missingSkills,
          availability: dayAvailability.available,
          workload: Math.round(workload),
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  // Leave Management
  getLeaveRequests(memberId?: string): LeaveRequest[] {
    if (memberId) {
      return this.leaveRequests.filter(r => r.memberId === memberId);
    }
    return this.leaveRequests;
  }

  submitLeaveRequest(request: Omit<LeaveRequest, 'id' | 'status' | 'memberName'>): LeaveRequest {
    const member = this.getTeamMember(request.memberId);
    const newRequest: LeaveRequest = {
      ...request,
      id: `lr-${Date.now()}`,
      memberName: member ? `${member.firstName} ${member.lastName}` : 'Onbekend',
      status: 'pending',
    };

    this.leaveRequests.push(newRequest);

    trackUserAction('leave_request_submitted', {
      memberId: request.memberId,
      type: request.type,
      totalDays: request.totalDays,
    });

    this.notify();
    return newRequest;
  }

  approveLeaveRequest(requestId: string): LeaveRequest | undefined {
    const request = this.leaveRequests.find(r => r.id === requestId);
    if (request) {
      request.status = 'approved';
      request.approvedDate = new Date();
      request.approvedBy = 'owner';

      trackUserAction('leave_request_approved', { requestId });

      this.notify();
      return request;
    }
    return undefined;
  }

  denyLeaveRequest(requestId: string): LeaveRequest | undefined {
    const request = this.leaveRequests.find(r => r.id === requestId);
    if (request) {
      request.status = 'denied';
      this.notify();
      return request;
    }
    return undefined;
  }

  // Training
  getTrainingRecords(memberId?: string): TrainingRecord[] {
    if (memberId) {
      return this.trainingRecords.filter(r => r.memberId === memberId);
    }
    return this.trainingRecords;
  }

  addTrainingRecord(record: Omit<TrainingRecord, 'id'>): TrainingRecord {
    const newRecord: TrainingRecord = {
      ...record,
      id: `tr-${Date.now()}`,
    };

    this.trainingRecords.push(newRecord);

    trackUserAction('training_recorded', {
      memberId: record.memberId,
      trainingName: record.trainingName,
      skillsGained: record.skillsGained.length,
    });

    this.notify();
    return newRecord;
  }

  // Team Stats
  getTeamStats(): {
    totalMembers: number;
    activeMembers: number;
    avgPerformance: number;
    totalCertifications: number;
    expiringCertifications: number;
    pendingLeaveRequests: number;
    todaysClockedIn: number;
  } {
    const activeMembers = this.teamMembers.filter(m => m.status === 'active');
    const allCerts = this.teamMembers.flatMap(m => m.certifications);
    const expiringCerts = allCerts.filter(c => c.status === 'expiring_soon');
    const pendingLeave = this.leaveRequests.filter(r => r.status === 'pending');
    const todayEntries = this.timeEntries.filter(e =>
      e.date.toDateString() === new Date().toDateString() &&
      e.status === 'in_progress'
    );

    return {
      totalMembers: this.teamMembers.length,
      activeMembers: activeMembers.length,
      avgPerformance: Math.round(
        activeMembers.reduce((sum, m) => sum + m.performanceScore, 0) / activeMembers.length
      ),
      totalCertifications: allCerts.length,
      expiringCertifications: expiringCerts.length,
      pendingLeaveRequests: pendingLeave.length,
      todaysClockedIn: todayEntries.length,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const teamManagementService = TeamManagementService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMembers(teamManagementService.getTeamMembers());
    setLoading(false);

    return teamManagementService.subscribe(() => {
      setMembers(teamManagementService.getTeamMembers());
    });
  }, []);

  const addMember = useCallback((member: Omit<TeamMember, 'id' | 'performanceScore'>) => {
    return teamManagementService.addTeamMember(member);
  }, []);

  const updateMember = useCallback((id: string, updates: Partial<TeamMember>) => {
    return teamManagementService.updateTeamMember(id, updates);
  }, []);

  return { members, loading, addMember, updateMember };
}

export function useTimeTracking(memberId?: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEntries(teamManagementService.getTimeEntries(memberId));
    setLoading(false);

    return teamManagementService.subscribe(() => {
      setEntries(teamManagementService.getTimeEntries(memberId));
    });
  }, [memberId]);

  const clockIn = useCallback((id: string, jobId?: string, location?: GPSLocation) => {
    return teamManagementService.clockIn(id, jobId, location);
  }, []);

  const clockOut = useCallback((entryId: string, breakMinutes?: number) => {
    return teamManagementService.clockOut(entryId, breakMinutes);
  }, []);

  const approveEntry = useCallback((entryId: string) => {
    return teamManagementService.approveTimeEntry(entryId);
  }, []);

  return { entries, loading, clockIn, clockOut, approveEntry };
}

export function useTeamPerformance() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMetrics(teamManagementService.getTeamPerformance());
    setLoading(false);
  }, []);

  const getMemberMetrics = useCallback((memberId: string) => {
    return teamManagementService.getPerformanceMetrics(memberId);
  }, []);

  return { metrics, loading, getMemberMetrics };
}

export function useLeaveRequests(memberId?: string) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRequests(teamManagementService.getLeaveRequests(memberId));
    setLoading(false);

    return teamManagementService.subscribe(() => {
      setRequests(teamManagementService.getLeaveRequests(memberId));
    });
  }, [memberId]);

  const submitRequest = useCallback((request: Omit<LeaveRequest, 'id' | 'status' | 'memberName'>) => {
    return teamManagementService.submitLeaveRequest(request);
  }, []);

  const approveRequest = useCallback((requestId: string) => {
    return teamManagementService.approveLeaveRequest(requestId);
  }, []);

  const denyRequest = useCallback((requestId: string) => {
    return teamManagementService.denyLeaveRequest(requestId);
  }, []);

  return { requests, loading, submitRequest, approveRequest, denyRequest };
}

export function useTeamStats() {
  const [stats, setStats] = useState(teamManagementService.getTeamStats());

  useEffect(() => {
    return teamManagementService.subscribe(() => {
      setStats(teamManagementService.getTeamStats());
    });
  }, []);

  return stats;
}

export function useSkillMatching() {
  const findMatches = useCallback((requiredSkills: string[], date: Date) => {
    return teamManagementService.findSkillMatches(requiredSkills, date);
  }, []);

  return { findMatches };
}
