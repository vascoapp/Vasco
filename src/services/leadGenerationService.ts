// =============================================================================
// LEAD GENERATION SERVICE
// =============================================================================
// Lead capture, qualification, and conversion tracking
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { DEMO_MODE } from '../config/demo';
import { registerSingletonReset } from './singletonReset';

// =============================================================================
// TYPES
// =============================================================================

export interface Lead {
  id: string;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  priority: 'low' | 'medium' | 'high' | 'hot';
  customerInfo: {
    name: string;
    email?: string;
    phone: string;
    address?: string;
    city?: string;
  };
  requestType: string;
  description: string;
  estimatedValue?: number;
  assignedTo?: string;
  assignedToName?: string;
  tags: string[];
  activities: LeadActivity[];
  createdAt: Date;
  updatedAt: Date;
  convertedAt?: Date;
  lostReason?: string;
}

export type LeadSource = 'website' | 'phone' | 'referral' | 'google_ads' | 'social_media' | 'partner' | 'walk_in' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'negotiating' | 'won' | 'lost';

export interface LeadActivity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'quote' | 'note' | 'status_change';
  description: string;
  performedBy: string;
  performedAt: Date;
  outcome?: string;
  nextAction?: string;
  nextActionDate?: Date;
}

export interface LeadScoreFactors {
  budgetFit: number;
  timeline: number;
  engagement: number;
  projectSize: number;
  location: number;
}

export interface LeadFunnel {
  stage: LeadStatus;
  count: number;
  value: number;
  conversionRate: number;
}

export interface SourcePerformance {
  source: LeadSource;
  leads: number;
  conversions: number;
  conversionRate: number;
  totalValue: number;
  costPerLead?: number;
  roi?: number;
}

export interface LeadStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  conversionRate: number;
  avgLeadScore: number;
  pipelineValue: number;
  leadsThisMonth: number;
  conversionsThisMonth: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const DEMO_mockLeads: Lead[] = [
  {
    id: 'lead-1',
    source: 'website',
    status: 'new',
    score: 85,
    priority: 'hot',
    customerInfo: { name: 'Familie van Dijk', phone: '06-12345678', email: 'vandijk@email.nl', address: 'Kerkstraat 23', city: 'Amsterdam' },
    requestType: 'CV-ketel vervanging',
    description: 'Huidige ketel is 15 jaar oud, wil graag offerte voor nieuwe energiezuinige ketel.',
    estimatedValue: 2800,
    tags: ['urgent', 'nieuwbouw-potentieel'],
    activities: [
      { id: 'act-1', type: 'note', description: 'Lead binnengekomen via contactformulier', performedBy: 'System', performedAt: new Date() },
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    updatedAt: new Date(),
  },
  {
    id: 'lead-2',
    source: 'referral',
    status: 'contacted',
    score: 72,
    priority: 'high',
    customerInfo: { name: 'Bakkerij Het Broodje', phone: '020-1234567', email: 'info@hetbroodje.nl', city: 'Utrecht' },
    requestType: 'Airconditioning installatie',
    description: 'Zakelijke klant, nieuwe winkel, zoekt complete klimaatoplossing.',
    estimatedValue: 8500,
    assignedTo: 'tm-1',
    assignedToName: 'Jan de Vries',
    tags: ['zakelijk', 'groot-project'],
    activities: [
      { id: 'act-2', type: 'call', description: 'Eerste telefoongesprek gehad', performedBy: 'Jan de Vries', performedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), outcome: 'Positief, afspraak gemaakt', nextAction: 'Locatiebezoek', nextActionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    ],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'lead-3',
    source: 'google_ads',
    status: 'qualified',
    score: 68,
    priority: 'medium',
    customerInfo: { name: 'Peter Jansen', phone: '06-98765432', city: 'Rotterdam' },
    requestType: 'Warmtepomp',
    description: 'Interesse in hybride warmtepomp, woning uit 1985.',
    estimatedValue: 6500,
    assignedTo: 'tm-1',
    assignedToName: 'Jan de Vries',
    tags: ['duurzaam', 'subsidie-mogelijk'],
    activities: [
      { id: 'act-3', type: 'meeting', description: 'Huisbezoek voor inspectie', performedBy: 'Jan de Vries', performedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), outcome: 'Woning geschikt, offerte maken' },
    ],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'lead-4',
    source: 'phone',
    status: 'proposal_sent',
    score: 78,
    priority: 'high',
    customerInfo: { name: 'Linda de Boer', phone: '06-55544433', email: 'linda@deboer.nl', city: 'Den Haag' },
    requestType: 'Vloerverwarming',
    description: 'Nieuwbouwwoning, complete vloerverwarming begane grond en eerste verdieping.',
    estimatedValue: 4200,
    assignedTo: 'tm-2',
    assignedToName: 'Pieter Bakker',
    tags: ['nieuwbouw'],
    activities: [
      { id: 'act-4', type: 'quote', description: 'Offerte verstuurd', performedBy: 'Pieter Bakker', performedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), nextAction: 'Follow-up bellen', nextActionDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
    ],
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'lead-5',
    source: 'website',
    status: 'won',
    score: 90,
    priority: 'high',
    customerInfo: { name: 'Restaurant De Gouden Lepel', phone: '030-9876543', city: 'Utrecht' },
    requestType: 'Keukenventilatie',
    description: 'Complete ventilatie-installatie voor nieuwe keuken.',
    estimatedValue: 12000,
    assignedTo: 'tm-1',
    assignedToName: 'Jan de Vries',
    tags: ['zakelijk', 'groot-project'],
    activities: [],
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    convertedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockLeads: Lead[] = DEMO_MODE ? DEMO_mockLeads : [];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type LeadListener = () => void;

class LeadGenerationService {
  private static instance: LeadGenerationService;
  private listeners: Set<LeadListener> = new Set();
  private leads: Lead[] = [...mockLeads];

  static getInstance(): LeadGenerationService {
    if (!LeadGenerationService.instance) {
      LeadGenerationService.instance = new LeadGenerationService();
      registerSingletonReset(() => {
        const inst = LeadGenerationService.instance;
        inst.leads = [...mockLeads];
        inst.listeners.forEach((l) => l());
      });
    }
    return LeadGenerationService.instance;
  }

  subscribe(listener: LeadListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  getLeads(status?: LeadStatus): Lead[] {
    if (status) return this.leads.filter(l => l.status === status);
    return this.leads;
  }

  getLead(id: string): Lead | undefined {
    return this.leads.find(l => l.id === id);
  }

  createLead(lead: Omit<Lead, 'id' | 'score' | 'priority' | 'activities' | 'createdAt' | 'updatedAt'>): Lead {
    const score = this.calculateScore(lead);
    const newLead: Lead = {
      ...lead,
      id: `lead-${Date.now()}`,
      score,
      priority: this.scoreToPriority(score),
      activities: [{ id: `act-${Date.now()}`, type: 'note', description: 'Lead aangemaakt', performedBy: 'System', performedAt: new Date() }],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.leads.unshift(newLead);
    trackUserAction('lead_created', { source: lead.source, requestType: lead.requestType });
    this.notify();
    return newLead;
  }

  updateLeadStatus(id: string, status: LeadStatus, reason?: string): void {
    const lead = this.leads.find(l => l.id === id);
    if (lead) {
      const oldStatus = lead.status;
      lead.status = status;
      lead.updatedAt = new Date();
      if (status === 'won') lead.convertedAt = new Date();
      if (status === 'lost') lead.lostReason = reason;
      lead.activities.push({ id: `act-${Date.now()}`, type: 'status_change', description: `Status: ${oldStatus} → ${status}`, performedBy: 'User', performedAt: new Date() });
      trackUserAction('lead_status_changed', { leadId: id, oldStatus, newStatus: status });
      this.notify();
    }
  }

  addActivity(leadId: string, activity: Omit<LeadActivity, 'id' | 'performedAt'>): void {
    const lead = this.leads.find(l => l.id === leadId);
    if (lead) {
      lead.activities.push({ ...activity, id: `act-${Date.now()}`, performedAt: new Date() });
      lead.updatedAt = new Date();
      trackUserAction('lead_activity_added', { leadId, activityType: activity.type });
      this.notify();
    }
  }

  assignLead(leadId: string, assignedTo: string, assignedToName: string): void {
    const lead = this.leads.find(l => l.id === leadId);
    if (lead) {
      lead.assignedTo = assignedTo;
      lead.assignedToName = assignedToName;
      lead.updatedAt = new Date();
      this.notify();
    }
  }

  private calculateScore(lead: Partial<Lead>): number {
    let score = 50;
    if (lead.estimatedValue && lead.estimatedValue > 5000) score += 20;
    else if (lead.estimatedValue && lead.estimatedValue > 2000) score += 10;
    if (lead.source === 'referral') score += 15;
    if (lead.source === 'website') score += 10;
    if (lead.customerInfo?.email) score += 5;
    if (lead.customerInfo?.address) score += 5;
    return Math.min(100, score);
  }

  private scoreToPriority(score: number): Lead['priority'] {
    if (score >= 80) return 'hot';
    if (score >= 65) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  getFunnel(): LeadFunnel[] {
    const stages: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating', 'won'];
    return stages.map(stage => {
      const stageLeads = this.leads.filter(l => l.status === stage);
      const prevStage = stages[stages.indexOf(stage) - 1];
      const prevCount = prevStage ? this.leads.filter(l => l.status === prevStage).length : this.leads.length;
      return {
        stage,
        count: stageLeads.length,
        value: stageLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
        conversionRate: prevCount > 0 ? Math.round((stageLeads.length / prevCount) * 100) : 100,
      };
    });
  }

  getSourcePerformance(): SourcePerformance[] {
    const sources: LeadSource[] = ['website', 'phone', 'referral', 'google_ads', 'social_media', 'partner'];
    return sources.map(source => {
      const sourceLeads = this.leads.filter(l => l.source === source);
      const won = sourceLeads.filter(l => l.status === 'won');
      return {
        source,
        leads: sourceLeads.length,
        conversions: won.length,
        conversionRate: sourceLeads.length > 0 ? Math.round((won.length / sourceLeads.length) * 100) : 0,
        totalValue: won.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
      };
    }).filter(s => s.leads > 0);
  }

  getStats(): LeadStats {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthLeads = this.leads.filter(l => l.createdAt >= monthStart);
    const monthWon = this.leads.filter(l => l.convertedAt && l.convertedAt >= monthStart);
    const activeLeads = this.leads.filter(l => !['won', 'lost'].includes(l.status));

    return {
      totalLeads: this.leads.length,
      newLeads: this.leads.filter(l => l.status === 'new').length,
      qualifiedLeads: this.leads.filter(l => l.status === 'qualified').length,
      hotLeads: this.leads.filter(l => l.priority === 'hot' && !['won', 'lost'].includes(l.status)).length,
      conversionRate: Math.round((this.leads.filter(l => l.status === 'won').length / this.leads.length) * 100),
      avgLeadScore: Math.round(activeLeads.reduce((sum, l) => sum + l.score, 0) / activeLeads.length),
      pipelineValue: activeLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
      leadsThisMonth: monthLeads.length,
      conversionsThisMonth: monthWon.length,
    };
  }
}

export const leadGenerationService = LeadGenerationService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useLeads(status?: LeadStatus) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLeads(leadGenerationService.getLeads(status));
    setLoading(false);
    return leadGenerationService.subscribe(() => setLeads(leadGenerationService.getLeads(status)));
  }, [status]);

  const createLead = useCallback((lead: Omit<Lead, 'id' | 'score' | 'priority' | 'activities' | 'createdAt' | 'updatedAt'>) => leadGenerationService.createLead(lead), []);
  const updateStatus = useCallback((id: string, status: LeadStatus, reason?: string) => leadGenerationService.updateLeadStatus(id, status, reason), []);
  const addActivity = useCallback((id: string, activity: Omit<LeadActivity, 'id' | 'performedAt'>) => leadGenerationService.addActivity(id, activity), []);
  const assignLead = useCallback((id: string, to: string, name: string) => leadGenerationService.assignLead(id, to, name), []);

  return { leads, loading, createLead, updateStatus, addActivity, assignLead };
}

export function useLeadFunnel() {
  const [funnel, setFunnel] = useState<LeadFunnel[]>([]);
  useEffect(() => {
    setFunnel(leadGenerationService.getFunnel());
    return leadGenerationService.subscribe(() => setFunnel(leadGenerationService.getFunnel()));
  }, []);
  return funnel;
}

export function useSourcePerformance() {
  const [performance, setPerformance] = useState<SourcePerformance[]>([]);
  useEffect(() => {
    setPerformance(leadGenerationService.getSourcePerformance());
    return leadGenerationService.subscribe(() => setPerformance(leadGenerationService.getSourcePerformance()));
  }, []);
  return performance;
}

export function useLeadStats() {
  const [stats, setStats] = useState<LeadStats>(leadGenerationService.getStats());
  useEffect(() => {
    return leadGenerationService.subscribe(() => setStats(leadGenerationService.getStats()));
  }, []);
  return stats;
}
