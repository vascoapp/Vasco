// =============================================================================
// MESSAGE TEMPLATE SERVICE — Pre-built and custom message templates
// =============================================================================
// Variable interpolation: {{customer}}, {{amount}}, {{date}}, {{jobTitle}}
// Stored in AsyncStorage for offline-first CRUD.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n/i18n';

const TEMPLATES_KEY = '@vasco_message_templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateCategory = 'reminder' | 'follow-up' | 'confirmation' | 'thank-you' | 'custom';

export interface MessageTemplate {
  id: string;
  title: string;
  body: string;
  category: TemplateCategory;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateContext {
  customer?: string;
  amount?: string;
  date?: string;
  jobTitle?: string;
  invoiceId?: string;
  daysOverdue?: number;
  contractorName?: string;
}

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

function getBuiltInTemplates(): MessageTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'builtin-invoice-reminder',
      title: i18n.t('templates.invoiceReminder', 'Invoice Reminder'),
      body: i18n.t(
        'templates.invoiceReminderBody',
        'Hi {{customer}},\n\nThis is a friendly reminder about invoice {{invoiceId}} for {{amount}}. Could you arrange payment at your earliest convenience?\n\nThank you,\n{{contractorName}}\nSent via Vasco'
      ),
      category: 'reminder',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'builtin-quote-followup',
      title: i18n.t('templates.quoteFollowUp', 'Quote Follow-up'),
      body: i18n.t(
        'templates.quoteFollowUpBody',
        'Hi {{customer}},\n\nI wanted to follow up on the quote for "{{jobTitle}}" ({{amount}}).\n\nDo you have any questions or would you like to proceed?\n\nBest regards,\n{{contractorName}}\nSent via Vasco'
      ),
      category: 'follow-up',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'builtin-job-confirmation',
      title: i18n.t('templates.jobConfirmation', 'Job Confirmation'),
      body: i18n.t(
        'templates.jobConfirmationBody',
        'Hi {{customer}},\n\nThis is to confirm your appointment for "{{jobTitle}}" on {{date}}.\n\nPlease let me know if you need to reschedule.\n\nSee you then!\n{{contractorName}}\nSent via Vasco'
      ),
      category: 'confirmation',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'builtin-schedule-change',
      title: i18n.t('templates.scheduleChange', 'Schedule Change'),
      body: i18n.t(
        'templates.scheduleChangeBody',
        'Hi {{customer}},\n\nI need to inform you of a schedule change for "{{jobTitle}}". The new date is {{date}}.\n\nApologies for any inconvenience.\n\n{{contractorName}}\nSent via Vasco'
      ),
      category: 'confirmation',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'builtin-thank-you',
      title: i18n.t('templates.thankYou', 'Thank You'),
      body: i18n.t(
        'templates.thankYouBody',
        'Hi {{customer}},\n\nThank you for choosing us for "{{jobTitle}}"! We appreciate your business.\n\nIf you have any questions or need further assistance, please don\'t hesitate to reach out.\n\nBest regards,\n{{contractorName}}\nSent via Vasco'
      ),
      category: 'thank-you',
      isBuiltIn: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ---------------------------------------------------------------------------
// Variable interpolation
// ---------------------------------------------------------------------------

export function resolveTemplate(template: MessageTemplate, context: TemplateContext): string {
  let result = template.body;
  if (context.customer) result = result.replace(/\{\{customer\}\}/g, context.customer);
  if (context.amount) result = result.replace(/\{\{amount\}\}/g, context.amount);
  if (context.date) result = result.replace(/\{\{date\}\}/g, context.date);
  if (context.jobTitle) result = result.replace(/\{\{jobTitle\}\}/g, context.jobTitle);
  if (context.invoiceId) result = result.replace(/\{\{invoiceId\}\}/g, context.invoiceId);
  if (context.daysOverdue !== undefined) result = result.replace(/\{\{daysOverdue\}\}/g, String(context.daysOverdue));
  if (context.contractorName) result = result.replace(/\{\{contractorName\}\}/g, context.contractorName);
  return result;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

async function loadCustomTemplates(): Promise<MessageTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(TEMPLATES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

async function saveCustomTemplates(templates: MessageTemplate[]): Promise<void> {
  await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)).catch(() => {});
}

/** Get all templates (built-in + custom) */
export async function getAllTemplates(): Promise<MessageTemplate[]> {
  const builtIn = getBuiltInTemplates();
  const custom = await loadCustomTemplates();
  return [...builtIn, ...custom];
}

/** Get templates by category */
export async function getTemplatesByCategory(category: TemplateCategory): Promise<MessageTemplate[]> {
  const all = await getAllTemplates();
  return all.filter(t => t.category === category);
}

/** Create a new custom template */
export async function createTemplate(
  title: string,
  body: string,
  category: TemplateCategory
): Promise<MessageTemplate> {
  const now = new Date().toISOString();
  const template: MessageTemplate = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    body,
    category,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  };
  const existing = await loadCustomTemplates();
  existing.push(template);
  await saveCustomTemplates(existing);
  return template;
}

/** Update a custom template */
export async function updateTemplate(
  id: string,
  updates: Partial<Pick<MessageTemplate, 'title' | 'body' | 'category'>>
): Promise<MessageTemplate | null> {
  const existing = await loadCustomTemplates();
  const idx = existing.findIndex(t => t.id === id);
  if (idx === -1) return null;
  existing[idx] = {
    ...existing[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveCustomTemplates(existing);
  return existing[idx];
}

/** Delete a custom template */
export async function deleteTemplate(id: string): Promise<boolean> {
  const existing = await loadCustomTemplates();
  const filtered = existing.filter(t => t.id !== id);
  if (filtered.length === existing.length) return false;
  await saveCustomTemplates(filtered);
  return true;
}

/** Get template for a specific AI queue action type */
export async function getTemplateForAction(
  actionType: 'draft_reminder' | 'draft_followup'
): Promise<MessageTemplate | null> {
  const all = await getAllTemplates();
  if (actionType === 'draft_reminder') {
    return all.find(t => t.id === 'builtin-invoice-reminder') || null;
  }
  if (actionType === 'draft_followup') {
    return all.find(t => t.id === 'builtin-quote-followup') || null;
  }
  return null;
}
