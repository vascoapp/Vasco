// =============================================================================
// PROJECT TEMPLATES — a new project arrives with a plan, not an empty list
// =============================================================================
// Milestones became editable in `0756a63` and sequenceable in `311b871`, which
// means the week-view staffing strip and the handover check both finally work —
// for any aannemer willing to type out their trade sequence by hand first.
// Nobody does that on day one, so both features stayed invisible in practice.
//
// A badkamer and a keuken have a KNOWN trade order. Shipping that order as
// content is the difference between a feature people use and one they have to
// build before it does anything.
//
// ⚠️ Ship the trade ORDER, never usage statistics. `f5105a2` is the precedent:
// `BUILTIN_TEMPLATES` told a day-one contractor "34× gebruikt" about their own
// past behaviour, which was fabricated. A template carries a name, a sequence,
// and nothing else that pretends to be measured.
//
// Pure — takes a translator, returns milestones. No store, no singleton.
// =============================================================================

import type { ProjectMilestone } from '../types/project';
import { defaultDependsOn } from './projectSequenceService';

/**
 * A step in a trade sequence.
 *
 * `week` is 1-based from project start, matching `ProjectMilestone.weekNumber`.
 * Two steps in the SAME week are concurrent trades (first-fix plumbing and
 * electrics genuinely do overlap) and are deliberately not chained to each
 * other — see `defaultDependsOn`, which only links across weeks.
 */
export interface TemplateStep {
  /** i18n key under `projectTemplate.step`, e.g. `roughIn`. */
  step: string;
  /** Trade slug from the milestone editor's list, or undefined for e.g. handover. */
  trade?: string;
  week: number;
}

export interface ProjectTemplate {
  id: string;
  /** i18n key under `projectTemplate.name`. */
  nameKey: string;
  steps: TemplateStep[];
}

/**
 * The shipped sequences.
 *
 * Ordered small-to-large so the common jobs are the first thing offered. Week
 * numbers are the realistic shape of the job, not a promise — the aannemer
 * edits them, and nothing here is presented as a prediction.
 */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'bathroom',
    nameKey: 'bathroom',
    steps: [
      { step: 'stripOut', trade: 'demolition', week: 1 },
      { step: 'roughInPlumbing', trade: 'plumbing', week: 1 },
      { step: 'roughInElectrical', trade: 'electrical', week: 2 },
      { step: 'wallsReady', trade: 'plastering', week: 2 },
      { step: 'tilingDone', trade: 'tiling', week: 3 },
      { step: 'sanitaryFitted', trade: 'plumbing', week: 4 },
      { step: 'handover', week: 4 },
    ],
  },
  {
    id: 'kitchen',
    nameKey: 'kitchen',
    steps: [
      { step: 'stripOut', trade: 'demolition', week: 1 },
      { step: 'roughInPlumbing', trade: 'plumbing', week: 1 },
      { step: 'roughInElectrical', trade: 'electrical', week: 1 },
      { step: 'wallsReady', trade: 'plastering', week: 2 },
      { step: 'floorLaid', trade: 'flooring', week: 2 },
      { step: 'kitchenFitted', trade: 'carpentry', week: 3 },
      { step: 'handover', week: 3 },
    ],
  },
  {
    id: 'attic',
    nameKey: 'attic',
    steps: [
      { step: 'stripOut', trade: 'demolition', week: 1 },
      { step: 'structureReady', trade: 'carpentry', week: 2 },
      { step: 'insulationDone', trade: 'insulation', week: 3 },
      { step: 'roughInElectrical', trade: 'electrical', week: 3 },
      { step: 'roughInPlumbing', trade: 'plumbing', week: 4 },
      { step: 'wallsReady', trade: 'plastering', week: 5 },
      { step: 'floorLaid', trade: 'flooring', week: 6 },
      { step: 'paintingDone', trade: 'painting', week: 6 },
      { step: 'handover', week: 7 },
    ],
  },
  {
    id: 'wholeHome',
    nameKey: 'wholeHome',
    steps: [
      { step: 'stripOut', trade: 'demolition', week: 1 },
      { step: 'structureReady', trade: 'carpentry', week: 2 },
      { step: 'roofDone', trade: 'roofing', week: 3 },
      { step: 'insulationDone', trade: 'insulation', week: 4 },
      { step: 'roughInPlumbing', trade: 'plumbing', week: 5 },
      { step: 'roughInElectrical', trade: 'electrical', week: 5 },
      { step: 'wallsReady', trade: 'plastering', week: 7 },
      { step: 'tilingDone', trade: 'tiling', week: 8 },
      { step: 'floorLaid', trade: 'flooring', week: 9 },
      { step: 'paintingDone', trade: 'painting', week: 10 },
      { step: 'handover', week: 11 },
    ],
  },
];

export function templateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

/**
 * Turn a template into real milestones, chained into a handover sequence.
 *
 * `translate` is passed in rather than imported so this stays pure and the
 * caller's `t` (already bound to the contractor's language, not the device)
 * is the one used. Titles are authored per step — composing them from trade
 * labels produces "Tegelzetten klaar", which is not how the trade is named in
 * a plan (#131: a translated enum label is not a drop-in noun).
 *
 * `idPrefix` exists so tests get stable ids; production passes a timestamp so
 * two templates applied to two projects cannot collide.
 */
export function buildMilestonesFromTemplate(args: {
  template: ProjectTemplate;
  translate: (key: string, fallback: string) => string;
  idPrefix?: string;
}): ProjectMilestone[] {
  const { template, translate } = args;
  const prefix = args.idPrefix ?? `ms-${Date.now()}`;
  const out: ProjectMilestone[] = [];

  for (const [i, s] of template.steps.entries()) {
    const milestone: ProjectMilestone = {
      id: `${prefix}-${i}`,
      title: translate(`projectTemplate.step.${s.step}`, s.step),
      trade: s.trade,
      weekNumber: s.week,
      completed: false,
      jobIds: [],
      // Built against what already exists, so each step waits on the last step
      // planned in an EARLIER week. Same-week steps stay concurrent.
      dependsOn: defaultDependsOn(out, s.week),
    };
    out.push(milestone);
  }
  return out;
}
