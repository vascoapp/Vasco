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
const t = ((key: string, fallback?: string) => {
  const hit = key.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), fr as any);
  return typeof hit === 'string' ? hit : fallback;
}) as any;

describe('the French decision catalogue resolves', () => {
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

  it('covers every key the English catalogue has', () => {
    const flat = (o: any, p = ''): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null
          ? flat(v, p ? `${p}.${k}` : k)
          : [[p ? `${p}.${k}` : k, v as string]] as [string, string][]);
    const E = new Map(flat((en as any).decisionCatalog));
    const F = new Map(flat((fr as any).decisionCatalog));
    expect(F.size).toBe(E.size);
    expect([...E.keys()].filter((k) => !F.has(k))).toEqual([]);
  });

  it('is actually French — the long strings are not the English ones', () => {
    // Brand names, units and cognates (Vaillant, Quartz, "100 litres") are
    // legitimately identical; anything wordy should not be.
    const flat = (o: any, p = ''): [string, string][] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null
          ? flat(v, p ? `${p}.${k}` : k)
          : [[p ? `${p}.${k}` : k, v as string]] as [string, string][]);
    const E = new Map(flat((en as any).decisionCatalog));
    // Legitimately identical: the whole string is "Premium" plus a list of
    // brand names, and "premium" is the French word too.
    const BRAND_LISTS = new Set([
      'items.item_paint_quality.options.premium',
      'items.item_reno_appliance_pkg.options.premium',
    ]);
    const shared = flat((fr as any).decisionCatalog)
      .filter(([k, v]) => E.get(k) === v && v.split(' ').length >= 3 && !BRAND_LISTS.has(k));
    expect(shared).toEqual([]);
  });
});
