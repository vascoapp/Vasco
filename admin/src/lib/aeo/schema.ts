// ═══════════════════════════════════════════════════════════════════════════
// AEO SCHEMA — JSON-LD structured data generators for AEO pages
// FAQPage + SoftwareApplication + HowTo schemas for AI extraction
// ═══════════════════════════════════════════════════════════════════════════

import type { AeoPage } from "./data";
import { MANDATE_VERIFIED_ON } from "./data";

/**
 * `dateModified` for mandate pages is the date the legal facts were actually
 * verified, not today's date.
 *
 * Every other page can honestly say "reviewed today" because the advice is
 * evergreen. A page asserting statutory deadlines cannot: stamping it with the
 * current date every time the site rebuilds claims a freshness nobody
 * performed, and for legal content that is the difference between a citation
 * and a liability.
 */
function verifiedDateIso(): string {
  const parsed = new Date(MANDATE_VERIFIED_ON);
  if (Number.isNaN(parsed.getTime())) return CONTENT_UPDATED_ON;
  // Local components, not toISOString(): "5 August 2026" parses as LOCAL
  // midnight, which is 4 August in UTC on any machine east of Greenwich.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

const BASE_URL = "https://vascobuild.com";

/**
 * `dateModified` / `lastModified` for every NON-mandate page. A fixed date that
 * moves when the copy actually changes — `new Date()` stamped "updated today"
 * on every build, a freshness claim nobody performed. Bump it when you edit
 * marketing or evergreen answer copy.
 */
export const CONTENT_UPDATED_ON = "2026-10-08";

/** The mandate verification date as an ISO day, for sitemaps and JSON-LD. */
export function mandateVerifiedIso(): string {
  return verifiedDateIso();
}

/**
 * A trade × country × topic page generated from one NON-mandate template.
 *
 * Several hundred of these differ only by the trade and country words, which
 * is what search engines treat as scaled, low-value content — and it can drag
 * down the pages that DO carry unique facts. They stay reachable (follow) but
 * are not indexed and are left out of the sitemap. Mandate pages carry
 * country-specific legal facts and stay indexed; so do the question pages and
 * the universal (trade-less) pages.
 */
export function isScaledTemplatePage(page: AeoPage): boolean {
  return page.topic !== "einvoicing-mandate" && Boolean(page.trade && page.country);
}

// ─── FAQ PAGE SCHEMA ───────────────────────────────────────────────────────

export function faqPageSchema(page: AeoPage): object {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: page.title,
    description: page.description,
    url: `${BASE_URL}/answers/${page.slug}`,
    // The content language, not the site's. A German answer announced as
    // English will not be surfaced for a German query.
    inLanguage: page.lang ?? "en",
    dateModified:
      page.topic === "einvoicing-mandate"
        ? verifiedDateIso()
        : CONTENT_UPDATED_ON,
    publisher: organizationSchema(),
    // A citation an assistant can follow and a reader can check. Unsourced
    // statutory claims are exactly what a careful model declines to repeat.
    ...(page.source
      ? {
          citation: {
            "@type": "CreativeWork",
            name: page.source.name,
            url: page.source.url,
          },
        }
      : {}),
    mainEntity: page.questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}

// ─── ORGANIZATION SCHEMA ───────────────────────────────────────────────────

export function organizationSchema(): object {
  return {
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: "Vasco",
    url: BASE_URL,
    logo: `${BASE_URL}/vasco-logo.png`,
    email: "hello@vascobuild.com",
  };
}

// ─── SOFTWARE APPLICATION SCHEMA ───────────────────────────────────────────
// Offers are the app's real tiers (src/services/subscriptionService.ts in the
// app repo, TIERS): Free €0, Pro €39/mo (€29/mo billed annually), Contractor
// €69/mo (€49/mo billed annually). No AggregateRating: there are no public
// ratings — the app is in a TestFlight beta, not in a store.

function monthlyOffer(name: string, monthly: number, annualMonthly: number): object {
  return {
    "@type": "Offer",
    name,
    price: String(monthly),
    priceCurrency: "EUR",
    priceSpecification: [
      {
        "@type": "UnitPriceSpecification",
        price: String(monthly),
        priceCurrency: "EUR",
        unitCode: "MON",
        name: "Billed monthly",
      },
      {
        "@type": "UnitPriceSpecification",
        price: String(annualMonthly),
        priceCurrency: "EUR",
        unitCode: "MON",
        name: "Per month, billed annually",
      },
    ],
  };
}

export function softwareApplicationSchema(): object {
  return {
    "@type": "SoftwareApplication",
    "@id": `${BASE_URL}/#app`,
    name: "Vasco",
    url: BASE_URL,
    description:
      "Business app for construction tradespeople. Connects quotes, jobs, invoices and payments in one workflow across 6 European markets. In beta; coming to iOS and Android.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "iOS, Android",
    publisher: organizationSchema(),
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR" },
      monthlyOffer("Pro", 39, 29),
      monthlyOffer("Contractor", 69, 49),
    ],
    featureList: [
      "Quotes with Good / Better / Best options",
      "Online quote acceptance for customers",
      "Invoices from a finished job in one tap",
      "Payment links via the contractor's own Mollie or Stripe account — no commission",
      "Payment reminders drafted for the contractor to approve",
      "VAT report per period (PDF/CSV) for the accountant",
      "6 European markets (NL, DE, FR, ES, IT, UK)",
      "E-invoicing (XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA, Peppol)",
    ],
    availableLanguage: ["nl", "de", "fr", "es", "it", "en"],
  };
}

// ─── HOWTO SCHEMA (for actionable pages) ───────────────────────────────────

export function howToSchema(
  page: AeoPage,
  steps: Array<{ name: string; text: string }>
): object {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: page.title,
    description: page.description,
    url: `${BASE_URL}/answers/${page.slug}`,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
    tool: {
      "@type": "SoftwareApplication",
      name: "Vasco",
    },
  };
}

// ─── BREADCRUMB SCHEMA ─────────────────────────────────────────────────────

export function breadcrumbSchema(
  page: AeoPage
): object {
  const items = [
    { name: "Vasco", url: BASE_URL },
    { name: "Answers", url: `${BASE_URL}/answers` },
    { name: page.title, url: `${BASE_URL}/answers/${page.slug}` },
  ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─── COMBINED SCHEMA FOR A PAGE ────────────────────────────────────────────

export function pageSchemas(page: AeoPage): string {
  const schemas = [
    faqPageSchema(page),
    breadcrumbSchema(page),
    // Each top-level node needs its own @context; the helper returns a bare
    // node so it can also be nested (e.g. as a publisher).
    { "@context": "https://schema.org", ...softwareApplicationSchema() },
  ];

  return JSON.stringify(schemas);
}
