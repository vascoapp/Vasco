// =============================================================================
// SERVICE CONTRACTS SERVICE
// =============================================================================
// Recurring maintenance contracts and subscription management
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { DEMO_MODE } from '../config/demo';
import { registerSingletonReset } from './singletonReset';

// =============================================================================
// TYPES
// =============================================================================

export interface ServiceContract {
  id: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  customerAddress: string;
  type: ContractType;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  startDate: Date;
  endDate: Date;
  renewalDate: Date;
  autoRenew: boolean;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  price: number;
  services: ContractService[];
  equipment: ContractEquipment[];
  visits: ScheduledVisit[];
  slaLevel: 'basic' | 'standard' | 'premium';
  responseTime: number; // hours
  notes?: string;
  createdAt: Date;
}

export type ContractType =
  | 'cv_maintenance'
  | 'airco_maintenance'
  | 'heat_pump_maintenance'
  | 'full_service'
  | 'custom';

export interface ContractService {
  id: string;
  name: string;
  description: string;
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'yearly';
  included: boolean;
  additionalCost?: number;
}

export interface ContractEquipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  serialNumber?: string;
  installDate?: Date;
  warrantyExpiry?: Date;
  location: string;
}

export interface ScheduledVisit {
  id: string;
  contractId: string;
  scheduledDate: Date;
  timeSlot: string;
  type: 'maintenance' | 'inspection' | 'repair';
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  assignedTo?: string;
  assignedToName?: string;
  completedDate?: Date;
  notes?: string;
  serviceReport?: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  type: ContractType;
  description: string;
  slaLevel: 'basic' | 'standard' | 'premium';
  basePrice: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  services: ContractService[];
  responseTime: number;
  popularityRank: number;
}

export interface ContractRenewal {
  id: string;
  contractId: string;
  contractNumber: string;
  customerName: string;
  currentEndDate: Date;
  renewalDate: Date;
  daysUntilRenewal: number;
  currentPrice: number;
  suggestedPrice: number;
  priceChange: number;
  status: 'pending' | 'sent' | 'accepted' | 'declined' | 'negotiating';
  notes?: string;
}

export interface ContractRevenue {
  period: string;
  recurring: number;
  oneTime: number;
  total: number;
}

export interface ContractStats {
  totalContracts: number;
  activeContracts: number;
  pendingRenewals: number;
  expiringThisMonth: number;
  monthlyRecurringRevenue: number;
  yearlyContractValue: number;
  averageContractValue: number;
  renewalRate: number;
  upcomingVisits: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const DEMO_mockContracts: ServiceContract[] = [
  {
    id: 'sc-1',
    contractNumber: 'SC-2024-001',
    customerId: 'cust-1',
    customerName: 'Familie de Groot',
    customerAddress: 'Hoofdstraat 45, Amsterdam',
    type: 'cv_maintenance',
    status: 'active',
    startDate: new Date('2023-01-15'),
    endDate: new Date('2025-01-15'),
    renewalDate: new Date('2024-12-15'),
    autoRenew: true,
    billingCycle: 'yearly',
    price: 189,
    services: [
      { id: 'srv-1', name: 'Jaarlijks CV-onderhoud', description: 'Complete ketelreiniging en inspectie', frequency: 'yearly', included: true },
      { id: 'srv-2', name: 'Storing service', description: '24/7 storingsdienst', frequency: 'yearly', included: true },
      { id: 'srv-3', name: 'Onderdelen korting', description: '15% korting op onderdelen', frequency: 'yearly', included: true },
    ],
    equipment: [
      { id: 'eq-1', name: 'CV-ketel', brand: 'Nefit', model: 'Trendline', serialNumber: 'NF-2021-12345', installDate: new Date('2021-03-10'), location: 'Bijkeuken' },
    ],
    visits: [
      { id: 'v-1', contractId: 'sc-1', scheduledDate: new Date('2024-03-15'), timeSlot: '09:00-12:00', type: 'maintenance', status: 'scheduled' },
    ],
    slaLevel: 'standard',
    responseTime: 24,
    createdAt: new Date('2023-01-10'),
  },
  {
    id: 'sc-2',
    contractNumber: 'SC-2024-002',
    customerId: 'cust-2',
    customerName: 'Bakkerij Jansen',
    customerAddress: 'Winkelstraat 12, Utrecht',
    type: 'full_service',
    status: 'active',
    startDate: new Date('2023-06-01'),
    endDate: new Date('2024-06-01'),
    renewalDate: new Date('2024-05-01'),
    autoRenew: true,
    billingCycle: 'monthly',
    price: 125,
    services: [
      { id: 'srv-4', name: 'CV-onderhoud', description: 'Halfjaarlijks onderhoud', frequency: 'biannual', included: true },
      { id: 'srv-5', name: 'Airco onderhoud', description: 'Halfjaarlijks onderhoud', frequency: 'biannual', included: true },
      { id: 'srv-6', name: 'Priority service', description: '4 uur responstijd', frequency: 'yearly', included: true },
      { id: 'srv-7', name: 'Noodservice 24/7', description: 'Inclusief avond/weekend', frequency: 'yearly', included: true },
    ],
    equipment: [
      { id: 'eq-2', name: 'CV-ketel', brand: 'Remeha', model: 'Calenta', location: 'Technische ruimte' },
      { id: 'eq-3', name: 'Airconditioning', brand: 'Daikin', model: 'FTXM35', location: 'Winkel' },
      { id: 'eq-4', name: 'Airconditioning', brand: 'Daikin', model: 'FTXM25', location: 'Kantoor' },
    ],
    visits: [
      { id: 'v-2', contractId: 'sc-2', scheduledDate: new Date('2024-02-20'), timeSlot: '07:00-08:00', type: 'maintenance', status: 'scheduled' },
    ],
    slaLevel: 'premium',
    responseTime: 4,
    createdAt: new Date('2023-05-25'),
  },
  {
    id: 'sc-3',
    contractNumber: 'SC-2024-003',
    customerId: 'cust-3',
    customerName: 'Familie Visser',
    customerAddress: 'Parkweg 78, Rotterdam',
    type: 'heat_pump_maintenance',
    status: 'active',
    startDate: new Date('2023-09-01'),
    endDate: new Date('2024-09-01'),
    renewalDate: new Date('2024-08-01'),
    autoRenew: false,
    billingCycle: 'yearly',
    price: 249,
    services: [
      { id: 'srv-8', name: 'Warmtepomp onderhoud', description: 'Jaarlijkse inspectie en onderhoud', frequency: 'yearly', included: true },
      { id: 'srv-9', name: 'F-gassen controle', description: 'Verplichte koelmiddel controle', frequency: 'yearly', included: true },
      { id: 'srv-10', name: 'Prestatie optimalisatie', description: 'Instellingen optimaliseren', frequency: 'yearly', included: true },
    ],
    equipment: [
      { id: 'eq-5', name: 'Warmtepomp', brand: 'Vaillant', model: 'aroTHERM', serialNumber: 'VL-2022-98765', installDate: new Date('2022-10-15'), warrantyExpiry: new Date('2027-10-15'), location: 'Tuin' },
    ],
    visits: [],
    slaLevel: 'standard',
    responseTime: 24,
    createdAt: new Date('2023-08-20'),
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockContracts: ServiceContract[] = DEMO_MODE ? DEMO_mockContracts : [];

const DEMO_mockTemplates: ContractTemplate[] = [
  {
    id: 'tpl-1',
    name: 'CV Basis',
    type: 'cv_maintenance',
    description: 'Jaarlijks onderhoud voor CV-ketels',
    slaLevel: 'basic',
    basePrice: 149,
    billingCycle: 'yearly',
    services: [
      { id: 's-1', name: 'Jaarlijks onderhoud', description: 'Ketelreiniging en inspectie', frequency: 'yearly', included: true },
    ],
    responseTime: 48,
    popularityRank: 3,
  },
  {
    id: 'tpl-2',
    name: 'CV Comfort',
    type: 'cv_maintenance',
    description: 'Uitgebreid pakket met voorrang bij storingen',
    slaLevel: 'standard',
    basePrice: 189,
    billingCycle: 'yearly',
    services: [
      { id: 's-2', name: 'Jaarlijks onderhoud', description: 'Ketelreiniging en inspectie', frequency: 'yearly', included: true },
      { id: 's-3', name: 'Storing service', description: 'Voorrang bij storingen', frequency: 'yearly', included: true },
      { id: 's-4', name: 'Onderdelen korting', description: '15% korting', frequency: 'yearly', included: true },
    ],
    responseTime: 24,
    popularityRank: 1,
  },
  {
    id: 'tpl-3',
    name: 'Warmtepomp Service',
    type: 'heat_pump_maintenance',
    description: 'Compleet onderhoudspakket voor warmtepompen',
    slaLevel: 'standard',
    basePrice: 249,
    billingCycle: 'yearly',
    services: [
      { id: 's-5', name: 'Warmtepomp onderhoud', description: 'Jaarlijkse inspectie', frequency: 'yearly', included: true },
      { id: 's-6', name: 'F-gassen controle', description: 'Koelmiddel controle', frequency: 'yearly', included: true },
      { id: 's-7', name: 'Prestatie check', description: 'Efficiëntie optimalisatie', frequency: 'yearly', included: true },
    ],
    responseTime: 24,
    popularityRank: 2,
  },
  {
    id: 'tpl-4',
    name: 'Zakelijk Premium',
    type: 'full_service',
    description: 'Alles-in-één voor zakelijke klanten',
    slaLevel: 'premium',
    basePrice: 125,
    billingCycle: 'monthly',
    services: [
      { id: 's-8', name: 'CV onderhoud', description: 'Halfjaarlijks', frequency: 'biannual', included: true },
      { id: 's-9', name: 'Airco onderhoud', description: 'Halfjaarlijks', frequency: 'biannual', included: true },
      { id: 's-10', name: '24/7 noodservice', description: 'Altijd bereikbaar', frequency: 'yearly', included: true },
      { id: 's-11', name: '4 uur respons', description: 'Gegarandeerde responstijd', frequency: 'yearly', included: true },
    ],
    responseTime: 4,
    popularityRank: 4,
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockTemplates: ContractTemplate[] = DEMO_MODE ? DEMO_mockTemplates : [];

const DEMO_mockRenewals: ContractRenewal[] = [
  {
    id: 'rn-1',
    contractId: 'sc-2',
    contractNumber: 'SC-2024-002',
    customerName: 'Bakkerij Jansen',
    currentEndDate: new Date('2024-06-01'),
    renewalDate: new Date('2024-05-01'),
    daysUntilRenewal: 90,
    currentPrice: 125,
    suggestedPrice: 135,
    priceChange: 8,
    status: 'pending',
  },
  {
    id: 'rn-2',
    contractId: 'sc-3',
    contractNumber: 'SC-2024-003',
    customerName: 'Familie Visser',
    currentEndDate: new Date('2024-09-01'),
    renewalDate: new Date('2024-08-01'),
    daysUntilRenewal: 180,
    currentPrice: 249,
    suggestedPrice: 259,
    priceChange: 4,
    status: 'pending',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockRenewals: ContractRenewal[] = DEMO_MODE ? DEMO_mockRenewals : [];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type ContractListener = () => void;

class ServiceContractsService {
  private static instance: ServiceContractsService;
  private listeners: Set<ContractListener> = new Set();
  private contracts: ServiceContract[] = [...mockContracts];
  private templates: ContractTemplate[] = [...mockTemplates];
  private renewals: ContractRenewal[] = [...mockRenewals];

  static getInstance(): ServiceContractsService {
    if (!ServiceContractsService.instance) {
      ServiceContractsService.instance = new ServiceContractsService();
      registerSingletonReset(() => {
        const inst = ServiceContractsService.instance;
        inst.contracts = [...mockContracts];
        inst.templates = [...mockTemplates];
        inst.renewals = [...mockRenewals];
        inst.listeners.forEach((l) => l());
      });
    }
    return ServiceContractsService.instance;
  }

  subscribe(listener: ContractListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Contracts
  getContracts(status?: ServiceContract['status']): ServiceContract[] {
    if (status) {
      return this.contracts.filter(c => c.status === status);
    }
    return this.contracts;
  }

  getContract(id: string): ServiceContract | undefined {
    return this.contracts.find(c => c.id === id);
  }

  getContractsByCustomer(customerId: string): ServiceContract[] {
    return this.contracts.filter(c => c.customerId === customerId);
  }

  createContract(contract: Omit<ServiceContract, 'id' | 'contractNumber' | 'createdAt'>): ServiceContract {
    const newContract: ServiceContract = {
      ...contract,
      id: `sc-${Date.now()}`,
      contractNumber: `SC-${new Date().getFullYear()}-${String(this.contracts.length + 1).padStart(3, '0')}`,
      createdAt: new Date(),
    };
    this.contracts.push(newContract);

    trackUserAction('contract_created', {
      type: contract.type,
      slaLevel: contract.slaLevel,
      price: contract.price,
      billingCycle: contract.billingCycle,
    });

    this.notify();
    return newContract;
  }

  updateContract(id: string, updates: Partial<ServiceContract>): ServiceContract | undefined {
    const index = this.contracts.findIndex(c => c.id === id);
    if (index >= 0) {
      this.contracts[index] = { ...this.contracts[index], ...updates };
      this.notify();
      return this.contracts[index];
    }
    return undefined;
  }

  cancelContract(id: string, reason?: string): void {
    const contract = this.contracts.find(c => c.id === id);
    if (contract) {
      contract.status = 'cancelled';
      contract.notes = reason;

      trackUserAction('contract_cancelled', {
        contractId: id,
        reason,
      });

      this.notify();
    }
  }

  // Visits
  getUpcomingVisits(days: number = 30): ScheduledVisit[] {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return this.contracts.flatMap(c =>
      c.visits.filter(v =>
        v.status === 'scheduled' &&
        v.scheduledDate >= now &&
        v.scheduledDate <= future
      )
    ).sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime());
  }

  scheduleVisit(contractId: string, visit: Omit<ScheduledVisit, 'id' | 'contractId'>): ScheduledVisit {
    const contract = this.contracts.find(c => c.id === contractId);
    if (!contract) throw new Error('Contract not found');

    const newVisit: ScheduledVisit = {
      ...visit,
      id: `v-${Date.now()}`,
      contractId,
    };
    contract.visits.push(newVisit);

    trackUserAction('contract_visit_scheduled', {
      contractId,
      visitType: visit.type,
      scheduledDate: visit.scheduledDate,
    });

    this.notify();
    return newVisit;
  }

  completeVisit(contractId: string, visitId: string, serviceReport?: string): void {
    const contract = this.contracts.find(c => c.id === contractId);
    if (contract) {
      const visit = contract.visits.find(v => v.id === visitId);
      if (visit) {
        visit.status = 'completed';
        visit.completedDate = new Date();
        visit.serviceReport = serviceReport;

        trackUserAction('contract_visit_completed', {
          contractId,
          visitId,
        });

        this.notify();
      }
    }
  }

  // Templates
  getTemplates(): ContractTemplate[] {
    return this.templates.sort((a, b) => a.popularityRank - b.popularityRank);
  }

  getTemplate(id: string): ContractTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  // Renewals
  getRenewals(status?: ContractRenewal['status']): ContractRenewal[] {
    if (status) {
      return this.renewals.filter(r => r.status === status);
    }
    return this.renewals;
  }

  sendRenewalOffer(renewalId: string): void {
    const renewal = this.renewals.find(r => r.id === renewalId);
    if (renewal) {
      renewal.status = 'sent';

      trackUserAction('contract_renewal_sent', {
        renewalId,
        contractId: renewal.contractId,
        suggestedPrice: renewal.suggestedPrice,
      });

      this.notify();
    }
  }

  acceptRenewal(renewalId: string): void {
    const renewal = this.renewals.find(r => r.id === renewalId);
    if (renewal) {
      renewal.status = 'accepted';

      // Extend the contract
      const contract = this.contracts.find(c => c.id === renewal.contractId);
      if (contract) {
        const newEndDate = new Date(contract.endDate);
        newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        contract.endDate = newEndDate;
        contract.renewalDate = new Date(newEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        contract.price = renewal.suggestedPrice;
      }

      trackUserAction('contract_renewal_accepted', {
        renewalId,
        newPrice: renewal.suggestedPrice,
      });

      this.notify();
    }
  }

  // Revenue
  getRevenueProjection(months: number = 12): ContractRevenue[] {
    const revenues: ContractRevenue[] = [];
    const now = new Date();

    for (let i = 0; i < months; i++) {
      const month = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = month.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

      let recurring = 0;
      this.contracts.filter(c => c.status === 'active').forEach(contract => {
        if (contract.billingCycle === 'monthly') {
          recurring += contract.price;
        } else if (contract.billingCycle === 'quarterly' && month.getMonth() % 3 === 0) {
          recurring += contract.price;
        } else if (contract.billingCycle === 'yearly') {
          const contractMonth = contract.startDate.getMonth();
          if (month.getMonth() === contractMonth) {
            recurring += contract.price;
          }
        }
      });

      revenues.push({
        period: monthStr,
        recurring,
        oneTime: Math.random() * 500,
        total: recurring + Math.random() * 500,
      });
    }

    return revenues;
  }

  // Stats
  getStats(): ContractStats {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const activeContracts = this.contracts.filter(c => c.status === 'active');
    const pendingRenewals = this.renewals.filter(r => r.status === 'pending');
    const expiringThisMonth = activeContracts.filter(c => c.endDate <= monthEnd);

    let mrr = 0;
    activeContracts.forEach(c => {
      if (c.billingCycle === 'monthly') mrr += c.price;
      else if (c.billingCycle === 'quarterly') mrr += c.price / 3;
      else if (c.billingCycle === 'yearly') mrr += c.price / 12;
    });

    const ycv = mrr * 12;
    const avgValue = activeContracts.length > 0
      ? activeContracts.reduce((sum, c) => sum + c.price, 0) / activeContracts.length
      : 0;

    const upcomingVisits = this.getUpcomingVisits(30).length;

    return {
      totalContracts: this.contracts.length,
      activeContracts: activeContracts.length,
      pendingRenewals: pendingRenewals.length,
      expiringThisMonth: expiringThisMonth.length,
      monthlyRecurringRevenue: Math.round(mrr),
      yearlyContractValue: Math.round(ycv),
      averageContractValue: Math.round(avgValue),
      renewalRate: 85,
      upcomingVisits,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const serviceContractsService = ServiceContractsService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useServiceContracts(status?: ServiceContract['status']) {
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setContracts(serviceContractsService.getContracts(status));
    setLoading(false);

    return serviceContractsService.subscribe(() => {
      setContracts(serviceContractsService.getContracts(status));
    });
  }, [status]);

  const createContract = useCallback((contract: Omit<ServiceContract, 'id' | 'contractNumber' | 'createdAt'>) => {
    return serviceContractsService.createContract(contract);
  }, []);

  const cancelContract = useCallback((id: string, reason?: string) => {
    serviceContractsService.cancelContract(id, reason);
  }, []);

  return { contracts, loading, createContract, cancelContract };
}

export function useContractTemplates() {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTemplates(serviceContractsService.getTemplates());
    setLoading(false);
  }, []);

  return { templates, loading };
}

export function useContractRenewals(status?: ContractRenewal['status']) {
  const [renewals, setRenewals] = useState<ContractRenewal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRenewals(serviceContractsService.getRenewals(status));
    setLoading(false);

    return serviceContractsService.subscribe(() => {
      setRenewals(serviceContractsService.getRenewals(status));
    });
  }, [status]);

  const sendOffer = useCallback((renewalId: string) => {
    serviceContractsService.sendRenewalOffer(renewalId);
  }, []);

  const acceptRenewal = useCallback((renewalId: string) => {
    serviceContractsService.acceptRenewal(renewalId);
  }, []);

  return { renewals, loading, sendOffer, acceptRenewal };
}

export function useUpcomingVisits(days: number = 30) {
  const [visits, setVisits] = useState<ScheduledVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setVisits(serviceContractsService.getUpcomingVisits(days));
    setLoading(false);

    return serviceContractsService.subscribe(() => {
      setVisits(serviceContractsService.getUpcomingVisits(days));
    });
  }, [days]);

  return { visits, loading };
}

export function useContractRevenue(months: number = 12) {
  const [revenue, setRevenue] = useState<ContractRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRevenue(serviceContractsService.getRevenueProjection(months));
    setLoading(false);
  }, [months]);

  return { revenue, loading };
}

export function useContractStats() {
  const [stats, setStats] = useState<ContractStats>(serviceContractsService.getStats());

  useEffect(() => {
    return serviceContractsService.subscribe(() => {
      setStats(serviceContractsService.getStats());
    });
  }, []);

  return stats;
}
