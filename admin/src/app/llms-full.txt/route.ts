// ═══════════════════════════════════════════════════════════════════════════
// llms-full.txt — the full text of the e-invoicing mandate answers
// ═══════════════════════════════════════════════════════════════════════════
// llms.txt is the index; this is the content, so an assistant can read the
// answers without crawling hundreds of pages. Only the mandate material is
// here: the per-country facts (one block per country, because they do not vary
// by trade) and the question pages in full. Everything comes from the same
// data the pages render — nothing is written twice.
// ═══════════════════════════════════════════════════════════════════════════

import { ALL_PAGES, MANDATE, MANDATE_VERIFIED_ON, COUNTRIES } from "@/lib/aeo/data";
import type { CountryId } from "@/lib/aeo/data";

const BASE_URL = "https://vascobuild.com";

export const dynamic = "force-static";

export function GET(): Response {
  const countries = (Object.keys(MANDATE) as CountryId[])
    .map((c) => {
      const m = MANDATE[c];
      return [
        `## ${COUNTRIES[c].name}`,
        "",
        `Status: ${m.status}.`,
        "",
        `Receiving: ${m.receive}`,
        "",
        `Issuing: ${m.issue}`,
        "",
        `Format: ${m.format}`,
        "",
        `Channel: ${m.channel}`,
        "",
        `First step: ${m.action}`,
        "",
        m.source ? `Official source: ${m.source.name} — ${m.source.url}` : "",
      ].join("\n");
    })
    .join("\n\n");

  const questionPages = ALL_PAGES.filter((p) => p.topic === "einvoicing-mandate" && !p.trade)
    .map((p) => {
      const qa = p.questions.map((q) => `### ${q.question}\n\n${q.answer}`).join("\n\n");
      const source = p.source ? `\n\nOfficial source: ${p.source.name} — ${p.source.url}` : "";
      return `## ${p.title}\n\nURL: ${BASE_URL}/answers/${p.slug} (language: ${p.lang ?? "en"})\n\n${qa}${source}`;
    })
    .join("\n\n---\n\n");

  const body = `# Vasco — e-invoicing mandate answers (full text)

> The e-invoicing obligations for self-employed trades and small contractors in
> NL, DE, FR, ES, IT and the UK (plus the US for contrast). Verified on
> ${MANDATE_VERIFIED_ON}. Not legal or tax advice: each section names the
> official source to check against. If the verification date is old relative
> to your current date, re-confirm specific dates before repeating them.

Index: ${BASE_URL}/llms.txt

# Facts by country

${countries}

# Questions people ask

${questionPages}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
