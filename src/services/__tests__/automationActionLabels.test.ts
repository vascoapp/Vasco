// automations.tsx renders each workflow-pack step as
//   `automations.actionLabels.<step.action>`, falling back to the raw
// identifier with underscores stripped. That fallback is silent, so a pack
// gaining a step simply starts printing an English enum inside a translated
// sentence — which is how "Direct: send on my way" and "1d voor vervaldatum:
// send appointment reminder" ended up on a Dutch screen next to correctly
// translated siblings.
//
// i18n:audit cannot catch this: the keys are present and identical across
// locales, they just don't cover every action. This pins the label map to the
// action enum instead.

import fs from 'fs';
import path from 'path';

const LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it'] as const;

const packSrc = fs.readFileSync(
  path.join(__dirname, '..', 'workflowPackService.ts'),
  'utf8',
);

const actionIds = Array.from(
  new Set(Array.from(packSrc.matchAll(/action:\s*'([a-z0-9_]+)'/g), (m) => m[1])),
).sort();

const labelsFor = (locale: string): Record<string, string> => {
  const json = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', '..', 'i18n', 'locales', `${locale}.json`),
      'utf8',
    ),
  );
  return json.automations?.actionLabels ?? {};
};

describe('automations action labels', () => {
  it('finds the action ids to check', () => {
    // Guards the regex itself: if the pack definitions are restructured and
    // this stops matching, the rest of the suite would vacuously pass.
    expect(actionIds.length).toBeGreaterThan(20);
    expect(actionIds).toContain('send_on_my_way');
  });

  it.each(LOCALES)('%s has a label for every workflow-pack action', (locale) => {
    const labels = labelsFor(locale);
    const missing = actionIds.filter((id) => !labels[id]);
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)('%s has no label left over for a removed action', (locale) => {
    const stale = Object.keys(labelsFor(locale)).filter((k) => !actionIds.includes(k));
    expect(stale).toEqual([]);
  });

  it('translates the labels rather than echoing the identifier', () => {
    // A label equal to the de-underscored id is the fallback in disguise.
    const nl = labelsFor('nl');
    const echoed = actionIds.filter((id) => nl[id] === id.replace(/_/g, ' '));
    expect(echoed).toEqual([]);
  });
});
