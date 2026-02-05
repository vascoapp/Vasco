/**
 * Reasoning Types
 *
 * Types for the Reasoning Engine that provides step-by-step
 * explanations for AI decisions (Eve pattern).
 */

// ============================================
// REASONING CHAIN
// ============================================

export interface ReasoningStep {
  id: string;
  stepNumber: number;
  title: string;                      // Short title: "Analyzing cost trends"
  description: string;                // What this step examines
  dataPoints: DataPoint[];            // Evidence used in this step
  finding: string;                    // What was found/concluded
  confidence: number;                 // 0-100 confidence in this step
  impact: 'positive' | 'negative' | 'neutral';
  duration?: number;                  // How long this step took (ms)
}

export interface DataPoint {
  id: string;
  type: DataPointType;
  label: string;
  value: any;
  source: string;                     // Where this data came from
  sourceId?: string;                  // ID of source document/record
  timestamp?: string;                 // When this data was captured
  reliability: 'verified' | 'calculated' | 'estimated' | 'user-provided';
}

export type DataPointType =
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'text'
  | 'boolean'
  | 'list'
  | 'comparison'
  | 'trend';

export interface ReasoningChain {
  id: string;
  questionOrTrigger: string;          // "Should we approve this payment?"
  context: ReasoningContext;
  steps: ReasoningStep[];
  conclusion: string;                 // Final conclusion
  recommendation: string;             // Recommended action
  confidence: number;                 // Overall confidence 0-100
  confidenceFactors: ConfidenceFactor[];
  alternativeConsiderations: AlternativeConsideration[];
  humanCheckpoints: string[];         // Where human judgment is needed
  generatedAt: string;
  processingTime: number;             // Total processing time (ms)
}

export interface ReasoningContext {
  entityType: 'invoice' | 'quote' | 'payment' | 'supplier' | 'project' | 'decision' | 'action';
  entityId: string;
  entityName?: string;
  role?: string;                      // User role requesting reasoning
  urgency?: 'immediate' | 'today' | 'this-week' | 'when-convenient';
  priorDecisions?: string[];          // Related past decisions
}

export interface ConfidenceFactor {
  factor: string;
  impact: number;                     // -100 to +100 impact on confidence
  explanation: string;
}

export interface AlternativeConsideration {
  option: string;
  pros: string[];
  cons: string[];
  whyNotRecommended: string;
  confidence: number;
}

// ============================================
// REASONING REQUEST/RESPONSE
// ============================================

export interface ReasoningRequest {
  question: string;
  context: ReasoningContext;
  maxSteps?: number;
  includeAlternatives?: boolean;
  verbosity?: 'concise' | 'standard' | 'detailed';
}

export interface ExplainRecommendationRequest {
  recommendationType: string;
  recommendationId: string;
  recommendation: any;
  context?: Partial<ReasoningContext>;
}

export interface ExplainActionRequest {
  actionType: string;
  actionId: string;
  action: any;
  context?: Partial<ReasoningContext>;
}

// ============================================
// REASONING TEMPLATES
// ============================================

export type ReasoningTemplate =
  | 'invoice-approval'
  | 'payment-approval'
  | 'supplier-selection'
  | 'quote-pricing'
  | 'schedule-decision'
  | 'risk-assessment'
  | 'budget-variance'
  | 'procurement-decision'
  | 'compliance-check';

export interface ReasoningTemplateConfig {
  template: ReasoningTemplate;
  steps: {
    title: string;
    description: string;
    dataPointsNeeded: string[];
    evaluationCriteria: string;
  }[];
  confidenceThresholds: {
    high: number;
    medium: number;
    low: number;
  };
  humanApprovalRequired: boolean;
}

// ============================================
// REASONING DISPLAY
// ============================================

export interface ReasoningDisplayOptions {
  showStepNumbers: boolean;
  showConfidence: boolean;
  showDataPoints: boolean;
  showAlternatives: boolean;
  expandedByDefault: boolean;
  highlightKeyFindings: boolean;
}

export interface ReasoningStepDisplay {
  step: ReasoningStep;
  isExpanded: boolean;
  isHighlighted: boolean;
}

// ============================================
// REASONING FEEDBACK
// ============================================

export interface ReasoningFeedback {
  id: string;
  reasoningChainId: string;
  userId: string;
  helpful: boolean;
  accurateConclusion: boolean;
  comments?: string;
  suggestedImprovements?: string;
  timestamp: string;
}

// ============================================
// PRE-BUILT REASONING QUESTIONS
// ============================================

export const REASONING_QUESTIONS = {
  contractor: [
    "Should I accept this job at the quoted price?",
    "Is this quote competitive for the market?",
    "Which supplier should I use for this material?",
    "Should I follow up with this customer?",
    "Is my pricing too high or too low?",
  ],
  cfo: [
    "Should I approve this invoice?",
    "Is this payment within budget?",
    "What's causing the cost overrun?",
    "Should we release retention?",
    "Is this change order justified?",
  ],
  coo: [
    "Which contractor should we award this work to?",
    "Should we approve this change order?",
    "Is this schedule achievable?",
    "What's the impact of this delay?",
    "Should we escalate this risk?",
  ],
  sitelead: [
    "Should I escalate this issue?",
    "Is this quality acceptable?",
    "Which task should be prioritized?",
    "Is the site safe to proceed?",
    "Should I accept this delivery?",
  ],
  director: [
    "Is this project on track?",
    "Should we approve this budget increase?",
    "What's the portfolio risk exposure?",
    "Should we proceed with this acquisition?",
    "Is this contractor performing well?",
  ],
};
