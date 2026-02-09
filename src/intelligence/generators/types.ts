// =============================================================================
// INSIGHT GENERATOR TYPES
// =============================================================================

import type { VascoInsight, InsightPriority } from '../../components/shared/VascoInsightCard';
import type { ContractorLearningProfile } from '../learningStorage';

export type UserRole = 'contractor' | 'sitelead' | 'coo' | 'cfo' | 'director';
export type ScreenContext =
  | 'today' | 'invoices' | 'savings' | 'decisions' | 'schedule'
  | 'dispatch' | 'costs' | 'cashflow' | 'returns' | 'approvals'
  | 'risks' | 'performance' | 'permits' | 'procurement' | 'financials'
  | 'efficiency' | 'market' | 'emerging' | 'portfolio' | 'meer'
  | 'overview' | 'safety' | 'quality' | 'issues';

export interface GeneratorContext {
  role: UserRole;
  screen: ScreenContext;
  profile: ContractorLearningProfile;
  now: Date;
}

export interface ReasoningChain {
  observation: string;   // "Je DSO is gestegen van 18 naar 24 dagen"
  evidence: string;      // "Op basis van 47 facturen"
  implication: string;   // "Dit kost je ~€320/maand aan werkkapitaal"
  suggestion: string;    // "Stuur herinneringen op dag 14 i.p.v. dag 21"
}

export interface ScoredInsight extends VascoInsight {
  generatorId: string;
  rawScore: number;
  reasoning: ReasoningChain;
  dataPoints: number;      // how many data points back this insight
  confidence: number;      // 0-1
  freshness: number;       // hours since data changed
}

export interface InsightGenerator {
  id: string;
  screens: ScreenContext[];
  roles: UserRole[];
  generate(ctx: GeneratorContext): ScoredInsight | null;
}

export function priorityToUrgencyScore(priority: InsightPriority): number {
  switch (priority) {
    case 'critical': return 1;
    case 'high': return 0.75;
    case 'medium': return 0.5;
    case 'low': return 0.25;
  }
}
