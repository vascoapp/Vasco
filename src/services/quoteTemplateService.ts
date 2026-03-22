// =============================================================================
// QUOTE TEMPLATE SERVICE
// =============================================================================
// Save, manage, and reuse quote templates for common job types
// =============================================================================

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface QuoteTemplateItem {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
  type: 'labour' | 'materials' | 'equipment' | 'other';
}

export interface QuoteTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description?: string;
  items: QuoteTemplateItem[];
  defaultVatRate: number;
  defaultPaymentTerms: string;
  estimatedDuration?: string;
  subtotal: number;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
}

export type TemplateCategory =
  | 'cv-onderhoud'
  | 'warmtepomp'
  | 'airco'
  | 'leidingwerk'
  | 'badkamer'
  | 'keuken'
  | 'elektra'
  | 'overig';

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: string }[] = [
  { id: 'cv-onderhoud', label: 'CV Onderhoud', icon: 'flame-outline' },
  { id: 'warmtepomp', label: 'Warmtepomp', icon: 'snow-outline' },
  { id: 'airco', label: 'Airco', icon: 'thermometer-outline' },
  { id: 'leidingwerk', label: 'Leidingwerk', icon: 'water-outline' },
  { id: 'badkamer', label: 'Badkamer', icon: 'water-outline' },
  { id: 'keuken', label: 'Keuken', icon: 'restaurant-outline' },
  { id: 'elektra', label: 'Elektra', icon: 'flash-outline' },
  { id: 'overig', label: 'Overig', icon: 'ellipsis-horizontal-outline' },
];

// =============================================================================
// MOCK DATA
// =============================================================================

const mockTemplates: QuoteTemplate[] = [
  {
    id: 'qt-1',
    name: 'CV-ketel jaarlijks onderhoud',
    category: 'cv-onderhoud',
    description: 'Standaard jaarlijks onderhoud inclusief reiniging en controle',
    items: [
      { description: 'Onderhoud CV-ketel (arbeid)', quantity: 1, unit: 'stuk', unitPrice: 95, vatRate: 9, type: 'labour' },
      { description: 'Reinigingsset', quantity: 1, unit: 'set', unitPrice: 15, vatRate: 21, type: 'materials' },
      { description: 'Rookgasanalyse', quantity: 1, unit: 'stuk', unitPrice: 25, vatRate: 9, type: 'labour' },
    ],
    defaultVatRate: 9,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '1.5 uur',
    subtotal: 135,
    usageCount: 34,
    lastUsed: new Date(Date.now() - 3 * 86400000),
    createdAt: new Date('2025-06-01'),
  },
  {
    id: 'qt-2',
    name: 'Warmtepomp installatie basis',
    category: 'warmtepomp',
    description: 'Lucht-water warmtepomp inclusief aansluitwerk',
    items: [
      { description: 'Warmtepomp unit', quantity: 1, unit: 'stuk', unitPrice: 2800, vatRate: 21, type: 'materials' },
      { description: 'Installatie arbeid', quantity: 16, unit: 'uur', unitPrice: 65, vatRate: 9, type: 'labour' },
      { description: 'Aansluitmateriaal', quantity: 1, unit: 'set', unitPrice: 350, vatRate: 21, type: 'materials' },
      { description: 'Inbedrijfstelling', quantity: 1, unit: 'stuk', unitPrice: 150, vatRate: 9, type: 'labour' },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: '50% aanbetaling, 50% bij oplevering',
    estimatedDuration: '2 dagen',
    subtotal: 4340,
    usageCount: 12,
    lastUsed: new Date(Date.now() - 7 * 86400000),
    createdAt: new Date('2025-09-15'),
  },
  {
    id: 'qt-3',
    name: 'Airco split-unit installatie',
    category: 'airco',
    items: [
      { description: 'Split-unit airco 3.5kW', quantity: 1, unit: 'stuk', unitPrice: 680, vatRate: 21, type: 'materials' },
      { description: 'Installatie + leidingwerk', quantity: 6, unit: 'uur', unitPrice: 65, vatRate: 9, type: 'labour' },
      { description: 'Montagebeugel + bevestiging', quantity: 1, unit: 'set', unitPrice: 85, vatRate: 21, type: 'materials' },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling binnen 14 dagen',
    estimatedDuration: '1 dag',
    subtotal: 1155,
    usageCount: 8,
    createdAt: new Date('2025-11-01'),
  },
];

// =============================================================================
// SERVICE
// =============================================================================

type TemplateListener = () => void;

class QuoteTemplateService {
  private static instance: QuoteTemplateService;
  private listeners: Set<TemplateListener> = new Set();
  private templates: QuoteTemplate[] = [...mockTemplates];

  static getInstance(): QuoteTemplateService {
    if (!QuoteTemplateService.instance) {
      QuoteTemplateService.instance = new QuoteTemplateService();
    }
    return QuoteTemplateService.instance;
  }

  subscribe(listener: TemplateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void { this.listeners.forEach(l => l()); }

  getTemplates(category?: TemplateCategory): QuoteTemplate[] {
    const list = category ? this.templates.filter(t => t.category === category) : this.templates;
    return list.sort((a, b) => b.usageCount - a.usageCount);
  }

  getTemplate(id: string): QuoteTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  saveTemplate(
    name: string,
    category: TemplateCategory,
    items: QuoteTemplateItem[],
    options?: { description?: string; paymentTerms?: string; estimatedDuration?: string },
  ): QuoteTemplate {
    const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    const template: QuoteTemplate = {
      id: `qt-${Date.now()}`,
      name,
      category,
      description: options?.description,
      items,
      defaultVatRate: 21,
      defaultPaymentTerms: options?.paymentTerms ?? 'Betaling binnen 14 dagen',
      estimatedDuration: options?.estimatedDuration,
      subtotal,
      usageCount: 0,
      createdAt: new Date(),
    };
    this.templates.unshift(template);
    this.notify();
    return template;
  }

  useTemplate(id: string): QuoteTemplate | undefined {
    const t = this.templates.find(x => x.id === id);
    if (t) {
      t.usageCount++;
      t.lastUsed = new Date();
      this.notify();
    }
    return t;
  }

  deleteTemplate(id: string): void {
    this.templates = this.templates.filter(t => t.id !== id);
    this.notify();
  }
}

export const quoteTemplateService = QuoteTemplateService.getInstance();

// =============================================================================
// HOOKS
// =============================================================================

export function useQuoteTemplates(category?: TemplateCategory) {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTemplates(quoteTemplateService.getTemplates(category));
    setLoading(false);
    return quoteTemplateService.subscribe(() => setTemplates(quoteTemplateService.getTemplates(category)));
  }, [category]);

  const save = useCallback(
    (name: string, cat: TemplateCategory, items: QuoteTemplateItem[], opts?: { description?: string; paymentTerms?: string; estimatedDuration?: string }) =>
      quoteTemplateService.saveTemplate(name, cat, items, opts),
    [],
  );
  const use = useCallback((id: string) => quoteTemplateService.useTemplate(id), []);
  const remove = useCallback((id: string) => quoteTemplateService.deleteTemplate(id), []);

  return { templates, loading, save, use, remove };
}
