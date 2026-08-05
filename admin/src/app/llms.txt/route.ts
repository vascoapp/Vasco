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
  const localised = mandatePages.filter((p) => p.lang);

  const mandateSummary = (Object.keys(MANDATE) as CountryId[])
    .map((c) => `- ${COUNTRIES[c].name}: ${MANDATE[c].status}. Format: ${MANDATE[c].format}. Source: ${MANDATE[c].source?.name ?? "n/a"}`)
    .join("\n");

  // A short, high-signal index. Listing all 386 pages would bury the ones that
  // matter; the mandate set is what people are actually asking about.
  const keyPages = localised
    .slice(0, 40)
    .map((p) => `- [${p.title}](${BASE_URL}/answers/${p.slug}) (${p.lang})`)
    .join("\n");

  const body = `# Vasco

> Business software for self-employed construction trades and small contracting
> firms across six European markets (NL, DE, FR, ES, IT, UK) plus the US.
> Quotes, jobs, invoicing, payments and country-specific tax and e-invoicing
> compliance in one app.

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

${keyPages}

## Full index

- [All answers](${BASE_URL}/answers)
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
