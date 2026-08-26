// =============================================================================
// JOB PREFILL — a scheduling default on job create
// =============================================================================
// When a contractor drops a fresh job with only a title + trade, ask the
// duration predictor for a sensible default so the scheduling UI doesn't
// leave them staring at empty fields.
//
// HOURS ONLY. This service used to also return `suggestedPriceLow/High`,
// computed from a hardcoded `LABOR_RATE` table of invented €/hour rates served
// to every contractor in every country — and `addJob` stamped it into
// `quotedAmount`, a field whose name asserts what was AGREED. A job created
// from a bare title arrived priced at €198 and that guess flowed into the
// margin generators, project P&L, the customer's spend total and the invoice
// prefill (learnings #207). The price is gone; the table with it, so nothing
// can pick it back up. A prediction may fill a field named `suggested*`; it may
// not fill one that asserts what happened.
// =============================================================================

import { predictJobDuration } from '../intelligence/mlModels';

export interface JobPrefillInput {
  trade: string;
  title: string;
  materialCount?: number;
}

export interface JobPrefillResult {
  suggestedHours: number;
  confidence: number;
}

// ── The seed heuristic, in the six languages this app ships in ──────────────
// The regexes were English-only (`/install|replace|repair|check/i`) against a
// title the contractor types in their OWN language, so "Heizungswartung",
// "CV-ketel onderhoud" and "remplacement chaudière" matched nothing and every
// non-English job fell to the flat 3-hour default. That is the
// home-market-default shape (#148/#151/#155/#157) where the home market is
// *English* — which is nobody's market here.
//
// Two match modes, because German writes a job title as one word:
//   `words` are matched with a boundary — short tokens that would otherwise hit
//           inside an unrelated word ("lek" inside "elektra", "pose" inside
//           "opposé").
//   `stems` are matched as substrings — long enough (6+) to be safe inside a
//           compound, which is what makes "Heizungs|wartung" and
//           "Dachrinnen|reparatur" resolve at all.
type Seed = { words: string[]; stems: string[] };

/** Multi-day-ish work: fitting something new, a renovation, an extension. */
const LONG: Seed = {
  words: [
    'install', 'build', 'fit', 'lay',
    'aanleg', 'plaatsen', 'uitbouw', 'aanbouw', 'leggen',
    'einbau', 'umbau', 'anbau', 'neubau', 'verlegen',
    'pose', 'poser', 'créer',
    'obra', 'montar',
    'posa', 'nuovo',
  ],
  stems: [
    'install', 'renovat', 'renovier', 'extension', 'construct',
    'aanleggen', 'verbouw', 'montage', 'monteren', 'nieuwbouw',
    'sanierung', 'sanieren', 'montieren', 'einbauen',
    'rénovation', 'rénover', 'aménagement', 'construire',
    'instalación', 'instalar', 'reforma', 'ampliación', 'montaje',
    'installazione', 'installare', 'ristruttur', 'rifacimento',
    'ampliamento', 'costruzione', 'montaggio',
  ],
};

/** Half-day work: swapping a part, a repair, routine maintenance. */
const MEDIUM: Seed = {
  words: [
    'replace', 'repair', 'fix', 'service',
    'storing', 'defect', 'lekkage', 'herstel', 'herstellen',
    'defekt', 'ersetzen', 'leck', 'undicht',
    'panne', 'fuite',
    'avería', 'fuga',
    'guasto', 'perdita',
  ],
  stems: [
    'replace', 'repair', 'maintenance',
    'vervang', 'reparatie', 'repareren', 'onderhoud',
    'austausch', 'reparatur', 'wartung', 'instandsetzung',
    'remplac', 'réparation', 'réparer', 'entretien', 'dépannage',
    'sustitu', 'reemplaz', 'reparación', 'reparar', 'mantenimiento',
    'sostitu', 'riparazione', 'riparare', 'manutenzione',
  ],
};

/** An hour: looking at it, measuring up, quoting. */
const SHORT: Seed = {
  words: [
    'check', 'quote', 'visit', 'survey',
    'opname', 'meten', 'keuren', 'keuring', 'offerte',
    'aufmaß', 'abnahme', 'angebot',
    'devis', 'visite',
    'visita', 'revisar',
    'verifica',
  ],
  stems: [
    'inspect', 'inspectie', 'controle', 'controleren', 'bezichtiging',
    'prüfung', 'prüfen', 'kontrolle', 'inspektion', 'besichtigung',
    'contrôle', 'contrôler', 'inspection', 'diagnostic',
    'revisión', 'inspección', 'inspeccionar', 'presupuesto', 'comprobar',
    'controllo', 'controllare', 'ispezione', 'preventivo', 'sopralluogo',
  ],
};

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matches(title: string, seed: Seed): boolean {
  const t = title.toLowerCase();
  if (seed.stems.some((stem) => t.includes(stem))) return true;
  // Deliberately NOT `\b` or `\p{L}`: `\b` is ASCII-only, so it would fire in
  // the middle of "prüfen", and Unicode property escapes are not safe to assume
  // on Hermes. An explicit Latin range covers every character these six
  // languages spell a trade word with.
  return seed.words.some((w) =>
    new RegExp(`(^|[^a-z0-9\u00c0-\u024f])${escapeRe(w)}([^a-z0-9\u00c0-\u024f]|$)`).test(t),
  );
}

/** Exported for the test that pins the six languages against each other. */
export function seedHoursForTitle(title: string): number {
  if (matches(title, LONG)) return 6;
  if (matches(title, MEDIUM)) return 3;
  if (matches(title, SHORT)) return 1;
  return 3;
}

export async function prefillJob(input: JobPrefillInput): Promise<JobPrefillResult> {
  const trade = input.trade.toLowerCase();
  const seedHours = seedHoursForTitle(input.title);

  let suggestedHours = seedHours;
  let confidence = 0.4;
  try {
    const pred = await predictJobDuration({
      trade,
      estimatedHours: seedHours,
      materialCount: input.materialCount ?? 0,
      crewSize: 1,
    });
    suggestedHours = Math.round(((pred as any).expectedHours ?? seedHours) * 10) / 10;
    confidence = (pred as any).confidence ?? confidence;
  } catch {}

  return { suggestedHours, confidence };
}
