#!/usr/bin/env node
// =============================================================================
// GENERATE en-US.json OVERRIDES FROM en.json (R74 US foundation)
// =============================================================================
// en-US is an OVERRIDE locale: it carries only the keys whose US-English
// rendering diverges from the base en (UK-flavoured) translation. i18next's
// fallbackLng resolves any missing key back to en at runtime, so when you
// add a new string to en.json you don't have to touch en-US.json — unless
// the new string contains "Quote" / "VAT" / "IBAN" / "€" / etc., in which
// case re-running this script picks it up.
//
// Run:  node scripts/generate-en-us.mjs
//
// Reads:   src/i18n/locales/en.json
// Writes:  src/i18n/locales/en-US.json
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const enPath = path.join(root, 'src/i18n/locales/en.json');
const outPath = path.join(root, 'src/i18n/locales/en-US.json');

// Substitution table — case-preserving, word-boundary anchored. Order
// matters: longer / more-specific patterns first.
const SUBS = [
  [/\bQuotes\b/g, 'Estimates'],
  [/\bquotes\b/g, 'estimates'],
  [/\bQuote\b/g, 'Estimate'],
  [/\bquote\b/g, 'estimate'],
  [/\bVAT\b/g, 'Sales tax'],
  [/\bvat\b/g, 'sales tax'],
  [/\bIBAN\b/g, 'Bank account'],
  [/\bBTW\b/g, 'Sales tax'],
  [/\bKvK\b/g, 'EIN'],
  [/\bkvk\b/g, 'ein'],
  [/\biban\b/g, 'bank account'],
  [/\bcolour\b/g, 'color'],
  [/\bColour\b/g, 'Color'],
  [/\blabour\b/g, 'labor'],
  [/\bLabour\b/g, 'Labor'],
  [/\bcheque\b/g, 'check'],
  [/\bCheque\b/g, 'Check'],
  [/€/g, '$'],
];

// Keys we deliberately do not transform — locale codes, raw country
// identifiers, NL/EU regulatory references that should display verbatim
// for non-US users (en-US users never hit these screens anyway).
const SKIP_KEYS = new Set([
  'locale', 'language', 'languageCode',
  'kvkFormatInvalid', 'vatFormatInvalid', 'btw',
]);

function transform(value) {
  let out = value;
  for (const [pat, repl] of SUBS) out = out.replace(pat, repl);
  return out;
}

function overridesOnly(obj) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SKIP_KEYS.has(k)) continue;
      const sub = overridesOnly(v);
      if (sub !== undefined && (typeof sub !== 'object' || Object.keys(sub).length > 0)) {
        out[k] = sub;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  if (typeof obj === 'string') {
    const transformed = transform(obj);
    return transformed !== obj ? transformed : undefined;
  }
  return undefined;
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const overrides = overridesOnly(en) ?? {};

const result = {
  _meta: {
    note: 'Auto-generated overrides from en.json. Only keys whose US-English form differs are present; everything else falls back to en at runtime. Re-generate via scripts/generate-en-us.mjs (R74).',
    regime: 'sales_tax',
    currency: 'USD',
  },
  ...overrides,
};

fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');

// Count keys (excluding _meta sub-keys).
const countKeys = (o) => {
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    return Object.values(o).reduce((a, v) => a + countKeys(v), 0);
  }
  return 1;
};
const total = countKeys(overrides);
console.log(`Wrote ${outPath}`);
console.log(`Overrides: ${total} keys`);
