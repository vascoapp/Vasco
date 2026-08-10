/**
 * A new project should arrive with a plan.
 *
 * The milestone editor and the handover sequencer both work — for an aannemer
 * willing to type their whole trade order in by hand first. Nobody does that on
 * day one, so both features were invisible in practice. These assert the
 * shipped sequences are real plans (ordered, chained, staffable) and that they
 * carry no fabricated usage data.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PROJECT_TEMPLATES,
  templateById,
  buildMilestonesFromTemplate,
} from '../projectTemplateService';
import { sequenceByMilestoneId, milestonesInCycle } from '../projectSequenceService';

// The translator the screens pass in, stubbed to echo the key so the tests can
// see which step produced which milestone.
const echo = (key: string) => key;

const build = (id: string) =>
  buildMilestonesFromTemplate({
    template: templateById(id)!,
    translate: echo,
    idPrefix: `t-${id}`,
  });

describe('the shipped templates are well-formed plans', () => {
  it.each(PROJECT_TEMPLATES.map(t => [t.id] as const))('%s has an ordered, non-empty sequence', (id) => {
    const t = templateById(id)!;
    expect(t.steps.length).toBeGreaterThan(2);
    // Weeks never go backwards: a plan that jumps back is not a sequence.
    const weeks = t.steps.map(s => s.week);
    expect([...weeks].sort((a, b) => a - b)).toEqual(weeks);
    expect(Math.min(...weeks)).toBe(1);
  });

  it.each(PROJECT_TEMPLATES.map(t => [t.id] as const))('%s ends with a handover that is not a trade', (id) => {
    const steps = templateById(id)!.steps;
    const last = steps[steps.length - 1];
    expect(last.step).toBe('handover');
    // Deliberately untraded: crewWeekService must not report "nobody of trade
    // <handover> is booked". Sequencing still uses it as a predecessor.
    expect(last.trade).toBeUndefined();
  });

  it('carries no usage statistics — only a name and a sequence', () => {
    // f5105a2: BUILTIN_TEMPLATES told a day-one contractor "34x gebruikt"
    // about their own past behaviour. Shipped content may not claim measurement.
    for (const t of PROJECT_TEMPLATES) {
      expect(Object.keys(t).sort()).toEqual(['id', 'nameKey', 'steps']);
      for (const s of t.steps) {
        expect(Object.keys(s).every(k => ['step', 'trade', 'week'].includes(k))).toBe(true);
      }
    }
  });

  it('only uses trades the milestone editor can also offer', () => {
    // A template that seeds a trade the editor cannot select leaves the
    // aannemer unable to correct it.
    const EDITOR_TRADES = new Set([
      'demolition', 'plumbing', 'electrical', 'gas', 'carpentry', 'tiling',
      'plastering', 'flooring', 'painting', 'roofing', 'insulation', 'glazing',
    ]);
    for (const t of PROJECT_TEMPLATES) {
      for (const s of t.steps) {
        if (s.trade) expect(EDITOR_TRADES.has(s.trade)).toBe(true);
      }
    }
  });
});

describe('buildMilestonesFromTemplate', () => {
  it('produces one milestone per step, with unique ids', () => {
    const ms = build('bathroom');
    expect(ms).toHaveLength(templateById('bathroom')!.steps.length);
    expect(new Set(ms.map(m => m.id)).size).toBe(ms.length);
  });

  it('chains each step onto the last one planned in an EARLIER week', () => {
    const ms = build('bathroom');
    const byStep = (k: string) => ms.find(m => m.title === `projectTemplate.step.${k}`)!;
    // stripOut (wk1) is first: nothing to wait for.
    expect(byStep('stripOut').dependsOn).toEqual([]);
    // roughInElectrical (wk2) waits on the last wk1 step, not on nothing.
    expect(byStep('roughInElectrical').dependsOn).toEqual([byStep('roughInPlumbing').id]);
    // tilingDone (wk3) waits on the last wk2 step.
    expect(byStep('tilingDone').dependsOn).toEqual([byStep('wallsReady').id]);
  });

  it('leaves same-week trades concurrent instead of inventing a handover', () => {
    const ms = build('kitchen');
    const byStep = (k: string) => ms.find(m => m.title === `projectTemplate.step.${k}`)!;
    // First-fix plumbing and electrics genuinely overlap in week 1. Chaining
    // them would claim a handover the trade does not have.
    expect(byStep('roughInPlumbing').dependsOn).toEqual([]);
    expect(byStep('roughInElectrical').dependsOn).toEqual([]);
  });

  it('never builds a cycle, for any shipped template', () => {
    for (const t of PROJECT_TEMPLATES) {
      expect(milestonesInCycle(build(t.id))).toEqual(new Set());
    }
  });

  it('produces a plan the sequencer reads as on-track on day one', () => {
    // A project created today is in week 1: nothing is overdue, so a freshly
    // applied template must not immediately cry "blocked" or "slipped".
    const project: any = {
      id: 'p', title: 'Badkamer', status: 'active',
      startDate: new Date().toISOString(), jobIds: [],
      milestones: build('bathroom'),
    };
    const seq = sequenceByMilestoneId({ project, today: new Date() });
    for (const m of project.milestones) {
      expect(seq.get(m.id)!.blockedBy).toHaveLength(0);
      expect(seq.get(m.id)!.slipWeeks).toBe(0);
    }
  });

  it('uses the caller\'s translator, so titles follow the contractor not the device', () => {
    const ms = buildMilestonesFromTemplate({
      template: templateById('kitchen')!,
      translate: (key, fallback) => `NL:${key}:${fallback}`,
      idPrefix: 'x',
    });
    expect(ms[0].title).toBe('NL:projectTemplate.step.stripOut:stripOut');
  });

  it('keeps ids distinct across two applications, so two projects cannot collide', () => {
    const a = buildMilestonesFromTemplate({ template: templateById('attic')!, translate: echo, idPrefix: 'a' });
    const b = buildMilestonesFromTemplate({ template: templateById('attic')!, translate: echo, idPrefix: 'b' });
    expect(a.map(m => m.id).some(id => b.map(x => x.id).includes(id))).toBe(false);
  });
});

describe('every shipped step is translated in every locale', () => {
  // This is not a nice-to-have. `translate()`'s fallback is PERSISTED as
  // `ProjectMilestone.title`, so a step with no key writes the raw camelCase key
  // ("roughInPlumbing") into the project as a milestone name — in every
  // language, permanently, in the customer-visible plan. i18n:audit cannot catch
  // it either: it compares en against the other five, so a step missing from ALL
  // six audits clean. (learnings #123, #118.)
  const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;
  const load = (lc: string) =>
    JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'i18n', 'locales', `${lc}.json`), 'utf8'),
    ).projectTemplate;

  it.each(LOCALES)('%s translates every step, template name and UI string', (lc) => {
    const pt = load(lc);
    expect(pt).toBeDefined();
    for (const t of PROJECT_TEMPLATES) {
      expect(typeof pt.name?.[t.nameKey]).toBe('string');
      for (const s of t.steps) expect(typeof pt.step?.[s.step]).toBe('string');
    }
    // `stepCount` puts a count directly before a noun, so it needs real plural
    // forms — the "1 dagen" / "1 JOBS" class.
    for (const k of ['pick', 'stepCount_one', 'stepCount_other']) {
      expect(typeof pt[k]).toBe('string');
    }
  });

  it('ships no step translation the templates never use', () => {
    // A leftover key is a step someone removed without removing its copy —
    // harmless to render, but it hides the fact that the sequence changed.
    const used = new Set(PROJECT_TEMPLATES.flatMap(t => t.steps.map(s => s.step)));
    for (const lc of LOCALES) {
      expect(Object.keys(load(lc).step).filter(k => !used.has(k))).toEqual([]);
    }
  });
});
