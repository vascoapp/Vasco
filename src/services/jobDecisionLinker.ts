// =============================================================================
// JOB-DECISION LINKER SERVICE
// =============================================================================
// Automatically links jobs to decision templates
// When a job is created, this service finds the best matching template
// and creates a decision tracker for the customer
// =============================================================================

import { trackUserAction } from '../intelligence/intelligenceEngine';
import type {
  DecisionTemplate,
  CustomerDecisionTracker,
  CustomerDecisionCategory,
  CustomerDecisionItem,
  Trade,
  ProjectPhase,
} from '../types/decisions';

// ============================================
// TYPES
// ============================================

interface Job {
  id: string;
  title: string;
  customer: string;
  customerPhone?: string;
  customerEmail?: string;
  startDate?: string;
  value?: number;
  trade?: Trade;
}

interface TemplateMatch {
  template: DecisionTemplate;
  confidence: number;
  matchReasons: string[];
}

// ============================================
// DEFAULT DECISION TEMPLATES
// ============================================

export const DEFAULT_TEMPLATES: DecisionTemplate[] = [
  // Bathroom Renovation Template
  {
    id: 'template_bathroom_1',
    name: 'Badkamer Renovatie',
    description: 'Complete set beslissingen voor badkamer renovatie',
    trade: 'bathroom_fitter',
    projectType: 'bathroom',
    estimatedTotalDecisions: 15,
    avgDaysToComplete: 14,
    usageCount: 147,
    isSystemTemplate: true,
    createdAt: '2024-01-01',
    categories: [
      {
        id: 'cat_bathroom_sanitair',
        name: 'Sanitair',
        description: 'Toilet, douche, wastafel keuzes',
        icon: 'water',
        sortOrder: 1,
        phase: 'planning',
        daysBeforePhaseStart: 21,
        items: [
          {
            id: 'item_toilet_model',
            name: 'Toilet model',
            description: 'Kies het type toilet',
            inputType: 'select',
            priority: 'critical',
            impactIfDelayed: 'Bestelling kan niet worden geplaatst, project loopt vertraging op',
            options: [
              { value: 'wall_hung', label: 'Wandhangend', description: 'Modern, makkelijk schoon te maken' },
              { value: 'floor_standing', label: 'Staand', description: 'Klassiek, geen inbouwreservoir nodig' },
              { value: 'smart', label: 'Smart toilet', description: 'Met bidet functie en verwarmde bril' },
            ],
          },
          {
            id: 'item_toilet_brand',
            name: 'Toilet merk',
            description: 'Welk merk heeft uw voorkeur?',
            inputType: 'select',
            priority: 'important',
            impactIfDelayed: 'Kan default merk kiezen',
            options: [
              { value: 'geberit', label: 'Geberit', priceImpact: 0 },
              { value: 'villeroy_boch', label: 'Villeroy & Boch', priceImpact: 150 },
              { value: 'grohe', label: 'Grohe', priceImpact: 100 },
              { value: 'duravit', label: 'Duravit', priceImpact: 200 },
            ],
          },
          {
            id: 'item_shower_type',
            name: 'Douche type',
            description: 'Welk type douche wilt u?',
            inputType: 'select',
            priority: 'critical',
            impactIfDelayed: 'Installatie kan niet worden gepland',
            options: [
              { value: 'walk_in', label: 'Inloopdouche', description: 'Open ontwerp, geen deur' },
              { value: 'cabin', label: 'Douchecabine', description: 'Volledig afgesloten' },
              { value: 'bathtub_combo', label: 'Bad/douche combi', description: 'Douche boven bad' },
            ],
          },
          {
            id: 'item_sink_type',
            name: 'Wastafel type',
            description: 'Welk type wastafel?',
            inputType: 'select',
            priority: 'important',
            impactIfDelayed: 'Standaard model wordt besteld',
            options: [
              { value: 'single', label: 'Enkele wastafel', priceImpact: 0 },
              { value: 'double', label: 'Dubbele wastafel', priceImpact: 400 },
              { value: 'floating', label: 'Zwevende wastafel', priceImpact: 200 },
            ],
          },
        ],
      },
      {
        id: 'cat_bathroom_tegels',
        name: 'Tegels',
        description: 'Vloer en wandtegels',
        icon: 'grid',
        sortOrder: 2,
        phase: 'planning',
        daysBeforePhaseStart: 14,
        items: [
          {
            id: 'item_floor_tile',
            name: 'Vloertegels',
            description: 'Kies de vloertegels',
            inputType: 'text',
            priority: 'critical',
            impactIfDelayed: 'Tegelwerk kan niet starten',
            helpText: 'Geef de naam of artikelnummer van de tegels die u heeft gekozen',
          },
          {
            id: 'item_wall_tile',
            name: 'Wandtegels',
            description: 'Kies de wandtegels',
            inputType: 'text',
            priority: 'critical',
            impactIfDelayed: 'Tegelwerk kan niet starten',
          },
          {
            id: 'item_tile_pattern',
            name: 'Legpatroon',
            description: 'Hoe moeten de tegels gelegd worden?',
            inputType: 'select',
            priority: 'optional',
            impactIfDelayed: 'Standaard strak patroon wordt toegepast',
            options: [
              { value: 'straight', label: 'Strak/recht' },
              { value: 'diagonal', label: 'Diagonaal' },
              { value: 'herringbone', label: 'Visgraat' },
              { value: 'brick', label: 'Halfsteensverband' },
            ],
          },
        ],
      },
      {
        id: 'cat_bathroom_kranen',
        name: 'Kranen & Accessoires',
        icon: 'water-outline',
        sortOrder: 3,
        phase: 'installation',
        daysBeforePhaseStart: 7,
        items: [
          {
            id: 'item_faucet_finish',
            name: 'Kraan afwerking',
            description: 'Welke kleur/afwerking voor de kranen?',
            inputType: 'select',
            priority: 'important',
            impactIfDelayed: 'Chroom wordt standaard geleverd',
            options: [
              { value: 'chrome', label: 'Chroom', priceImpact: 0 },
              { value: 'black_matt', label: 'Mat zwart', priceImpact: 100 },
              { value: 'brushed_gold', label: 'Geborsteld goud', priceImpact: 200 },
              { value: 'nickel', label: 'RVS look', priceImpact: 50 },
            ],
          },
          {
            id: 'item_shower_head',
            name: 'Douchekop type',
            description: 'Welk type douchekop?',
            inputType: 'select',
            priority: 'optional',
            impactIfDelayed: 'Standaard handdouche',
            options: [
              { value: 'rain', label: 'Regendouche', priceImpact: 150 },
              { value: 'hand', label: 'Handdouche', priceImpact: 0 },
              { value: 'combo', label: 'Beide', priceImpact: 200 },
            ],
          },
        ],
      },
    ],
  },

  // Kitchen Template
  {
    id: 'template_kitchen_1',
    name: 'Keuken Renovatie',
    description: 'Complete set beslissingen voor keuken renovatie',
    trade: 'kitchen_fitter',
    projectType: 'kitchen',
    estimatedTotalDecisions: 20,
    avgDaysToComplete: 21,
    usageCount: 89,
    isSystemTemplate: true,
    createdAt: '2024-01-01',
    categories: [
      {
        id: 'cat_kitchen_kasten',
        name: 'Keukenkasten',
        icon: 'cube',
        sortOrder: 1,
        phase: 'planning',
        daysBeforePhaseStart: 28,
        items: [
          {
            id: 'item_cabinet_color',
            name: 'Kastkleur',
            description: 'Welke kleur voor de keukenkasten?',
            inputType: 'color',
            priority: 'critical',
            impactIfDelayed: 'Keuken kan niet worden besteld',
          },
          {
            id: 'item_cabinet_style',
            name: 'Kaststijl',
            description: 'Modern, klassiek of landelijk?',
            inputType: 'select',
            priority: 'critical',
            impactIfDelayed: 'Keuken kan niet worden besteld',
            options: [
              { value: 'modern', label: 'Modern/strak' },
              { value: 'classic', label: 'Klassiek' },
              { value: 'country', label: 'Landelijk' },
              { value: 'industrial', label: 'Industrieel' },
            ],
          },
          {
            id: 'item_handle_type',
            name: 'Greep type',
            description: 'Welk type handgrepen?',
            inputType: 'select',
            priority: 'important',
            impactIfDelayed: 'Standaard greep wordt gemonteerd',
            options: [
              { value: 'bar', label: 'Stang greep' },
              { value: 'knob', label: 'Knop greep' },
              { value: 'integrated', label: 'Geïntegreerd (greeploos)' },
              { value: 'profile', label: 'Profielgreep' },
            ],
          },
        ],
      },
      {
        id: 'cat_kitchen_blad',
        name: 'Werkblad',
        icon: 'layers',
        sortOrder: 2,
        phase: 'planning',
        daysBeforePhaseStart: 21,
        items: [
          {
            id: 'item_countertop_material',
            name: 'Werkblad materiaal',
            description: 'Welk materiaal voor het werkblad?',
            inputType: 'select',
            priority: 'critical',
            impactIfDelayed: 'Werkblad kan niet worden besteld',
            options: [
              { value: 'quartz', label: 'Composiet/Quartz', priceImpact: 0 },
              { value: 'granite', label: 'Graniet', priceImpact: 500 },
              { value: 'wood', label: 'Massief hout', priceImpact: 300 },
              { value: 'stainless', label: 'RVS', priceImpact: 400 },
              { value: 'dekton', label: 'Dekton', priceImpact: 800 },
            ],
          },
          {
            id: 'item_countertop_color',
            name: 'Werkblad kleur',
            description: 'Welke kleur/patroon?',
            inputType: 'text',
            priority: 'critical',
            impactIfDelayed: 'Werkblad kan niet worden besteld',
          },
        ],
      },
      {
        id: 'cat_kitchen_apparatuur',
        name: 'Apparatuur',
        icon: 'flash',
        sortOrder: 3,
        phase: 'installation',
        daysBeforePhaseStart: 14,
        items: [
          {
            id: 'item_cooktop_type',
            name: 'Kookplaat type',
            description: 'Welk type kookplaat?',
            inputType: 'select',
            priority: 'critical',
            impactIfDelayed: 'Elektrische aansluiting kan niet worden voorbereid',
            options: [
              { value: 'induction', label: 'Inductie' },
              { value: 'ceramic', label: 'Keramisch' },
              { value: 'gas', label: 'Gas' },
            ],
          },
          {
            id: 'item_oven_position',
            name: 'Oven positie',
            description: 'Waar moet de oven komen?',
            inputType: 'select',
            priority: 'important',
            impactIfDelayed: 'Standaard onder kookplaat',
            options: [
              { value: 'under_cooktop', label: 'Onder kookplaat' },
              { value: 'eye_level', label: 'Op ooghoogte' },
            ],
          },
        ],
      },
    ],
  },

  // Painting Template
  {
    id: 'template_painting_1',
    name: 'Schilderwerk',
    description: 'Beslissingen voor schilderprojecten',
    trade: 'painter',
    projectType: 'painting',
    estimatedTotalDecisions: 8,
    avgDaysToComplete: 7,
    usageCount: 234,
    isSystemTemplate: true,
    createdAt: '2024-01-01',
    categories: [
      {
        id: 'cat_paint_colors',
        name: 'Kleuren',
        icon: 'color-palette',
        sortOrder: 1,
        phase: 'planning',
        daysBeforePhaseStart: 7,
        items: [
          {
            id: 'item_wall_color',
            name: 'Muurkleur',
            description: 'Welke kleur voor de muren?',
            inputType: 'color',
            priority: 'critical',
            impactIfDelayed: 'Verf kan niet worden besteld',
            helpText: 'Geef de RAL code of merknaam (bijv. Flexa Creations "Steel Blue")',
          },
          {
            id: 'item_ceiling_color',
            name: 'Plafond kleur',
            description: 'Welke kleur voor het plafond?',
            inputType: 'select',
            priority: 'important',
            impactIfDelayed: 'Standaard wit wordt gebruikt',
            options: [
              { value: 'white', label: 'Wit' },
              { value: 'same_as_wall', label: 'Zelfde als muur' },
              { value: 'custom', label: 'Andere kleur' },
            ],
          },
          {
            id: 'item_trim_color',
            name: 'Kozijnen kleur',
            description: 'Welke kleur voor kozijnen en plinten?',
            inputType: 'select',
            priority: 'important',
            impactIfDelayed: 'Standaard wit wordt gebruikt',
            options: [
              { value: 'white', label: 'Wit' },
              { value: 'black', label: 'Zwart' },
              { value: 'same_as_wall', label: 'Zelfde als muur' },
              { value: 'custom', label: 'Andere kleur' },
            ],
          },
        ],
      },
      {
        id: 'cat_paint_finish',
        name: 'Afwerking',
        icon: 'brush',
        sortOrder: 2,
        phase: 'planning',
        daysBeforePhaseStart: 3,
        items: [
          {
            id: 'item_wall_finish',
            name: 'Muur afwerking',
            description: 'Welke glansgraad voor de muren?',
            inputType: 'select',
            priority: 'optional',
            impactIfDelayed: 'Mat wordt standaard gebruikt',
            options: [
              { value: 'matte', label: 'Mat', description: 'Geen reflectie, verbergt oneffenheden' },
              { value: 'eggshell', label: 'Eierschaal', description: 'Subtiele glans, afwasbaar' },
              { value: 'satin', label: 'Zijdeglans', description: 'Meer glans, zeer afwasbaar' },
            ],
          },
          {
            id: 'item_paint_brand',
            name: 'Verfmerk voorkeur',
            description: 'Heeft u een voorkeur voor een bepaald merk?',
            inputType: 'select',
            priority: 'optional',
            impactIfDelayed: 'Aannemer kiest beste prijs/kwaliteit',
            options: [
              { value: 'no_preference', label: 'Geen voorkeur' },
              { value: 'flexa', label: 'Flexa' },
              { value: 'sigma', label: 'Sigma' },
              { value: 'dulux', label: 'Dulux' },
              { value: 'sikkens', label: 'Sikkens' },
            ],
          },
        ],
      },
    ],
  },
];

// ============================================
// TEMPLATE MATCHING
// ============================================

const KEYWORD_MAPPINGS: Record<string, { trades: Trade[]; projectTypes: string[] }> = {
  // Bathroom keywords
  badkamer: { trades: ['bathroom_fitter'], projectTypes: ['bathroom'] },
  bathroom: { trades: ['bathroom_fitter'], projectTypes: ['bathroom'] },
  toilet: { trades: ['bathroom_fitter', 'plumber'], projectTypes: ['bathroom'] },
  douche: { trades: ['bathroom_fitter'], projectTypes: ['bathroom'] },
  shower: { trades: ['bathroom_fitter'], projectTypes: ['bathroom'] },

  // Kitchen keywords
  keuken: { trades: ['kitchen_fitter'], projectTypes: ['kitchen'] },
  kitchen: { trades: ['kitchen_fitter'], projectTypes: ['kitchen'] },

  // Painting keywords
  schilder: { trades: ['painter'], projectTypes: ['painting'] },
  verf: { trades: ['painter'], projectTypes: ['painting'] },
  paint: { trades: ['painter'], projectTypes: ['painting'] },
  repaint: { trades: ['painter'], projectTypes: ['painting'] },
  latex: { trades: ['painter'], projectTypes: ['painting'] },

  // Electrical
  elektr: { trades: ['electrician'], projectTypes: ['electrical'] },
  electric: { trades: ['electrician'], projectTypes: ['electrical'] },
  stopcontact: { trades: ['electrician'], projectTypes: ['electrical'] },
  outlet: { trades: ['electrician'], projectTypes: ['electrical'] },

  // Flooring
  vloer: { trades: ['flooring'], projectTypes: ['flooring'] },
  floor: { trades: ['flooring'], projectTypes: ['flooring'] },
  parket: { trades: ['flooring'], projectTypes: ['flooring'] },
  laminaat: { trades: ['flooring'], projectTypes: ['flooring'] },

  // Tiling
  tegel: { trades: ['tiler'], projectTypes: ['tiling'] },
  tile: { trades: ['tiler'], projectTypes: ['tiling'] },
};

/**
 * Find the best matching template for a job
 */
function findMatchingTemplate(job: Job): TemplateMatch | null {
  const titleLower = job.title.toLowerCase();
  const matches: TemplateMatch[] = [];

  // Score each template
  for (const template of DEFAULT_TEMPLATES) {
    let confidence = 0;
    const matchReasons: string[] = [];

    // Direct trade match
    if (job.trade && job.trade === template.trade) {
      confidence += 0.5;
      matchReasons.push(`Trade matches: ${template.trade}`);
    }

    // Keyword matching
    for (const [keyword, mapping] of Object.entries(KEYWORD_MAPPINGS)) {
      if (titleLower.includes(keyword)) {
        if (mapping.trades.includes(template.trade)) {
          confidence += 0.3;
          matchReasons.push(`Keyword "${keyword}" matches trade`);
        }
        if (mapping.projectTypes.includes(template.projectType)) {
          confidence += 0.2;
          matchReasons.push(`Keyword "${keyword}" matches project type`);
        }
      }
    }

    // Template name matching
    if (titleLower.includes(template.projectType.toLowerCase())) {
      confidence += 0.2;
      matchReasons.push(`Job title contains project type "${template.projectType}"`);
    }

    // Usage count bonus (popular templates are more likely correct)
    confidence += Math.min(template.usageCount / 1000, 0.1);

    if (confidence > 0) {
      matches.push({
        template,
        confidence: Math.min(confidence, 1),
        matchReasons,
      });
    }
  }

  // Sort by confidence and return best match
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches.length > 0 ? matches[0] : null;
}

// ============================================
// DECISION TRACKER CREATION
// ============================================

/**
 * Calculate phase dates based on project start
 */
function calculatePhaseDates(
  projectStartDate: Date,
  template: DecisionTemplate
): Map<ProjectPhase, Date> {
  const phases: ProjectPhase[] = ['planning', 'demolition', 'rough_in', 'installation', 'finishing', 'final'];
  const phaseDurations = {
    planning: 0,
    demolition: 3,
    rough_in: 7,
    installation: 14,
    finishing: 21,
    final: 28,
  };

  const phaseDates = new Map<ProjectPhase, Date>();
  for (const phase of phases) {
    const date = new Date(projectStartDate);
    date.setDate(date.getDate() + phaseDurations[phase]);
    phaseDates.set(phase, date);
  }

  return phaseDates;
}

/**
 * Create a decision tracker instance for a job
 */
function createDecisionTracker(
  job: Job,
  template: DecisionTemplate
): CustomerDecisionTracker {
  const projectStartDate = job.startDate ? new Date(job.startDate) : new Date();
  const phaseDates = calculatePhaseDates(projectStartDate, template);

  // Create category instances
  const categories: CustomerDecisionCategory[] = template.categories.map((cat) => {
    const phaseDate = phaseDates.get(cat.phase) || projectStartDate;
    const dueDate = new Date(phaseDate);
    dueDate.setDate(dueDate.getDate() - cat.daysBeforePhaseStart);

    const items: CustomerDecisionItem[] = cat.items.map((item) => ({
      id: `decision_${job.id}_${item.id}`,
      itemId: item.id,
      name: item.name,
      description: item.description,
      inputType: item.inputType,
      options: item.options,
      priority: item.priority,
      status: 'pending',
      dueDate: dueDate.toISOString(),
      isOverdue: new Date() > dueDate,
      remindersSent: 0,
    }));

    return {
      id: `cat_${job.id}_${cat.id}`,
      categoryId: cat.id,
      name: cat.name,
      phase: cat.phase,
      dueDate: dueDate.toISOString(),
      items,
      isOverdue: new Date() > dueDate,
      completedCount: 0,
      totalCount: items.length,
    };
  });

  const totalDecisions = categories.reduce((sum, cat) => sum + cat.items.length, 0);

  return {
    id: `tracker_${job.id}`,
    jobId: job.id,
    customerId: `customer_${job.id}`,
    customerName: job.customer,
    customerPhone: job.customerPhone,
    customerEmail: job.customerEmail,
    templateId: template.id,
    templateName: template.name,
    projectStartDate: projectStartDate.toISOString(),
    phases: Array.from(phaseDates.entries()).map(([phase, date]) => ({
      phase,
      startDate: date.toISOString(),
    })),
    categories,
    totalDecisions,
    decidedCount: 0,
    pendingCount: totalDecisions,
    overdueCount: categories.reduce(
      (sum, cat) => sum + cat.items.filter((i) => i.isOverdue).length,
      0
    ),
    reminderFrequency: 'every_2_days',
    preferredChannel: 'whatsapp',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ============================================
// JOB DECISION LINKER CLASS
// ============================================

class JobDecisionLinker {
  private trackers: Map<string, CustomerDecisionTracker> = new Map();

  /**
   * Process a new job and create a decision tracker if matching template found
   */
  async linkJobToDecisions(job: Job): Promise<{
    success: boolean;
    tracker?: CustomerDecisionTracker;
    match?: TemplateMatch;
    error?: string;
  }> {
    try {
      // Find matching template
      const match = findMatchingTemplate(job);

      if (!match) {
        return {
          success: false,
          error: 'No matching template found for this job type',
        };
      }

      // Require minimum confidence
      if (match.confidence < 0.3) {
        return {
          success: false,
          error: `Template match confidence too low (${Math.round(match.confidence * 100)}%)`,
          match,
        };
      }

      // Create decision tracker
      const tracker = createDecisionTracker(job, match.template);
      this.trackers.set(tracker.id, tracker);

      // Track for intelligence
      trackUserAction('decision_tracker_created', {
        jobId: job.id,
        templateId: match.template.id,
        templateName: match.template.name,
        confidence: match.confidence,
        totalDecisions: tracker.totalDecisions,
        autoLinked: true,
      });

      console.log(
        `[JobDecisionLinker] Created tracker for job "${job.title}" using template "${match.template.name}" (${Math.round(match.confidence * 100)}% confidence)`
      );

      return {
        success: true,
        tracker,
        match,
      };
    } catch (error) {
      console.error('[JobDecisionLinker] Failed to link job:', error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Get available templates
   */
  getTemplates(): DecisionTemplate[] {
    return DEFAULT_TEMPLATES;
  }

  /**
   * Get templates for a specific trade
   */
  getTemplatesForTrade(trade: Trade): DecisionTemplate[] {
    return DEFAULT_TEMPLATES.filter((t) => t.trade === trade);
  }

  /**
   * Suggest template for a job title
   */
  suggestTemplate(jobTitle: string): TemplateMatch | null {
    return findMatchingTemplate({
      id: 'temp',
      title: jobTitle,
      customer: '',
    });
  }

  /**
   * Get tracker for a job
   */
  getTrackerForJob(jobId: string): CustomerDecisionTracker | undefined {
    return Array.from(this.trackers.values()).find((t) => t.jobId === jobId);
  }

  /**
   * Get all trackers
   */
  getAllTrackers(): CustomerDecisionTracker[] {
    return Array.from(this.trackers.values());
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const jobDecisionLinker = new JobDecisionLinker();

// ============================================
// REACT HOOK
// ============================================

import { useState, useCallback, useEffect } from 'react';

export function useJobDecisionLinker() {
  const [templates] = useState(jobDecisionLinker.getTemplates());

  const linkJob = useCallback(async (job: Job) => {
    return jobDecisionLinker.linkJobToDecisions(job);
  }, []);

  const suggestTemplate = useCallback((jobTitle: string) => {
    return jobDecisionLinker.suggestTemplate(jobTitle);
  }, []);

  return {
    templates,
    linkJob,
    suggestTemplate,
  };
}

export function useTemplateSuggestion(jobTitle: string) {
  const [suggestion, setSuggestion] = useState<TemplateMatch | null>(null);

  useEffect(() => {
    if (jobTitle.length >= 3) {
      setSuggestion(jobDecisionLinker.suggestTemplate(jobTitle));
    } else {
      setSuggestion(null);
    }
  }, [jobTitle]);

  return suggestion;
}
