// The ledger banner counts actions the CONTRACTOR approved — never anything
// Vasco did on its own (actionLedgerService counts only approved + executed).
//
// German emulator walk 2026-09-29: the headline read "Vasco hat 3 Aktionen
// ausgeführt" / "Was Vasco erledigt hat", which reads as autonomous work and
// contradicts the EVE rule the product is sold on: Vasco prepares, you approve.
// The copy must say who decided.
import fs from 'fs';
import path from 'path';

const APPROVE: Record<string, RegExp> = {
  en: /approved/i, nl: /goedgekeurd|keurde .* goed/i, de: /freigegeben/i,
  fr: /approuvé/i, es: /aprob/i, it: /approvat/i,
};

describe.each(Object.keys(APPROVE))('ledger copy (%s)', (loc) => {
  const ledger = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../i18n/locales/${loc}.json`), 'utf8')).ledger;
  it.each(['didThisMonth_one', 'didThisMonth_other', 'sectionTitle'])('%s says the contractor approved it', (k) => {
    expect(ledger[k]).toMatch(APPROVE[loc]);
  });
});

it('the screens fall back to approver copy too', () => {
  for (const f of ['app/(contractor)/index.tsx', 'app/(contractor)/besparen.tsx']) {
    const src = fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8');
    expect(src).not.toMatch(/'Vasco carried out|'What Vasco did'/);
  }
});
