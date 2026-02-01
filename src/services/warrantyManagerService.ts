// =============================================================================
// WARRANTY MANAGER SERVICE
// =============================================================================
// Warranty tracking and claims management
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface Warranty {
  id: string;
  customerId: string;
  customerName: string;
  equipmentName: string;
  brand: string;
  model: string;
  serialNumber: string;
  installDate: Date;
  warrantyStart: Date;
  warrantyEnd: Date;
  warrantyType: 'manufacturer' | 'extended' | 'labor';
  status: 'active' | 'expiring_soon' | 'expired';
  coverage: string[];
  exclusions?: string[];
  documentUrl?: string;
  notes?: string;
  location: string;
}

export interface WarrantyClaim {
  id: string;
  warrantyId: string;
  customerName: string;
  equipmentName: string;
  brand: string;
  issueDescription: string;
  issueDate: Date;
  claimDate: Date;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'denied' | 'completed';
  claimNumber?: string;
  estimatedCost: number;
  approvedAmount?: number;
  resolution?: string;
  documents: string[];
  timeline: ClaimEvent[];
}

export interface ClaimEvent {
  date: Date;
  event: string;
  details?: string;
}

export interface WarrantyStats {
  totalWarranties: number;
  activeWarranties: number;
  expiringThisMonth: number;
  expiredWarranties: number;
  openClaims: number;
  claimsThisYear: number;
  totalClaimValue: number;
  approvalRate: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockWarranties: Warranty[] = [
  {
    id: 'war-1', customerId: 'cust-1', customerName: 'Familie de Groot', equipmentName: 'CV-ketel', brand: 'Nefit', model: 'Trendline HRC 30',
    serialNumber: 'NF-2021-12345', installDate: new Date('2021-03-10'), warrantyStart: new Date('2021-03-10'), warrantyEnd: new Date('2026-03-10'),
    warrantyType: 'manufacturer', status: 'active', coverage: ['Onderdelen', 'Arbeidsloon', 'Voorrijkosten'], location: 'Hoofdstraat 45, Amsterdam',
  },
  {
    id: 'war-2', customerId: 'cust-3', customerName: 'Familie Visser', equipmentName: 'Warmtepomp', brand: 'Vaillant', model: 'aroTHERM plus',
    serialNumber: 'VL-2022-98765', installDate: new Date('2022-10-15'), warrantyStart: new Date('2022-10-15'), warrantyEnd: new Date('2027-10-15'),
    warrantyType: 'manufacturer', status: 'active', coverage: ['Compressor 5 jaar', 'Overige onderdelen 2 jaar'], location: 'Parkweg 78, Rotterdam',
  },
  {
    id: 'war-3', customerId: 'cust-2', customerName: 'Bakkerij Jansen', equipmentName: 'Airconditioning', brand: 'Daikin', model: 'FTXM35',
    serialNumber: 'DK-2023-55555', installDate: new Date('2023-06-01'), warrantyStart: new Date('2023-06-01'), warrantyEnd: new Date('2024-06-01'),
    warrantyType: 'manufacturer', status: 'expiring_soon', coverage: ['Onderdelen'], exclusions: ['Arbeidsloon na 6 maanden'], location: 'Winkelstraat 12, Utrecht',
  },
];

const mockClaims: WarrantyClaim[] = [
  {
    id: 'claim-1', warrantyId: 'war-1', customerName: 'Familie de Groot', equipmentName: 'CV-ketel', brand: 'Nefit',
    issueDescription: 'Ketel geeft storing E9 - druksensor defect', issueDate: new Date('2024-01-20'), claimDate: new Date('2024-01-22'),
    status: 'approved', claimNumber: 'NF-2024-001234', estimatedCost: 185, approvedAmount: 185,
    documents: [], timeline: [
      { date: new Date('2024-01-22'), event: 'Claim ingediend' },
      { date: new Date('2024-01-24'), event: 'In behandeling', details: 'Nefit beoordeelt claim' },
      { date: new Date('2024-01-26'), event: 'Goedgekeurd', details: 'Volledige vergoeding onderdeel + arbeid' },
    ],
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type WarrantyListener = () => void;

class WarrantyManagerService {
  private static instance: WarrantyManagerService;
  private listeners: Set<WarrantyListener> = new Set();
  private warranties: Warranty[] = [...mockWarranties];
  private claims: WarrantyClaim[] = [...mockClaims];

  static getInstance(): WarrantyManagerService {
    if (!WarrantyManagerService.instance) {
      WarrantyManagerService.instance = new WarrantyManagerService();
    }
    return WarrantyManagerService.instance;
  }

  subscribe(listener: WarrantyListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getWarranties(status?: Warranty['status']): Warranty[] {
    if (status) return this.warranties.filter(w => w.status === status);
    return this.warranties;
  }

  getWarranty(id: string): Warranty | undefined { return this.warranties.find(w => w.id === id); }

  getExpiringWarranties(days: number = 90): Warranty[] {
    const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.warranties.filter(w => w.warrantyEnd <= future && w.warrantyEnd > new Date());
  }

  registerWarranty(warranty: Omit<Warranty, 'id' | 'status'>): Warranty {
    const status = this.calculateStatus(warranty.warrantyEnd);
    const newWarranty: Warranty = { ...warranty, id: `war-${Date.now()}`, status };
    this.warranties.push(newWarranty);
    trackUserAction('warranty_registered', { brand: warranty.brand, type: warranty.warrantyType });
    this.notify();
    return newWarranty;
  }

  private calculateStatus(endDate: Date): Warranty['status'] {
    const now = new Date();
    const daysLeft = (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 0) return 'expired';
    if (daysLeft < 90) return 'expiring_soon';
    return 'active';
  }

  getClaims(status?: WarrantyClaim['status']): WarrantyClaim[] {
    if (status) return this.claims.filter(c => c.status === status);
    return this.claims;
  }

  createClaim(claim: Omit<WarrantyClaim, 'id' | 'claimDate' | 'status' | 'timeline'>): WarrantyClaim {
    const newClaim: WarrantyClaim = {
      ...claim, id: `claim-${Date.now()}`, claimDate: new Date(), status: 'draft',
      timeline: [{ date: new Date(), event: 'Claim aangemaakt' }],
    };
    this.claims.push(newClaim);
    trackUserAction('warranty_claim_created', { warrantyId: claim.warrantyId, estimatedCost: claim.estimatedCost });
    this.notify();
    return newClaim;
  }

  submitClaim(claimId: string): void {
    const claim = this.claims.find(c => c.id === claimId);
    if (claim) {
      claim.status = 'submitted';
      claim.claimNumber = `CLM-${new Date().getFullYear()}-${String(this.claims.length).padStart(4, '0')}`;
      claim.timeline.push({ date: new Date(), event: 'Claim ingediend bij fabrikant' });
      this.notify();
    }
  }

  updateClaimStatus(claimId: string, status: WarrantyClaim['status'], details?: string): void {
    const claim = this.claims.find(c => c.id === claimId);
    if (claim) {
      claim.status = status;
      claim.timeline.push({ date: new Date(), event: `Status: ${status}`, details });
      this.notify();
    }
  }

  getStats(): WarrantyStats {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return {
      totalWarranties: this.warranties.length,
      activeWarranties: this.warranties.filter(w => w.status === 'active').length,
      expiringThisMonth: this.warranties.filter(w => w.warrantyEnd <= monthEnd && w.warrantyEnd > now).length,
      expiredWarranties: this.warranties.filter(w => w.status === 'expired').length,
      openClaims: this.claims.filter(c => !['completed', 'denied'].includes(c.status)).length,
      claimsThisYear: this.claims.filter(c => c.claimDate >= yearStart).length,
      totalClaimValue: this.claims.filter(c => c.status === 'approved' || c.status === 'completed').reduce((sum, c) => sum + (c.approvedAmount || 0), 0),
      approvalRate: Math.round((this.claims.filter(c => c.status === 'approved' || c.status === 'completed').length / this.claims.length) * 100),
    };
  }
}

export const warrantyManagerService = WarrantyManagerService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useWarranties(status?: Warranty['status']) {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWarranties(warrantyManagerService.getWarranties(status));
    setLoading(false);
    return warrantyManagerService.subscribe(() => setWarranties(warrantyManagerService.getWarranties(status)));
  }, [status]);

  const register = useCallback((w: Omit<Warranty, 'id' | 'status'>) => warrantyManagerService.registerWarranty(w), []);
  const getExpiring = useCallback((days?: number) => warrantyManagerService.getExpiringWarranties(days), []);

  return { warranties, loading, register, getExpiring };
}

export function useWarrantyClaims(status?: WarrantyClaim['status']) {
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setClaims(warrantyManagerService.getClaims(status));
    setLoading(false);
    return warrantyManagerService.subscribe(() => setClaims(warrantyManagerService.getClaims(status)));
  }, [status]);

  const createClaim = useCallback((c: Omit<WarrantyClaim, 'id' | 'claimDate' | 'status' | 'timeline'>) => warrantyManagerService.createClaim(c), []);
  const submitClaim = useCallback((id: string) => warrantyManagerService.submitClaim(id), []);
  const updateStatus = useCallback((id: string, status: WarrantyClaim['status'], details?: string) => warrantyManagerService.updateClaimStatus(id, status, details), []);

  return { claims, loading, createClaim, submitClaim, updateStatus };
}

export function useWarrantyStats() {
  const [stats, setStats] = useState<WarrantyStats>(warrantyManagerService.getStats());
  useEffect(() => warrantyManagerService.subscribe(() => setStats(warrantyManagerService.getStats())), []);
  return stats;
}
