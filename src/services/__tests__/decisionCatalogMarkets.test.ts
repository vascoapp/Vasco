// The decision catalogue is 564 strings the CONTRACTOR sees, the CUSTOMER reads
// in the acceptance portal, and that can end up on an invoice once an upgrade
// is billed. DE and NL were complete; FR, ES and IT had ZERO, so a French
// customer read an English checklist.
//
// This asserts the strings RESOLVE through the real resolver in French — not
// merely that keys exist in the file. `decisionCatalogI18n` looks them up by
// STABLE id at render time (never at creation, or a checklist copied into a
// tracker would freeze that day's language), so the ids are the contract.
import fr from '../../i18n/locales/fr.json';
import es from '../../i18n/locales/es.json';
// NOT `import it` — that shadows jest's own `it` and the whole suite
// fails to run with "(0 , _it.default) is not a function".
import itLocale from '../../i18n/locales/it.json';
import en from '../../i18n/locales/en.json';
import {
  localizeCategoryName, localizeItemName, localizeItemDescription,
  localizeItemImpact, localizeOptionLabel,
} from '../decisionCatalogI18n';

/**
 * A real i18next is mocked out in this jest setup, so `t` here resolves the
 * dotted key straight out of the shipped fr.json — which is the thing under
 * test: that the KEYS `decisionCatalogI18n` builds from a stable id line up
 * with the keys actually in the file. A mocked t would prove nothing.
 */
const tFor = (bundle: any) => ((key: string, fallback?: string) => {
  const hit = key.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), bundle);
  return typeof hit === 'string' ? hit : fallback;
}) as any;
const t = tFor(fr);

const flat = (o: any, p = ''): [string, string][] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flat(v, p ? `${p}.${k}` : k)
      : [[p ? `${p}.${k}` : k, v as string]] as [string, string][]);

/** Identical to English on purpose: "Premium" plus a list of brand names, and
 *  "premium" is the word in all three languages. */
const BRAND_LISTS = new Set([
  'items.item_paint_quality.options.premium',
  'items.item_reno_appliance_pkg.options.premium',
]);

const MARKETS: [string, any][] = [['fr', fr], ['es', es], ['it', itLocale]];

describe('the FR/ES/IT decision catalogue resolves', () => {
  it('category names come back in French, not the English fallback', () => {
    expect(localizeCategoryName('cat_bath_fixtures', 'Fixtures & Fittings', t))
      .toBe('Sanitaires et robinetterie');
    expect(localizeCategoryName('cat_kitchen_counters', 'Countertops', t))
      .toBe('Plans de travail');
  });

  it('item names, descriptions and impacts resolve', () => {
    expect(localizeItemName('item_toilet_style', 'Toilet Style', t)).toBe('Type de WC');
    expect(localizeItemDescription('item_toilet_style', 'Wall-hung or floor-standing toilet', t))
      .toBe('WC suspendu ou posé au sol');
    expect(localizeItemImpact('item_reno_floorplan', 'Affects all trades — must be decided first', t))
      .toMatch(/corps de métier/);
  });

  it('option labels resolve — these are what the customer picks', () => {
    expect(localizeOptionLabel('item_toilet_style', 'wall_hung', 'Wall-hung', t)).toBe('Suspendu');
    expect(localizeOptionLabel('item_hp_type', 'ground_source', 'Ground-source', t)).toBe('Géothermique');
  });

  it('an unknown id still falls back to what it was given', () => {
    // The resolver must never blank a string it has no translation for.
    expect(localizeItemName('item_does_not_exist', 'Some Custom Item', t)).toBe('Some Custom Item');
  });

  it.each(MARKETS)('%s covers every key the English catalogue has', (_lang, bundle) => {
    const E = new Map(flat((en as any).decisionCatalog));
    const L = new Map(flat((bundle as any).decisionCatalog));
    expect(L.size).toBe(E.size);
    expect([...E.keys()].filter((k) => !L.has(k))).toEqual([]);
  });

  it.each(MARKETS)('%s is actually translated — no wordy string equals English', (_lang, bundle) => {
    // Brands, units and cognates (Vaillant, Quartz, "100 litres") are
    // legitimately identical; anything of three words or more should not be.
    const E = new Map(flat((en as any).decisionCatalog));
    const shared = flat((bundle as any).decisionCatalog)
      .filter(([k, v]) => E.get(k) === v && v.split(' ').length >= 3 && !BRAND_LISTS.has(k));
    expect(shared).toEqual([]);
  });

  it.each(MARKETS)('%s resolves an option label through the real resolver', (_lang, bundle) => {
    // The customer picks these. An id that does not resolve silently renders
    // the English fallback next to translated siblings.
    const lt = tFor(bundle);
    const label = localizeOptionLabel('item_toilet_style', 'wall_hung', 'Wall-hung', lt);
    expect(label).not.toBe('Wall-hung');
    expect(label.length).toBeGreaterThan(0);
  });
});
