/**
 * Dutch copy says "klus/klussen", never the English "job(s)". The Vandaag
 * empty state read "Geen jobs vandaag" beside "Plan je eerste klus" (NL walk,
 * 2026-10-06). {{job}} placeholders are fine — they are filled with a title.
 */
import nl from '../i18n/locales/nl.json';

function strings(o: unknown, path = ''): Array<[string, string]> {
  if (typeof o === 'string') return [[path, o]];
  if (o && typeof o === 'object') return Object.entries(o).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

it('no Dutch string uses the English word job(s)', () => {
  const offenders = strings(nl)
    .map(([k, v]) => [k, v.replace(/\{\{[^}]+\}\}/g, '')] as const)
    .filter(([, v]) => /\bjobs?\b/i.test(v));
  expect(offenders).toEqual([]);
});
