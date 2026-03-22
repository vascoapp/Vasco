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
  | 'overview' | 'safety' | 'quality' | 'issues'
  | 'quote-new' | 'invoice-new' | 'invoice-create'
  | 'job-detail' | 'job-materials' | 'jobs-list'
  | 'cfo-projects' | 'cfo-costs' | 'cfo-appraisal' | 'cfo-risks' | 'cfo-approvals'
  | 'coo-schedule' | 'director-metrics'
  | 'ai' | 'werk' | 'geld' | 'bedrijf' | 'compliance';

export type GeneratorLanguage = 'en' | 'nl' | 'de' | 'fr' | 'es' | 'it';

export interface GeneratorContext {
  role: UserRole;
  screen: ScreenContext;
  profile: ContractorLearningProfile;
  now: Date;
  language: GeneratorLanguage;
}

export interface ReasoningChain {
  observation: string;   // "Je DSO is gestegen van 18 naar 24 dagen"
  evidence: string;      // "Op basis van 47 facturen"
  implication: string;   // "Dit kost je ~€320/maand aan werkkapitaal"
  suggestion: string;    // "Stuur herinneringen op dag 14 i.p.v. dag 21"
}

// Action types — transforms insights from "information" to "execution"
export type InsightActionType =
  | 'send_reminder'        // Send payment reminder to customer
  | 'create_invoice'       // Generate invoice from completed job
  | 'order_materials'      // Place purchase order for materials
  | 'schedule_job'         // Schedule a job from accepted quote
  | 'adjust_quote'         // Suggest price adjustment on draft quote
  | 'renew_cert'           // Start certification renewal process
  | 'send_followup'        // Follow up on sent quote
  | 'escalate_issue'       // Escalate blocked/overdue item
  | 'log_expense'          // Record a material purchase as expense
  | 'switch_supplier'      // Switch to cheaper supplier for material
  | 'close_defect'         // Mark defect as resolved
  | 'submit_report'        // Submit daily/safety report
  | 'custom';

export interface InsightAction {
  type: InsightActionType;
  label: string;           // Dutch action label: "Herinnering sturen"
  params: Record<string, any>; // Action-specific data
  requiresApproval: boolean;   // Show confirmation before executing
  estimatedImpact?: string;    // "Bespaart ~€320/maand"
  route?: string;              // Optional: navigate instead of executing inline
}

export interface ScoredInsight extends VascoInsight {
  generatorId: string;
  rawScore: number;
  reasoning: ReasoningChain;
  dataPoints: number;      // how many data points back this insight
  confidence: number;      // 0-1
  freshness: number;       // hours since data changed
  rootCauseTags?: string[];       // semantic tags for consolidation (e.g. ['margin', 'cost-variance'])
  consolidatedFrom?: string[];    // IDs of insights absorbed during consolidation
  shownOnScreen?: string;         // screen context where this insight was displayed
  confidenceWarning?: string;     // Dutch warning when insight based on few data points
  action?: InsightAction;          // One-tap action the AI can execute
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
