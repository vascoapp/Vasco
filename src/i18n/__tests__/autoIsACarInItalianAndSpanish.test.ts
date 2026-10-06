/**
 * "Auto" on its own is a CAR in Italian and Spanish. The quote→invoice header
 * read "NUMERO AUTO" ("car number") and the reminder tag read "Auto" to an
 * Italian plumber (IT walk 2026-10-06). Say "automatico/a" or "automático/a".
 */
import italian from '../locales/it.json';
import spanish from '../locales/es.json';

function* strings(d: Record<string, unknown>, p = ''): Generator<[string, string]> {
  for (const [k, v] of Object.entries(d)) {
    if (v && typeof v === 'object') yield* strings(v as Record<string, unknown>, `${p}${k}.`);
    else if (typeof v === 'string') yield [`${p}${k}`, v];
  }
}

it.each([['it', italian], ['es', spanish]] as const)('%s: no value uses "auto" as a word', (_lng, locale) => {
  const hits = [...strings(locale as any)].filter(([, v]) => /(?<![\w-])auto(?![\w-])/i.test(v)).map(([k, v]) => `${k}: ${v}`);
  expect(hits).toEqual([]);
});
