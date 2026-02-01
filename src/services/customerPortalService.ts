// =============================================================================
// CUSTOMER PORTAL SERVICE
// =============================================================================
// Customer-facing portal for project tracking, quotes, and communication
// Captures customer preferences that feed into contractor intelligence
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';

// ============================================
// TYPES
// ============================================

export interface CustomerProject {
  id: string;
  customerId: string;
  title: string;
  description: string;
  status: 'quote_pending' | 'quote_approved' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

  // Timeline
  createdAt: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;

  // Financials
  quoteAmount: number;
  paidAmount: number;
  paymentStatus: 'pending' | 'partial' | 'paid';

  // Progress
  progressPercent: number;
  milestones: ProjectMilestone[];
  updates: ProjectUpdate[];
  photos: ProjectPhoto[];
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  completedAt?: string;
}

export interface ProjectUpdate {
  id: string;
  type: 'status' | 'photo' | 'message' | 'milestone';
  message: string;
  timestamp: string;
  readByCustomer: boolean;
}

export interface ProjectPhoto {
  id: string;
  url: string;
  caption?: string;
  type: 'before' | 'during' | 'after';
  timestamp: string;
}

export interface CustomerQuote {
  id: string;
  projectId: string;
  title: string;
  description: string;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  validUntil: string;
  status: 'pending' | 'approved' | 'declined' | 'expired';
  createdAt: string;
  respondedAt?: string;
  customerNotes?: string;
}

export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CustomerMessage {
  id: string;
  projectId?: string;
  direction: 'incoming' | 'outgoing';
  content: string;
  timestamp: string;
  read: boolean;
}

export interface MaintenanceRequest {
  id: string;
  projectId?: string;
  type: 'warranty' | 'maintenance' | 'new_work';
  description: string;
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'scheduled' | 'completed';
  createdAt: string;
  scheduledDate?: string;
}

export interface CustomerPreferences {
  communicationPreference: 'email' | 'phone' | 'whatsapp' | 'app';
  preferredContactTime: string;
  allowPhotos: boolean;
  allowUpdates: boolean;
  marketingOptIn: boolean;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_PROJECTS: CustomerProject[] = [
  {
    id: 'proj_1',
    customerId: 'cust_portal_1',
    title: 'Badkamerrenovatie',
    description: 'Complete renovatie van de badkamer op de eerste verdieping',
    status: 'in_progress',
    createdAt: '2025-01-10',
    scheduledStart: '2025-01-20',
    scheduledEnd: '2025-02-05',
    actualStart: '2025-01-20',
    quoteAmount: 8500,
    paidAmount: 4250,
    paymentStatus: 'partial',
    progressPercent: 65,
    milestones: [
      { id: 'm1', title: 'Sloopwerk', status: 'completed', completedAt: '2025-01-22' },
      { id: 'm2', title: 'Sanitair installatie', status: 'completed', completedAt: '2025-01-26' },
      { id: 'm3', title: 'Tegelwerk', status: 'in_progress', dueDate: '2025-01-31' },
      { id: 'm4', title: 'Afwerking', status: 'pending', dueDate: '2025-02-03' },
    ],
    updates: [
      { id: 'u1', type: 'status', message: 'Project gestart', timestamp: '2025-01-20T09:00:00Z', readByCustomer: true },
      { id: 'u2', type: 'milestone', message: 'Sloopwerk afgerond', timestamp: '2025-01-22T16:00:00Z', readByCustomer: true },
      { id: 'u3', type: 'photo', message: 'Foto\'s van de voortgang toegevoegd', timestamp: '2025-01-25T14:00:00Z', readByCustomer: true },
      { id: 'u4', type: 'milestone', message: 'Sanitair installatie compleet', timestamp: '2025-01-26T17:00:00Z', readByCustomer: false },
    ],
    photos: [
      { id: 'p1', url: 'https://example.com/before.jpg', caption: 'Voor aanvang werkzaamheden', type: 'before', timestamp: '2025-01-20T08:00:00Z' },
      { id: 'p2', url: 'https://example.com/during1.jpg', caption: 'Na sloopwerk', type: 'during', timestamp: '2025-01-22T16:00:00Z' },
      { id: 'p3', url: 'https://example.com/during2.jpg', caption: 'Sanitair geïnstalleerd', type: 'during', timestamp: '2025-01-26T15:00:00Z' },
    ],
  },
  {
    id: 'proj_2',
    customerId: 'cust_portal_1',
    title: 'Keuken schilderwerk',
    description: 'Schilderen van keukenkasten en muren',
    status: 'completed',
    createdAt: '2024-11-01',
    scheduledStart: '2024-11-15',
    scheduledEnd: '2024-11-18',
    actualStart: '2024-11-15',
    actualEnd: '2024-11-17',
    quoteAmount: 1850,
    paidAmount: 1850,
    paymentStatus: 'paid',
    progressPercent: 100,
    milestones: [
      { id: 'm1', title: 'Voorbereiding', status: 'completed', completedAt: '2024-11-15' },
      { id: 'm2', title: 'Schilderen', status: 'completed', completedAt: '2024-11-17' },
    ],
    updates: [],
    photos: [
      { id: 'p1', url: 'https://example.com/kitchen-after.jpg', caption: 'Eindresultaat', type: 'after', timestamp: '2024-11-17T16:00:00Z' },
    ],
  },
];

const MOCK_QUOTES: CustomerQuote[] = [
  {
    id: 'quote_1',
    projectId: 'proj_1',
    title: 'Badkamerrenovatie',
    description: 'Complete renovatie inclusief sanitair en tegelwerk',
    items: [
      { description: 'Sloopwerk en afvoer', quantity: 1, unitPrice: 850, total: 850 },
      { description: 'Sanitair installatie', quantity: 1, unitPrice: 2500, total: 2500 },
      { description: 'Tegelwerk (materiaal + arbeid)', quantity: 12, unitPrice: 350, total: 4200 },
      { description: 'Afwerking en schoonmaak', quantity: 1, unitPrice: 950, total: 950 },
    ],
    subtotal: 8500,
    tax: 1785,
    total: 10285,
    validUntil: '2025-01-25',
    status: 'approved',
    createdAt: '2025-01-10',
    respondedAt: '2025-01-12',
  },
  {
    id: 'quote_2',
    projectId: '',
    title: 'Zolder isolatie',
    description: 'Isolatie van zoldervloer en dakkapel',
    items: [
      { description: 'Isolatiemateriaal', quantity: 45, unitPrice: 35, total: 1575 },
      { description: 'Arbeid installatie', quantity: 16, unitPrice: 55, total: 880 },
      { description: 'Afwerking', quantity: 1, unitPrice: 450, total: 450 },
    ],
    subtotal: 2905,
    tax: 610.05,
    total: 3515.05,
    validUntil: '2025-02-15',
    status: 'pending',
    createdAt: '2025-01-28',
  },
];

const MOCK_MESSAGES: CustomerMessage[] = [
  { id: 'msg_1', projectId: 'proj_1', direction: 'outgoing', content: 'Wanneer verwacht u klaar te zijn met het tegelwerk?', timestamp: '2025-01-27T10:00:00Z', read: true },
  { id: 'msg_2', projectId: 'proj_1', direction: 'incoming', content: 'Het tegelwerk zou vrijdag af moeten zijn, daarna nog 2 dagen voor de afwerking.', timestamp: '2025-01-27T10:30:00Z', read: true },
  { id: 'msg_3', projectId: 'proj_1', direction: 'outgoing', content: 'Perfect, bedankt voor de update!', timestamp: '2025-01-27T11:00:00Z', read: true },
];

// ============================================
// SERVICE CLASS
// ============================================

class CustomerPortalService {
  private projects: Map<string, CustomerProject> = new Map();
  private quotes: Map<string, CustomerQuote> = new Map();
  private messages: Map<string, CustomerMessage> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    MOCK_PROJECTS.forEach((p) => this.projects.set(p.id, p));
    MOCK_QUOTES.forEach((q) => this.quotes.set(q.id, q));
    MOCK_MESSAGES.forEach((m) => this.messages.set(m.id, m));
  }

  // -----------------------------------------
  // Projects
  // -----------------------------------------

  getProjects(customerId?: string): CustomerProject[] {
    let projects = Array.from(this.projects.values());
    if (customerId) {
      projects = projects.filter((p) => p.customerId === customerId);
    }
    return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getProject(projectId: string): CustomerProject | undefined {
    return this.projects.get(projectId);
  }

  getActiveProjects(): CustomerProject[] {
    return this.getProjects().filter((p) =>
      p.status === 'scheduled' || p.status === 'in_progress'
    );
  }

  // -----------------------------------------
  // Quotes
  // -----------------------------------------

  getQuotes(status?: CustomerQuote['status']): CustomerQuote[] {
    let quotes = Array.from(this.quotes.values());
    if (status) {
      quotes = quotes.filter((q) => q.status === status);
    }
    return quotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getQuote(quoteId: string): CustomerQuote | undefined {
    return this.quotes.get(quoteId);
  }

  approveQuote(quoteId: string, notes?: string): void {
    const quote = this.quotes.get(quoteId);
    if (quote && quote.status === 'pending') {
      quote.status = 'approved';
      quote.respondedAt = new Date().toISOString();
      quote.customerNotes = notes;
      this.notifyListeners();

      trackUserAction('quote_approved_by_customer', {
        quoteId,
        total: quote.total,
      });
    }
  }

  declineQuote(quoteId: string, reason?: string): void {
    const quote = this.quotes.get(quoteId);
    if (quote && quote.status === 'pending') {
      quote.status = 'declined';
      quote.respondedAt = new Date().toISOString();
      quote.customerNotes = reason;
      this.notifyListeners();

      trackUserAction('quote_declined_by_customer', {
        quoteId,
        reason,
      });
    }
  }

  // -----------------------------------------
  // Messages
  // -----------------------------------------

  getMessages(projectId?: string): CustomerMessage[] {
    let messages = Array.from(this.messages.values());
    if (projectId) {
      messages = messages.filter((m) => m.projectId === projectId);
    }
    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  sendMessage(content: string, projectId?: string): CustomerMessage {
    const message: CustomerMessage = {
      id: `msg_${Date.now()}`,
      projectId,
      direction: 'outgoing',
      content,
      timestamp: new Date().toISOString(),
      read: true,
    };
    this.messages.set(message.id, message);
    this.notifyListeners();

    trackUserAction('customer_message_sent', {
      projectId,
      messageLength: content.length,
    });

    return message;
  }

  getUnreadCount(): number {
    return Array.from(this.messages.values()).filter(
      (m) => m.direction === 'incoming' && !m.read
    ).length;
  }

  // -----------------------------------------
  // Maintenance Requests
  // -----------------------------------------

  submitMaintenanceRequest(params: {
    projectId?: string;
    type: MaintenanceRequest['type'];
    description: string;
    urgency: MaintenanceRequest['urgency'];
  }): MaintenanceRequest {
    const request: MaintenanceRequest = {
      id: `maint_${Date.now()}`,
      ...params,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    trackUserAction('maintenance_request_submitted', {
      type: params.type,
      urgency: params.urgency,
    });

    return request;
  }

  // -----------------------------------------
  // Statistics
  // -----------------------------------------

  getPortalStatistics(): {
    activeProjects: number;
    completedProjects: number;
    pendingQuotes: number;
    totalSpent: number;
    unreadMessages: number;
  } {
    const projects = this.getProjects();
    const quotes = this.getQuotes();

    return {
      activeProjects: projects.filter((p) => p.status === 'in_progress' || p.status === 'scheduled').length,
      completedProjects: projects.filter((p) => p.status === 'completed').length,
      pendingQuotes: quotes.filter((q) => q.status === 'pending').length,
      totalSpent: projects.reduce((sum, p) => sum + p.paidAmount, 0),
      unreadMessages: this.getUnreadCount(),
    };
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

export const customerPortalService = new CustomerPortalService();

// ============================================
// REACT HOOKS
// ============================================

import { useState, useEffect, useCallback } from 'react';

export function useCustomerProjects(customerId?: string) {
  const [projects, setProjects] = useState<CustomerProject[]>(() =>
    customerPortalService.getProjects(customerId)
  );

  useEffect(() => {
    const unsubscribe = customerPortalService.subscribe(() => {
      setProjects(customerPortalService.getProjects(customerId));
    });
    return unsubscribe;
  }, [customerId]);

  return {
    projects,
    activeProjects: projects.filter((p) => p.status === 'in_progress' || p.status === 'scheduled'),
    statistics: customerPortalService.getPortalStatistics(),
  };
}

export function useCustomerQuotes(status?: CustomerQuote['status']) {
  const [quotes, setQuotes] = useState<CustomerQuote[]>(() =>
    customerPortalService.getQuotes(status)
  );

  useEffect(() => {
    const unsubscribe = customerPortalService.subscribe(() => {
      setQuotes(customerPortalService.getQuotes(status));
    });
    return unsubscribe;
  }, [status]);

  const approveQuote = useCallback((quoteId: string, notes?: string) => {
    customerPortalService.approveQuote(quoteId, notes);
  }, []);

  const declineQuote = useCallback((quoteId: string, reason?: string) => {
    customerPortalService.declineQuote(quoteId, reason);
  }, []);

  return { quotes, approveQuote, declineQuote };
}

export function useCustomerMessages(projectId?: string) {
  const [messages, setMessages] = useState<CustomerMessage[]>(() =>
    customerPortalService.getMessages(projectId)
  );

  useEffect(() => {
    const unsubscribe = customerPortalService.subscribe(() => {
      setMessages(customerPortalService.getMessages(projectId));
    });
    return unsubscribe;
  }, [projectId]);

  const sendMessage = useCallback((content: string) => {
    return customerPortalService.sendMessage(content, projectId);
  }, [projectId]);

  return {
    messages,
    sendMessage,
    unreadCount: customerPortalService.getUnreadCount(),
  };
}
