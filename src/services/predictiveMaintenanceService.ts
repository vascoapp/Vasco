// =============================================================================
// PREDICTIVE MAINTENANCE SERVICE — DEPRECATED — DO NOT EXTEND (R19 audit)
// =============================================================================
// Status as of R19: pure orphan + heavy mock state.
//
//  - 809 LoC of equipment-health / failure-prediction / maintenance-recommendation
//    machinery, all powered by hardcoded mock data (`mockEquipmentHealth`,
//    `mockPredictions`, `mockRecommendations`, `mockPartOrders`).
//  - Class constructor populates from mocks; no Supabase fetch ever runs;
//    no equipment telemetry source exists in the BE schema.
//  - Methods like `schedulePreventiveMaintenance` write nothing — return
//    in-memory objects only. No persistence, no AsyncStorage, no RPC.
//  - ZERO consumers anywhere in app/ or src/components/. The only references
//    in the codebase are: (a) the type re-exports in src/services/index.ts,
//    (b) cooRealEstateKPIService declaring its own `PredictiveMaintenanceItem`
//    type for the COO enterprise dashboard (a separate concept, not this
//    service).
//  - Hardcoded NL strings throughout failure-mode descriptions.
//
// To make this real:
//  1. New BE table `equipment_health_observations` (one row per
//     contractor-tracked tool/asset, with sensor or manual readings)
//  2. RPC `get_equipment_health(user_id)` returning rolled-up scores
//  3. UI: equipment list in compliance/permits or new /contractor/equipment route
//  4. ML: actual failure-prediction model trained on observed-vs-predicted breaks
//  5. Localize all failure-mode descriptions
//
// Until then: do not import. Tagged for cleanup. Same pattern as R288/R295/R296/R299/R18.
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { registerSingletonReset } from './singletonReset';

// =============================================================================
// TYPES
// =============================================================================

export interface EquipmentHealth {
  equipmentId: string;
  equipmentName: string;
  category: string;
  healthScore: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastAssessment: Date;
  factors: HealthFactor[];
  predictions: FailurePrediction[];
  recommendations: MaintenanceRecommendation[];
}

export interface HealthFactor {
  name: string;
  value: number; // 0-100
  weight: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export interface FailurePrediction {
  id: string;
  equipmentId: string;
  equipmentName: string;
  component: string;
  failureType: string;
  probability: number; // 0-100
  confidenceLevel: number; // 0-100
  predictedTimeframe: {
    earliest: Date;
    mostLikely: Date;
    latest: Date;
  };
  potentialImpact: 'low' | 'medium' | 'high' | 'critical';
  estimatedDowntime: number; // hours
  estimatedRepairCost: number;
  preventionCost: number;
  savingsIfPrevented: number;
  indicators: string[];
  acknowledged: boolean;
}

export interface MaintenanceRecommendation {
  id: string;
  equipmentId: string;
  equipmentName: string;
  type: 'preventive' | 'predictive' | 'corrective' | 'improvement';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  reasoning: string;
  estimatedCost: number;
  estimatedDuration: number; // minutes
  potentialSavings: number;
  recommendedDate: Date;
  deadline?: Date;
  requiredParts: RequiredPart[];
  status: 'pending' | 'scheduled' | 'completed' | 'dismissed';
}

export interface RequiredPart {
  name: string;
  partNumber?: string;
  quantity: number;
  estimatedCost: number;
  inStock: boolean;
  leadTime?: number; // days
}

export interface UsagePattern {
  equipmentId: string;
  period: 'daily' | 'weekly' | 'monthly';
  data: UsageDataPoint[];
  averageUsage: number;
  peakUsage: number;
  anomalies: UsageAnomaly[];
}

export interface UsageDataPoint {
  date: Date;
  hours: number;
  cycles?: number;
  load?: number;
}

export interface UsageAnomaly {
  date: Date;
  type: 'overuse' | 'unusual_pattern' | 'stress' | 'idle';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface MaintenanceHistory {
  equipmentId: string;
  records: MaintenanceRecord[];
  totalCost: number;
  unplannedBreakdowns: number;
  preventedFailures: number;
  averageTimeBetweenFailures: number; // days
  reliabilityTrend: 'improving' | 'stable' | 'declining';
}

export interface MaintenanceRecord {
  id: string;
  date: Date;
  type: 'preventive' | 'predictive' | 'corrective' | 'emergency';
  description: string;
  cost: number;
  downtime: number; // hours
  wasPlanned: boolean;
  prediction?: string;
}

export interface CostSavingsReport {
  period: { start: Date; end: Date };
  preventedFailures: number;
  actualMaintenanceCost: number;
  estimatedWithoutPredictive: number;
  savings: number;
  savingsPercentage: number;
  downtimePrevented: number; // hours
  revenueProtected: number;
  breakdowns: {
    category: string;
    prevented: number;
    savings: number;
  }[];
}

export interface PartOrderSuggestion {
  id: string;
  equipmentId: string;
  equipmentName: string;
  partName: string;
  partNumber?: string;
  quantity: number;
  estimatedCost: number;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
  predictedNeedDate: Date;
  currentStock: number;
  leadTime: number;
  orderByDate: Date;
  supplierName?: string;
  supplierPrice?: number;
}

export interface PredictiveStats {
  totalEquipmentMonitored: number;
  equipmentAtRisk: number;
  predictionsActive: number;
  recommendationsPending: number;
  preventedFailuresThisMonth: number;
  savingsThisMonth: number;
  averageHealthScore: number;
  partsToOrder: number;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const mockEquipmentHealth: EquipmentHealth[] = [
  {
    equipmentId: 'eq-1',
    equipmentName: 'Boormachine Hilti TE 30',
    category: 'power_tools',
    healthScore: 72,
    trend: 'declining',
    riskLevel: 'medium',
    lastAssessment: new Date(),
    factors: [
      { name: 'Gebruiksuren', value: 65, weight: 0.3, status: 'warning', description: '520 van 800 uur tot onderhoud' },
      { name: 'Leeftijd', value: 75, weight: 0.2, status: 'good', description: '3 jaar oud, gemiddelde levensduur 6 jaar' },
      { name: 'Onderhoudshistorie', value: 85, weight: 0.2, status: 'good', description: 'Regelmatig onderhouden' },
      { name: 'Omgevingscondities', value: 60, weight: 0.15, status: 'warning', description: 'Veel stoffige omgevingen' },
      { name: 'Belastingspatroon', value: 70, weight: 0.15, status: 'good', description: 'Normale belasting' },
    ],
    predictions: [],
    recommendations: [],
  },
  {
    equipmentId: 'eq-4',
    equipmentName: 'Bedrijfsbus Mercedes Sprinter',
    category: 'vehicles',
    healthScore: 85,
    trend: 'stable',
    riskLevel: 'low',
    lastAssessment: new Date(),
    factors: [
      { name: 'Kilometerstand', value: 80, weight: 0.25, status: 'good', description: '45.000 km, goed voor dit type' },
      { name: 'Onderhoudsstatus', value: 95, weight: 0.25, status: 'good', description: 'Recent grote beurt gehad' },
      { name: 'Leeftijd', value: 85, weight: 0.2, status: 'good', description: '2 jaar oud' },
      { name: 'Rijstijl', value: 75, weight: 0.15, status: 'good', description: 'Normaal rijgedrag' },
      { name: 'Laadpatroon', value: 80, weight: 0.15, status: 'good', description: 'Binnen specificaties' },
    ],
    predictions: [],
    recommendations: [],
  },
  {
    equipmentId: 'eq-5',
    equipmentName: 'Lekdetector testo 316-2',
    category: 'diagnostic',
    healthScore: 88,
    trend: 'stable',
    riskLevel: 'low',
    lastAssessment: new Date(),
    factors: [
      { name: 'Kalibratiesstatus', value: 100, weight: 0.35, status: 'good', description: 'Recent gekalibreerd' },
      { name: 'Batterijconditie', value: 75, weight: 0.25, status: 'good', description: 'Goede batterijlevensduur' },
      { name: 'Sensorstatus', value: 85, weight: 0.25, status: 'good', description: 'Sensoren functioneren normaal' },
      { name: 'Behuizing', value: 90, weight: 0.15, status: 'good', description: 'Geen beschadigingen' },
    ],
    predictions: [],
    recommendations: [],
  },
  {
    equipmentId: 'eq-6',
    equipmentName: 'Persmachine REMS Power-Press',
    category: 'power_tools',
    healthScore: 45,
    trend: 'declining',
    riskLevel: 'high',
    lastAssessment: new Date(),
    factors: [
      { name: 'Perscycli', value: 35, weight: 0.3, status: 'critical', description: '8.500 van 10.000 cycli' },
      { name: 'Aandrijfmechanisme', value: 40, weight: 0.25, status: 'critical', description: 'Slijtage gedetecteerd' },
      { name: 'Hydraulisch systeem', value: 55, weight: 0.25, status: 'warning', description: 'Druk licht verminderd' },
      { name: 'Bekken conditie', value: 60, weight: 0.2, status: 'warning', description: 'Slijtage zichtbaar' },
    ],
    predictions: [],
    recommendations: [],
  },
];

const mockPredictions: FailurePrediction[] = [
  {
    id: 'pred-1',
    equipmentId: 'eq-6',
    equipmentName: 'Persmachine REMS Power-Press',
    component: 'Aandrijfmechanisme',
    failureType: 'Mechanische slijtage',
    probability: 78,
    confidenceLevel: 85,
    predictedTimeframe: {
      earliest: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      mostLikely: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      latest: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    },
    potentialImpact: 'high',
    estimatedDowntime: 24,
    estimatedRepairCost: 850,
    preventionCost: 320,
    savingsIfPrevented: 1530,
    indicators: [
      'Hoog aantal perscycli (8.500+)',
      'Verminderde perskracht (-12%)',
      'Onregelmatige cyclusduur',
      'Lichte trillingen gedetecteerd',
    ],
    acknowledged: false,
  },
  {
    id: 'pred-2',
    equipmentId: 'eq-1',
    equipmentName: 'Boormachine Hilti TE 30',
    component: 'Koolborstels',
    failureType: 'Slijtage onderdelen',
    probability: 65,
    confidenceLevel: 90,
    predictedTimeframe: {
      earliest: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      mostLikely: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      latest: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
    potentialImpact: 'medium',
    estimatedDowntime: 4,
    estimatedRepairCost: 125,
    preventionCost: 45,
    savingsIfPrevented: 280,
    indicators: [
      'Gebruiksuren boven 500',
      'Lichte vonkvorming gemeld',
      'Verminderd vermogen bij hoge belasting',
    ],
    acknowledged: false,
  },
  {
    id: 'pred-3',
    equipmentId: 'eq-4',
    equipmentName: 'Bedrijfsbus Mercedes Sprinter',
    component: 'Remblokken voor',
    failureType: 'Normale slijtage',
    probability: 45,
    confidenceLevel: 80,
    predictedTimeframe: {
      earliest: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      mostLikely: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      latest: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
    },
    potentialImpact: 'medium',
    estimatedDowntime: 2,
    estimatedRepairCost: 280,
    preventionCost: 185,
    savingsIfPrevented: 195,
    indicators: [
      'Geschatte slijtage 65%',
      'Kilometerstand sinds laatste vervanging: 35.000 km',
    ],
    acknowledged: true,
  },
];

const mockRecommendations: MaintenanceRecommendation[] = [
  {
    id: 'rec-1',
    equipmentId: 'eq-6',
    equipmentName: 'Persmachine REMS Power-Press',
    type: 'preventive',
    priority: 'urgent',
    title: 'Aandrijfmechanisme revisie',
    description: 'Volledige revisie van het aandrijfmechanisme om storing te voorkomen.',
    reasoning: 'Op basis van cyclusanalyse en trillingmetingen is er 78% kans op storing binnen 30 dagen.',
    estimatedCost: 320,
    estimatedDuration: 180,
    potentialSavings: 1530,
    recommendedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    requiredParts: [
      { name: 'Aandrijfriem', partNumber: 'REMS-DR-450', quantity: 1, estimatedCost: 85, inStock: false, leadTime: 3 },
      { name: 'Lagers set', partNumber: 'REMS-BRG-SET', quantity: 1, estimatedCost: 120, inStock: true },
      { name: 'Smeermiddel', partNumber: 'LUB-SPEC-500', quantity: 1, estimatedCost: 25, inStock: true },
    ],
    status: 'pending',
  },
  {
    id: 'rec-2',
    equipmentId: 'eq-1',
    equipmentName: 'Boormachine Hilti TE 30',
    type: 'preventive',
    priority: 'medium',
    title: 'Koolborstels vervangen',
    description: 'Preventieve vervanging van koolborstels voor optimale prestaties.',
    reasoning: 'Gebruiksuren suggereren dat borstels binnen 6-8 weken vervangen moeten worden.',
    estimatedCost: 45,
    estimatedDuration: 30,
    potentialSavings: 280,
    recommendedDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    requiredParts: [
      { name: 'Koolborstels set', partNumber: 'HLT-CB-TE30', quantity: 1, estimatedCost: 32, inStock: true },
    ],
    status: 'pending',
  },
  {
    id: 'rec-3',
    equipmentId: 'eq-6',
    equipmentName: 'Persmachine REMS Power-Press',
    type: 'improvement',
    priority: 'low',
    title: 'Upgrade naar nieuwe persbekken',
    description: 'Nieuwere bekken bieden betere duurzaamheid en precisie.',
    reasoning: 'Huidige bekken tonen slijtage. Upgrade kan levensduur met 40% verlengen.',
    estimatedCost: 185,
    estimatedDuration: 45,
    potentialSavings: 400,
    recommendedDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    requiredParts: [
      { name: 'Persbekken set V2', partNumber: 'REMS-JAW-V2', quantity: 1, estimatedCost: 165, inStock: false, leadTime: 5 },
    ],
    status: 'pending',
  },
];

const mockPartOrders: PartOrderSuggestion[] = [
  {
    id: 'po-1',
    equipmentId: 'eq-6',
    equipmentName: 'Persmachine REMS Power-Press',
    partName: 'Aandrijfriem',
    partNumber: 'REMS-DR-450',
    quantity: 1,
    estimatedCost: 85,
    reason: 'Nodig voor geplande revisie aandrijfmechanisme',
    urgency: 'high',
    predictedNeedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    currentStock: 0,
    leadTime: 3,
    orderByDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
    supplierName: 'Technische Unie',
    supplierPrice: 82,
  },
  {
    id: 'po-2',
    equipmentId: 'eq-1',
    equipmentName: 'Boormachine Hilti TE 30',
    partName: 'Koolborstels set',
    partNumber: 'HLT-CB-TE30',
    quantity: 2,
    estimatedCost: 64,
    reason: 'Voorraad aanvullen voor preventief onderhoud',
    urgency: 'medium',
    predictedNeedDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    currentStock: 1,
    leadTime: 2,
    orderByDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    supplierName: 'Hilti Store',
    supplierPrice: 32,
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type MaintenanceListener = () => void;

class PredictiveMaintenanceService {
  private static instance: PredictiveMaintenanceService;
  private listeners: Set<MaintenanceListener> = new Set();
  private equipmentHealth: EquipmentHealth[] = [...mockEquipmentHealth];
  private predictions: FailurePrediction[] = [...mockPredictions];
  private recommendations: MaintenanceRecommendation[] = [...mockRecommendations];
  private partOrders: PartOrderSuggestion[] = [...mockPartOrders];

  static getInstance(): PredictiveMaintenanceService {
    if (!PredictiveMaintenanceService.instance) {
      PredictiveMaintenanceService.instance = new PredictiveMaintenanceService();
      registerSingletonReset(() => {
        const inst = PredictiveMaintenanceService.instance;
        inst.equipmentHealth = [...mockEquipmentHealth];
        inst.predictions = [...mockPredictions];
        inst.recommendations = [...mockRecommendations];
        inst.partOrders = [...mockPartOrders];
        inst.listeners.forEach((l) => l());
      });
    }
    return PredictiveMaintenanceService.instance;
  }

  subscribe(listener: MaintenanceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener());
  }

  // Equipment Health
  getEquipmentHealth(): EquipmentHealth[] {
    return this.equipmentHealth;
  }

  getEquipmentHealthById(equipmentId: string): EquipmentHealth | undefined {
    return this.equipmentHealth.find(h => h.equipmentId === equipmentId);
  }

  getAtRiskEquipment(): EquipmentHealth[] {
    return this.equipmentHealth.filter(h => h.riskLevel === 'high' || h.riskLevel === 'critical');
  }

  // Predictions
  getPredictions(acknowledged?: boolean): FailurePrediction[] {
    if (acknowledged !== undefined) {
      return this.predictions.filter(p => p.acknowledged === acknowledged);
    }
    return this.predictions;
  }

  getPredictionsByEquipment(equipmentId: string): FailurePrediction[] {
    return this.predictions.filter(p => p.equipmentId === equipmentId);
  }

  acknowledgePrediction(predictionId: string): void {
    const prediction = this.predictions.find(p => p.id === predictionId);
    if (prediction) {
      prediction.acknowledged = true;

      trackUserAction('prediction_acknowledged', {
        predictionId,
        equipmentId: prediction.equipmentId,
        probability: prediction.probability,
      });

      this.notify();
    }
  }

  // Recommendations
  getRecommendations(status?: MaintenanceRecommendation['status']): MaintenanceRecommendation[] {
    if (status) {
      return this.recommendations.filter(r => r.status === status);
    }
    return this.recommendations;
  }

  getRecommendationsByEquipment(equipmentId: string): MaintenanceRecommendation[] {
    return this.recommendations.filter(r => r.equipmentId === equipmentId);
  }

  scheduleRecommendation(recommendationId: string, scheduledDate: Date): void {
    const rec = this.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      rec.status = 'scheduled';
      rec.recommendedDate = scheduledDate;

      trackUserAction('recommendation_scheduled', {
        recommendationId,
        equipmentId: rec.equipmentId,
        estimatedSavings: rec.potentialSavings,
      });

      this.notify();
    }
  }

  completeRecommendation(recommendationId: string): void {
    const rec = this.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      rec.status = 'completed';

      trackUserAction('recommendation_completed', {
        recommendationId,
        equipmentId: rec.equipmentId,
        actualSavings: rec.potentialSavings,
      });

      this.notify();
    }
  }

  dismissRecommendation(recommendationId: string): void {
    const rec = this.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      rec.status = 'dismissed';

      trackUserAction('recommendation_dismissed', {
        recommendationId,
        equipmentId: rec.equipmentId,
      });

      this.notify();
    }
  }

  // Part Orders
  getPartOrderSuggestions(): PartOrderSuggestion[] {
    return this.partOrders;
  }

  getUrgentPartOrders(): PartOrderSuggestion[] {
    return this.partOrders.filter(p => p.urgency === 'high');
  }

  orderPart(suggestionId: string): void {
    const index = this.partOrders.findIndex(p => p.id === suggestionId);
    if (index >= 0) {
      const part = this.partOrders[index];

      trackUserAction('part_ordered', {
        partName: part.partName,
        equipmentId: part.equipmentId,
        cost: part.estimatedCost,
      });

      this.partOrders.splice(index, 1);
      this.notify();
    }
  }

  // Cost Savings
  getCostSavingsReport(): CostSavingsReport {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    return {
      period: { start: monthStart, end: now },
      preventedFailures: 3,
      actualMaintenanceCost: 890,
      estimatedWithoutPredictive: 2450,
      savings: 1560,
      savingsPercentage: 64,
      downtimePrevented: 18,
      revenueProtected: 4500,
      breakdowns: [
        { category: 'Elektrisch gereedschap', prevented: 2, savings: 820 },
        { category: 'Voertuigen', prevented: 1, savings: 740 },
      ],
    };
  }

  // Usage Patterns
  getUsagePattern(equipmentId: string, period: 'daily' | 'weekly' | 'monthly'): UsagePattern {
    // Generate mock usage data
    const now = new Date();
    const dataPoints: UsageDataPoint[] = [];
    const numPoints = period === 'daily' ? 30 : period === 'weekly' ? 12 : 6;

    for (let i = numPoints - 1; i >= 0; i--) {
      const date = new Date(now);
      if (period === 'daily') date.setDate(date.getDate() - i);
      else if (period === 'weekly') date.setDate(date.getDate() - i * 7);
      else date.setMonth(date.getMonth() - i);

      dataPoints.push({
        date,
        hours: Math.round((4 + Math.random() * 4) * 10) / 10,
        cycles: Math.round(20 + Math.random() * 30),
      });
    }

    const hours = dataPoints.map(d => d.hours);
    const avgUsage = hours.reduce((a, b) => a + b, 0) / hours.length;
    const peakUsage = Math.max(...hours);

    return {
      equipmentId,
      period,
      data: dataPoints,
      averageUsage: Math.round(avgUsage * 10) / 10,
      peakUsage,
      anomalies: [
        {
          date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          type: 'overuse',
          description: 'Gebruik 40% hoger dan gemiddeld',
          severity: 'low',
        },
      ],
    };
  }

  // Stats
  getStats(): PredictiveStats {
    const atRisk = this.equipmentHealth.filter(h => h.riskLevel === 'high' || h.riskLevel === 'critical');
    const pendingRecs = this.recommendations.filter(r => r.status === 'pending');
    const avgHealth = this.equipmentHealth.reduce((sum, h) => sum + h.healthScore, 0) / this.equipmentHealth.length;
    const urgentParts = this.partOrders.filter(p => p.urgency === 'high');

    return {
      totalEquipmentMonitored: this.equipmentHealth.length,
      equipmentAtRisk: atRisk.length,
      predictionsActive: this.predictions.filter(p => !p.acknowledged).length,
      recommendationsPending: pendingRecs.length,
      preventedFailuresThisMonth: 3,
      savingsThisMonth: 1560,
      averageHealthScore: Math.round(avgHealth),
      partsToOrder: urgentParts.length,
    };
  }

  // Run Analysis (simulate AI analysis)
  runAnalysis(equipmentId: string): Promise<EquipmentHealth> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const health = this.getEquipmentHealthById(equipmentId);
        if (health) {
          health.lastAssessment = new Date();

          trackUserAction('predictive_analysis_run', {
            equipmentId,
            healthScore: health.healthScore,
            riskLevel: health.riskLevel,
          });

          this.notify();
          resolve(health);
        }
      }, 1500);
    });
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const predictiveMaintenanceService = PredictiveMaintenanceService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useEquipmentHealth() {
  const [health, setHealth] = useState<EquipmentHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setHealth(predictiveMaintenanceService.getEquipmentHealth());
    setLoading(false);

    return predictiveMaintenanceService.subscribe(() => {
      setHealth(predictiveMaintenanceService.getEquipmentHealth());
    });
  }, []);

  const getAtRisk = useCallback(() => {
    return predictiveMaintenanceService.getAtRiskEquipment();
  }, []);

  const runAnalysis = useCallback((equipmentId: string) => {
    return predictiveMaintenanceService.runAnalysis(equipmentId);
  }, []);

  return { health, loading, getAtRisk, runAnalysis };
}

export function useFailurePredictions(acknowledged?: boolean) {
  const [predictions, setPredictions] = useState<FailurePrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPredictions(predictiveMaintenanceService.getPredictions(acknowledged));
    setLoading(false);

    return predictiveMaintenanceService.subscribe(() => {
      setPredictions(predictiveMaintenanceService.getPredictions(acknowledged));
    });
  }, [acknowledged]);

  const acknowledge = useCallback((predictionId: string) => {
    predictiveMaintenanceService.acknowledgePrediction(predictionId);
  }, []);

  return { predictions, loading, acknowledge };
}

export function useMaintenanceRecommendations(status?: MaintenanceRecommendation['status']) {
  const [recommendations, setRecommendations] = useState<MaintenanceRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRecommendations(predictiveMaintenanceService.getRecommendations(status));
    setLoading(false);

    return predictiveMaintenanceService.subscribe(() => {
      setRecommendations(predictiveMaintenanceService.getRecommendations(status));
    });
  }, [status]);

  const schedule = useCallback((recommendationId: string, date: Date) => {
    predictiveMaintenanceService.scheduleRecommendation(recommendationId, date);
  }, []);

  const complete = useCallback((recommendationId: string) => {
    predictiveMaintenanceService.completeRecommendation(recommendationId);
  }, []);

  const dismiss = useCallback((recommendationId: string) => {
    predictiveMaintenanceService.dismissRecommendation(recommendationId);
  }, []);

  return { recommendations, loading, schedule, complete, dismiss };
}

export function usePartOrderSuggestions() {
  const [suggestions, setSuggestions] = useState<PartOrderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSuggestions(predictiveMaintenanceService.getPartOrderSuggestions());
    setLoading(false);

    return predictiveMaintenanceService.subscribe(() => {
      setSuggestions(predictiveMaintenanceService.getPartOrderSuggestions());
    });
  }, []);

  const order = useCallback((suggestionId: string) => {
    predictiveMaintenanceService.orderPart(suggestionId);
  }, []);

  const getUrgent = useCallback(() => {
    return predictiveMaintenanceService.getUrgentPartOrders();
  }, []);

  return { suggestions, loading, order, getUrgent };
}

export function useCostSavings() {
  const [report, setReport] = useState<CostSavingsReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setReport(predictiveMaintenanceService.getCostSavingsReport());
    setLoading(false);
  }, []);

  return { report, loading };
}

export function usePredictiveStats() {
  const [stats, setStats] = useState<PredictiveStats>(predictiveMaintenanceService.getStats());

  useEffect(() => {
    return predictiveMaintenanceService.subscribe(() => {
      setStats(predictiveMaintenanceService.getStats());
    });
  }, []);

  return stats;
}
