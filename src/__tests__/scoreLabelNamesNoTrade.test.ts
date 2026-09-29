// The profile score was "Aannemer Score" to a solo vakman, "Auftragnehmer-
// Score", "contratista", "appaltatore" — the GC word, or a word the market
// does not use for a tradesperson (ui-playbook §8). It measures completion,
// punctuality and repeat customers, so it is named for that (walk 2026-09-29).
import fs from 'fs';
import path from 'path';

const BAD = /aannemer|auftragnehmer|contratista|appaltatore|contractor/i;

it.each(['en', 'nl', 'de', 'fr', 'es', 'it'])('%s score label names no trade', (l) => {
  const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${l}.json`), 'utf8'));
  expect(j.profile.contractorScore).not.toMatch(BAD);
});
