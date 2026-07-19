// =============================================================================
// CUSTOMER FOLLOW-UP SERVICE
// =============================================================================
// Automates customer follow-ups based on project status and behavior patterns
// Learns from engagement data to optimize timing and messaging
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import { DEMO_MODE } from '../config/demo';

// ============================================
// TYPES
// ============================================

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: 'particulier' | 'zakelijk';
  preferredContact: 'email' | 'phone' | 'whatsapp';
  lastContactDate: string;
  totalProjects: number;
  totalRevenue: number;
  avgResponseTime?: number; // hours
  bestContactTime?: string; // e.g., "10:00-12:00"
  notes?: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  customerName: string;

  // Context
  type: 'quote_reminder' | 'project_check_in' | 'post_project' | 'maintenance_reminder' | 'seasonal' | 'anniversary';
  relatedProjectId?: string;
  relatedQuoteId?: string;

  // Scheduling
  status: 'scheduled' | 'due' | 'overdue' | 'completed' | 'snoozed' | 'cancelled';
  scheduledDate: string;
  scheduledTime?: string;
  dueInDays: number;

  // Content
  suggestedMessage: string;
  suggestedSubject?: string;
  personalizationFactors: string[];

  // Learning
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-1, how confident we are this is a good follow-up
  predictedResponseRate: number; // 0-1
  basedOn: string[];

  // Outcome tracking
  outcome?: 'responded' | 'no_response' | 'converted' | 'declined' | 'rescheduled';
  completedAt?: string;
  notes?: string;
}

export interface FollowUpTemplate {
  id: string;
  type: FollowUp['type'];
  name: string;
  subject: string;
  body: string;
  variables: string[]; // e.g., ['customerName', 'projectName', 'quoteAmount']
  responseRate: number;
  conversionRate: number;
}

export interface FollowUpStatistics {
  totalFollowUps: number;
  completedThisMonth: number;
  responseRate: number;
  conversionRate: number;
  avgResponseTime: number; // hours
  topPerformingType: FollowUp['type'];
  savedDealValue: number;
}

export interface FollowUpPreferences {
  enabled: boolean;
  autoSchedule: boolean;
  reminderLeadTime: number; // hours before scheduled time
  channels: {
    email: boolean;
    whatsapp: boolean;
    phone: boolean;
  };
  quietDays: number[]; // 0-6, Sunday-Saturday
  workingHours: {
    start: string;
    end: string;
  };
}

// ============================================
// MOCK DATA
// ============================================

const DEMO_MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'cust_1',
    name: 'Familie de Vries',
    email: 'devries@email.nl',
    phone: '+31 6 12345678',
    type: 'particulier',
    preferredContact: 'whatsapp',
    lastContactDate: '2025-01-20',
    totalProjects: 2,
    totalRevenue: 4500,
    avgResponseTime: 4,
    bestContactTime: '18:00-20:00',
  },
  {
    id: 'cust_2',
    name: 'Bakkerij Jansen',
    email: 'info@bakkerijjansen.nl',
    phone: '+31 6 98765432',
    type: 'zakelijk',
    preferredContact: 'email',
    lastContactDate: '2025-01-15',
    totalProjects: 5,
    totalRevenue: 12000,
    avgResponseTime: 8,
    bestContactTime: '09:00-11:00',
  },
  {
    id: 'cust_3',
    name: 'Peter van den Berg',
    email: 'peter@vdberg.com',
    phone: '+31 6 55443322',
    type: 'particulier',
    preferredContact: 'phone',
    lastContactDate: '2025-01-28',
    totalProjects: 1,
    totalRevenue: 2200,
    avgResponseTime: 2,
    bestContactTime: '12:00-14:00',
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_CUSTOMERS: Customer[] = DEMO_MODE ? DEMO_MOCK_CUSTOMERS : [];

const DEMO_MOCK_FOLLOW_UPS: FollowUp[] = [
  {
    id: 'fu_1',
    customerId: 'cust_1',
    customerName: 'Familie de Vries',
    type: 'quote_reminder',
    relatedQuoteId: 'quote_123',
    status: 'due',
    scheduledDate: '2025-01-31',
    scheduledTime: '18:30',
    dueInDays: 0,
    suggestedMessage: 'Beste familie de Vries,\n\nVorige week heb ik een offerte gestuurd voor de badkamerrenovatie. Heeft u al tijd gehad om ernaar te kijken? Ik help graag met eventuele vragen.\n\nMet vriendelijke groet',
    suggestedSubject: 'Offerte badkamerrenovatie - nog vragen?',
    personalizationFactors: ['Voorkeur avondcontact', 'Vorige project goed verlopen'],
    priority: 'high',
    confidence: 0.85,
    predictedResponseRate: 0.72,
    basedOn: ['Offerte 5 dagen oud', 'Historisch responspatroon', 'Klantwaarde'],
  },
  {
    id: 'fu_2',
    customerId: 'cust_2',
    customerName: 'Bakkerij Jansen',
    type: 'maintenance_reminder',
    relatedProjectId: 'proj_456',
    status: 'scheduled',
    scheduledDate: '2025-02-05',
    scheduledTime: '09:30',
    dueInDays: 5,
    suggestedMessage: 'Beste heer Jansen,\n\nHet is alweer 6 maanden geleden dat we de keuken hebben gerenoveerd. Tijd voor een onderhoudscheck! Zal ik langskomen om te kijken of alles nog goed werkt?\n\nMet vriendelijke groet',
    suggestedSubject: 'Onderhoudscheck keukenrenovatie',
    personalizationFactors: ['Zakelijke klant', 'Hoge klantwaarde', '6-maanden interval'],
    priority: 'medium',
    confidence: 0.78,
    predictedResponseRate: 0.65,
    basedOn: ['6 maanden sinds project', 'Onderhoudsinterval', 'Klantloyaliteit'],
  },
  {
    id: 'fu_3',
    customerId: 'cust_3',
    customerName: 'Peter van den Berg',
    type: 'post_project',
    relatedProjectId: 'proj_789',
    status: 'overdue',
    scheduledDate: '2025-01-29',
    scheduledTime: '12:30',
    dueInDays: -2,
    suggestedMessage: 'Hallo Peter,\n\nEen paar weken geleden hebben we het schilderwerk afgerond. Bent u tevreden met het resultaat? Ik zou het erg waarderen als u een korte review zou willen achterlaten.\n\nGroet',
    suggestedSubject: 'Hoe bevalt het schilderwerk?',
    personalizationFactors: ['Informele toon preferred', 'Review verzoek'],
    priority: 'high',
    confidence: 0.82,
    predictedResponseRate: 0.58,
    basedOn: ['2 weken na oplevering', 'Review timing optimaal'],
  },
  {
    id: 'fu_4',
    customerId: 'cust_1',
    customerName: 'Familie de Vries',
    type: 'seasonal',
    status: 'scheduled',
    scheduledDate: '2025-03-01',
    dueInDays: 29,
    suggestedMessage: 'Beste familie de Vries,\n\nDe lente komt eraan! Tijd om het huis klaar te maken voor het nieuwe seizoen. Ik heb een speciale aanbieding voor buitenschilderwerk. Interesse?\n\nMet vriendelijke groet',
    suggestedSubject: 'Voorjaarsaanbieding buitenschilderwerk',
    personalizationFactors: ['Vorig jaar interesse getoond', 'Seizoensgebonden'],
    priority: 'low',
    confidence: 0.62,
    predictedResponseRate: 0.35,
    basedOn: ['Seizoenspatroon', 'Historische interesse', 'Markttrend'],
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_FOLLOW_UPS: FollowUp[] = DEMO_MODE ? DEMO_MOCK_FOLLOW_UPS : [];

const DEMO_MOCK_TEMPLATES: FollowUpTemplate[] = [
  {
    id: 'tpl_1',
    type: 'quote_reminder',
    name: 'Offerte opvolging - vriendelijk',
    subject: 'Offerte {{projectType}} - nog vragen?',
    body: 'Beste {{customerName}},\n\n{{daysAgo}} heb ik een offerte gestuurd voor de {{projectType}}. Heeft u al tijd gehad om ernaar te kijken?\n\nIk help graag met eventuele vragen of kan de offerte toelichten.\n\nMet vriendelijke groet,\n{{contractorName}}',
    variables: ['customerName', 'projectType', 'daysAgo', 'contractorName'],
    responseRate: 0.68,
    conversionRate: 0.42,
  },
  {
    id: 'tpl_2',
    type: 'post_project',
    name: 'Tevredenheidscheck + review',
    subject: 'Hoe bevalt {{projectType}}?',
    body: 'Hallo {{customerName}},\n\n{{weeksAgo}} hebben we de {{projectType}} afgerond. Bent u tevreden met het resultaat?\n\nUw feedback is belangrijk voor mij. Zou u een korte review willen achterlaten?\n\n{{reviewLink}}\n\nAlvast bedankt!\n{{contractorName}}',
    variables: ['customerName', 'projectType', 'weeksAgo', 'reviewLink', 'contractorName'],
    responseRate: 0.52,
    conversionRate: 0.28,
  },
  {
    id: 'tpl_3',
    type: 'maintenance_reminder',
    name: 'Onderhoudsherinnering',
    subject: 'Tijd voor onderhoud - {{projectType}}',
    body: 'Beste {{customerName}},\n\nHet is alweer {{monthsAgo}} geleden dat we de {{projectType}} hebben uitgevoerd.\n\nTijd voor een onderhoudscheck om ervoor te zorgen dat alles nog optimaal werkt. Zal ik langskomen?\n\nMet vriendelijke groet,\n{{contractorName}}',
    variables: ['customerName', 'projectType', 'monthsAgo', 'contractorName'],
    responseRate: 0.58,
    conversionRate: 0.35,
  },
];

/** Demo fixture — empty in production builds (see src/config/demo.ts). */
const MOCK_TEMPLATES: FollowUpTemplate[] = DEMO_MODE ? DEMO_MOCK_TEMPLATES : [];

const DEFAULT_PREFERENCES: FollowUpPreferences = {
  enabled: true,
  autoSchedule: true,
  reminderLeadTime: 2,
  channels: {
    email: true,
    whatsapp: true,
    phone: false,
  },
  quietDays: [0], // Sunday
  workingHours: {
    start: '08:00',
    end: '18:00',
  },
};

// ============================================
// SERVICE CLASS
// ============================================

class FollowUpService {
  private customers: Map<string, Customer> = new Map();
  private followUps: Map<string, FollowUp> = new Map();
  private templates: Map<string, FollowUpTemplate> = new Map();
  private preferences: FollowUpPreferences = DEFAULT_PREFERENCES;
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_CUSTOMERS.forEach((c) => this.customers.set(c.id, c));
    MOCK_FOLLOW_UPS.forEach((f) => this.followUps.set(f.id, f));
    MOCK_TEMPLATES.forEach((t) => this.templates.set(t.id, t));
  }

  // -----------------------------------------
  // Follow-Up Management
  // -----------------------------------------

  /**
   * Get all follow-ups
   */
  getFollowUps(filter?: { status?: FollowUp['status']; type?: FollowUp['type'] }): FollowUp[] {
    let followUps = Array.from(this.followUps.values());

    if (filter?.status) {
      followUps = followUps.filter((f) => f.status === filter.status);
    }
    if (filter?.type) {
      followUps = followUps.filter((f) => f.type === filter.type);
    }

    // Sort by priority and due date
    return followUps.sort((a, b) => {
      // Overdue first
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;

      // Then by priority
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }

      // Then by due date
      return a.dueInDays - b.dueInDays;
    });
  }

  /**
   * Get due and overdue follow-ups
   */
  getDueFollowUps(): FollowUp[] {
    return this.getFollowUps().filter(
      (f) => f.status === 'due' || f.status === 'overdue'
    );
  }

  /**
   * Get follow-ups for today
   */
  getTodayFollowUps(): FollowUp[] {
    const today = new Date().toISOString().split('T')[0];
    return this.getFollowUps().filter(
      (f) => f.scheduledDate === today && f.status !== 'completed' && f.status !== 'cancelled'
    );
  }

  /**
   * Schedule a new follow-up
   */
  scheduleFollowUp(params: {
    customerId: string;
    type: FollowUp['type'];
    scheduledDate: string;
    scheduledTime?: string;
    relatedProjectId?: string;
    relatedQuoteId?: string;
    customMessage?: string;
  }): FollowUp {
    const customer = this.customers.get(params.customerId);
    if (!customer) throw new Error('Customer not found');

    const template = this.getBestTemplate(params.type);
    const message = params.customMessage || this.generateMessage(template, customer);

    const scheduledDate = new Date(params.scheduledDate);
    const today = new Date();
    const dueInDays = Math.ceil(
      (scheduledDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const followUp: FollowUp = {
      id: `fu_${Date.now()}`,
      customerId: params.customerId,
      customerName: customer.name,
      type: params.type,
      relatedProjectId: params.relatedProjectId,
      relatedQuoteId: params.relatedQuoteId,
      status: dueInDays <= 0 ? 'due' : 'scheduled',
      scheduledDate: params.scheduledDate,
      scheduledTime: params.scheduledTime || customer.bestContactTime?.split('-')[0],
      dueInDays,
      suggestedMessage: message,
      suggestedSubject: template?.subject,
      personalizationFactors: this.getPersonalizationFactors(customer, params.type),
      priority: this.calculatePriority(customer, params.type),
      confidence: 0.75,
      predictedResponseRate: this.predictResponseRate(customer, params.type),
      basedOn: ['Handmatig gepland'],
    };

    this.followUps.set(followUp.id, followUp);
    this.notifyListeners();

    trackUserAction('follow_up_scheduled', {
      followUpId: followUp.id,
      customerId: params.customerId,
      type: params.type,
    });

    return followUp;
  }

  /**
   * Complete a follow-up
   */
  completeFollowUp(followUpId: string, outcome: FollowUp['outcome'], notes?: string): void {
    const followUp = this.followUps.get(followUpId);
    if (!followUp) return;

    followUp.status = 'completed';
    followUp.outcome = outcome;
    followUp.completedAt = new Date().toISOString();
    followUp.notes = notes;

    // Update customer last contact
    const customer = this.customers.get(followUp.customerId);
    if (customer) {
      customer.lastContactDate = new Date().toISOString().split('T')[0];
    }

    this.notifyListeners();

    trackUserAction('follow_up_completed', {
      followUpId,
      outcome,
      type: followUp.type,
    });
  }

  /**
   * Snooze a follow-up
   */
  snoozeFollowUp(followUpId: string, days: number): void {
    const followUp = this.followUps.get(followUpId);
    if (!followUp) return;

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);

    followUp.status = 'snoozed';
    followUp.scheduledDate = newDate.toISOString().split('T')[0];
    followUp.dueInDays = days;

    this.notifyListeners();

    trackUserAction('follow_up_snoozed', {
      followUpId,
      days,
    });
  }

  /**
   * Cancel a follow-up
   */
  cancelFollowUp(followUpId: string, reason?: string): void {
    const followUp = this.followUps.get(followUpId);
    if (!followUp) return;

    followUp.status = 'cancelled';
    followUp.notes = reason;

    this.notifyListeners();

    trackUserAction('follow_up_cancelled', {
      followUpId,
      reason,
    });
  }

  /**
   * Update follow-up message
   */
  updateMessage(followUpId: string, message: string): void {
    const followUp = this.followUps.get(followUpId);
    if (followUp) {
      followUp.suggestedMessage = message;
      this.notifyListeners();
    }
  }

  // -----------------------------------------
  // Templates
  // -----------------------------------------

  /**
   * Get all templates
   */
  getTemplates(type?: FollowUp['type']): FollowUpTemplate[] {
    const templates = Array.from(this.templates.values());
    if (type) {
      return templates.filter((t) => t.type === type);
    }
    return templates;
  }

  /**
   * Get best template for a type
   */
  getBestTemplate(type: FollowUp['type']): FollowUpTemplate | undefined {
    const templates = this.getTemplates(type);
    return templates.sort((a, b) => b.responseRate - a.responseRate)[0];
  }

  /**
   * Generate message from template
   */
  private generateMessage(template: FollowUpTemplate | undefined, customer: Customer): string {
    if (!template) {
      return `Beste ${customer.name},\n\nIk wilde even contact opnemen.\n\nMet vriendelijke groet`;
    }

    let message = template.body;
    message = message.replace(/\{\{customerName\}\}/g, customer.name);
    message = message.replace(/\{\{contractorName\}\}/g, 'Jan'); // Would come from user profile
    message = message.replace(/\{\{daysAgo\}\}/g, 'Vorige week');
    message = message.replace(/\{\{weeksAgo\}\}/g, 'Een paar weken geleden');
    message = message.replace(/\{\{monthsAgo\}\}/g, '6 maanden');
    message = message.replace(/\{\{projectType\}\}/g, 'werkzaamheden');

    return message;
  }

  // -----------------------------------------
  // Smart Features
  // -----------------------------------------

  /**
   * Get personalization factors for a customer
   */
  private getPersonalizationFactors(customer: Customer, type: FollowUp['type']): string[] {
    const factors: string[] = [];

    if (customer.preferredContact) {
      factors.push(`Voorkeur: ${customer.preferredContact}`);
    }
    if (customer.bestContactTime) {
      factors.push(`Beste tijd: ${customer.bestContactTime}`);
    }
    if (customer.type === 'zakelijk') {
      factors.push('Zakelijke klant');
    }
    if (customer.totalRevenue > 5000) {
      factors.push('Hoge klantwaarde');
    }
    if (customer.totalProjects > 2) {
      factors.push('Terugkerende klant');
    }

    return factors;
  }

  /**
   * Calculate priority based on customer and type
   */
  private calculatePriority(customer: Customer, type: FollowUp['type']): FollowUp['priority'] {
    // High priority for valuable customers and urgent types
    if (customer.totalRevenue > 5000 && type === 'quote_reminder') return 'high';
    if (type === 'quote_reminder' && customer.avgResponseTime && customer.avgResponseTime < 6) return 'high';
    if (type === 'post_project') return 'medium';
    if (type === 'seasonal') return 'low';
    return 'medium';
  }

  /**
   * Predict response rate
   */
  private predictResponseRate(customer: Customer, type: FollowUp['type']): number {
    let baseRate = 0.5;

    // Adjust based on customer history
    if (customer.avgResponseTime && customer.avgResponseTime < 6) baseRate += 0.15;
    if (customer.totalProjects > 2) baseRate += 0.1;

    // Adjust based on type
    const typeRates: Record<FollowUp['type'], number> = {
      quote_reminder: 0.65,
      project_check_in: 0.55,
      post_project: 0.50,
      maintenance_reminder: 0.58,
      seasonal: 0.35,
      anniversary: 0.40,
    };
    baseRate = (baseRate + typeRates[type]) / 2;

    return Math.min(baseRate, 0.95);
  }

  /**
   * Get suggested follow-ups based on project/quote status
   */
  getSuggestedFollowUps(): Array<{
    customerId: string;
    customerName: string;
    type: FollowUp['type'];
    reason: string;
    suggestedDate: string;
    priority: FollowUp['priority'];
  }> {
    // In production, this would analyze open quotes, recent projects, etc.
    return [
      {
        customerId: 'cust_2',
        customerName: 'Bakkerij Jansen',
        type: 'quote_reminder',
        reason: 'Offerte 7 dagen zonder reactie',
        suggestedDate: new Date().toISOString().split('T')[0],
        priority: 'high',
      },
      {
        customerId: 'cust_1',
        customerName: 'Familie de Vries',
        type: 'maintenance_reminder',
        reason: '1 jaar sinds badkamerrenovatie',
        suggestedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        priority: 'medium',
      },
    ];
  }

  // -----------------------------------------
  // Statistics
  // -----------------------------------------

  /**
   * Get follow-up statistics
   */
  getStatistics(): FollowUpStatistics {
    const followUps = Array.from(this.followUps.values());
    const completed = followUps.filter((f) => f.status === 'completed');
    const responded = completed.filter((f) => f.outcome === 'responded' || f.outcome === 'converted');
    const converted = completed.filter((f) => f.outcome === 'converted');

    // Find top performing type
    const typePerformance: Record<string, number> = {};
    completed.forEach((f) => {
      if (f.outcome === 'converted') {
        typePerformance[f.type] = (typePerformance[f.type] || 0) + 1;
      }
    });
    const topType = Object.entries(typePerformance).sort((a, b) => b[1] - a[1])[0];

    return {
      totalFollowUps: followUps.length,
      completedThisMonth: completed.length,
      responseRate: completed.length > 0 ? Math.round((responded.length / completed.length) * 100) : 0,
      conversionRate: completed.length > 0 ? Math.round((converted.length / completed.length) * 100) : 0,
      avgResponseTime: 6,
      topPerformingType: (topType?.[0] as FollowUp['type']) || 'quote_reminder',
      savedDealValue: 8500,
    };
  }

  // -----------------------------------------
  // Preferences
  // -----------------------------------------

  getPreferences(): FollowUpPreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<FollowUpPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    trackUserAction('follow_up_preferences_updated', updates);
  }

  // -----------------------------------------
  // Customers
  // -----------------------------------------

  getCustomers(): Customer[] {
    return Array.from(this.customers.values());
  }

  getCustomer(customerId: string): Customer | undefined {
    return this.customers.get(customerId);
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const followUpService = new FollowUpService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useFollowUps(filter?: { status?: FollowUp['status']; type?: FollowUp['type'] }) {
  const [followUps, setFollowUps] = useState<FollowUp[]>(() =>
    followUpService.getFollowUps(filter)
  );

  useEffect(() => {
    const unsubscribe = followUpService.subscribe(() => {
      setFollowUps(followUpService.getFollowUps(filter));
    });
    return unsubscribe;
  }, [filter?.status, filter?.type]);

  const scheduleFollowUp = useCallback(
    (params: Parameters<typeof followUpService.scheduleFollowUp>[0]) => {
      return followUpService.scheduleFollowUp(params);
    },
    []
  );

  const completeFollowUp = useCallback(
    (followUpId: string, outcome: FollowUp['outcome'], notes?: string) => {
      followUpService.completeFollowUp(followUpId, outcome, notes);
    },
    []
  );

  const snoozeFollowUp = useCallback((followUpId: string, days: number) => {
    followUpService.snoozeFollowUp(followUpId, days);
  }, []);

  const cancelFollowUp = useCallback((followUpId: string, reason?: string) => {
    followUpService.cancelFollowUp(followUpId, reason);
  }, []);

  const dueCount = useMemo(
    () => followUps.filter((f) => f.status === 'due' || f.status === 'overdue').length,
    [followUps]
  );

  return {
    followUps,
    dueCount,
    scheduleFollowUp,
    completeFollowUp,
    snoozeFollowUp,
    cancelFollowUp,
    todayFollowUps: followUpService.getTodayFollowUps(),
    suggestedFollowUps: followUpService.getSuggestedFollowUps(),
    statistics: followUpService.getStatistics(),
  };
}

export function useFollowUpTemplates(type?: FollowUp['type']) {
  return useMemo(() => followUpService.getTemplates(type), [type]);
}

export function useFollowUpPreferences() {
  const [preferences, setPreferences] = useState<FollowUpPreferences>(
    followUpService.getPreferences()
  );

  const updatePreferences = useCallback((updates: Partial<FollowUpPreferences>) => {
    followUpService.updatePreferences(updates);
    setPreferences(followUpService.getPreferences());
  }, []);

  return { preferences, updatePreferences };
}

export function useCustomers() {
  return useMemo(() => followUpService.getCustomers(), []);
}
