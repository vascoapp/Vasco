/**
 * @jest-environment node
 */
// The VAT nature of a 0 % line (Italy, FatturaPA Natura) — src/domain/vatNature.ts.
// A 0 % line used to be written N2.2 whatever it was; a building subcontract
// (reverse charge, N6.3) went to SDI as "non soggetta – altri casi" and was
// accepted. The nature is now the contractor's, per line (2026-10-03).
import fs from 'fs';
import path from 'path';
import {
  VAT_NATURES, isVatNature, isReverseChargeNature, offeredVatNatures, defaultVatNature,
  vatNatureLegalReference, vatNatureMentions, vatNatureLabelKey,
} from '../vatNature';
import { lineVatNature } from '../lineItems';

const MIGRATION = path.resolve(__dirname, '../../../supabase/migrations/20261003000003_line_item_vat_nature.sql');

describe('the codes', () => {
  it('are exactly the ones the migration CHECK allows — app and database agree', () => {
    // An app code the CHECK lacks would make the WHOLE line insert fail; a
    // CHECK code the app lacks is harmless but means the lists drifted.
    const sql = fs.readFileSync(MIGRATION, 'utf8');
    const list = /vat_nature IN \(([\s\S]*?)\)\)/.exec(sql)?.[1] ?? '';
    const inCheck = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(inCheck).toEqual([...VAT_NATURES]);
  });

  it('never include the generic N2 / N3 / N6 SDI refuses since 2021 (00445)', () => {
    for (const g of ['N2', 'N3', 'N6']) expect(isVatNature(g)).toBe(false);
    expect(VAT_NATURES).toHaveLength(21);
  });

  it('reverse charge is the N6.x family only', () => {
    expect(isReverseChargeNature('N6.3')).toBe(true);
    expect(isReverseChargeNature('N6.7')).toBe(true);
    expect(isReverseChargeNature('N6')).toBe(false);
    expect(isReverseChargeNature('N2.2')).toBe(false);
    expect(isReverseChargeNature(undefined)).toBe(false);
  });
});

describe('what each regime may state', () => {
  it('a forfettario / minimo: the franchise and art. 15 expenses — never reverse charge', () => {
    for (const r of ['RF19', 'RF02']) {
      expect(offeredVatNatures(r)).toEqual(['N2.2', 'N1']);
      expect(defaultVatNature(r)).toBe('N2.2');
    }
  });

  it('the ordinary regime: the construction reverse charges first, no N2.2, and NO default', () => {
    const o = offeredVatNatures('RF01');
    expect(o.slice(0, 2)).toEqual(['N6.3', 'N6.7']);
    expect(o).not.toContain('N2.2');
    expect(defaultVatNature('RF01')).toBeNull();
    // An unknown regime is not the flat-rate one.
    expect(defaultVatNature(undefined)).toBeNull();
  });

  it('every offered nature has a legal reference under that regime, ≤ 100 Latin-1 characters', () => {
    for (const regime of ['RF01', 'RF19', 'RF02', 'RF18']) {
      for (const n of offeredVatNatures(regime)) {
        const ref = vatNatureLegalReference(n, regime);
        expect(ref).toBeTruthy();
        expect(ref!.length).toBeLessThanOrEqual(100);
        expect(/^[\u0000-ÿ]*$/.test(ref!)).toBe(true);
      }
    }
  });

  it('cites the right norm: art. 17 c. 6 lett. a) / a-ter); the regime decides N2.2', () => {
    expect(vatNatureLegalReference('N6.3', 'RF01')).toContain('art. 17, c. 6, lett. a)');
    expect(vatNatureLegalReference('N6.7', 'RF01')).toContain('lett. a-ter)');
    expect(vatNatureLegalReference('N6.3', 'RF01')).toMatch(/^Inversione contabile/);
    expect(vatNatureLegalReference('N2.2', 'RF19')).toContain('L. 190/2014');
    expect(vatNatureLegalReference('N2.2', 'RF02')).toContain('DL 98/2011');
    // Outside the flat-rate regimes N2.2 has no norm Vasco can name.
    expect(vatNatureLegalReference('N2.2', 'RF01')).toBeNull();
    // Codes not offered have none either — refused, not guessed.
    expect(vatNatureLegalReference('N3.5', 'RF01')).toBeNull();
  });

  it('labels resolve under vatNature.* in every locale', () => {
    for (const lang of ['en', 'nl', 'de', 'fr', 'es', 'it']) {
      const loc = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../i18n/locales/${lang}.json`), 'utf8'));
      for (const n of [...offeredVatNatures('RF01'), ...offeredVatNatures('RF19')]) {
        const [ns, key] = vatNatureLabelKey(n).split('.');
        expect(`${lang}:${n}:${typeof loc[ns]?.[key]}`).toBe(`${lang}:${n}:string`);
      }
    }
  });
});

describe('a nature only ever sits on a 0 % line', () => {
  it('kept at 0 %, dropped on a rated line, a non-code is dropped', () => {
    expect(lineVatNature({ vatRate: 0, vatNature: 'N6.3' })).toBe('N6.3');
    expect(lineVatNature({ vatRate: 22, vatNature: 'N6.3' })).toBeNull();
    expect(lineVatNature({ vatRate: 0, vatNature: 'N6' })).toBeNull();
    expect(lineVatNature({ vatRate: 0 })).toBeNull();
    // No own rate: the fallback decides.
    expect(lineVatNature({ vatNature: 'N1' }, 0)).toBe('N1');
    expect(lineVatNature({ vatNature: 'N1' }, 22)).toBeNull();
  });
});

describe('what the printed invoice says', () => {
  it('one mention per distinct nature, in line order, the franchise by default under RF19', () => {
    expect(vatNatureMentions([
      { vatRate: 0, vatNature: 'N6.3' }, { vatRate: 22 }, { vatRate: 0, vatNature: 'N6.3' }, { vatRate: 0, vatNature: 'N1' },
    ], 'RF01')).toEqual([
      'Inversione contabile ex art. 17, c. 6, lett. a), DPR 633/72',
      'Operazione esclusa ex art. 15 DPR 633/72',
    ]);
    expect(vatNatureMentions([{ vatRate: 0 }], 'RF19')).toEqual(['Operazione in franchigia da IVA ex art. 1, cc. 54-89, L. 190/2014']);
    // Ordinary regime, no nature: nothing invented (the export refuses it).
    expect(vatNatureMentions([{ vatRate: 0 }], 'RF01')).toEqual([]);
    expect(vatNatureMentions([{ vatRate: 22 }], 'RF19')).toEqual([]);
  });
});
