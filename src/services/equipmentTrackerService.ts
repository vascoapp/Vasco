// =============================================================================
// EQUIPMENT TRACKER SERVICE
// =============================================================================
// Comprehensive equipment and asset management system
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { DEMO_MODE } from '../config/demo';
import { registerSingletonReset } from './singletonReset';

// =============================================================================
// TYPES
// =============================================================================

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: Date;
  purchasePrice: number;
  currentValue: number;
  warrantyExpiry?: Date;
  status: 'available' | 'in_use' | 'maintenance' | 'repair' | 'retired';
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  location: string;
  assignedTo?: string;
  assignedToName?: string;
  imageUrl?: string;
  specifications?: Record<string, string>;
  notes?: string;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  totalUsageHours: number;
  repairCount: number;
  totalRepairCost: number;
}

export type EquipmentCategory =
  | 'power_tools'
  | 'hand_tools'
  | 'measuring'
  | 'safety'
  | 'vehicles'
  | 'heavy_equipment'
  | 'diagnostic'
  | 'other';

export interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  type: 'routine' | 'repair' | 'calibration' | 'inspection';
  date: Date;
  description: string;
  performedBy: string;
  cost: number;
  parts?: MaintenancePart[];
  notes?: string;
  nextScheduledDate?: Date;
}

export interface MaintenancePart {
  name: string;
  partNumber?: string;
  quantity: number;
  unitCost: number;
}

export interface MaintenanceSchedule {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: 'routine' | 'calibration' | 'inspection';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  lastPerformed?: Date;
  nextDue: Date;
  description: string;
  estimatedDuration: number; // minutes
  estimatedCost: number;
  isOverdue: boolean;
}

export interface EquipmentCheckout {
  id: string;
  equipmentId: string;
  equipmentName: string;
  checkedOutBy: string;
  checkedOutByName: string;
  checkoutDate: Date;
  expectedReturn: Date;
  actualReturn?: Date;
  jobId?: string;
  jobName?: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  returnCondition?: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  notes?: string;
}

export interface EquipmentUtilization {
  equipmentId: string;
  equipmentName: string;
  category: EquipmentCategory;
  totalDaysAvailable: number;
  daysInUse: number;
  utilizationRate: number;
  revenueGenerated: number;
  costPerUse: number;
  roi: number;
}

export interface DepreciationReport {
  equipmentId: string;
  equipmentName: string;
  purchaseDate: Date;
  purchasePrice: number;
  currentValue: number;
  depreciationMethod: 'straight_line' | 'declining_balance';
  usefulLife: number; // years
  annualDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
  yearsRemaining: number;
}

export interface EquipmentAlert {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: 'maintenance_due' | 'warranty_expiry' | 'low_condition' | 'overdue_return' | 'high_repair_cost';
  severity: 'low' | 'medium' | 'high';
  message: string;
  actionRequired: string;
  createdAt: Date;
  acknowledged: boolean;
}

export interface EquipmentStats {
  totalEquipment: number;
  totalValue: number;
  availableCount: number;
  inUseCount: number;
  maintenanceCount: number;
  overdueMaintenanceCount: number;
  expiringWarranties: number;
  averageUtilization: number;
  totalRepairCostThisYear: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const DEMO_mockEquipment: Equipment[] = [
  {
    id: 'eq-1',
    name: 'Boormachine Hilti TE 30',
    category: 'power_tools',
    brand: 'Hilti',
    model: 'TE 30',
    serialNumber: 'HLT-2021-78945',
    purchaseDate: new Date('2021-03-15'),
    purchasePrice: 850,
    currentValue: 510,
    warrantyExpiry: new Date('2024-03-15'),
    status: 'available',
    condition: 'good',
    location: 'Magazijn A',
    lastMaintenanceDate: new Date('2024-01-10'),
    nextMaintenanceDate: new Date('2024-04-10'),
    totalUsageHours: 520,
    repairCount: 1,
    totalRepairCost: 85,
  },
  {
    id: 'eq-2',
    name: 'Soldeerbout Rothenberger',
    category: 'hand_tools',
    brand: 'Rothenberger',
    model: 'Industrial 200',
    serialNumber: 'RTH-2022-12345',
    purchaseDate: new Date('2022-06-20'),
    purchasePrice: 320,
    currentValue: 240,
    status: 'in_use',
    condition: 'excellent',
    location: 'Bij monteur',
    assignedTo: 'tm-1',
    assignedToName: 'Jan de Vries',
    totalUsageHours: 180,
    repairCount: 0,
    totalRepairCost: 0,
  },
  {
    id: 'eq-3',
    name: 'Buizensnijder REMS',
    category: 'hand_tools',
    brand: 'REMS',
    model: 'RAS Cu-INOX',
    serialNumber: 'RMS-2020-56789',
    purchaseDate: new Date('2020-11-10'),
    purchasePrice: 185,
    currentValue: 92,
    status: 'available',
    condition: 'fair',
    location: 'Magazijn A',
    lastMaintenanceDate: new Date('2023-11-15'),
    nextMaintenanceDate: new Date('2024-02-15'),
    totalUsageHours: 890,
    repairCount: 2,
    totalRepairCost: 45,
  },
  {
    id: 'eq-4',
    name: 'Bedrijfsbus Mercedes Sprinter',
    category: 'vehicles',
    brand: 'Mercedes',
    model: 'Sprinter 314 CDI',
    serialNumber: 'WDB9066351S123456',
    purchaseDate: new Date('2022-01-05'),
    purchasePrice: 38500,
    currentValue: 29000,
    status: 'in_use',
    condition: 'good',
    location: 'Onderweg',
    assignedTo: 'tm-1',
    assignedToName: 'Jan de Vries',
    lastMaintenanceDate: new Date('2024-01-20'),
    nextMaintenanceDate: new Date('2024-07-20'),
    totalUsageHours: 2400,
    repairCount: 0,
    totalRepairCost: 0,
  },
  {
    id: 'eq-5',
    name: 'Lekdetector testo 316-2',
    category: 'diagnostic',
    brand: 'Testo',
    model: '316-2',
    serialNumber: 'TST-2023-98765',
    purchaseDate: new Date('2023-04-12'),
    purchasePrice: 680,
    currentValue: 578,
    warrantyExpiry: new Date('2025-04-12'),
    status: 'maintenance',
    condition: 'good',
    location: 'Bij leverancier',
    lastMaintenanceDate: new Date('2024-01-25'),
    nextMaintenanceDate: new Date('2024-01-30'),
    totalUsageHours: 95,
    repairCount: 0,
    totalRepairCost: 0,
  },
  {
    id: 'eq-6',
    name: 'Persmachine REMS Power-Press',
    category: 'power_tools',
    brand: 'REMS',
    model: 'Power-Press SE',
    serialNumber: 'RMS-2021-11111',
    purchaseDate: new Date('2021-08-22'),
    purchasePrice: 2450,
    currentValue: 1715,
    warrantyExpiry: new Date('2024-08-22'),
    status: 'available',
    condition: 'excellent',
    location: 'Magazijn A',
    lastMaintenanceDate: new Date('2023-12-01'),
    nextMaintenanceDate: new Date('2024-03-01'),
    totalUsageHours: 340,
    repairCount: 0,
    totalRepairCost: 0,
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockEquipment: Equipment[] = DEMO_MODE ? DEMO_mockEquipment : [];

const DEMO_mockMaintenanceRecords: MaintenanceRecord[] = [
  {
    id: 'mr-1',
    equipmentId: 'eq-1',
    type: 'routine',
    date: new Date('2024-01-10'),
    description: 'Jaarlijks onderhoud en smering',
    performedBy: 'Hilti Service',
    cost: 125,
    parts: [
      { name: 'Koolborstels', quantity: 2, unitCost: 15 },
      { name: 'Smeerolie', quantity: 1, unitCost: 8 },
    ],
    nextScheduledDate: new Date('2024-04-10'),
  },
  {
    id: 'mr-2',
    equipmentId: 'eq-3',
    type: 'repair',
    date: new Date('2023-11-15'),
    description: 'Snijwiel vervangen wegens slijtage',
    performedBy: 'Intern',
    cost: 25,
    parts: [{ name: 'Snijwiel RAS Cu-INOX', quantity: 1, unitCost: 25 }],
  },
  {
    id: 'mr-3',
    equipmentId: 'eq-4',
    type: 'routine',
    date: new Date('2024-01-20'),
    description: 'Grote beurt 30.000 km',
    performedBy: 'Mercedes Dealer',
    cost: 485,
    parts: [
      { name: 'Motorolie', quantity: 7, unitCost: 12 },
      { name: 'Oliefilter', quantity: 1, unitCost: 28 },
      { name: 'Luchtfilter', quantity: 1, unitCost: 45 },
    ],
    nextScheduledDate: new Date('2024-07-20'),
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockMaintenanceRecords: MaintenanceRecord[] = DEMO_MODE ? DEMO_mockMaintenanceRecords : [];

const DEMO_mockCheckouts: EquipmentCheckout[] = [
  {
    id: 'co-1',
    equipmentId: 'eq-2',
    equipmentName: 'Soldeerbout Rothenberger',
    checkedOutBy: 'tm-1',
    checkedOutByName: 'Jan de Vries',
    checkoutDate: new Date('2024-01-28'),
    expectedReturn: new Date('2024-01-31'),
    jobId: 'job-123',
    jobName: 'CV-ketel vervanging - Familie Smit',
    condition: 'excellent',
  },
  {
    id: 'co-2',
    equipmentId: 'eq-4',
    equipmentName: 'Bedrijfsbus Mercedes Sprinter',
    checkedOutBy: 'tm-1',
    checkedOutByName: 'Jan de Vries',
    checkoutDate: new Date('2024-01-28'),
    expectedReturn: new Date('2024-01-28'),
    condition: 'good',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockCheckouts: EquipmentCheckout[] = DEMO_MODE ? DEMO_mockCheckouts : [];

const DEMO_mockAlerts: EquipmentAlert[] = [
  {
    id: 'alert-1',
    equipmentId: 'eq-3',
    equipmentName: 'Buizensnijder REMS',
    type: 'maintenance_due',
    severity: 'medium',
    message: 'Onderhoud is over 2 weken gepland',
    actionRequired: 'Plan onderhoud in',
    createdAt: new Date(),
    acknowledged: false,
  },
  {
    id: 'alert-2',
    equipmentId: 'eq-1',
    equipmentName: 'Boormachine Hilti TE 30',
    type: 'warranty_expiry',
    severity: 'low',
    message: 'Garantie verloopt op 15 maart 2024',
    actionRequired: 'Overweeg verlengde garantie',
    createdAt: new Date(),
    acknowledged: false,
  },
  {
    id: 'alert-3',
    equipmentId: 'eq-5',
    equipmentName: 'Lekdetector testo 316-2',
    type: 'maintenance_due',
    severity: 'high',
    message: 'Apparaat is bij leverancier voor kalibratie',
    actionRequired: 'Ophalen wanneer gereed',
    createdAt: new Date(),
    acknowledged: false,
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const mockAlerts: EquipmentAlert[] = DEMO_MODE ? DEMO_mockAlerts : [];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type EquipmentListener = () => void;

class EquipmentTrackerService {
  private static instance: EquipmentTrackerService;
  private listeners: Set<EquipmentListener> = new Set();
  private equipment: Equipment[] = [...mockEquipment];
  private maintenanceRecords: MaintenanceRecord[] = [...mockMaintenanceRecords];
  private checkouts: EquipmentCheckout[] = [...mockCheckouts];
  private alerts: EquipmentAlert[] = [...mockAlerts];

  static getInstance(): EquipmentTrackerService {
    if (!EquipmentTrackerService.instance) {
      EquipmentTrackerService.instance = new EquipmentTrackerService();
      registerSingletonReset(() => {
        const inst = EquipmentTrackerService.instance;
        inst.equipment = [...mockEquipment];
        inst.maintenanceRecords = [...mockMaintenanceRecords];
        inst.checkouts = [...mockCheckouts];
        inst.alerts = [...mockAlerts];
        inst.listeners.forEach((l) => l());
      });
    }
    return EquipmentTrackerService.instance;
  }

  subscribe(listener: EquipmentListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Equipment CRUD
  getEquipment(category?: EquipmentCategory): Equipment[] {
    if (category) {
      return this.equipment.filter(e => e.category === category);
    }
    return this.equipment;
  }

  getEquipmentById(id: string): Equipment | undefined {
    return this.equipment.find(e => e.id === id);
  }

  addEquipment(item: Omit<Equipment, 'id' | 'currentValue' | 'totalUsageHours' | 'repairCount' | 'totalRepairCost'>): Equipment {
    const newItem: Equipment = {
      ...item,
      id: `eq-${Date.now()}`,
      currentValue: item.purchasePrice,
      totalUsageHours: 0,
      repairCount: 0,
      totalRepairCost: 0,
    };
    this.equipment.push(newItem);

    trackUserAction('equipment_added', {
      category: item.category,
      brand: item.brand,
      purchasePrice: item.purchasePrice,
    });

    this.notify();
    return newItem;
  }

  updateEquipment(id: string, updates: Partial<Equipment>): Equipment | undefined {
    const index = this.equipment.findIndex(e => e.id === id);
    if (index >= 0) {
      this.equipment[index] = { ...this.equipment[index], ...updates };

      trackUserAction('equipment_updated', { equipmentId: id });

      this.notify();
      return this.equipment[index];
    }
    return undefined;
  }

  // Checkout System
  checkoutEquipment(
    equipmentId: string,
    checkedOutBy: string,
    checkedOutByName: string,
    expectedReturn: Date,
    jobId?: string,
    jobName?: string
  ): EquipmentCheckout | undefined {
    const item = this.getEquipmentById(equipmentId);
    if (!item || item.status !== 'available') return undefined;

    const checkout: EquipmentCheckout = {
      id: `co-${Date.now()}`,
      equipmentId,
      equipmentName: item.name,
      checkedOutBy,
      checkedOutByName,
      checkoutDate: new Date(),
      expectedReturn,
      jobId,
      jobName,
      condition: item.condition,
    };

    this.checkouts.push(checkout);
    this.updateEquipment(equipmentId, {
      status: 'in_use',
      assignedTo: checkedOutBy,
      assignedToName: checkedOutByName,
    });

    trackUserAction('equipment_checkout', {
      equipmentId,
      assignedTo: checkedOutBy,
      hasJob: !!jobId,
    });

    return checkout;
  }

  returnEquipment(
    checkoutId: string,
    returnCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged',
    notes?: string
  ): EquipmentCheckout | undefined {
    const checkout = this.checkouts.find(c => c.id === checkoutId);
    if (!checkout || checkout.actualReturn) return undefined;

    checkout.actualReturn = new Date();
    checkout.returnCondition = returnCondition;
    checkout.notes = notes;

    this.updateEquipment(checkout.equipmentId, {
      status: returnCondition === 'damaged' ? 'repair' : 'available',
      condition: returnCondition === 'damaged' ? 'poor' : returnCondition,
      assignedTo: undefined,
      assignedToName: undefined,
    });

    trackUserAction('equipment_return', {
      equipmentId: checkout.equipmentId,
      returnCondition,
      isDamaged: returnCondition === 'damaged',
    });

    this.notify();
    return checkout;
  }

  getActiveCheckouts(): EquipmentCheckout[] {
    return this.checkouts.filter(c => !c.actualReturn);
  }

  getCheckoutHistory(equipmentId?: string): EquipmentCheckout[] {
    if (equipmentId) {
      return this.checkouts.filter(c => c.equipmentId === equipmentId);
    }
    return this.checkouts;
  }

  // Maintenance
  getMaintenanceRecords(equipmentId?: string): MaintenanceRecord[] {
    if (equipmentId) {
      return this.maintenanceRecords.filter(r => r.equipmentId === equipmentId);
    }
    return this.maintenanceRecords;
  }

  addMaintenanceRecord(record: Omit<MaintenanceRecord, 'id'>): MaintenanceRecord {
    const newRecord: MaintenanceRecord = {
      ...record,
      id: `mr-${Date.now()}`,
    };
    this.maintenanceRecords.push(newRecord);

    // Update equipment
    const item = this.getEquipmentById(record.equipmentId);
    if (item) {
      const updates: Partial<Equipment> = {
        lastMaintenanceDate: record.date,
      };
      if (record.nextScheduledDate) {
        updates.nextMaintenanceDate = record.nextScheduledDate;
      }
      if (record.type === 'repair') {
        updates.repairCount = item.repairCount + 1;
        updates.totalRepairCost = item.totalRepairCost + record.cost;
        updates.status = 'available';
      }
      this.updateEquipment(record.equipmentId, updates);
    }

    trackUserAction('maintenance_recorded', {
      equipmentId: record.equipmentId,
      type: record.type,
      cost: record.cost,
    });

    this.notify();
    return newRecord;
  }

  getMaintenanceSchedule(): MaintenanceSchedule[] {
    return this.equipment
      .filter(e => e.nextMaintenanceDate)
      .map(e => ({
        id: `ms-${e.id}`,
        equipmentId: e.id,
        equipmentName: e.name,
        type: 'routine' as const,
        frequency: 'quarterly' as const,
        lastPerformed: e.lastMaintenanceDate,
        nextDue: e.nextMaintenanceDate!,
        description: 'Standaard onderhoud',
        estimatedDuration: 60,
        estimatedCost: 50,
        isOverdue: e.nextMaintenanceDate! < new Date(),
      }));
  }

  // Utilization
  getUtilizationReport(): EquipmentUtilization[] {
    return this.equipment.map(e => {
      const checkoutDays = this.checkouts
        .filter(c => c.equipmentId === e.id && c.actualReturn)
        .reduce((sum, c) => {
          const days = Math.ceil(
            (c.actualReturn!.getTime() - c.checkoutDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }, 0);

      const purchaseAge = Math.ceil(
        (new Date().getTime() - e.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const utilizationRate = (checkoutDays / purchaseAge) * 100;
      const estimatedRevenue = e.totalUsageHours * 25; // €25 per hour assumed
      const totalCost = e.purchasePrice + e.totalRepairCost;
      const roi = ((estimatedRevenue - totalCost) / totalCost) * 100;

      return {
        equipmentId: e.id,
        equipmentName: e.name,
        category: e.category,
        totalDaysAvailable: purchaseAge,
        daysInUse: checkoutDays,
        utilizationRate: Math.round(utilizationRate),
        revenueGenerated: estimatedRevenue,
        costPerUse: checkoutDays > 0 ? Math.round(totalCost / checkoutDays) : 0,
        roi: Math.round(roi),
      };
    });
  }

  // Depreciation
  getDepreciationReport(): DepreciationReport[] {
    return this.equipment.map(e => {
      const usefulLife = getCategoryUsefulLife(e.category);
      const ageInYears = (new Date().getTime() - e.purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      const annualDepreciation = e.purchasePrice / usefulLife;
      const accumulatedDepreciation = Math.min(annualDepreciation * ageInYears, e.purchasePrice * 0.9);
      const bookValue = e.purchasePrice - accumulatedDepreciation;
      const yearsRemaining = Math.max(0, usefulLife - ageInYears);

      return {
        equipmentId: e.id,
        equipmentName: e.name,
        purchaseDate: e.purchaseDate,
        purchasePrice: e.purchasePrice,
        currentValue: e.currentValue,
        depreciationMethod: 'straight_line',
        usefulLife,
        annualDepreciation: Math.round(annualDepreciation),
        accumulatedDepreciation: Math.round(accumulatedDepreciation),
        bookValue: Math.round(bookValue),
        yearsRemaining: Math.round(yearsRemaining * 10) / 10,
      };
    });
  }

  // Alerts
  getAlerts(): EquipmentAlert[] {
    return this.alerts.filter(a => !a.acknowledged);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.notify();
    }
  }

  // Stats
  getStats(): EquipmentStats {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const maintenanceDue = this.equipment.filter(
      e => e.nextMaintenanceDate && e.nextMaintenanceDate <= now
    );
    const expiringWarranties = this.equipment.filter(e => {
      if (!e.warrantyExpiry) return false;
      const daysUntilExpiry = (e.warrantyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
    });

    const yearRepairCost = this.maintenanceRecords
      .filter(r => r.type === 'repair' && r.date >= yearStart)
      .reduce((sum, r) => sum + r.cost, 0);

    const utilization = this.getUtilizationReport();
    const avgUtilization = utilization.reduce((sum, u) => sum + u.utilizationRate, 0) / utilization.length;

    return {
      totalEquipment: this.equipment.length,
      totalValue: this.equipment.reduce((sum, e) => sum + e.currentValue, 0),
      availableCount: this.equipment.filter(e => e.status === 'available').length,
      inUseCount: this.equipment.filter(e => e.status === 'in_use').length,
      maintenanceCount: this.equipment.filter(e => e.status === 'maintenance').length,
      overdueMaintenanceCount: maintenanceDue.length,
      expiringWarranties: expiringWarranties.length,
      averageUtilization: Math.round(avgUtilization),
      totalRepairCostThisYear: yearRepairCost,
    };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function getCategoryUsefulLife(category: EquipmentCategory): number {
  const lifespans: Record<EquipmentCategory, number> = {
    power_tools: 5,
    hand_tools: 10,
    measuring: 7,
    safety: 3,
    vehicles: 8,
    heavy_equipment: 10,
    diagnostic: 6,
    other: 5,
  };
  return lifespans[category];
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const equipmentTrackerService = EquipmentTrackerService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useEquipment(category?: EquipmentCategory) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setEquipment(equipmentTrackerService.getEquipment(category));
    setLoading(false);

    return equipmentTrackerService.subscribe(() => {
      setEquipment(equipmentTrackerService.getEquipment(category));
    });
  }, [category]);

  const addItem = useCallback(
    (item: Omit<Equipment, 'id' | 'currentValue' | 'totalUsageHours' | 'repairCount' | 'totalRepairCost'>) => {
      return equipmentTrackerService.addEquipment(item);
    },
    []
  );

  const updateItem = useCallback((id: string, updates: Partial<Equipment>) => {
    return equipmentTrackerService.updateEquipment(id, updates);
  }, []);

  return { equipment, loading, addItem, updateItem };
}

export function useEquipmentCheckouts() {
  const [checkouts, setCheckouts] = useState<EquipmentCheckout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCheckouts(equipmentTrackerService.getActiveCheckouts());
    setLoading(false);

    return equipmentTrackerService.subscribe(() => {
      setCheckouts(equipmentTrackerService.getActiveCheckouts());
    });
  }, []);

  const checkout = useCallback(
    (
      equipmentId: string,
      checkedOutBy: string,
      checkedOutByName: string,
      expectedReturn: Date,
      jobId?: string,
      jobName?: string
    ) => {
      return equipmentTrackerService.checkoutEquipment(
        equipmentId,
        checkedOutBy,
        checkedOutByName,
        expectedReturn,
        jobId,
        jobName
      );
    },
    []
  );

  const returnItem = useCallback(
    (
      checkoutId: string,
      returnCondition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged',
      notes?: string
    ) => {
      return equipmentTrackerService.returnEquipment(checkoutId, returnCondition, notes);
    },
    []
  );

  return { checkouts, loading, checkout, returnItem };
}

export function useMaintenanceSchedule() {
  const [schedule, setSchedule] = useState<MaintenanceSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSchedule(equipmentTrackerService.getMaintenanceSchedule());
    setLoading(false);

    return equipmentTrackerService.subscribe(() => {
      setSchedule(equipmentTrackerService.getMaintenanceSchedule());
    });
  }, []);

  const addRecord = useCallback((record: Omit<MaintenanceRecord, 'id'>) => {
    return equipmentTrackerService.addMaintenanceRecord(record);
  }, []);

  return { schedule, loading, addRecord };
}

export function useEquipmentUtilization() {
  const [utilization, setUtilization] = useState<EquipmentUtilization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUtilization(equipmentTrackerService.getUtilizationReport());
    setLoading(false);

    return equipmentTrackerService.subscribe(() => {
      setUtilization(equipmentTrackerService.getUtilizationReport());
    });
  }, []);

  return { utilization, loading };
}

export function useDepreciation() {
  const [depreciation, setDepreciation] = useState<DepreciationReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setDepreciation(equipmentTrackerService.getDepreciationReport());
    setLoading(false);
  }, []);

  return { depreciation, loading };
}

export function useEquipmentAlerts() {
  const [alerts, setAlerts] = useState<EquipmentAlert[]>([]);

  useEffect(() => {
    setAlerts(equipmentTrackerService.getAlerts());

    return equipmentTrackerService.subscribe(() => {
      setAlerts(equipmentTrackerService.getAlerts());
    });
  }, []);

  const acknowledge = useCallback((alertId: string) => {
    equipmentTrackerService.acknowledgeAlert(alertId);
  }, []);

  return { alerts, acknowledge };
}

export function useEquipmentStats() {
  const [stats, setStats] = useState<EquipmentStats>(equipmentTrackerService.getStats());

  useEffect(() => {
    return equipmentTrackerService.subscribe(() => {
      setStats(equipmentTrackerService.getStats());
    });
  }, []);

  return stats;
}
