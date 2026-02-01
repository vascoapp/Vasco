// =============================================================================
// AI BUSINESS ASSISTANT SERVICE
// =============================================================================
// Contextual AI assistant with proactive recommendations, Q&A capabilities,
// and business optimization suggestions based on user data patterns
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    suggestionType?: string;
    actionable?: boolean;
    relatedData?: any;
  };
}

export interface AssistantConversation {
  id: string;
  title: string;
  messages: AssistantMessage[];
  createdAt: string;
  updatedAt: string;
  context?: string;
}

export interface ProactiveInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'tip' | 'milestone' | 'reminder';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionLabel?: string;
  actionRoute?: string;
  data?: Record<string, any>;
  expiresAt?: string;
  dismissed: boolean;
  createdAt: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  category: 'quotes' | 'scheduling' | 'finance' | 'customers' | 'general';
}

export interface AssistantCapability {
  id: string;
  name: string;
  description: string;
  examples: string[];
  category: string;
}

export interface BusinessSuggestion {
  id: string;
  type: 'pricing' | 'scheduling' | 'customer' | 'inventory' | 'marketing' | 'efficiency';
  title: string;
  description: string;
  potentialImpact: string;
  confidence: number;
  basedOn: string;
  actionSteps: string[];
}

export interface AssistantContext {
  currentScreen?: string;
  selectedProject?: string;
  selectedCustomer?: string;
  recentActions?: string[];
  userPreferences?: Record<string, any>;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_INSIGHTS: ProactiveInsight[] = [
  {
    id: 'insight_1',
    type: 'opportunity',
    priority: 'high',
    title: 'Badkamer seizoen begint',
    description: 'Maart-mei is piekseizoen voor badkamerrenovaties. Overweeg gerichte marketing.',
    actionLabel: 'Marketing tips',
    data: { seasonStart: 'maart', avgIncrease: '35%' },
    dismissed: false,
    createdAt: '2025-02-01T08:00:00',
  },
  {
    id: 'insight_2',
    type: 'warning',
    priority: 'high',
    title: '2 facturen zijn verlopen',
    description: 'Familie de Vries en Bakkerij Jansen hebben openstaande facturen van meer dan 14 dagen.',
    actionLabel: 'Bekijk facturen',
    actionRoute: '/cash-flow',
    data: { overdueAmount: 10950, customers: ['Familie de Vries', 'Bakkerij Jansen'] },
    dismissed: false,
    createdAt: '2025-02-01T07:00:00',
  },
  {
    id: 'insight_3',
    type: 'tip',
    priority: 'medium',
    title: 'Optimaliseer je planning',
    description: 'Je hebt 3 afspraken in Amsterdam-Zuid deze week. Combineer voor minder reistijd.',
    actionLabel: 'Bekijk planning',
    actionRoute: '/schedule',
    data: { potentialSaving: '45 minuten' },
    dismissed: false,
    createdAt: '2025-02-01T06:00:00',
  },
  {
    id: 'insight_4',
    type: 'milestone',
    priority: 'low',
    title: 'Nieuwe mijlpaal bereikt!',
    description: 'Je hebt deze maand €30.000+ omzet behaald. Dit is 15% meer dan vorige maand!',
    dismissed: false,
    createdAt: '2025-01-31T18:00:00',
  },
  {
    id: 'insight_5',
    type: 'reminder',
    priority: 'medium',
    title: 'VCA certificaat verloopt',
    description: 'Je VCA certificaat verloopt over 4 maanden. Plan de hernieuwing.',
    actionLabel: 'Documenten',
    actionRoute: '/documents',
    data: { expiryDate: '2025-06-01', document: 'VCA Certificaat' },
    dismissed: false,
    createdAt: '2025-02-01T09:00:00',
  },
];

const MOCK_QUICK_ACTIONS: QuickAction[] = [
  { id: 'qa_1', label: 'Maak een offerte', icon: 'document-text-outline', prompt: 'Help me een offerte maken', category: 'quotes' },
  { id: 'qa_2', label: 'Plan een afspraak', icon: 'calendar-outline', prompt: 'Plan een nieuwe afspraak in mijn agenda', category: 'scheduling' },
  { id: 'qa_3', label: 'Bekijk mijn omzet', icon: 'trending-up-outline', prompt: 'Wat is mijn omzet deze maand?', category: 'finance' },
  { id: 'qa_4', label: 'Stuur herinnering', icon: 'mail-outline', prompt: 'Stuur een betalingsherinnering', category: 'finance' },
  { id: 'qa_5', label: 'Voeg uitgave toe', icon: 'receipt-outline', prompt: 'Voeg een nieuwe uitgave toe', category: 'finance' },
  { id: 'qa_6', label: 'Zoek klantinfo', icon: 'person-outline', prompt: 'Zoek informatie over een klant', category: 'customers' },
];

const MOCK_CAPABILITIES: AssistantCapability[] = [
  {
    id: 'cap_1',
    name: 'Offertes',
    description: 'Help bij het maken en optimaliseren van offertes',
    examples: ['Maak een offerte voor schilderwerk', 'Wat is een goede prijs voor badkamerrenovatie?', 'Optimaliseer mijn offerte'],
    category: 'quotes',
  },
  {
    id: 'cap_2',
    name: 'Planning',
    description: 'Beheer je agenda en optimaliseer je planning',
    examples: ['Plan een afspraak volgende week', 'Wanneer heb ik tijd vrij?', 'Optimaliseer mijn reisroute'],
    category: 'scheduling',
  },
  {
    id: 'cap_3',
    name: 'Financiën',
    description: 'Inzicht in je financiële situatie',
    examples: ['Hoeveel omzet heb ik deze maand?', 'Welke facturen staan open?', 'Wat zijn mijn grootste uitgaven?'],
    category: 'finance',
  },
  {
    id: 'cap_4',
    name: 'Klanten',
    description: 'Klantinformatie en -beheer',
    examples: ['Hoeveel projecten heb ik gedaan voor [klant]?', 'Wanneer was mijn laatste contact met [klant]?', 'Wie zijn mijn beste klanten?'],
    category: 'customers',
  },
  {
    id: 'cap_5',
    name: 'Analyses',
    description: 'Bedrijfsanalyses en inzichten',
    examples: ['Hoe presteer ik vergeleken met vorig jaar?', 'Wat zijn mijn meest winstgevende projecten?', 'Waar kan ik verbeteren?'],
    category: 'analytics',
  },
];

const MOCK_SUGGESTIONS: BusinessSuggestion[] = [
  {
    id: 'sug_1',
    type: 'pricing',
    title: 'Verhoog je tarieven voor badkamerwerk',
    description: 'Je badkamertarieven liggen 12% onder het marktgemiddelde terwijl je reviews uitstekend zijn.',
    potentialImpact: '+€2.400/maand',
    confidence: 0.85,
    basedOn: 'Marktanalyse en jouw reviews',
    actionSteps: ['Verhoog tarief met 10%', 'Benadruk kwaliteit in offertes', 'Monitor acceptatieratio'],
  },
  {
    id: 'sug_2',
    type: 'customer',
    title: 'Win terugkerende klanten',
    description: '8 klanten hebben >2 jaar geleden een project gehad. Ideaal voor onderhoudswerkzaamheden.',
    potentialImpact: '€4.000-8.000 extra omzet',
    confidence: 0.72,
    basedOn: 'Klanthistorie analyse',
    actionSteps: ['Stuur persoonlijke check-in', 'Bied onderhoudscontract aan', 'Vraag naar nieuwe projecten'],
  },
  {
    id: 'sug_3',
    type: 'efficiency',
    title: 'Batch je offertebezoeken',
    description: 'Je maakt gemiddeld 3 losse offertebezoeken per week. Combineren bespaart 2 uur reistijd.',
    potentialImpact: '8 uur/maand bespaard',
    confidence: 0.9,
    basedOn: 'Planningsanalyse',
    actionSteps: ['Plan offertebezoeken op vaste dagen', 'Groepeer per regio', 'Gebruik route-optimalisatie'],
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class AIAssistantService {
  private conversations: Map<string, AssistantConversation> = new Map();
  private insights: Map<string, ProactiveInsight> = new Map();
  private context: AssistantContext = {};
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_INSIGHTS.forEach((i) => this.insights.set(i.id, i));
  }

  // -----------------------------------------
  // Conversations
  // -----------------------------------------

  startConversation(initialMessage?: string): AssistantConversation {
    const conversation: AssistantConversation = {
      id: `conv_${Date.now()}`,
      title: 'Nieuw gesprek',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (initialMessage) {
      conversation.messages.push({
        id: `msg_${Date.now()}`,
        role: 'user',
        content: initialMessage,
        timestamp: new Date().toISOString(),
      });

      // Generate response
      const response = this.generateResponse(initialMessage);
      conversation.messages.push(response);
      conversation.title = this.generateTitle(initialMessage);
    }

    this.conversations.set(conversation.id, conversation);
    trackUserAction('assistant_conversation_started', { conversationId: conversation.id });
    return conversation;
  }

  sendMessage(conversationId: string, message: string): AssistantMessage {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    const userMessage: AssistantMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    conversation.messages.push(userMessage);

    const response = this.generateResponse(message);
    conversation.messages.push(response);
    conversation.updatedAt = new Date().toISOString();

    this.notifyListeners();
    trackUserAction('assistant_message_sent', { conversationId });

    return response;
  }

  private generateResponse(message: string): AssistantMessage {
    const lowerMessage = message.toLowerCase();
    let content = '';
    let metadata: AssistantMessage['metadata'] = {};

    // Simple response logic - in production this would be AI-powered
    if (lowerMessage.includes('omzet') || lowerMessage.includes('revenue')) {
      content = 'Je omzet deze maand is €32.450, dat is 12% meer dan vorige maand (€28.900). Je beste presterende categorie is badkamerrenovaties met €12.400.';
      metadata = { suggestionType: 'finance', actionable: false };
    } else if (lowerMessage.includes('offerte') || lowerMessage.includes('quote')) {
      content = 'Ik kan je helpen met je offerte! Op basis van vergelijkbare projecten en marktdata raad ik de volgende prijsrange aan. Wil je dat ik een conceptofferte genereer?';
      metadata = { suggestionType: 'quotes', actionable: true };
    } else if (lowerMessage.includes('planning') || lowerMessage.includes('agenda') || lowerMessage.includes('afspraak')) {
      content = 'Je hebt deze week 4 afspraken gepland. Er zijn nog 2 slots beschikbaar op donderdag en vrijdag. Wil je een overzicht van je beschikbare tijden?';
      metadata = { suggestionType: 'scheduling', actionable: true };
    } else if (lowerMessage.includes('factuur') || lowerMessage.includes('betaling')) {
      content = 'Je hebt 2 openstaande facturen ter waarde van €10.950. De oudste is 16 dagen verlopen. Zal ik een betalingsherinnering klaarzetten?';
      metadata = { suggestionType: 'finance', actionable: true };
    } else if (lowerMessage.includes('klant')) {
      content = 'Je hebt 127 klanten in je database. 42% zijn terugkerende klanten. Je beste klant qua omzet is Bakkerij Jansen met €24.500 totaal. Over welke klant wil je meer weten?';
      metadata = { suggestionType: 'customers', actionable: false };
    } else if (lowerMessage.includes('tip') || lowerMessage.includes('advies') || lowerMessage.includes('verbeteren')) {
      content = 'Op basis van je data heb ik 3 suggesties:\n\n1. **Verhoog badkamertarieven** - Je ligt 12% onder markt\n2. **Win oude klanten terug** - 8 klanten zijn rijp voor follow-up\n3. **Batch offertebezoeken** - Bespaar 8 uur/maand\n\nWil je details over één van deze suggesties?';
      metadata = { suggestionType: 'optimization', actionable: true };
    } else {
      content = 'Ik kan je helpen met offertes, planning, financiën, klantbeheer en bedrijfsanalyses. Wat wil je weten of doen?';
      metadata = { suggestionType: 'general', actionable: false };
    }

    return {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }

  private generateTitle(message: string): string {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('omzet')) return 'Omzet vraag';
    if (lowerMessage.includes('offerte')) return 'Offerte hulp';
    if (lowerMessage.includes('planning')) return 'Planning';
    if (lowerMessage.includes('factuur')) return 'Facturen';
    if (lowerMessage.includes('klant')) return 'Klantinfo';
    return 'Gesprek';
  }

  getConversation(conversationId: string): AssistantConversation | undefined {
    return this.conversations.get(conversationId);
  }

  getRecentConversations(limit: number = 10): AssistantConversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);
  }

  // -----------------------------------------
  // Proactive Insights
  // -----------------------------------------

  getInsights(filter?: { type?: ProactiveInsight['type']; dismissed?: boolean }): ProactiveInsight[] {
    let insights = Array.from(this.insights.values());
    if (filter?.type) insights = insights.filter((i) => i.type === filter.type);
    if (filter?.dismissed !== undefined) insights = insights.filter((i) => i.dismissed === filter.dismissed);
    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  dismissInsight(insightId: string): void {
    const insight = this.insights.get(insightId);
    if (insight) {
      insight.dismissed = true;
      this.notifyListeners();
      trackUserAction('insight_dismissed', { insightId, type: insight.type });
    }
  }

  getActiveInsightCount(): number {
    return this.getInsights({ dismissed: false }).length;
  }

  // -----------------------------------------
  // Quick Actions & Capabilities
  // -----------------------------------------

  getQuickActions(): QuickAction[] {
    return MOCK_QUICK_ACTIONS;
  }

  getCapabilities(): AssistantCapability[] {
    return MOCK_CAPABILITIES;
  }

  // -----------------------------------------
  // Business Suggestions
  // -----------------------------------------

  getBusinessSuggestions(): BusinessSuggestion[] {
    return MOCK_SUGGESTIONS;
  }

  // -----------------------------------------
  // Context Management
  // -----------------------------------------

  setContext(context: Partial<AssistantContext>): void {
    this.context = { ...this.context, ...context };
    trackUserAction('assistant_context_updated', { context: Object.keys(context) });
  }

  getContext(): AssistantContext {
    return this.context;
  }

  // -----------------------------------------
  // Subscription
  // -----------------------------------------

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l());
  }
}

export const aiAssistantService = new AIAssistantService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react';

export function useAssistant() {
  const [conversation, setConversation] = useState<AssistantConversation | null>(null);

  const startConversation = useCallback((initialMessage?: string) => {
    const conv = aiAssistantService.startConversation(initialMessage);
    setConversation(conv);
    return conv;
  }, []);

  const sendMessage = useCallback((message: string) => {
    if (!conversation) {
      const conv = aiAssistantService.startConversation(message);
      setConversation(conv);
      return conv.messages[conv.messages.length - 1];
    }

    const response = aiAssistantService.sendMessage(conversation.id, message);
    setConversation({ ...aiAssistantService.getConversation(conversation.id)! });
    return response;
  }, [conversation]);

  const quickActions = useMemo(() => aiAssistantService.getQuickActions(), []);
  const capabilities = useMemo(() => aiAssistantService.getCapabilities(), []);

  return {
    conversation,
    startConversation,
    sendMessage,
    quickActions,
    capabilities,
    setContext: aiAssistantService.setContext.bind(aiAssistantService),
  };
}

export function useProactiveInsights(showDismissed: boolean = false) {
  const [insights, setInsights] = useState<ProactiveInsight[]>(() =>
    aiAssistantService.getInsights({ dismissed: showDismissed ? undefined : false })
  );

  useEffect(() => {
    const unsubscribe = aiAssistantService.subscribe(() => {
      setInsights(aiAssistantService.getInsights({ dismissed: showDismissed ? undefined : false }));
    });
    return unsubscribe;
  }, [showDismissed]);

  const dismissInsight = useCallback((insightId: string) => {
    aiAssistantService.dismissInsight(insightId);
  }, []);

  const activeCount = useMemo(() => aiAssistantService.getActiveInsightCount(), [insights]);

  return { insights, dismissInsight, activeCount };
}

export function useBusinessSuggestions() {
  return useMemo(() => aiAssistantService.getBusinessSuggestions(), []);
}

export function useConversationHistory() {
  const [conversations, setConversations] = useState<AssistantConversation[]>(() =>
    aiAssistantService.getRecentConversations()
  );

  useEffect(() => {
    const unsubscribe = aiAssistantService.subscribe(() => {
      setConversations(aiAssistantService.getRecentConversations());
    });
    return unsubscribe;
  }, []);

  return conversations;
}
