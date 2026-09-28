/**
 * @jest-environment node
 */
// Notification actions go somewhere real and speak the contractor's language.
// Emulator walk 2026-09-28: "Send reminder" (English) on a Dutch screen, and
// "View team" / "View customer" / "Review" routed to /(contractor)/klanten and
// /(contractor)/vasco — tabs that do not exist (they are bedrijf and ai).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const src = stripComments(fs.readFileSync(path.join(ROOT, 'src/services/pushNotificationService.ts'), 'utf8'));
const table = src.slice(src.indexOf('const TYPE_ROUTES'), src.indexOf('};', src.indexOf('const TYPE_ROUTES')));

function routeExists(route: string): boolean {
  const rel = route.replace(/^\//, '');
  return [`app/${rel}.tsx`, `app/${rel}/index.tsx`].some((f) => fs.existsSync(path.join(ROOT, f)));
}

it('reads the table it claims to', () => {
  expect(table.length).toBeGreaterThan(500);
});

it('every route opens a screen that exists', () => {
  const routes = [...table.matchAll(/(?:route|groupRoute):\s*'([^']+)'/g)].map((m) => m[1]);
  expect(routes.length).toBeGreaterThan(10);
  expect(routes.filter((r) => !routeExists(r))).toEqual([]);
});

it('every action has a label in all six languages', () => {
  const keys = [...table.matchAll(/\{\s*key:\s*'(\w+)'/g)].map((m) => m[1]);
  const actions = [...table.matchAll(/\{\s*(?:key:\s*'\w+',\s*)?label:/g)].length;
  expect(keys.length).toBe(actions); // no action without a key
  for (const lang of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, `src/i18n/locales/${lang}.json`), 'utf8'));
    for (const k of keys) expect([lang, k, typeof cat.notifications?.action?.[k]]).toEqual([lang, k, 'string']);
  }
});
