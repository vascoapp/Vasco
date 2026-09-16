/**
 * @jest-environment node
 */
// Onboarding asked for things and then threw them away (#339, real-account
// walk 2026-09-15 + sweep 2026-09-16):
//
//  - The registration step writes `regFields[key]` for each key in REG_FIELDS.
//    The save step read a SECOND spelling of those keys ('ustIdNr' for the
//    form's 'ustId', 'hrb' for 'handelsregister', 'tva' for 'tvaIntra',
//    'companyNumber' for 'companiesHouse', 'codiceFiscale' for
//    'cameraCommercio'), so a German contractor's USt-IdNr never reached their
//    profile — and the invoice-send gate then blocked them for missing it.
//  - The plan step upserted `billing_cycle: 'annual'`, which the live CHECK
//    (monthly|yearly) rejects, and swallowed the error: the plan choice never
//    reached the server. Picking "free" also wrote `trial_ends_at: null`,
//    erasing the trial `AuthContext.signUp` had just started.
//  - It silently put every DE solo Einzelunternehmen on Kleinunternehmer
//    (§19 UStG) — invoices issued without VAT — from "solo + sole trader"
//    alone. The advisor is a SUGGESTION now (shown on the USt & audit screen).
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const SRC = stripComments(
  fs.readFileSync(path.resolve(__dirname, '../../app/onboarding.tsx'), 'utf8'),
);

/** The keys the FORM writes, per country, straight out of REG_FIELDS. */
function regFieldKeys(): Record<string, string[]> {
  const block = SRC.slice(SRC.indexOf('const REG_FIELDS'), SRC.indexOf('const VAT_EXAMPLE'));
  const out: Record<string, string[]> = {};
  for (const m of block.matchAll(/^\s{2}([A-Z]{2}):\s*\[([\s\S]*?)\n\s{2}\],/gm)) {
    out[m[1]] = [...m[2].matchAll(/key:\s*'([^']+)'/g)].map((k) => k[1]);
  }
  return out;
}

/** The keys the SAVE step reads, per country, out of the two ternaries. */
function savedKeys(varName: string): Record<string, string> {
  const at = SRC.indexOf(`const ${varName} =`);
  const expr = SRC.slice(at, SRC.indexOf(';', at));
  const out: Record<string, string> = {};
  for (const m of expr.matchAll(/country === '([A-Z]{2})'\s*\?\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
}

describe('onboarding saves the fields it asks for', () => {
  const fields = regFieldKeys();

  it('reads REG_FIELDS for at least the six EU markets', () => {
    expect(Object.keys(fields).sort()).toEqual(expect.arrayContaining(['DE', 'ES', 'FR', 'IT', 'NL', 'UK']));
    expect(fields.DE).toContain('ustId');
  });

  it.each(['countryVatKey', 'regRegKey'])('%s names a key the form actually writes', (varName) => {
    const bad: string[] = [];
    for (const [country, key] of Object.entries(savedKeys(varName))) {
      if (!(fields[country] ?? []).includes(key)) bad.push(`${country}: reads '${key}', form writes ${JSON.stringify(fields[country])}`);
    }
    expect(bad).toEqual([]);
  });

  it('puts the service-area postcode on the business profile', () => {
    const save = SRC.slice(SRC.indexOf('await updateBusinessProfile({'), SRC.indexOf('});', SRC.indexOf('await updateBusinessProfile({')));
    expect(save).toMatch(/postcode:\s*postcode\.trim\(\)/);
  });
});

describe('the plan step', () => {
  const upsert = SRC.slice(SRC.indexOf("from('subscriptions'"), SRC.indexOf('onConflict'));

  it("sends a billing_cycle the database allows ('annual' is rejected)", () => {
    expect(upsert).toMatch(/billing_cycle:\s*cycle/);
    expect(SRC).toMatch(/billingCycle === 'annual' \? 'yearly' : 'monthly'/);
  });

  it('never clears an existing trial', () => {
    expect(upsert).not.toMatch(/trial_ends_at:\s*null/);
    expect(upsert).not.toMatch(/trial_ends_at:[^,]*\?\s*null/);
  });

  it('does not swallow the write error', () => {
    expect(SRC).toMatch(/const \{ error: planError \}/);
    expect(SRC).toMatch(/if \(planError\)/);
  });
});

describe('the VAT scheme is suggested, not applied', () => {
  it('onboarding always writes the standard scheme', () => {
    expect(SRC).toMatch(/const vatSchemeToApply = 'standard';/);
    expect(SRC).not.toMatch(/advice\.confident \? advice\.suggested/);
  });
});
