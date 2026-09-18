/**
 * @jest-environment node
 */
// A claim is a claim in whatever artefact it appears — copy, screenshot,
// listing, or the checkout page the contractor pays from.
//
// `npm run check:listing` has blocked AI/photo-scanning claims in the Play
// listing since the LLM keys turned out to be unset in production, and the
// app's own plan screen was corrected at the same time ("Full AI suite" →
// the automations that actually run; "API + white-label" → dedicated support,
// because neither an API surface nor white-label theming exists anywhere in
// the product). The WEB checkout page — `admin/src/app/billing/upgrade` — was
// never part of either sweep and still sold all four (verified 2026-09-19).
//
// This is the gate for the artefacts the store check cannot see.
import fs from 'fs';
import path from 'path';
import { stripComments } from '../utils/stripComments';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** The same shape `scripts/check-store-listing.mjs` refuses in the listing. */
const DARK = /\b(AI|K\.?I\.?|kunstmatige intelligentie|intelligence artificielle|foto[- ]?scan|photo[- ]?to[- ]?quote|automatisch(e)? prijs)\b/i;

/** Sold at some point, implemented nowhere. */
const UNBUILT = [
  { claim: /\bAPI access\b/i, why: 'there is no public API surface' },
  { claim: /white[- ]?label/i, why: 'there is no white-label theming' },
];

const PAGES = [
  'admin/src/app/billing/upgrade/page.tsx',
];

describe('the checkout page sells only what ships', () => {
  it.each(PAGES)('%s makes no claim that is dark in production', (rel) => {
    const src = read(rel);
    // The `features:` arrays — the bullets a contractor reads before paying.
    //
    // ⚠️ The first version of this test collected "every quoted string" with
    // `matchAll(/"([^"]+)"/g)`. That pairs quotes SEQUENTIALLY, so one
    // unbalanced quote anywhere earlier in the file shifts every pair and the
    // matches become the gaps BETWEEN the strings. It extracted 129 "strings"
    // and none of them were the bullets — the decoy proved it toothless.
    const blocks = [...src.matchAll(/features: \[([\s\S]*?)\]/g)].map((m) => m[1]);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    const offenders = blocks.filter((b) => DARK.test(b));
    expect({ rel, offenders }).toEqual({ rel, offenders: [] });
  });

  it.each(PAGES)('%s does not sell what was never built', (rel) => {
    const src = read(rel);
    for (const { claim, why } of UNBUILT) {
      expect({ rel, claim: String(claim), sold: claim.test(src), why })
        .toEqual({ rel, claim: String(claim), sold: false, why });
    }
  });

  it('the app plan screen stays corrected too', () => {
    // The in-app list was fixed first; this stops it drifting back while the
    // web page is watched.
    const onboarding = read('app/onboarding.tsx');
    for (const { claim } of UNBUILT) {
      expect({ claim: String(claim), sold: claim.test(onboarding) })
        .toEqual({ claim: String(claim), sold: false });
    }
  });
});

describe('the two pages agree on what a plan costs', () => {
  it('the web prices match the tier table', () => {
    const web = read('admin/src/app/billing/upgrade/page.tsx');
    const tiers = read('src/services/subscriptionService.ts');
    for (const tier of ['pro', 'contractor'] as const) {
      const block = tiers.slice(tiers.indexOf(`  ${tier}: {`), tiers.indexOf('limits:', tiers.indexOf(`  ${tier}: {`)));
      const monthly = block.match(/monthlyPrice: (\d+)/)?.[1];
      const annualMonthly = block.match(/annualMonthlyPrice: (\d+)/)?.[1];
      const webBlock = web.slice(web.indexOf(`  ${tier}: {`), web.indexOf('},', web.indexOf(`  ${tier}: {`)));
      expect({ tier, monthly: webBlock.includes(`monthly: ${monthly}`) })
        .toEqual({ tier, monthly: true });
      expect({ tier, yearly: webBlock.includes(`yearly: ${annualMonthly}`) })
        .toEqual({ tier, yearly: true });
    }
  });
});
