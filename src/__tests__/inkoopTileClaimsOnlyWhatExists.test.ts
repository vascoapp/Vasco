// Inkoop was rebuilt as "supplier invoices in, price intelligence out" (#364)
// and reorders / supplier lists / stock were REMOVED — nothing writes
// inventory. The Geld tile still sold "Bon scanner, herbestellen,
// leveranciersprijzen" (aannemer walk, 2026-09-29). A claim is a claim in any
// artefact, a tile subtitle included.
import fs from 'fs';
import path from 'path';

const DEAD = /herbestel|reorder|nachbestell|recommand|pedidos|riordin|voorraad|stock|lagerbestand/i;

it.each(['en', 'nl', 'de', 'fr', 'es', 'it'])('%s: the Inkoop tile names no removed feature', (l) => {
  const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${l}.json`), 'utf8'));
  expect(j.dk.money.purchasingSub).not.toMatch(DEAD);
});

it('the screen fallback names no removed feature either', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../app/(contractor)/geld.tsx'), 'utf8');
  const m = src.match(/t\('dk\.money\.purchasingSub', '([^']*)'\)/);
  expect(m).not.toBeNull();
  expect(m![1]).not.toMatch(DEAD);
});
