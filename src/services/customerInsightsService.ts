// =============================================================================
// CUSTOMER INSIGHTS SERVICE
// =============================================================================
// Deep customer analytics and relationship intelligence
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface CustomerProfile {
  id: string;
  name: string;
  type: 'residential' | 'commercial';
  email?: string;
  phone: string;
  address: string;
  city: string;
  customerSince: Date;
  lifetimeValue: number;
  totalJobs: number;
  avgJobValue: number;
  lastContact: Date;
  lastJob: Date;
  nextScheduledJob?: Date;
  preferredContact: 'phone' | 'email' | 'whatsapp';
  preferredTimeSlot?: string;
  paymentBehavior: 'excellent' | 'good' | 'average' | 'poor';
  churnRisk: 'low' | 'medium' | 'high';
  satisfaction: number;
  tags: string[];
  notes: string[];
  equipment: CustomerEquipment[];
  interactions: CustomerInteraction[];
}

export interface CustomerEquipment {
  id: string;
  type: string;
  brand: string;
  model: string;
  installDate?: Date;
  warrantyEnd?: Date;
  nextServiceDue?: Date;
}

export interface CustomerInteraction {
  id: string;
  date: Date;
  type: 'job' | 'quote' | 'call' | 'email' | 'complaint' | 'review';
  description: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  value?: number;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string;
  criteria: string[];
  customerCount: number;
  avgLifetimeValue: number;
  churnRate: number;
  recommendations: string[];
}

export interface ChurnPrediction {
  customerId: string;
  customerName: string;
  riskLevel: 'low' | 'medium' | 'high';
  probability: number;
  factors: string[];
  suggestedActions: string[];
  lastContact: Date;
  lifetimeValue: number;
}

export interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  newThisMonth: number;
  avgLifetimeValue: number;
  avgSatisfaction: number;
  churnRiskHigh: number;
  topSegment: string;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockCustomers: CustomerProfile[] = [
  {
    id: 'cust-1', name: 'Familie de Groot', type: 'residential', email: 'degroot@email.nl', phone: '06-12345678',
    address: 'Hoofdstraat 45', city: 'Amsterdam', customerSince: new Date('2019-03-15'), lifetimeValue: 4850,
    totalJobs: 12, avgJobValue: 404, lastContact: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), lastJob: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    preferredContact: 'phone', preferredTimeSlot: 'ochtend', paymentBehavior: 'excellent', churnRisk: 'low', satisfaction: 4.8,
    tags: ['loyaal', 'onderhoudscontract'], notes: ['Altijd op tijd betalen', 'Voorkeur Jan als monteur'],
    equipment: [{ id: 'eq-1', type: 'CV-ketel', brand: 'Nefit', model: 'Trendline', installDate: new Date('2021-03-10'), warrantyEnd: new Date('2026-03-10'), nextServiceDue: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }],
    interactions: [
      { id: 'int-1', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), type: 'job', description: 'Jaarlijks CV onderhoud', sentiment: 'positive', value: 189 },
      { id: 'int-2', date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), type: 'review', description: '5 sterren Google review', sentiment: 'positive' },
    ],
  },
  {
    id: 'cust-2', name: 'Bakkerij Jansen', type: 'commercial', email: 'info@bakkerijjansen.nl', phone: '020-1234567',
    address: 'Winkelstraat 12', city: 'Utrecht', customerSince: new Date('2020-06-01'), lifetimeValue: 15200,
    totalJobs: 24, avgJobValue: 633, lastContact: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), lastJob: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    preferredContact: 'email', preferredTimeSlot: 'voor opening (7:00)', paymentBehavior: 'good', churnRisk: 'low', satisfaction: 4.5,
    tags: ['zakelijk', 'premium-contract', 'airco+cv'], notes: ['Alleen service buiten openingstijden'],
    equipment: [
      { id: 'eq-2', type: 'CV-ketel', brand: 'Remeha', model: 'Calenta', nextServiceDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
      { id: 'eq-3', type: 'Airco', brand: 'Daikin', model: 'FTXM35', nextServiceDue: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) },
    ],
    interactions: [],
  },
  {
    id: 'cust-3', name: 'Familie Visser', type: 'residential', phone: '06-98765432',
    address: 'Parkweg 78', city: 'Rotterdam', customerSince: new Date('2022-10-15'), lifetimeValue: 6500,
    totalJobs: 3, avgJobValue: 2167, lastContact: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), lastJob: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
    preferredContact: 'whatsapp', paymentBehavior: 'average', churnRisk: 'medium', satisfaction: 4.0,
    tags: ['warmtepomp'], notes: [],
    equipment: [{ id: 'eq-4', type: 'Warmtepomp', brand: 'Vaillant', model: 'aroTHERM', installDate: new Date('2022-10-15'), warrantyEnd: new Date('2027-10-15') }],
    interactions: [],
  },
];

const mockSegments: CustomerSegment[] = [
  { id: 'seg-1', name: 'VIP Klanten', description: 'Hoge waarde, lange relatie', criteria: ['LTV > €5000', 'Klant > 3 jaar', 'Onderhoudscontract'], customerCount: 45, avgLifetimeValue: 8500, churnRate: 5, recommendations: ['Persoonlijke aandacht', 'Exclusieve aanbiedingen'] },
  { id: 'seg-2', name: 'Zakelijke Klanten', description: 'Commerciële panden', criteria: ['Type = commercial'], customerCount: 28, avgLifetimeValue: 12000, churnRate: 8, recommendations: ['SLA contracten aanbieden', 'Snelle responstijd'] },
  { id: 'seg-3', name: 'Nieuwe Klanten', description: 'Klant < 1 jaar', criteria: ['Klant < 1 jaar'], customerCount: 32, avgLifetimeValue: 850, churnRate: 25, recommendations: ['Welkomstkorting', 'Follow-up na eerste job'] },
];

const mockChurnPredictions: ChurnPrediction[] = [
  { customerId: 'cust-3', customerName: 'Familie Visser', riskLevel: 'medium', probability: 35, factors: ['Geen contact > 90 dagen', 'Geen onderhoudscontract'], suggestedActions: ['Bel voor check-up', 'Bied onderhoudscontract aan'], lastContact: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), lifetimeValue: 6500 },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type InsightsListener = () => void;

class CustomerInsightsService {
  private static instance: CustomerInsightsService;
  private listeners: Set<InsightsListener> = new Set();
  private customers: CustomerProfile[] = [...mockCustomers];
  private segments: CustomerSegment[] = [...mockSegments];

  static getInstance(): CustomerInsightsService {
    if (!CustomerInsightsService.instance) {
      CustomerInsightsService.instance = new CustomerInsightsService();
    }
    return CustomerInsightsService.instance;
  }

  subscribe(listener: InsightsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getCustomers(): CustomerProfile[] { return this.customers; }
  getCustomer(id: string): CustomerProfile | undefined { return this.customers.find(c => c.id === id); }
  getSegments(): CustomerSegment[] { return this.segments; }
  getChurnPredictions(): ChurnPrediction[] { return mockChurnPredictions; }

  addInteraction(customerId: string, interaction: Omit<CustomerInteraction, 'id'>): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (customer) {
      customer.interactions.unshift({ ...interaction, id: `int-${Date.now()}` });
      customer.lastContact = interaction.date;
      if (interaction.type === 'job') customer.lastJob = interaction.date;
      trackUserAction('customer_interaction_added', { customerId, type: interaction.type });
      this.notify();
    }
  }

  updateTags(customerId: string, tags: string[]): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (customer) { customer.tags = tags; this.notify(); }
  }

  getStats(): CustomerStats {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const active = this.customers.filter(c => c.lastJob > new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));

    return {
      totalCustomers: this.customers.length,
      activeCustomers: active.length,
      newThisMonth: this.customers.filter(c => c.customerSince >= monthStart).length,
      avgLifetimeValue: Math.round(this.customers.reduce((sum, c) => sum + c.lifetimeValue, 0) / this.customers.length),
      avgSatisfaction: Math.round(this.customers.reduce((sum, c) => sum + c.satisfaction, 0) / this.customers.length * 10) / 10,
      churnRiskHigh: this.customers.filter(c => c.churnRisk === 'high').length,
      topSegment: 'VIP Klanten',
    };
  }
}

export const customerInsightsService = CustomerInsightsService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useCustomerProfiles() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCustomers(customerInsightsService.getCustomers());
    setLoading(false);
    return customerInsightsService.subscribe(() => setCustomers(customerInsightsService.getCustomers()));
  }, []);

  const addInteraction = useCallback((id: string, i: Omit<CustomerInteraction, 'id'>) => customerInsightsService.addInteraction(id, i), []);
  const updateTags = useCallback((id: string, tags: string[]) => customerInsightsService.updateTags(id, tags), []);

  return { customers, loading, addInteraction, updateTags };
}

export function useCustomerSegments() {
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  useEffect(() => { setSegments(customerInsightsService.getSegments()); }, []);
  return segments;
}

export function useChurnPredictions() {
  const [predictions, setPredictions] = useState<ChurnPrediction[]>([]);
  useEffect(() => { setPredictions(customerInsightsService.getChurnPredictions()); }, []);
  return predictions;
}

export function useCustomerInsightsStats() {
  const [stats, setStats] = useState<CustomerStats>(customerInsightsService.getStats());
  useEffect(() => customerInsightsService.subscribe(() => setStats(customerInsightsService.getStats())), []);
  return stats;
}
