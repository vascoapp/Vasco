// =============================================================================
// UPSELL ENGINE SERVICE
// =============================================================================
// Intelligent upselling and cross-selling recommendations
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface UpsellOpportunity {
  id: string;
  type: 'upsell' | 'cross_sell' | 'addon' | 'upgrade';
  title: string;
  description: string;
  targetService: string;
  suggestedPrice: number;
  margin: number;
  probability: number;
  triggers: string[];
  bestTiming: string;
  talkingPoints: string[];
  objectionHandlers: { objection: string; response: string }[];
  status: 'pending' | 'presented' | 'accepted' | 'declined';
}

export interface ActiveRecommendation {
  id: string;
  jobId: string;
  jobType: string;
  customerId: string;
  customerName: string;
  opportunities: UpsellOpportunity[];
  totalPotentialValue: number;
  presentedAt?: Date;
  outcome?: 'accepted' | 'declined' | 'partial';
  acceptedValue?: number;
}

export interface UpsellPerformance {
  period: string;
  presented: number;
  accepted: number;
  acceptanceRate: number;
  revenue: number;
  avgOrderIncrease: number;
}

export interface UpsellStats {
  opportunitiesToday: number;
  presentedThisMonth: number;
  acceptedThisMonth: number;
  revenueThisMonth: number;
  avgAcceptanceRate: number;
  topPerformingUpsell: string;
}

// =============================================================================
// MOCK DATA
// =============================================================================

const upsellTemplates: Omit<UpsellOpportunity, 'id' | 'status'>[] = [
  {
    type: 'addon', title: 'Onderhoudscontract', description: 'Jaarlijks onderhoudsabonnement voor zorgeloos comfort',
    targetService: 'cv_installation', suggestedPrice: 189, margin: 65, probability: 45,
    triggers: ['Nieuwe installatie', 'Ketel > 5 jaar'], bestTiming: 'Bij oplevering',
    talkingPoints: ['Voorrang bij storingen', 'Inclusief jaarlijkse beurt', 'Verlengt levensduur'],
    objectionHandlers: [{ objection: 'Te duur', response: 'Een storing kost vaak €150+, contract bespaart op lange termijn' }],
  },
  {
    type: 'upsell', title: 'Slimme Thermostaat', description: 'Upgrade naar slimme thermostaat met app-bediening',
    targetService: 'cv_maintenance', suggestedPrice: 289, margin: 40, probability: 35,
    triggers: ['Oude thermostaat', 'Hoge stookkosten'], bestTiming: 'Tijdens onderhoud',
    talkingPoints: ['Tot 20% energiebesparing', 'Bediening via smartphone', 'Zelf-lerend systeem'],
    objectionHandlers: [{ objection: 'Werkt het met mijn ketel?', response: 'Werkt met vrijwel alle moderne ketels' }],
  },
  {
    type: 'cross_sell', title: 'Radiator Spoelen', description: 'Radiatorensysteem doorspoelen voor optimale warmteafgifte',
    targetService: 'cv_maintenance', suggestedPrice: 149, margin: 70, probability: 30,
    triggers: ['Radiatoren worden niet goed warm', 'Systeem > 10 jaar'], bestTiming: 'Bij klachten over warmte',
    talkingPoints: ['Betere warmteverdeling', 'Lager energieverbruik', 'Voorkomt verstoppingen'],
    objectionHandlers: [],
  },
  {
    type: 'addon', title: 'CO-melder Installatie', description: 'Gecertificeerde CO-melder voor extra veiligheid',
    targetService: 'cv_installation', suggestedPrice: 89, margin: 50, probability: 55,
    triggers: ['CV-ketel installatie', 'Geen CO-melder aanwezig'], bestTiming: 'Bij nieuwe ketel',
    talkingPoints: ['Levensreddend bij lekkage', 'Wettelijk aanbevolen', '10 jaar batterij'],
    objectionHandlers: [{ objection: 'Is dat nodig?', response: 'Jaarlijks 200 CO-vergiftigingen in NL, melder kan levens redden' }],
  },
  {
    type: 'upgrade', title: 'Hybride Warmtepomp', description: 'Voeg warmtepomp toe aan bestaande CV voor lagere gasrekening',
    targetService: 'cv_maintenance', suggestedPrice: 4500, margin: 25, probability: 15,
    triggers: ['Hoge gasrekening', 'Ketel vervanging overwegen'], bestTiming: 'Bij onderhoud oude ketel',
    talkingPoints: ['Tot 50% minder gas', 'ISDE subsidie mogelijk', 'Waarde woning stijgt'],
    objectionHandlers: [{ objection: 'Grote investering', response: 'Met subsidie vaak €2000 minder, terugverdientijd 5-7 jaar' }],
  },
];

const mockActiveRecommendations: ActiveRecommendation[] = [
  {
    id: 'ar-1', jobId: 'job-123', jobType: 'cv_maintenance', customerId: 'cust-1', customerName: 'Familie de Groot',
    opportunities: upsellTemplates.filter(t => t.targetService === 'cv_maintenance').map((t, i) => ({ ...t, id: `opp-${i}`, status: 'pending' as const })),
    totalPotentialValue: 4938,
  },
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

type UpsellListener = () => void;

class UpsellEngineService {
  private static instance: UpsellEngineService;
  private listeners: Set<UpsellListener> = new Set();
  private recommendations: ActiveRecommendation[] = [...mockActiveRecommendations];
  private history: ActiveRecommendation[] = [];

  static getInstance(): UpsellEngineService {
    if (!UpsellEngineService.instance) {
      UpsellEngineService.instance = new UpsellEngineService();
    }
    return UpsellEngineService.instance;
  }

  subscribe(listener: UpsellListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getRecommendationsForJob(jobId: string): ActiveRecommendation | undefined {
    return this.recommendations.find(r => r.jobId === jobId);
  }

  generateRecommendations(jobId: string, jobType: string, customerId: string, customerName: string): ActiveRecommendation {
    const existing = this.recommendations.find(r => r.jobId === jobId);
    if (existing) return existing;

    const opportunities = upsellTemplates
      .filter(t => t.targetService === jobType || t.targetService === 'any')
      .map((t, i) => ({ ...t, id: `opp-${Date.now()}-${i}`, status: 'pending' as const }));

    const rec: ActiveRecommendation = {
      id: `ar-${Date.now()}`, jobId, jobType, customerId, customerName, opportunities,
      totalPotentialValue: opportunities.reduce((sum, o) => sum + o.suggestedPrice, 0),
    };
    this.recommendations.push(rec);
    trackUserAction('upsell_recommendations_generated', { jobId, count: opportunities.length });
    this.notify();
    return rec;
  }

  presentOpportunity(recommendationId: string, opportunityId: string): void {
    const rec = this.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      const opp = rec.opportunities.find(o => o.id === opportunityId);
      if (opp) {
        opp.status = 'presented';
        rec.presentedAt = new Date();
        trackUserAction('upsell_presented', { opportunityId, title: opp.title, price: opp.suggestedPrice });
        this.notify();
      }
    }
  }

  recordOutcome(recommendationId: string, opportunityId: string, accepted: boolean): void {
    const rec = this.recommendations.find(r => r.id === recommendationId);
    if (rec) {
      const opp = rec.opportunities.find(o => o.id === opportunityId);
      if (opp) {
        opp.status = accepted ? 'accepted' : 'declined';
        trackUserAction('upsell_outcome', { opportunityId, accepted, value: accepted ? opp.suggestedPrice : 0 });
        this.notify();
      }
    }
  }

  getPerformance(months: number = 6): UpsellPerformance[] {
    const performances: UpsellPerformance[] = [];
    for (let i = 0; i < months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      performances.push({
        period: date.toLocaleDateString(undefined, { month: 'short' }),
        presented: Math.floor(15 + Math.random() * 10),
        accepted: Math.floor(5 + Math.random() * 5),
        acceptanceRate: Math.floor(25 + Math.random() * 20),
        revenue: Math.floor(1500 + Math.random() * 2000),
        avgOrderIncrease: Math.floor(15 + Math.random() * 10),
      });
    }
    return performances.reverse();
  }

  getStats(): UpsellStats {
    const thisMonth = this.recommendations.filter(r => r.presentedAt && r.presentedAt.getMonth() === new Date().getMonth());
    const accepted = thisMonth.flatMap(r => r.opportunities.filter(o => o.status === 'accepted'));

    return {
      opportunitiesToday: this.recommendations.flatMap(r => r.opportunities.filter(o => o.status === 'pending')).length,
      presentedThisMonth: thisMonth.flatMap(r => r.opportunities.filter(o => o.status !== 'pending')).length,
      acceptedThisMonth: accepted.length,
      revenueThisMonth: accepted.reduce((sum, o) => sum + o.suggestedPrice, 0),
      avgAcceptanceRate: 32,
      topPerformingUpsell: 'Onderhoudscontract',
    };
  }
}

export const upsellEngineService = UpsellEngineService.getInstance();

// =============================================================================
// REACT HOOKS
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

export function useUpsellRecommendations(jobId?: string) {
  const [recommendation, setRecommendation] = useState<ActiveRecommendation | null>(null);

  useEffect(() => {
    if (jobId) {
      setRecommendation(upsellEngineService.getRecommendationsForJob(jobId) || null);
    }
    return upsellEngineService.subscribe(() => {
      if (jobId) setRecommendation(upsellEngineService.getRecommendationsForJob(jobId) || null);
    });
  }, [jobId]);

  const generate = useCallback((jId: string, jType: string, cId: string, cName: string) => upsellEngineService.generateRecommendations(jId, jType, cId, cName), []);
  const present = useCallback((rId: string, oId: string) => upsellEngineService.presentOpportunity(rId, oId), []);
  const recordOutcome = useCallback((rId: string, oId: string, accepted: boolean) => upsellEngineService.recordOutcome(rId, oId, accepted), []);

  return { recommendation, generate, present, recordOutcome };
}

export function useUpsellPerformance(months?: number) {
  const [performance, setPerformance] = useState<UpsellPerformance[]>([]);
  useEffect(() => { setPerformance(upsellEngineService.getPerformance(months)); }, [months]);
  return performance;
}

export function useUpsellStats() {
  const [stats, setStats] = useState<UpsellStats>(upsellEngineService.getStats());
  useEffect(() => upsellEngineService.subscribe(() => setStats(upsellEngineService.getStats())), []);
  return stats;
}
