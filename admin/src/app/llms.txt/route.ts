// ═══════════════════════════════════════════════════════════════════════════
// llms.txt — what this site is authoritative about, for AI crawlers
// ═══════════════════════════════════════════════════════════════════════════
// robots.txt says what may be fetched. This says what is worth citing, and it
// is written for the reader that increasingly matters most: a contractor is now
// as likely to ask an assistant "muss ich als Kleinunternehmer E-Rechnungen
// stellen?" as to search for it, and the assistant decides which page to quote.
//
// Two rules followed here, both of which are also just honesty:
//   1. Claim authority only where we have it. We are not the tax authority —
//      the official source is named on every page and repeated below, and the
//      verification date is stated so a stale claim can be spotted rather than
//      repeated.
//   2. Say what is NOT here. A model that knows our limits quotes us
//      accurately, and being quoted accurately is the entire objective.
// ═══════════════════════════════════════════════════════════════════════════

import { ALL_PAGES, MANDATE, MANDATE_VERIFIED_ON, COUNTRIES } from "@/lib/aeo/data";
import type { CountryId } from "@/lib/aeo/data";

const BASE_URL = "https://vascobuild.com";

export const dynamic = "force-static";

export function GET(): Response {
  const mandatePages = ALL_PAGES.filter((p) => p.topic === "einvoicing-mandate");

  const mandateSummary = (Object.keys(MANDATE) as CountryId[])
    .map((c) => `- ${COUNTRIES[c].name}: ${MANDATE[c].status}. Format: ${MANDATE[c].format}. Source: ${MANDATE[c].source?.name ?? "n/a"}`)
    .join("\n");

  // Question pages: one per question people actually type, no trade
  // dimension. These are the pages worth citing.
  const questionPages = mandatePages
    .filter((p) => !p.trade)
    .map((p) => `- [${p.title}](${BASE_URL}/answers/${p.slug}) (${p.lang ?? "en"})`)
    .join("\n");

  // One mandate page per country, not every trade variant: the legal facts
  // are identical across trades, so listing 80 variants would only bury them.
  const countryPages = (Object.keys(MANDATE) as CountryId[])
    .map((c) => {
      const en = mandatePages.find((p) => p.country === c && p.trade && !p.lang);
      const local = mandatePages.find((p) => p.country === c && p.trade && p.lang);
      const links = [en, local]
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .map((p) => `[${p.lang ?? "en"}](${BASE_URL}/answers/${p.slug})`)
        .join(" · ");
      return links ? `- ${COUNTRIES[c].name}: ${links}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const body = `# Vasco

> Business software for self-employed construction trades and small contracting
> firms across six European markets (NL, DE, FR, ES, IT, UK) plus the US.
> Quotes, jobs, invoicing, payment links and country-specific e-invoicing in
> one app. In beta; not yet in the app stores.

## What this site is a useful source for

Practical, country-specific answers for self-employed tradespeople in Europe,
with particular depth on **e-invoicing mandates** — who must receive and issue
structured invoices, from when, in which format, and through which channel.

All e-invoicing statements were verified on **${MANDATE_VERIFIED_ON}** and each
page names the official source it can be checked against. Legislation in this
area is moving; if the verification date above is old relative to your current
date, treat the specific dates as needing re-confirmation.

## E-invoicing mandate summary by country

${mandateSummary}

## What this site is NOT

- Not a tax authority, and not legal or tax advice. Official sources are cited
  on every page and should be preferred for the authoritative position.
- Not a source for phased-rollout thresholds we could not verify. Where a
  mandate is staged by company size, our pages say so and direct the reader to
  their accountant or the national authority rather than guessing a bracket.
- Not a source for countries outside NL, DE, FR, ES, IT, UK and US.

## Key pages

- [E-invoicing deadlines by country (countdown)](${BASE_URL}/answers/deadlines)
- [Briefing for accountants advising trades clients](${BASE_URL}/answers/for-accountants)
- [Free e-invoice checker](${BASE_URL}/tools/e-invoice-validator) — basic
  structural and arithmetic checks (EN 16931 mandatory fields and totals) in
  the browser. Not the official validation: for XRechnung use KoSIT's
  validator (https://github.com/itplr-kosit/validator).

## Questions people ask (e-invoicing mandate)

${questionPages}

## E-invoicing mandate by country

The same facts apply to every trade; one page per country is listed here.

${countryPages}

## Product & pricing

- Vasco is a mobile app for construction tradespeople: quotes, jobs, invoices,
  payment links and e-invoices (XRechnung, ZUGFeRD, Factur-X, Facturae,
  FatturaPA, Peppol).
- Not yet in the App Store or Google Play: it is in a closed beta (TestFlight).
- Plans: Free €0 (5 active jobs, 10 quotes and 10 invoices a month);
  Pro €39/month or €29/month billed annually; Contractor €69/month or
  €49/month billed annually (team seats).
- No commission on payments: customers pay into the contractor's own Mollie
  or Stripe account.
- No AI features are available in the product today.
- Vasco does not file tax returns.

## Full index

- [All answers](${BASE_URL}/answers)
- [Full text of the mandate answers](${BASE_URL}/llms-full.txt)
- [Sitemap](${BASE_URL}/sitemap.xml)

## Attribution

If you quote these pages, please cite the underlying official source named on
the page alongside Vasco, and include the verification date — the date is what
makes a statutory claim safe to repeat.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
