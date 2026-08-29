/**
 * What the CUSTOMER reads in the decision portal.
 *
 * `decision_items` stores the ENGLISH label and carries no catalog id, and
 * `get_portal_by_access_code` returns `'name', di.label` and `'name', category`.
 * So the portal showed the raw category id — "CAT_BATH_FIXTURES", uppercased by
 * the CSS — above English item names and English option labels, in EVERY
 * market, including NL and DE whose catalogues have been complete for months.
 * The 564 translated strings only ever reached the contractor's app.
 *
 * Run: cd admin && npm run check:portalCatalog
 */
import {
  portalCategoryName, portalItemName, portalOptionLabel, portalItemId,
  CATEGORY_NAMES, ITEM_NAMES, OPTION_LABELS,
} from '../src/lib/decisionCatalogI18n';

let failures = 0;
function check(what: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.error(`  ✕ ${what}\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(actual)}`); }
  else console.log(`  ✓ ${what}`);
}

console.log('portal catalogue localization');

check('nl category heading is not a raw id',
  portalCategoryName('nl', 'cat_bath_fixtures', 'cat_bath_fixtures'), 'Sanitair & kranen');
check('fr category heading', portalCategoryName('fr', 'cat_bath_fixtures', 'cat_bath_fixtures'), 'Sanitaires et robinetterie');
check('it category heading', portalCategoryName('it', 'cat_kitchen_counters', 'cat_kitchen_counters'), 'Piani di lavoro');

for (const l of ['nl', 'de', 'fr', 'es', 'it'] as const) {
  const v = portalCategoryName(l, 'cat_bath_fixtures', 'cat_bath_fixtures');
  check(`${l} never leaks the category id`, /^cat_/.test(v), false);
}

check('fr item from its stored English label', portalItemName('fr', 'cat_bath_fixtures', 'Toilet Style'), 'Type de WC');
check('es item from its stored English label', portalItemName('es', 'cat_bath_fixtures', 'Toilet Style'), 'Tipo de inodoro');
check('it item from its stored English label', portalItemName('it', 'cat_bath_fixtures', 'Toilet Style'), 'Tipo di WC');

// "Underfloor Heating" is the one English name used by two items.
check('ambiguous name resolves by category (bath)', portalItemId('cat_bath_tiles', 'Underfloor Heating'), 'item_heated_floor');
check('ambiguous name resolves by category (reno)', portalItemId('cat_reno_flooring', 'Underfloor Heating'), 'item_reno_ufh');

check('fr option label (what the customer picks)',
  portalOptionLabel('fr', 'cat_bath_fixtures', 'Toilet Style', 'wall_hung', 'Wall-hung'), 'Suspendu');
check('es option label',
  portalOptionLabel('es', 'cat_bath_fixtures', 'Toilet Style', 'floor_standing', 'Floor-standing'), 'De pie');

// A fallback must never blank the customer's page.
check('unknown category falls back', portalCategoryName('fr', 'cat_unknown', 'Fallback heading'), 'Fallback heading');
check('unknown item falls back', portalItemName('fr', 'cat_bath_fixtures', 'Some Custom Item'), 'Some Custom Item');
check('unknown option falls back', portalOptionLabel('fr', 'cat_x', 'No Such Item', 'v', 'Stored label'), 'Stored label');

for (const l of ['en', 'nl', 'de', 'fr', 'es', 'it'] as const) {
  check(`${l} categories complete`, Object.keys(CATEGORY_NAMES[l]).length, Object.keys(CATEGORY_NAMES.en).length);
  check(`${l} items complete`, Object.keys(ITEM_NAMES[l]).length, Object.keys(ITEM_NAMES.en).length);
  check(`${l} option labels complete`, Object.keys(OPTION_LABELS[l]).length, Object.keys(OPTION_LABELS.en).length);
}

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\nall good');
