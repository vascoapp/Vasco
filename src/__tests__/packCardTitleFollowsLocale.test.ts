// Automation cards are titled "<pack>: <subject>". French walk 2026-09-29:
// "Relances de paiement: Boulangerie Lefort" — French typography puts a space
// before the colon, and the join was a template literal no locale could
// change. An empty label also left a dangling "Relances de paiement: ".
import fs from 'fs';
import path from 'path';
import i18next from 'i18next';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const load = (l: string) => JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${l}.json`), 'utf8'));

it.each([
  ['fr', 'Relances de paiement : Boulangerie Lefort'],
  ['de', 'Automatisches Mahnwesen: Boulangerie Lefort'],
])('%s renders the join its own way', async (lng, want) => {
  const inst = i18next.createInstance();
  await inst.init({ lng, resources: { [lng]: { translation: load(lng) } }, interpolation: { escapeValue: false } });
  const pack = inst.t('workflowPacks.incasso.name');
  expect(inst.t('workflowPacks.cardTitle', { pack, subject: 'Boulangerie Lefort' })).toBe(want);
});

it('the card title goes through the key, and only when there is a subject', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, 'src/services/workflowPackService.ts'), 'utf8'));
  expect(src).not.toMatch(/`\$\{resolvePackName\(pack\)\}:/);
  expect(src).toMatch(/title: match\.label\s*\?\s*i18n\.t\('workflowPacks\.cardTitle'/);
});
