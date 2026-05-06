// =============================================================================
// SUBCONTRACTOR SERVICE — DEPRECATED — DO NOT EXTEND (R19 audit)
// =============================================================================
// Status as of R19: pure orphan, no UI, mock-only roster.
//
//  - 278 LoC of subcontractor / assignment / credential / stats machinery,
//    powered by 3 hardcoded mock subcontractors (`De Vries Elektra`,
//    `Bakker Loodgieterij`, ...) with mock NL credentials (`NEN 1010`,
//    `VCA Basis`).
//  - ZERO imports anywhere in app/ or src/components/. Hooks
//    `useSubcontractors` / `useSubcontractorAssignments` /
//    `useSubcontractorStats` defined and exported, never called.
//  - Assignments are created in-memory only — no AsyncStorage, no Supabase.
//    `cancelAssignment` / `recordWorkUpdate` calls evaporate on unmount.
//  - Aligned with LAUNCH §6 solo-contractor focus per
//    `feedback_no_lead_generation.md` — multi-party orchestration is not
//    in the load-bearing flow.
//
// To make this real:
//  1. New BE tables `subcontractors`, `subcontractor_assignments`,
//     `subcontractor_credentials` with per-contractor RLS
//  2. RPCs for the three readers
//  3. UI: /contractor/subcontractors route + assignment picker on job detail
//  4. Credential expiry → AI queue item (cert_renewal pattern from R286)
//  5. Localize credentials and trade names
//
// Until then: do not import. Same speculative-multi-employee provenance as
// teamToolsService (R299, deleted in R24).
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { MS_PER_DAY } from '../utils/timeConstants';
import { registerSingletonReset } from './singletonReset';

// =============================================================================
// TYPES
// =============================================================================

export type SubcontractorStatus = 'active' | 'inactive' | 'blocked';
export type AssignmentStatus = 'assigned' | 'in-progress' | 'completed' | 'cancelled';

export interface SubcontractorCredential {
  id: string;
  name: string;
  issuingBody: string;
  expiryDate: Date;
  verified: boolean;
  documentUrl?: string;
}

export interface Subcontractor {
  id: string;
  name: string;
  companyName?: string;
  trade: string;
  phone: string;
  email?: string;
  status: SubcontractorStatus;
  hourlyRate: number;
  credentials: SubcontractorCredential[];
  insuranceExpiry?: Date;
  kvkNumber?: string;
  rating: number; // 0-5
  completedJobs: number;
  notes?: string;
  createdAt: Date;
}

export interface SubcontractorAssignment {
  id: string;
  subcontractorId: string;
  subcontractorName: string;
  jobId: string;
  jobTitle: string;
  status: AssignmentStatus;
  startDate: Date;
  endDate?: Date;
  agreedRate: number;
  rateType: 'hourly' | 'fixed';
  hoursLogged: number;
  totalCost: number;
  notes?: string;
}

export interface SubcontractorStats {
  totalSubcontractors: number;
  activeAssignments: number;
  totalSpentThisMonth: number;
  expiringCredentials: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const now = new Date();

const mockSubcontractors: Subcontractor[] = [
  {
    id: 'sc-1',
    name: 'Jan de Vries',
    companyName: 'De Vries Elektra',
    trade: 'Elektricien',
    phone: '+31612345678',
    email: 'jan@devries-elektra.nl',
    status: 'active',
    hourlyRate: 65,
    credentials: [
      { id: 'cred-1', name: 'NEN 1010', issuingBody: 'UNETO-VNI', expiryDate: new Date('2027-06-15'), verified: true },
      { id: 'cred-2', name: 'VCA Basis', issuingBody: 'SSVV', expiryDate: new Date('2026-09-01'), verified: true },
    ],
    insuranceExpiry: new Date('2027-01-01'),
    kvkNumber: '87654321',
    rating: 4.5,
    completedJobs: 23,
    createdAt: new Date('2024-03-01'),
  },
  {
    id: 'sc-2',
    name: 'Pieter Bakker',
    companyName: 'Bakker Loodgieterij',
    trade: 'Loodgieter',
    phone: '+31687654321',
    status: 'active',
    hourlyRate: 55,
    credentials: [
      { id: 'cred-3', name: 'KOMO Keurmerk', issuingBody: 'KOMO', expiryDate: new Date('2026-04-10'), verified: true },
    ],
    insuranceExpiry: new Date('2026-12-01'),
    rating: 4.0,
    completedJobs: 15,
    createdAt: new Date('2024-06-15'),
  },
  {
    id: 'sc-3',
    name: 'Ahmed Hassan',
    trade: 'Stukadoor',
    phone: '+31698765432',
    email: 'ahmed.hassan@gmail.com',
    status: 'active',
    hourlyRate: 45,
    credentials: [],
    rating: 3.8,
    completedJobs: 8,
    createdAt: new Date('2025-01-10'),
  },
];

const mockAssignments: SubcontractorAssignment[] = [
  {
    id: 'sa-1',
    subcontractorId: 'sc-1',
    subcontractorName: 'Jan de Vries',
    jobId: 'j-2',
    jobTitle: 'Warmtepomp installatie — Bakkerij Jansen',
    status: 'in-progress',
    startDate: new Date(now.getTime() - 3 * MS_PER_DAY),
    agreedRate: 65,
    rateType: 'hourly',
    hoursLogged: 16,
    totalCost: 1040,
  },
  {
    id: 'sa-2',
    subcontractorId: 'sc-2',
    subcontractorName: 'Pieter Bakker',
    jobId: 'j-1',
    jobTitle: 'CV-ketel onderhoud — Fam. de Groot',
    status: 'completed',
    startDate: new Date(now.getTime() - 10 * MS_PER_DAY),
    endDate: new Date(now.getTime() - 7 * MS_PER_DAY),
    agreedRate: 450,
    rateType: 'fixed',
    hoursLogged: 8,
    totalCost: 450,
  },
];

// =============================================================================
// SERVICE
// =============================================================================

type SCListener = () => void;

class SubcontractorService {
  private static instance: SubcontractorService;
  private listeners: Set<SCListener> = new Set();
  private subs: Subcontractor[] = [...mockSubcontractors];
  private assignments: SubcontractorAssignment[] = [...mockAssignments];

  static getInstance(): SubcontractorService {
    if (!SubcontractorService.instance) {
      SubcontractorService.instance = new SubcontractorService();
      registerSingletonReset(() => {
        const inst = SubcontractorService.instance;
        inst.subs = [...mockSubcontractors];
        inst.assignments = [...mockAssignments];
        inst.listeners.forEach((l) => l());
      });
    }
    return SubcontractorService.instance;
  }

  subscribe(listener: SCListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getSubcontractors(): Subcontractor[] { return this.subs; }

  getAssignments(subcontractorId?: string): SubcontractorAssignment[] {
    if (subcontractorId) return this.assignments.filter(a => a.subcontractorId === subcontractorId);
    return this.assignments;
  }

  assignToJob(subcontractorId: string, jobId: string, jobTitle: string, rate: number, rateType: 'hourly' | 'fixed'): SubcontractorAssignment {
    const sub = this.subs.find(s => s.id === subcontractorId);
    const assignment: SubcontractorAssignment = {
      id: `sa-${Date.now()}`,
      subcontractorId,
      subcontractorName: sub?.name ?? '',
      jobId,
      jobTitle,
      status: 'assigned',
      startDate: new Date(),
      agreedRate: rate,
      rateType,
      hoursLogged: 0,
      totalCost: 0,
    };
    this.assignments.unshift(assignment);
    this.notify();
    return assignment;
  }

  updateAssignmentStatus(id: string, status: AssignmentStatus): void {
    const a = this.assignments.find(x => x.id === id);
    if (a) {
      a.status = status;
      if (status === 'completed') a.endDate = new Date();
      this.notify();
    }
  }

  getStats(): SubcontractorStats {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonths = new Date(now.getTime() + 90 * MS_PER_DAY);
    const expiringCreds = this.subs.reduce((count, s) =>
      count + s.credentials.filter(c => c.expiryDate <= threeMonths).length, 0);

    return {
      totalSubcontractors: this.subs.length,
      activeAssignments: this.assignments.filter(a => ['assigned', 'in-progress'].includes(a.status)).length,
      totalSpentThisMonth: this.assignments
        .filter(a => a.status === 'completed' && a.endDate && a.endDate >= monthStart)
        .reduce((sum, a) => sum + a.totalCost, 0),
      expiringCredentials: expiringCreds,
    };
  }
}

export const subcontractorService = SubcontractorService.getInstance();

// =============================================================================
// HOOKS
// =============================================================================

export function useSubcontractors() {
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSubs(subcontractorService.getSubcontractors());
    setLoading(false);
    return subcontractorService.subscribe(() => setSubs(subcontractorService.getSubcontractors()));
  }, []);

  const assign = useCallback(
    (subId: string, jobId: string, jobTitle: string, rate: number, rateType: 'hourly' | 'fixed') =>
      subcontractorService.assignToJob(subId, jobId, jobTitle, rate, rateType),
    [],
  );

  return { subcontractors: subs, loading, assign };
}

export function useSubcontractorAssignments(subcontractorId?: string) {
  const [assignments, setAssignments] = useState<SubcontractorAssignment[]>([]);

  useEffect(() => {
    setAssignments(subcontractorService.getAssignments(subcontractorId));
    return subcontractorService.subscribe(() => setAssignments(subcontractorService.getAssignments(subcontractorId)));
  }, [subcontractorId]);

  const updateStatus = useCallback(
    (id: string, status: AssignmentStatus) => subcontractorService.updateAssignmentStatus(id, status),
    [],
  );

  return { assignments, updateStatus };
}

export function useSubcontractorStats() {
  const [stats, setStats] = useState<SubcontractorStats>(subcontractorService.getStats());
  useEffect(() => subcontractorService.subscribe(() => setStats(subcontractorService.getStats())), []);
  return stats;
}
