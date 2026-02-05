/**
 * Reasoning Engine Service
 *
 * Provides step-by-step explanations for AI decisions and recommendations.
 * Implements the Eve Legal AI "Reasoning Mode" pattern - every AI output
 * can explain its logic.
 */

import {
  ReasoningChain,
  ReasoningStep,
  ReasoningContext,
  ReasoningRequest,
  DataPoint,
  ConfidenceFactor,
  AlternativeConsideration,
  ReasoningTemplate,
  ReasoningTemplateConfig,
  ReasoningFeedback,
} from '../types/reasoning';

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

// ============================================
// REASONING TEMPLATES
// ============================================

const REASONING_TEMPLATES: Record<ReasoningTemplate, ReasoningTemplateConfig> = {
  'invoice-approval': {
    template: 'invoice-approval',
    steps: [
      {
        title: 'Verify invoice details',
        description: 'Check invoice matches order/contract',
        dataPointsNeeded: ['invoice-amount', 'contract-amount', 'po-amount'],
        evaluationCriteria: 'Amounts match within tolerance',
      },
      {
        title: 'Check budget allocation',
        description: 'Verify sufficient budget remains',
        dataPointsNeeded: ['budget-total', 'budget-spent', 'budget-remaining'],
        evaluationCriteria: 'Invoice within remaining budget',
      },
      {
        title: 'Verify work completion',
        description: 'Confirm deliverables received',
        dataPointsNeeded: ['deliverables-expected', 'deliverables-received'],
        evaluationCriteria: 'All expected items delivered',
      },
      {
        title: 'Check compliance',
        description: 'Verify regulatory requirements met',
        dataPointsNeeded: ['certifications', 'insurance', 'compliance-docs'],
        evaluationCriteria: 'All requirements satisfied',
      },
    ],
    confidenceThresholds: { high: 85, medium: 70, low: 50 },
    humanApprovalRequired: true,
  },

  'payment-approval': {
    template: 'payment-approval',
    steps: [
      {
        title: 'Verify payment request',
        description: 'Check payment matches approved invoice',
        dataPointsNeeded: ['payment-amount', 'invoice-amount', 'approval-status'],
        evaluationCriteria: 'Payment matches approved invoice',
      },
      {
        title: 'Check cash position',
        description: 'Verify sufficient funds available',
        dataPointsNeeded: ['account-balance', 'committed-payments', 'available-funds'],
        evaluationCriteria: 'Sufficient funds available',
      },
      {
        title: 'Verify supplier details',
        description: 'Confirm payment details are correct',
        dataPointsNeeded: ['bank-details', 'supplier-verified'],
        evaluationCriteria: 'Payment details verified',
      },
    ],
    confidenceThresholds: { high: 90, medium: 75, low: 60 },
    humanApprovalRequired: true,
  },

  'supplier-selection': {
    template: 'supplier-selection',
    steps: [
      {
        title: 'Compare pricing',
        description: 'Analyze quotes from available suppliers',
        dataPointsNeeded: ['supplier-quotes', 'market-rate', 'historical-prices'],
        evaluationCriteria: 'Best value for money',
      },
      {
        title: 'Assess reliability',
        description: 'Review supplier performance history',
        dataPointsNeeded: ['on-time-rate', 'quality-score', 'dispute-rate'],
        evaluationCriteria: 'Acceptable reliability score',
      },
      {
        title: 'Check availability',
        description: 'Verify supplier can meet delivery requirements',
        dataPointsNeeded: ['lead-time', 'stock-availability', 'delivery-date'],
        evaluationCriteria: 'Can meet required delivery date',
      },
      {
        title: 'Risk assessment',
        description: 'Evaluate supplier risk factors',
        dataPointsNeeded: ['financial-stability', 'concentration-risk'],
        evaluationCriteria: 'Acceptable risk level',
      },
    ],
    confidenceThresholds: { high: 80, medium: 65, low: 50 },
    humanApprovalRequired: false,
  },

  'quote-pricing': {
    template: 'quote-pricing',
    steps: [
      {
        title: 'Calculate costs',
        description: 'Sum up material and labour costs',
        dataPointsNeeded: ['material-costs', 'labour-hours', 'labour-rate'],
        evaluationCriteria: 'Costs accurately calculated',
      },
      {
        title: 'Compare to market',
        description: 'Check pricing against market rates',
        dataPointsNeeded: ['market-rate', 'competitor-prices', 'regional-data'],
        evaluationCriteria: 'Price competitive but profitable',
      },
      {
        title: 'Analyze customer',
        description: 'Consider customer history and value',
        dataPointsNeeded: ['customer-history', 'repeat-rate', 'payment-history'],
        evaluationCriteria: 'Appropriate pricing for customer',
      },
      {
        title: 'Calculate margin',
        description: 'Ensure acceptable profit margin',
        dataPointsNeeded: ['total-cost', 'proposed-price', 'target-margin'],
        evaluationCriteria: 'Margin meets target',
      },
    ],
    confidenceThresholds: { high: 75, medium: 60, low: 45 },
    humanApprovalRequired: false,
  },

  'schedule-decision': {
    template: 'schedule-decision',
    steps: [
      {
        title: 'Check availability',
        description: 'Verify resource availability',
        dataPointsNeeded: ['resource-calendar', 'existing-commitments'],
        evaluationCriteria: 'Resources available',
      },
      {
        title: 'Assess dependencies',
        description: 'Check predecessor activities',
        dataPointsNeeded: ['dependencies', 'predecessor-status'],
        evaluationCriteria: 'Dependencies satisfied',
      },
      {
        title: 'Evaluate risks',
        description: 'Consider weather and other risks',
        dataPointsNeeded: ['weather-forecast', 'permit-status', 'material-availability'],
        evaluationCriteria: 'Acceptable risk level',
      },
    ],
    confidenceThresholds: { high: 80, medium: 65, low: 50 },
    humanApprovalRequired: false,
  },

  'risk-assessment': {
    template: 'risk-assessment',
    steps: [
      {
        title: 'Identify risk',
        description: 'Classify and describe the risk',
        dataPointsNeeded: ['risk-category', 'risk-description', 'affected-areas'],
        evaluationCriteria: 'Risk clearly identified',
      },
      {
        title: 'Assess probability',
        description: 'Estimate likelihood of occurrence',
        dataPointsNeeded: ['historical-data', 'current-conditions', 'leading-indicators'],
        evaluationCriteria: 'Probability accurately estimated',
      },
      {
        title: 'Evaluate impact',
        description: 'Determine potential consequences',
        dataPointsNeeded: ['cost-impact', 'schedule-impact', 'quality-impact'],
        evaluationCriteria: 'Impact fully assessed',
      },
      {
        title: 'Recommend response',
        description: 'Suggest mitigation actions',
        dataPointsNeeded: ['mitigation-options', 'cost-of-mitigation'],
        evaluationCriteria: 'Appropriate response identified',
      },
    ],
    confidenceThresholds: { high: 70, medium: 55, low: 40 },
    humanApprovalRequired: true,
  },

  'budget-variance': {
    template: 'budget-variance',
    steps: [
      {
        title: 'Calculate variance',
        description: 'Compare actual to budget',
        dataPointsNeeded: ['budget-amount', 'actual-amount', 'committed-amount'],
        evaluationCriteria: 'Variance accurately calculated',
      },
      {
        title: 'Identify causes',
        description: 'Determine root causes of variance',
        dataPointsNeeded: ['cost-breakdown', 'change-orders', 'rate-changes'],
        evaluationCriteria: 'Causes identified',
      },
      {
        title: 'Forecast outcome',
        description: 'Project final cost',
        dataPointsNeeded: ['work-remaining', 'rate-trends', 'known-changes'],
        evaluationCriteria: 'Forecast reliable',
      },
    ],
    confidenceThresholds: { high: 85, medium: 70, low: 55 },
    humanApprovalRequired: false,
  },

  'procurement-decision': {
    template: 'procurement-decision',
    steps: [
      {
        title: 'Verify requirement',
        description: 'Confirm item is needed',
        dataPointsNeeded: ['requirement-source', 'quantity-needed', 'timing'],
        evaluationCriteria: 'Requirement valid',
      },
      {
        title: 'Compare options',
        description: 'Evaluate available suppliers',
        dataPointsNeeded: ['supplier-quotes', 'lead-times', 'reliability-scores'],
        evaluationCriteria: 'Best option identified',
      },
      {
        title: 'Check budget',
        description: 'Verify budget availability',
        dataPointsNeeded: ['budget-allocation', 'spent-to-date', 'remaining'],
        evaluationCriteria: 'Within budget',
      },
    ],
    confidenceThresholds: { high: 80, medium: 65, low: 50 },
    humanApprovalRequired: false,
  },

  'compliance-check': {
    template: 'compliance-check',
    steps: [
      {
        title: 'Identify requirements',
        description: 'List applicable regulations',
        dataPointsNeeded: ['jurisdiction', 'work-type', 'regulatory-requirements'],
        evaluationCriteria: 'All requirements identified',
      },
      {
        title: 'Verify credentials',
        description: 'Check required certifications',
        dataPointsNeeded: ['certifications', 'expiry-dates', 'scope'],
        evaluationCriteria: 'All credentials valid',
      },
      {
        title: 'Check documentation',
        description: 'Verify required documents present',
        dataPointsNeeded: ['required-docs', 'available-docs', 'expiry-dates'],
        evaluationCriteria: 'All documents present and valid',
      },
    ],
    confidenceThresholds: { high: 95, medium: 80, low: 60 },
    humanApprovalRequired: true,
  },
};

// ============================================
// REASONING ENGINE CLASS
// ============================================

class ReasoningEngine {
  private feedbackHistory: ReasoningFeedback[] = [];

  /**
   * Generate a reasoning chain for a question
   */
  async generateReasoningChain(request: ReasoningRequest): Promise<ReasoningChain> {
    const startTime = Date.now();
    const template = this.selectTemplate(request.question, request.context);
    const steps = await this.generateSteps(template, request.context);
    const conclusion = this.generateConclusion(steps);
    const recommendation = this.generateRecommendation(steps, request.context);
    const confidence = this.calculateOverallConfidence(steps);
    const confidenceFactors = this.identifyConfidenceFactors(steps);
    const alternatives = request.includeAlternatives !== false
      ? this.generateAlternatives(steps, request.context)
      : [];
    const humanCheckpoints = this.identifyHumanCheckpoints(template, confidence);

    return {
      id: generateId('rc'),
      questionOrTrigger: request.question,
      context: request.context,
      steps,
      conclusion,
      recommendation,
      confidence,
      confidenceFactors,
      alternativeConsiderations: alternatives,
      humanCheckpoints,
      generatedAt: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Explain a recommendation
   */
  async explainRecommendation(
    recommendationType: string,
    recommendation: any,
    context?: Partial<ReasoningContext>
  ): Promise<ReasoningChain> {
    const fullContext: ReasoningContext = {
      entityType: 'decision',
      entityId: recommendation.id || generateId('rec'),
      entityName: recommendation.title || recommendationType,
      ...context,
    };

    const question = `Why is "${recommendation.title || recommendationType}" recommended?`;

    return this.generateReasoningChain({
      question,
      context: fullContext,
      includeAlternatives: true,
    });
  }

  /**
   * Explain an agent action
   */
  async explainAction(
    actionType: string,
    action: any,
    context?: Partial<ReasoningContext>
  ): Promise<ReasoningChain> {
    const fullContext: ReasoningContext = {
      entityType: 'action',
      entityId: action.id || generateId('act'),
      entityName: action.title || actionType,
      ...context,
    };

    const question = `Why should we ${actionType.replace(/-/g, ' ')}?`;

    return this.generateReasoningChain({
      question,
      context: fullContext,
      includeAlternatives: true,
    });
  }

  /**
   * Get data points that support a reasoning step
   */
  getDataPointsForStep(step: ReasoningStep): DataPoint[] {
    return step.dataPoints;
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private selectTemplate(question: string, context: ReasoningContext): ReasoningTemplateConfig {
    const questionLower = question.toLowerCase();

    if (questionLower.includes('invoice') || questionLower.includes('bill')) {
      return REASONING_TEMPLATES['invoice-approval'];
    }
    if (questionLower.includes('payment') || questionLower.includes('pay')) {
      return REASONING_TEMPLATES['payment-approval'];
    }
    if (questionLower.includes('supplier') || questionLower.includes('vendor')) {
      return REASONING_TEMPLATES['supplier-selection'];
    }
    if (questionLower.includes('quote') || questionLower.includes('price') || questionLower.includes('pricing')) {
      return REASONING_TEMPLATES['quote-pricing'];
    }
    if (questionLower.includes('schedule') || questionLower.includes('when')) {
      return REASONING_TEMPLATES['schedule-decision'];
    }
    if (questionLower.includes('risk')) {
      return REASONING_TEMPLATES['risk-assessment'];
    }
    if (questionLower.includes('budget') || questionLower.includes('cost') || questionLower.includes('variance')) {
      return REASONING_TEMPLATES['budget-variance'];
    }
    if (questionLower.includes('buy') || questionLower.includes('purchase') || questionLower.includes('procure')) {
      return REASONING_TEMPLATES['procurement-decision'];
    }
    if (questionLower.includes('compliance') || questionLower.includes('certificate') || questionLower.includes('regulation')) {
      return REASONING_TEMPLATES['compliance-check'];
    }

    // Default based on context entity type
    switch (context.entityType) {
      case 'invoice':
        return REASONING_TEMPLATES['invoice-approval'];
      case 'payment':
        return REASONING_TEMPLATES['payment-approval'];
      case 'supplier':
        return REASONING_TEMPLATES['supplier-selection'];
      case 'quote':
        return REASONING_TEMPLATES['quote-pricing'];
      default:
        return REASONING_TEMPLATES['risk-assessment'];
    }
  }

  private async generateSteps(
    template: ReasoningTemplateConfig,
    context: ReasoningContext
  ): Promise<ReasoningStep[]> {
    const steps: ReasoningStep[] = [];

    for (let i = 0; i < template.steps.length; i++) {
      const stepTemplate = template.steps[i];
      const dataPoints = this.gatherDataPoints(stepTemplate.dataPointsNeeded, context);
      const { finding, impact, confidence } = this.evaluateStep(stepTemplate, dataPoints);

      steps.push({
        id: generateId('step'),
        stepNumber: i + 1,
        title: stepTemplate.title,
        description: stepTemplate.description,
        dataPoints,
        finding,
        confidence,
        impact,
      });
    }

    return steps;
  }

  private gatherDataPoints(needed: string[], context: ReasoningContext): DataPoint[] {
    // In a real implementation, this would fetch actual data
    // For now, generate realistic mock data based on what's needed
    const dataPoints: DataPoint[] = [];

    for (const pointName of needed) {
      dataPoints.push(this.generateMockDataPoint(pointName, context));
    }

    return dataPoints;
  }

  private generateMockDataPoint(name: string, context: ReasoningContext): DataPoint {
    // Generate realistic mock data based on the data point name
    const mockData: Record<string, () => DataPoint> = {
      'invoice-amount': () => ({
        id: generateId('dp'),
        type: 'currency',
        label: 'Invoice Amount',
        value: 23450,
        source: 'Invoice INV-2024-0892',
        sourceId: 'INV-2024-0892',
        reliability: 'verified',
      }),
      'contract-amount': () => ({
        id: generateId('dp'),
        type: 'currency',
        label: 'Contract Amount',
        value: 22000,
        source: 'Contract CON-2024-001',
        sourceId: 'CON-2024-001',
        reliability: 'verified',
      }),
      'budget-total': () => ({
        id: generateId('dp'),
        type: 'currency',
        label: 'Total Budget',
        value: 250000,
        source: 'Project Budget v3',
        reliability: 'verified',
      }),
      'budget-spent': () => ({
        id: generateId('dp'),
        type: 'currency',
        label: 'Amount Spent',
        value: 45000,
        source: 'Financial System',
        reliability: 'verified',
      }),
      'budget-remaining': () => ({
        id: generateId('dp'),
        type: 'currency',
        label: 'Remaining Budget',
        value: 205000,
        source: 'Calculated',
        reliability: 'calculated',
      }),
      'on-time-rate': () => ({
        id: generateId('dp'),
        type: 'percentage',
        label: 'On-Time Delivery Rate',
        value: 87,
        source: 'Supplier Performance History',
        reliability: 'calculated',
      }),
      'quality-score': () => ({
        id: generateId('dp'),
        type: 'number',
        label: 'Quality Score',
        value: 4.2,
        source: 'Quality Reviews (n=23)',
        reliability: 'calculated',
      }),
      'market-rate': () => ({
        id: generateId('dp'),
        type: 'currency',
        label: 'Market Rate',
        value: 38,
        source: 'RSMeans Q1 2024',
        reliability: 'verified',
      }),
      'weather-forecast': () => ({
        id: generateId('dp'),
        type: 'text',
        label: 'Weather Forecast',
        value: 'Dry conditions expected',
        source: 'Met Office 7-day forecast',
        reliability: 'estimated',
      }),
    };

    const generator = mockData[name];
    if (generator) {
      return generator();
    }

    // Default data point
    return {
      id: generateId('dp'),
      type: 'text',
      label: name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: 'Data available',
      source: 'System',
      reliability: 'calculated',
    };
  }

  private evaluateStep(
    stepTemplate: { evaluationCriteria: string },
    dataPoints: DataPoint[]
  ): { finding: string; impact: 'positive' | 'negative' | 'neutral'; confidence: number } {
    // In a real implementation, this would use AI to evaluate
    // For now, generate realistic mock evaluations
    const hasAllData = dataPoints.length > 0;
    const confidence = hasAllData ? 75 + Math.random() * 20 : 40 + Math.random() * 20;

    if (confidence > 80) {
      return {
        finding: `${stepTemplate.evaluationCriteria}. All criteria satisfied.`,
        impact: 'positive',
        confidence,
      };
    } else if (confidence > 60) {
      return {
        finding: `Partially meets criteria. Some items require attention.`,
        impact: 'neutral',
        confidence,
      };
    } else {
      return {
        finding: `Does not fully meet criteria. Review required.`,
        impact: 'negative',
        confidence,
      };
    }
  }

  private generateConclusion(steps: ReasoningStep[]): string {
    const positiveSteps = steps.filter(s => s.impact === 'positive').length;
    const negativeSteps = steps.filter(s => s.impact === 'negative').length;
    const totalSteps = steps.length;

    if (negativeSteps === 0 && positiveSteps === totalSteps) {
      return 'All evaluation criteria have been satisfied. The analysis supports proceeding.';
    } else if (negativeSteps === 0) {
      return 'Most criteria have been satisfied with some items requiring minor attention. The analysis generally supports proceeding.';
    } else if (negativeSteps === 1) {
      return 'One significant issue was identified that requires resolution before proceeding.';
    } else {
      return `Multiple issues (${negativeSteps}) were identified that require attention. Careful review recommended.`;
    }
  }

  private generateRecommendation(steps: ReasoningStep[], context: ReasoningContext): string {
    const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    const hasNegativeImpact = steps.some(s => s.impact === 'negative');

    if (avgConfidence > 80 && !hasNegativeImpact) {
      return 'Approve. All checks passed with high confidence.';
    } else if (avgConfidence > 60 && !hasNegativeImpact) {
      return 'Approve with conditions. Review flagged items before finalizing.';
    } else if (hasNegativeImpact) {
      return 'Hold for review. Address identified issues before proceeding.';
    } else {
      return 'Request additional information to increase confidence.';
    }
  }

  private calculateOverallConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) return 0;

    // Weighted average - negative impacts reduce confidence more
    let weightedSum = 0;
    let totalWeight = 0;

    for (const step of steps) {
      const weight = step.impact === 'negative' ? 1.5 : step.impact === 'positive' ? 1 : 1.2;
      weightedSum += step.confidence * weight;
      totalWeight += weight;
    }

    return Math.round(weightedSum / totalWeight);
  }

  private identifyConfidenceFactors(steps: ReasoningStep[]): ConfidenceFactor[] {
    const factors: ConfidenceFactor[] = [];

    // Data quality factor
    const verifiedDataPoints = steps.flatMap(s => s.dataPoints).filter(d => d.reliability === 'verified').length;
    const totalDataPoints = steps.flatMap(s => s.dataPoints).length;

    if (totalDataPoints > 0) {
      const verifiedRatio = verifiedDataPoints / totalDataPoints;
      factors.push({
        factor: 'Data Quality',
        impact: Math.round((verifiedRatio - 0.5) * 40),
        explanation: `${verifiedDataPoints}/${totalDataPoints} data points are from verified sources`,
      });
    }

    // Step success factor
    const positiveSteps = steps.filter(s => s.impact === 'positive').length;
    factors.push({
      factor: 'Criteria Satisfaction',
      impact: Math.round(((positiveSteps / steps.length) - 0.5) * 40),
      explanation: `${positiveSteps}/${steps.length} evaluation steps passed`,
    });

    // Average step confidence
    const avgStepConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    factors.push({
      factor: 'Analysis Confidence',
      impact: Math.round((avgStepConfidence / 100 - 0.5) * 40),
      explanation: `Average step confidence is ${avgStepConfidence.toFixed(0)}%`,
    });

    return factors;
  }

  private generateAlternatives(
    steps: ReasoningStep[],
    context: ReasoningContext
  ): AlternativeConsideration[] {
    // Generate 1-2 alternatives based on context
    const alternatives: AlternativeConsideration[] = [];

    // Always include a "do nothing" alternative for high-stakes decisions
    if (context.entityType === 'payment' || context.entityType === 'invoice') {
      alternatives.push({
        option: 'Defer decision',
        pros: ['More time to gather information', 'Reduced risk of error'],
        cons: ['May impact supplier relationship', 'Could delay project'],
        whyNotRecommended: 'Current analysis provides sufficient confidence to proceed',
        confidence: 45,
      });
    }

    // Add context-specific alternatives
    if (context.entityType === 'supplier') {
      alternatives.push({
        option: 'Request additional quotes',
        pros: ['May find better pricing', 'More competitive options'],
        cons: ['Delays procurement', 'Administrative overhead'],
        whyNotRecommended: 'Current options provide good value and meet requirements',
        confidence: 55,
      });
    }

    return alternatives;
  }

  private identifyHumanCheckpoints(template: ReasoningTemplateConfig, confidence: number): string[] {
    const checkpoints: string[] = [];

    if (template.humanApprovalRequired) {
      checkpoints.push('Final approval required from authorized person');
    }

    if (confidence < template.confidenceThresholds.medium) {
      checkpoints.push('Low confidence analysis - human review recommended');
    }

    if (confidence < template.confidenceThresholds.high) {
      checkpoints.push('Consider reviewing flagged items before proceeding');
    }

    return checkpoints;
  }

  /**
   * Record feedback on reasoning quality
   */
  recordFeedback(feedback: Omit<ReasoningFeedback, 'id' | 'timestamp'>): ReasoningFeedback {
    const fullFeedback: ReasoningFeedback = {
      ...feedback,
      id: generateId('fb'),
      timestamp: new Date().toISOString(),
    };

    this.feedbackHistory.push(fullFeedback);
    return fullFeedback;
  }

  /**
   * Get feedback stats for improving reasoning
   */
  getFeedbackStats(): { helpful: number; accurate: number; total: number } {
    const total = this.feedbackHistory.length;
    const helpful = this.feedbackHistory.filter(f => f.helpful).length;
    const accurate = this.feedbackHistory.filter(f => f.accurateConclusion).length;

    return { helpful, accurate, total };
  }
}

// ============================================
// SINGLETON INSTANCE & HOOKS
// ============================================

export const reasoningEngine = new ReasoningEngine();

// React hooks
import { useState, useCallback } from 'react';

export function useReasoningChain() {
  const [chain, setChain] = useState<ReasoningChain | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReasoning = useCallback(async (request: ReasoningRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reasoningEngine.generateReasoningChain(request);
      setChain(result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate reasoning');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const explainRecommendation = useCallback(async (
    type: string,
    recommendation: any,
    context?: Partial<ReasoningContext>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reasoningEngine.explainRecommendation(type, recommendation, context);
      setChain(result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to explain recommendation');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const explainAction = useCallback(async (
    type: string,
    action: any,
    context?: Partial<ReasoningContext>
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await reasoningEngine.explainAction(type, action, context);
      setChain(result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to explain action');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    chain,
    loading,
    error,
    generateReasoning,
    explainRecommendation,
    explainAction,
  };
}

export default reasoningEngine;
