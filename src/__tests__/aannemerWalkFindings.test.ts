// Aannemer walk 2026-10-03 — the static half (the flows have their own tests).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (f: string) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const locale = (l: string) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l}.json`), 'utf8'));

it('the planner and the crew use DK colours, not hex (blue/pink/indigo on the dark UI)', () => {
  for (const f of ['app/contractor/schedule.tsx', 'app/contractor/crew.tsx']) {
    expect(`${f}: ${(read(f).match(/'#[0-9A-Fa-f]{6}'/g) ?? []).join(', ')}`).toBe(`${f}: `);
  }
});

it('"open projects" is not called "running" — it includes the ones still in planning', () => {
  const running = { nl: 'Lopend', de: 'Laufend', fr: 'En cours', es: 'En curso', it: 'In corso' } as Record<string, string>;
  for (const [l, word] of Object.entries(running)) {
    expect(`${l}: ${locale(l).contractor.projects.filterOpen}`).not.toBe(`${l}: ${word}`);
  }
});

it('glazing is glazing in Dutch, not window cleaning', () => {
  expect(locale('nl').onboarding.trades.glazing).not.toMatch(/bewassing/i);
});
