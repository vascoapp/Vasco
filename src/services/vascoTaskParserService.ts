// =============================================================================
// VASCO TASK PARSER SERVICE - Natural language Dutch task parsing
// =============================================================================
// Parses Dutch input like "Inspectie ketel om 14:00 morgen" into structured
// task objects. Uses simple keyword matching (no external NLP library).
// =============================================================================

import { useMemo, useCallback } from 'react';
import { localDateKey } from '../utils/dateKey';

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedTask {
  title: string;
  time?: string; // "HH:MM"
  date?: string; // ISO date string
  dateLabel?: string; // "Vandaag", "Morgen", etc.
  category?: TaskCategory;
  confidence: number; // 0–1
  raw: string;
}

export type TaskCategory =
  | 'inspectie'
  | 'factuur'
  | 'bestelling'
  | 'reparatie'
  | 'onderhoud'
  | 'overleg'
  | 'veiligheid'
  | 'administratie'
  | 'overig';

// =============================================================================
// KEYWORD MAPS
// =============================================================================

const CATEGORY_KEYWORDS: Record<TaskCategory, string[]> = {
  inspectie: ['inspectie', 'keuring', 'controle', 'check', 'audit', 'inspecteren'],
  factuur: ['factuur', 'factureer', 'rekening', 'betaling', 'betaal', 'invoice'],
  bestelling: ['bestel', 'bestelling', 'order', 'inkoop', 'materiaal', 'levering'],
  reparatie: ['reparatie', 'repareer', 'fix', 'herstel', 'vervang', 'lekkage', 'storing'],
  onderhoud: ['onderhoud', 'service', 'schoonmaak', 'preventief'],
  overleg: ['overleg', 'meeting', 'vergadering', 'bel', 'afspraak', 'bespreek', 'bespreking'],
  veiligheid: ['veiligheid', 'vca', 'risico', 'pbm', 'gevaar', 'arbo'],
  administratie: ['admin', 'administratie', 'rapport', 'verslag', 'document', 'papierwerk'],
  overig: [],
};

const DATE_KEYWORDS: Record<string, (today: Date) => Date> = {
  vandaag: (today) => today,
  morgen: (today) => { const d = new Date(today); d.setDate(d.getDate() + 1); return d; },
  overmorgen: (today) => { const d = new Date(today); d.setDate(d.getDate() + 2); return d; },
  maandag: (today) => getNextWeekday(today, 1),
  dinsdag: (today) => getNextWeekday(today, 2),
  woensdag: (today) => getNextWeekday(today, 3),
  donderdag: (today) => getNextWeekday(today, 4),
  vrijdag: (today) => getNextWeekday(today, 5),
  'volgende week': (today) => { const d = new Date(today); d.setDate(d.getDate() + 7); return d; },
};

function getNextWeekday(from: Date, dayOfWeek: number): Date {
  const d = new Date(from);
  const diff = (dayOfWeek + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// =============================================================================
// PARSER
// =============================================================================

const TIME_REGEX = /om\s+(\d{1,2})[:.:](\d{2})/i;
const TIME_SIMPLE_REGEX = /om\s+(\d{1,2})\s*uur/i;

function parseTime(input: string): string | undefined {
  const match = input.match(TIME_REGEX);
  if (match) {
    const hours = match[1].padStart(2, '0');
    const mins = match[2].padStart(2, '0');
    return `${hours}:${mins}`;
  }
  const simpleMatch = input.match(TIME_SIMPLE_REGEX);
  if (simpleMatch) {
    const hours = simpleMatch[1].padStart(2, '0');
    return `${hours}:00`;
  }
  return undefined;
}

function parseDate(input: string): { date?: string; label?: string } {
  const lower = input.toLowerCase();
  const today = new Date();

  for (const [keyword, resolver] of Object.entries(DATE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      const resolved = resolver(today);
      return {
        date: localDateKey(resolved),
        label: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      };
    }
  }

  return {};
}

function parseCategory(input: string): TaskCategory | undefined {
  const lower = input.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [TaskCategory, string[]][]) {
    if (category === 'overig') continue;
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }
  return undefined;
}

function cleanTitle(input: string): string {
  let title = input.trim();
  // Remove parsed time/date tokens for a cleaner title
  title = title.replace(TIME_REGEX, '').replace(TIME_SIMPLE_REGEX, '');
  for (const keyword of Object.keys(DATE_KEYWORDS)) {
    title = title.replace(new RegExp(keyword, 'gi'), '');
  }
  // Clean up leftover whitespace
  title = title.replace(/\s{2,}/g, ' ').trim();
  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  return title;
}

export function parseTaskInput(input: string): ParsedTask {
  const time = parseTime(input);
  const { date, label: dateLabel } = parseDate(input);
  const category = parseCategory(input);
  const title = cleanTitle(input);

  // Confidence based on how many fields were extracted
  let confidence = 0.3; // base
  if (title.length > 3) confidence += 0.2;
  if (time) confidence += 0.2;
  if (date) confidence += 0.15;
  if (category) confidence += 0.15;

  return {
    title: title || input,
    time,
    date,
    dateLabel,
    category: category || 'overig',
    confidence: Math.min(confidence, 1),
    raw: input,
  };
}

// =============================================================================
// HOOK
// =============================================================================

export function useTaskParser() {
  const parse = useCallback((input: string): ParsedTask => {
    return parseTaskInput(input);
  }, []);

  const categoryIcon = useMemo(() => {
    const map: Record<TaskCategory, string> = {
      inspectie: 'search',
      factuur: 'receipt',
      bestelling: 'cart',
      reparatie: 'hammer',
      onderhoud: 'construct',
      overleg: 'people',
      veiligheid: 'shield-checkmark',
      administratie: 'document-text',
      overig: 'ellipsis-horizontal',
    };
    return map;
  }, []);

  const categoryLabel = useMemo(() => {
    const map: Record<TaskCategory, string> = {
      inspectie: 'Inspectie',
      factuur: 'Factuur',
      bestelling: 'Bestelling',
      reparatie: 'Reparatie',
      onderhoud: 'Onderhoud',
      overleg: 'Overleg',
      veiligheid: 'Veiligheid',
      administratie: 'Administratie',
      overig: 'Overig',
    };
    return map;
  }, []);

  return { parse, categoryIcon, categoryLabel };
}
