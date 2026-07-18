// =============================================================================
// QUOTE TEMPLATE SERVICE
// =============================================================================
// Save, manage, and reuse quote templates for common job types
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TFunction } from 'i18next';
import { MS_PER_DAY } from '../utils/timeConstants';
import { registerSingletonReset } from './singletonReset';

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

// R187: shared payment-terms keys so builtin templates can be translated
// without duplicating the same German/French/etc. strings 25 times.
export type PaymentTermsKey =
  | 'onCompletion'
  | 'within14Days'
  | 'deposit50_50'
  | 'deposit40_60'
  | 'deposit30_70';

export interface QuoteTemplate {
  id: string;
  // R187: builtin templates set i18nId so consumers can resolve
  // quoteTemplates.builtins.{i18nId}.{name|desc|duration|items[i]}.
  // User-created templates omit it and fall back to .name/.description directly.
  i18nId?: string;
  paymentTermsKey?: PaymentTermsKey;
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
  | 'dakwerk'
  | 'tegelwerk'
  | 'stucwerk'
  | 'vloeren'
  | 'isolatie'
  | 'zonnepanelen'
  | 'glaswerk'
  | 'tuinaanleg'
  | 'overig';

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; icon: string }[] = [
  { id: 'cv-onderhoud', label: 'CV Onderhoud', icon: 'flame-outline' },
  { id: 'warmtepomp', label: 'Warmtepomp', icon: 'snow-outline' },
  { id: 'airco', label: 'Airco', icon: 'thermometer-outline' },
  { id: 'leidingwerk', label: 'Leidingwerk', icon: 'water-outline' },
  { id: 'badkamer', label: 'Badkamer', icon: 'water-outline' },
  { id: 'keuken', label: 'Keuken', icon: 'restaurant-outline' },
  { id: 'elektra', label: 'Elektra', icon: 'flash-outline' },
  { id: 'dakwerk', label: 'Dakwerk', icon: 'home-outline' },
  { id: 'tegelwerk', label: 'Tegelwerk', icon: 'grid-outline' },
  { id: 'stucwerk', label: 'Stucwerk', icon: 'layers-outline' },
  { id: 'vloeren', label: 'Vloeren', icon: 'albums-outline' },
  { id: 'isolatie', label: 'Isolatie', icon: 'thermometer-outline' },
  { id: 'zonnepanelen', label: 'Zonnepanelen', icon: 'sunny-outline' },
  { id: 'glaswerk', label: 'Glaswerk', icon: 'browsers-outline' },
  { id: 'tuinaanleg', label: 'Tuinaanleg', icon: 'leaf-outline' },
  { id: 'overig', label: 'Overig', icon: 'ellipsis-horizontal-outline' },
];

// =============================================================================
// MOCK DATA
// =============================================================================

const BUILTIN_TEMPLATES: QuoteTemplate[] = [
  {
    id: 'qt-1',
    i18nId: 'qt-1',
    paymentTermsKey: 'onCompletion',
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
    lastUsed: new Date(Date.now() - 3 * MS_PER_DAY),
    createdAt: new Date('2025-06-01'),
  },
  {
    id: 'qt-2',
    i18nId: 'qt-2',
    paymentTermsKey: 'deposit50_50',
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
    lastUsed: new Date(Date.now() - 7 * MS_PER_DAY),
    createdAt: new Date('2025-09-15'),
  },
  {
    id: 'qt-3',
    i18nId: 'qt-3',
    paymentTermsKey: 'within14Days',
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

  // ─── Roofing ─────────────────────────────────────────
  {
    id: 'qt-roofing-1',
    i18nId: 'qt-roofing-1',
    paymentTermsKey: 'deposit40_60',
    name: 'Dakpannen vervangen (100m²)',
    category: 'dakwerk' as TemplateCategory,
    description: 'Verwijderen oude dakpannen, lattwerk controleren, nieuwe pannen leggen',
    items: [
      { description: 'Dakpannen (betonnen)', quantity: 100, unit: 'm²', unitPrice: 28, vatRate: 21, type: 'materials' as const },
      { description: 'Tengels en panlatten', quantity: 100, unit: 'm¹', unitPrice: 4.50, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid dakdekker', quantity: 32, unit: 'uur', unitPrice: 55, vatRate: 9, type: 'labour' as const },
      { description: 'Steiger huur (1 week)', quantity: 1, unit: 'stuk', unitPrice: 450, vatRate: 21, type: 'equipment' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: '40% aanbetaling, 60% bij oplevering',
    estimatedDuration: '4-5 dagen',
    subtotal: 5060,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'qt-roofing-2',
    i18nId: 'qt-roofing-2',
    paymentTermsKey: 'deposit50_50',
    name: 'Plat dak renovatie EPDM',
    category: 'dakwerk' as TemplateCategory,
    description: 'EPDM dakbedekking op plat dak inclusief isolatie',
    items: [
      { description: 'EPDM dakbedekking', quantity: 50, unit: 'm²', unitPrice: 35, vatRate: 21, type: 'materials' as const },
      { description: 'PIR isolatieplaten (Rc 6.0)', quantity: 50, unit: 'm²', unitPrice: 42, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid', quantity: 24, unit: 'uur', unitPrice: 55, vatRate: 9, type: 'labour' as const },
      { description: 'Dakrandafwerking', quantity: 20, unit: 'm¹', unitPrice: 18, vatRate: 21, type: 'materials' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: '50% aanbetaling, 50% bij oplevering',
    estimatedDuration: '3 dagen',
    subtotal: 5530,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Tiling ──────────────────────────────────────────
  {
    id: 'qt-tiling-1',
    i18nId: 'qt-tiling-1',
    paymentTermsKey: 'within14Days',
    name: 'Badkamer betegelen (wand + vloer)',
    category: 'tegelwerk' as TemplateCategory,
    description: 'Wandtegels en vloertegels in badkamer inclusief waterdichting',
    items: [
      { description: 'Wandtegels 30x60', quantity: 25, unit: 'm²', unitPrice: 38, vatRate: 21, type: 'materials' as const },
      { description: 'Vloertegels 60x60', quantity: 8, unit: 'm²', unitPrice: 45, vatRate: 21, type: 'materials' as const },
      { description: 'Tegellijm + voegmortel', quantity: 1, unit: 'set', unitPrice: 120, vatRate: 21, type: 'materials' as const },
      { description: 'Waterdichtingsmembraan', quantity: 15, unit: 'm²', unitPrice: 12, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid tegelzetter', quantity: 24, unit: 'uur', unitPrice: 50, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling binnen 14 dagen',
    estimatedDuration: '3 dagen',
    subtotal: 3290,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Plastering ──────────────────────────────────────
  {
    id: 'qt-plastering-1',
    i18nId: 'qt-plastering-1',
    paymentTermsKey: 'onCompletion',
    name: 'Muren stuken (woonkamer)',
    category: 'stucwerk' as TemplateCategory,
    description: 'Glad stucwerk op gipsblokken wanden',
    items: [
      { description: 'Stucmortel', quantity: 60, unit: 'm²', unitPrice: 8, vatRate: 21, type: 'materials' as const },
      { description: 'Primer + voorstrijkmiddel', quantity: 60, unit: 'm²', unitPrice: 2.50, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid stukadoor', quantity: 16, unit: 'uur', unitPrice: 48, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '2 dagen',
    subtotal: 1398,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Flooring ────────────────────────────────────────
  {
    id: 'qt-flooring-1',
    i18nId: 'qt-flooring-1',
    paymentTermsKey: 'onCompletion',
    name: 'Laminaat leggen (40m²)',
    category: 'vloeren' as TemplateCategory,
    description: 'Laminaatvloer inclusief ondervloer en plinten',
    items: [
      { description: 'Laminaat (click)', quantity: 44, unit: 'm²', unitPrice: 28, vatRate: 21, type: 'materials' as const },
      { description: 'Ondervloer', quantity: 40, unit: 'm²', unitPrice: 4.50, vatRate: 21, type: 'materials' as const },
      { description: 'Plinten', quantity: 25, unit: 'm¹', unitPrice: 6, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid', quantity: 8, unit: 'uur', unitPrice: 45, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '1 dag',
    subtotal: 1882,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Insulation ──────────────────────────────────────
  {
    id: 'qt-insulation-1',
    i18nId: 'qt-insulation-1',
    paymentTermsKey: 'within14Days',
    name: 'Spouwmuurisolatie (100m²)',
    category: 'isolatie' as TemplateCategory,
    description: 'Spouwmuur isolatie met glaswolparels',
    items: [
      { description: 'Glaswolparels spouwvulling', quantity: 100, unit: 'm²', unitPrice: 18, vatRate: 21, type: 'materials' as const },
      { description: 'Boorgaten + afwerking', quantity: 40, unit: 'stuk', unitPrice: 5, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid isolatiemonteur', quantity: 8, unit: 'uur', unitPrice: 55, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling binnen 14 dagen',
    estimatedDuration: '1 dag',
    subtotal: 2440,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Solar ───────────────────────────────────────────
  {
    id: 'qt-solar-1',
    i18nId: 'qt-solar-1',
    paymentTermsKey: 'deposit30_70',
    name: 'Zonnepanelen installatie (10 panelen)',
    category: 'zonnepanelen' as TemplateCategory,
    description: '10 zonnepanelen met omvormer op schuin dak',
    items: [
      { description: 'Zonnepanelen 420Wp (full black)', quantity: 10, unit: 'stuk', unitPrice: 195, vatRate: 0, type: 'materials' as const },
      { description: 'Micro-omvormers', quantity: 10, unit: 'stuk', unitPrice: 125, vatRate: 0, type: 'materials' as const },
      { description: 'Montagesysteem + dakbevestiging', quantity: 1, unit: 'set', unitPrice: 380, vatRate: 0, type: 'materials' as const },
      { description: 'Bekabeling + aansluitwerk', quantity: 1, unit: 'set', unitPrice: 220, vatRate: 0, type: 'materials' as const },
      { description: 'Installatie arbeid', quantity: 8, unit: 'uur', unitPrice: 60, vatRate: 0, type: 'labour' as const },
      { description: 'Monitoring systeem', quantity: 1, unit: 'stuk', unitPrice: 95, vatRate: 0, type: 'materials' as const },
    ],
    defaultVatRate: 0,
    defaultPaymentTerms: '30% aanbetaling, 70% bij oplevering',
    estimatedDuration: '1 dag',
    subtotal: 4375,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Glazing ─────────────────────────────────────────
  {
    id: 'qt-glazing-1',
    i18nId: 'qt-glazing-1',
    paymentTermsKey: 'onCompletion',
    name: 'HR++ glas plaatsen (raam)',
    category: 'glaswerk' as TemplateCategory,
    description: 'Vervangen enkel/dubbel glas door HR++ isolatieglas',
    items: [
      { description: 'HR++ glasplaat op maat', quantity: 4, unit: 'stuk', unitPrice: 185, vatRate: 21, type: 'materials' as const },
      { description: 'Kit + glaslatten', quantity: 4, unit: 'set', unitPrice: 25, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid glaszetter', quantity: 6, unit: 'uur', unitPrice: 52, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '1 dag',
    subtotal: 1152,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Landscaping ─────────────────────────────────────
  {
    id: 'qt-landscaping-1',
    i18nId: 'qt-landscaping-1',
    paymentTermsKey: 'deposit30_70',
    name: 'Tuin aanleggen (50m²)',
    category: 'tuinaanleg' as TemplateCategory,
    description: 'Complete tuinaanleg met terras, beplanting en gazon',
    items: [
      { description: 'Bestrating terras (30x30 tegels)', quantity: 20, unit: 'm²', unitPrice: 35, vatRate: 21, type: 'materials' as const },
      { description: 'Grond + compost', quantity: 5, unit: 'm³', unitPrice: 45, vatRate: 21, type: 'materials' as const },
      { description: 'Beplanting', quantity: 1, unit: 'partij', unitPrice: 450, vatRate: 21, type: 'materials' as const },
      { description: 'Graszaad/graszoden', quantity: 20, unit: 'm²', unitPrice: 8, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid hovenier', quantity: 24, unit: 'uur', unitPrice: 48, vatRate: 9, type: 'labour' as const },
      { description: 'Afvoer grond/puin', quantity: 1, unit: 'container', unitPrice: 250, vatRate: 21, type: 'materials' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: '30% aanbetaling, 70% bij oplevering',
    estimatedDuration: '3-4 dagen',
    subtotal: 3157,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Plumbing ──────────────────────────────────────────────
  {
    id: 'qt-plumbing-1',
    i18nId: 'qt-plumbing-1',
    paymentTermsKey: 'within14Days',
    name: 'Badkamer leidingwerk compleet',
    category: 'leidingwerk' as TemplateCategory,
    description: 'Nieuw leidingwerk voor badkamer inclusief warm/koud water en afvoer',
    items: [
      { description: 'Koperen buis 15mm', quantity: 25, unit: 'm¹', unitPrice: 8.50, vatRate: 21, type: 'materials' as const },
      { description: 'PVC afvoerbuis 40mm', quantity: 12, unit: 'm¹', unitPrice: 5.20, vatRate: 21, type: 'materials' as const },
      { description: 'Koppelingen + bochten set', quantity: 1, unit: 'set', unitPrice: 85, vatRate: 21, type: 'materials' as const },
      { description: 'Muurplaten en bevestiging', quantity: 6, unit: 'stuk', unitPrice: 12, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid loodgieter', quantity: 16, unit: 'uur', unitPrice: 58, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling binnen 14 dagen',
    estimatedDuration: '2 dagen',
    subtotal: 1357,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'qt-plumbing-2',
    i18nId: 'qt-plumbing-2',
    paymentTermsKey: 'onCompletion',
    name: 'Lekkage opsporing + reparatie',
    category: 'leidingwerk' as TemplateCategory,
    description: 'Lekkage opsporen met camera-inspectie en reparatie',
    items: [
      { description: 'Lekkage detectie (arbeid)', quantity: 2, unit: 'uur', unitPrice: 75, vatRate: 9, type: 'labour' as const },
      { description: 'Camera-inspectie riolering', quantity: 1, unit: 'stuk', unitPrice: 150, vatRate: 9, type: 'labour' as const },
      { description: 'Reparatie materiaal', quantity: 1, unit: 'set', unitPrice: 65, vatRate: 21, type: 'materials' as const },
      { description: 'Reparatie arbeid', quantity: 3, unit: 'uur', unitPrice: 58, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 9,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '0.5-1 dag',
    subtotal: 539,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Electrical ────────────────────────────────────────────
  {
    id: 'qt-electrical-1',
    i18nId: 'qt-electrical-1',
    paymentTermsKey: 'within14Days',
    name: 'Meterkast vervangen',
    category: 'elektra' as TemplateCategory,
    description: 'Groepenkast vervangen naar 12-groepen met aardlekschakelaars',
    items: [
      { description: 'Groepenkast 12-groepen', quantity: 1, unit: 'stuk', unitPrice: 320, vatRate: 21, type: 'materials' as const },
      { description: 'Aardlekschakelaars 30mA', quantity: 4, unit: 'stuk', unitPrice: 45, vatRate: 21, type: 'materials' as const },
      { description: 'Installatieautomaten', quantity: 12, unit: 'stuk', unitPrice: 12, vatRate: 21, type: 'materials' as const },
      { description: 'Aansluitkabel + rail', quantity: 1, unit: 'set', unitPrice: 85, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid elektricien', quantity: 8, unit: 'uur', unitPrice: 62, vatRate: 9, type: 'labour' as const },
      { description: 'NEN 1010 keuringsrapport', quantity: 1, unit: 'stuk', unitPrice: 95, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling binnen 14 dagen',
    estimatedDuration: '1 dag',
    subtotal: 1340,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'qt-electrical-2',
    i18nId: 'qt-electrical-2',
    paymentTermsKey: 'onCompletion',
    name: 'Stopcontacten + schakelaars vernieuwen',
    category: 'elektra' as TemplateCategory,
    description: 'Vervanging stopcontacten en schakelaars in woning',
    items: [
      { description: 'Stopcontacten Berker/Busch-Jaeger', quantity: 15, unit: 'stuk', unitPrice: 18, vatRate: 21, type: 'materials' as const },
      { description: 'Schakelaars', quantity: 8, unit: 'stuk', unitPrice: 22, vatRate: 21, type: 'materials' as const },
      { description: 'Afdekramen', quantity: 23, unit: 'stuk', unitPrice: 8, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid elektricien', quantity: 6, unit: 'uur', unitPrice: 62, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '1 dag',
    subtotal: 1002,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'qt-electrical-3',
    i18nId: 'qt-electrical-3',
    paymentTermsKey: 'deposit50_50',
    name: 'Laadpaal installatie',
    category: 'elektra' as TemplateCategory,
    description: 'Thuislaadpaal 11kW installatie met aparte groep',
    items: [
      { description: 'Laadpaal 11kW (Alfen Eve)', quantity: 1, unit: 'stuk', unitPrice: 850, vatRate: 21, type: 'materials' as const },
      { description: 'Installatiekabel 5G6', quantity: 15, unit: 'm¹', unitPrice: 8, vatRate: 21, type: 'materials' as const },
      { description: 'Aardlekschakelaar B-type', quantity: 1, unit: 'stuk', unitPrice: 95, vatRate: 21, type: 'materials' as const },
      { description: 'Installatiearbeid', quantity: 6, unit: 'uur', unitPrice: 62, vatRate: 9, type: 'labour' as const },
      { description: 'Activatie + app configuratie', quantity: 1, unit: 'stuk', unitPrice: 50, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: '50% aanbetaling, 50% bij oplevering',
    estimatedDuration: '0.5 dag',
    subtotal: 1367,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Painting ──────────────────────────────────────────────
  {
    id: 'qt-painting-1',
    i18nId: 'qt-painting-1',
    paymentTermsKey: 'onCompletion',
    name: 'Binnenschilderwerk woonkamer',
    category: 'overig' as TemplateCategory,
    description: 'Muren en plafond schilderen inclusief voorbehandeling',
    items: [
      { description: 'Latex muurverf (Flexa)', quantity: 10, unit: 'liter', unitPrice: 22, vatRate: 21, type: 'materials' as const },
      { description: 'Plafondverf', quantity: 5, unit: 'liter', unitPrice: 18, vatRate: 21, type: 'materials' as const },
      { description: 'Grondverf + vulpasta', quantity: 1, unit: 'set', unitPrice: 35, vatRate: 21, type: 'materials' as const },
      { description: 'Afplakmateriaal + afdekfolie', quantity: 1, unit: 'set', unitPrice: 25, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid schilder', quantity: 16, unit: 'uur', unitPrice: 45, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '2 dagen',
    subtotal: 1100,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'qt-painting-2',
    i18nId: 'qt-painting-2',
    paymentTermsKey: 'within14Days',
    name: 'Buitenschilderwerk kozijnen',
    category: 'overig' as TemplateCategory,
    description: 'Houten kozijnen schuren, gronden en aflakken',
    items: [
      { description: 'Buitenlak (Sikkens Rubbol)', quantity: 5, unit: 'liter', unitPrice: 38, vatRate: 21, type: 'materials' as const },
      { description: 'Grondverf buiten', quantity: 3, unit: 'liter', unitPrice: 28, vatRate: 21, type: 'materials' as const },
      { description: 'Schuurpapier + plamuur', quantity: 1, unit: 'set', unitPrice: 30, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid schilder', quantity: 24, unit: 'uur', unitPrice: 45, vatRate: 9, type: 'labour' as const },
      { description: 'Ladder/steiger huur', quantity: 1, unit: 'dag', unitPrice: 45, vatRate: 21, type: 'equipment' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling binnen 14 dagen',
    estimatedDuration: '3 dagen',
    subtotal: 1479,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Carpentry ─────────────────────────────────────────────
  {
    id: 'qt-carpentry-1',
    i18nId: 'qt-carpentry-1',
    paymentTermsKey: 'onCompletion',
    name: 'Houten vloer leggen (40m²)',
    category: 'overig' as TemplateCategory,
    description: 'Eiken parketvloer inclusief ondervloer en plinten',
    items: [
      { description: 'Eiken parket (click)', quantity: 44, unit: 'm²', unitPrice: 52, vatRate: 21, type: 'materials' as const },
      { description: 'Ondervloer', quantity: 40, unit: 'm²', unitPrice: 6, vatRate: 21, type: 'materials' as const },
      { description: 'Plinten eiken', quantity: 25, unit: 'm¹', unitPrice: 12, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid timmerman', quantity: 12, unit: 'uur', unitPrice: 52, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '1.5 dagen',
    subtotal: 3412,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },
  {
    id: 'qt-carpentry-2',
    i18nId: 'qt-carpentry-2',
    paymentTermsKey: 'deposit40_60',
    name: 'Dakkapel plaatsen',
    category: 'overig' as TemplateCategory,
    description: 'Prefab dakkapel plaatsen inclusief timmering en afwerking',
    items: [
      { description: 'Prefab dakkapel 3m', quantity: 1, unit: 'stuk', unitPrice: 3200, vatRate: 21, type: 'materials' as const },
      { description: 'Zinken bekleding', quantity: 8, unit: 'm²', unitPrice: 65, vatRate: 21, type: 'materials' as const },
      { description: 'Isolatie + dampscherm', quantity: 8, unit: 'm²', unitPrice: 28, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid timmerman', quantity: 24, unit: 'uur', unitPrice: 52, vatRate: 9, type: 'labour' as const },
      { description: 'Kraan huur (half dag)', quantity: 1, unit: 'stuk', unitPrice: 350, vatRate: 21, type: 'equipment' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: '40% aanbetaling, 60% bij oplevering',
    estimatedDuration: '2-3 dagen',
    subtotal: 5742,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Additional Tiling ─────────────────────────────────────
  {
    id: 'qt-tiling-2',
    i18nId: 'qt-tiling-2',
    paymentTermsKey: 'onCompletion',
    name: 'Terrastegels leggen (30m²)',
    category: 'tegelwerk' as TemplateCategory,
    description: 'Buitentegels op gestabiliseerd zandbed',
    items: [
      { description: 'Keramische terrastegels 60x60', quantity: 33, unit: 'm²', unitPrice: 42, vatRate: 21, type: 'materials' as const },
      { description: 'Drainagemortel + zandbed', quantity: 30, unit: 'm²', unitPrice: 8, vatRate: 21, type: 'materials' as const },
      { description: 'Randafwerking', quantity: 20, unit: 'm¹', unitPrice: 6, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid tegelzetter', quantity: 16, unit: 'uur', unitPrice: 50, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '2 dagen',
    subtotal: 2746,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Additional Insulation ─────────────────────────────────
  {
    id: 'qt-insulation-2',
    i18nId: 'qt-insulation-2',
    paymentTermsKey: 'within14Days',
    name: 'Dakisolatie binnenzijde (PIR)',
    category: 'isolatie' as TemplateCategory,
    description: 'PIR isolatie aan binnenzijde schuin dak (Rc 6.0)',
    items: [
      { description: 'PIR platen 120mm', quantity: 50, unit: 'm²', unitPrice: 42, vatRate: 21, type: 'materials' as const },
      { description: 'Dampscherm + tape', quantity: 55, unit: 'm²', unitPrice: 4, vatRate: 21, type: 'materials' as const },
      { description: 'Rachels + bevestiging', quantity: 50, unit: 'm¹', unitPrice: 3.50, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid isolatiemonteur', quantity: 16, unit: 'uur', unitPrice: 55, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling binnen 14 dagen',
    estimatedDuration: '2 dagen',
    subtotal: 3375,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Additional Solar ──────────────────────────────────────
  {
    id: 'qt-solar-2',
    i18nId: 'qt-solar-2',
    paymentTermsKey: 'deposit30_70',
    name: 'Zonnepanelen + thuisbatterij',
    category: 'zonnepanelen' as TemplateCategory,
    description: '16 panelen met 10kWh thuisbatterij voor maximale zelfconsumptie',
    items: [
      { description: 'Zonnepanelen 420Wp', quantity: 16, unit: 'stuk', unitPrice: 195, vatRate: 0, type: 'materials' as const },
      { description: 'Hybride omvormer', quantity: 1, unit: 'stuk', unitPrice: 1800, vatRate: 0, type: 'materials' as const },
      { description: 'Thuisbatterij 10kWh', quantity: 1, unit: 'stuk', unitPrice: 4500, vatRate: 0, type: 'materials' as const },
      { description: 'Montagesysteem', quantity: 1, unit: 'set', unitPrice: 580, vatRate: 0, type: 'materials' as const },
      { description: 'Bekabeling + aansluitwerk', quantity: 1, unit: 'set', unitPrice: 380, vatRate: 0, type: 'materials' as const },
      { description: 'Installatie arbeid', quantity: 16, unit: 'uur', unitPrice: 60, vatRate: 0, type: 'labour' as const },
    ],
    defaultVatRate: 0,
    defaultPaymentTerms: '30% aanbetaling, 70% bij oplevering',
    estimatedDuration: '2 dagen',
    subtotal: 11340,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Additional Landscaping ────────────────────────────────
  {
    id: 'qt-landscaping-2',
    i18nId: 'qt-landscaping-2',
    paymentTermsKey: 'onCompletion',
    name: 'Schutting plaatsen (15m)',
    category: 'tuinaanleg' as TemplateCategory,
    description: 'Houten schutting op betonpoeren inclusief palen en planken',
    items: [
      { description: 'Betonpoeren', quantity: 8, unit: 'stuk', unitPrice: 15, vatRate: 21, type: 'materials' as const },
      { description: 'Palen (geïmpregneerd)', quantity: 8, unit: 'stuk', unitPrice: 22, vatRate: 21, type: 'materials' as const },
      { description: 'Schuttingplanken 180cm', quantity: 90, unit: 'stuk', unitPrice: 4.50, vatRate: 21, type: 'materials' as const },
      { description: 'Betonnen tussenliggers', quantity: 16, unit: 'stuk', unitPrice: 8, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid hovenier', quantity: 8, unit: 'uur', unitPrice: 48, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: 'Betaling bij oplevering',
    estimatedDuration: '1 dag',
    subtotal: 1315,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },

  // ─── Gas/HVAC additional ───────────────────────────────────
  {
    id: 'qt-gas-1',
    i18nId: 'qt-gas-1',
    paymentTermsKey: 'deposit50_50',
    name: 'Vloerverwarming aanleggen (50m²)',
    category: 'leidingwerk' as TemplateCategory,
    description: 'Vloerverwarming op bestaande vloer met noppenplaat systeem',
    items: [
      { description: 'Noppenplaat systeem', quantity: 50, unit: 'm²', unitPrice: 18, vatRate: 21, type: 'materials' as const },
      { description: 'PE-RT buis 16mm', quantity: 200, unit: 'm¹', unitPrice: 1.80, vatRate: 21, type: 'materials' as const },
      { description: 'Verdeler 6-groeps', quantity: 1, unit: 'stuk', unitPrice: 280, vatRate: 21, type: 'materials' as const },
      { description: 'Regelautomaat + thermostaat', quantity: 1, unit: 'set', unitPrice: 195, vatRate: 21, type: 'materials' as const },
      { description: 'Arbeid installateur', quantity: 16, unit: 'uur', unitPrice: 58, vatRate: 9, type: 'labour' as const },
    ],
    defaultVatRate: 21,
    defaultPaymentTerms: '50% aanbetaling, 50% bij oplevering',
    estimatedDuration: '2 dagen',
    subtotal: 2663,
    usageCount: 0,
    createdAt: new Date('2026-03-01'),
  },
];

// =============================================================================
// SERVICE
// =============================================================================

type TemplateListener = () => void;

// Templates were an in-memory singleton: a template the contractor saved
// survived until the next app restart and then silently vanished, and a
// deleted built-in came back. BUILTIN_TEMPLATES stay as shipped content;
// user-authored templates, deletions and usage counts now persist.
const TEMPLATES_STORAGE_KEY = '@vasco_quote_templates';

interface PersistedTemplates {
  /** User-authored templates only — built-ins are not duplicated into storage. */
  userTemplates: QuoteTemplate[];
  /** Built-ins the contractor deleted, so they do not reappear on next launch. */
  deletedBuiltinIds: string[];
  /** usageCount / lastUsed per template id, including built-ins. */
  usage: Record<string, { usageCount: number; lastUsed?: string }>;
}

/** JSON.parse gives strings back for Date fields — revive them. */
function reviveTemplate(t: any): QuoteTemplate {
  return {
    ...t,
    createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
    lastUsed: t.lastUsed ? new Date(t.lastUsed) : undefined,
  };
}

class QuoteTemplateService {
  private static instance: QuoteTemplateService;
  private listeners: Set<TemplateListener> = new Set();
  private templates: QuoteTemplate[] = [...BUILTIN_TEMPLATES];
  private deletedBuiltinIds: Set<string> = new Set();
  private hydrated = false;

  static getInstance(): QuoteTemplateService {
    if (!QuoteTemplateService.instance) {
      QuoteTemplateService.instance = new QuoteTemplateService();
      registerSingletonReset(() => {
        const inst = QuoteTemplateService.instance;
        inst.templates = [...BUILTIN_TEMPLATES];
        inst.deletedBuiltinIds = new Set();
        inst.hydrated = false;
        inst.listeners.forEach((l) => l());
      });
    }
    return QuoteTemplateService.instance;
  }

  /**
   * Rebuilds the list from storage. Built-ins are re-merged from code rather
   * than read from the cache, so shipping a new starter template in a future
   * release is not blocked by a stale persisted copy.
   */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as PersistedTemplates;
      this.deletedBuiltinIds = new Set(p.deletedBuiltinIds ?? []);
      const userTemplates = (p.userTemplates ?? []).map(reviveTemplate);
      const builtins = BUILTIN_TEMPLATES.filter((b) => !this.deletedBuiltinIds.has(b.id));
      this.templates = [...userTemplates, ...builtins].map((t) => {
        const u = p.usage?.[t.id];
        return u
          ? { ...t, usageCount: u.usageCount, lastUsed: u.lastUsed ? new Date(u.lastUsed) : t.lastUsed }
          : t;
      });
    } catch {
      // Corrupt cache must not wipe the built-ins the screen depends on.
    } finally {
      this.notify();
    }
  }

  private persist(): void {
    const builtinIds = new Set(BUILTIN_TEMPLATES.map((b) => b.id));
    const payload: PersistedTemplates = {
      userTemplates: this.templates.filter((t) => !builtinIds.has(t.id)),
      deletedBuiltinIds: [...this.deletedBuiltinIds],
      usage: Object.fromEntries(
        this.templates.map((t) => [t.id, { usageCount: t.usageCount, lastUsed: t.lastUsed?.toISOString() }]),
      ),
    };
    AsyncStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
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
    this.persist();
    this.notify();
    return template;
  }

  useTemplate(id: string): QuoteTemplate | undefined {
    const t = this.templates.find(x => x.id === id);
    if (t) {
      t.usageCount++;
      t.lastUsed = new Date();
      this.persist();
      this.notify();
    }
    return t;
  }

  deleteTemplate(id: string): void {
    if (BUILTIN_TEMPLATES.some((b) => b.id === id)) this.deletedBuiltinIds.add(id);
    this.templates = this.templates.filter(t => t.id !== id);
    this.persist();
    this.notify();
  }
}

export const quoteTemplateService = QuoteTemplateService.getInstance();

// =============================================================================
// LOCALIZATION HELPERS (R187)
// =============================================================================
// Builtin templates carry an i18nId. localizeTemplate() resolves the
// per-template name/description/duration/items via i18n and the shared
// paymentTermsKey via quoteTemplates.paymentTerms.{key}. Anything missing
// falls back to the seed (Dutch) string so user-created templates and
// missing translations both still render.

export interface LocalizedQuoteTemplate extends QuoteTemplate {
  // Display strings already resolved against the active locale.
  displayName: string;
  displayDescription?: string;
  displayDuration?: string;
  displayPaymentTerms: string;
  displayItems: { description: string; quantity: number; unit: string; unitPrice: number; vatRate: number; type: QuoteTemplateItem['type'] }[];
}

export function localizeTemplate(template: QuoteTemplate, t: TFunction): LocalizedQuoteTemplate {
  const base = template.i18nId ? `quoteTemplates.builtins.${template.i18nId}` : null;

  const displayName = base ? t(`${base}.name`, { defaultValue: template.name }) : template.name;
  const displayDescription = template.description
    ? (base ? t(`${base}.desc`, { defaultValue: template.description }) : template.description)
    : undefined;
  const displayDuration = template.estimatedDuration
    ? (base ? t(`${base}.duration`, { defaultValue: template.estimatedDuration }) : template.estimatedDuration)
    : undefined;
  const displayPaymentTerms = template.paymentTermsKey
    ? t(`quoteTemplates.paymentTerms.${template.paymentTermsKey}`, { defaultValue: template.defaultPaymentTerms })
    : template.defaultPaymentTerms;

  const displayItems = template.items.map((item, idx) => ({
    description: base ? t(`${base}.items.${idx}`, { defaultValue: item.description }) : item.description,
    quantity: item.quantity,
    unit: base ? t(`${base}.units.${idx}`, { defaultValue: item.unit }) : item.unit,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate,
    type: item.type,
  }));

  return {
    ...template,
    displayName,
    displayDescription,
    displayDuration,
    displayPaymentTerms,
    displayItems,
  };
}

export function localizeCategory(catId: TemplateCategory, fallbackLabel: string, t: TFunction): string {
  return t(`quoteTemplates.categories.${catId}`, { defaultValue: fallbackLabel });
}

// =============================================================================
// HOOKS
// =============================================================================

export function useQuoteTemplates(category?: TemplateCategory) {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sync = () => { if (!cancelled) setTemplates(quoteTemplateService.getTemplates(category)); };
    const unsub = quoteTemplateService.subscribe(sync);
    // Hydrate before the first paint so saved templates are not missing for a
    // frame; notify() inside hydrate re-runs sync.
    quoteTemplateService.hydrate().finally(() => { sync(); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; unsub(); };
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
