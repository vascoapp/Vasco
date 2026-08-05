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
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().split("T")[0]
    : parsed.toISOString().split("T")[0];
}

const BASE_URL = "https://vascobuild.com";

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
        : new Date().toISOString().split("T")[0],
    publisher: softwareApplicationSchema(),
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

// ─── SOFTWARE APPLICATION SCHEMA ───────────────────────────────────────────

export function softwareApplicationSchema(): object {
  return {
    "@type": "SoftwareApplication",
    name: "Vasco",
    description:
      "AI-native business app for construction contractors. Connects quotes, jobs, invoices, and payments in one workflow across 6 European markets.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "iOS, Android",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "69",
      priceCurrency: "EUR",
      offerCount: 4,
    },
    featureList: [
      "AI-powered quoting with 30 trade-specific templates",
      "Instant invoicing from completed jobs",
      "Payment tracking and automated follow-up",
      "Certification and compliance monitoring",
      "Job management for 15 construction trades",
      "6 European markets (NL, DE, FR, ES, IT, UK)",
      "E-invoicing (XRechnung, ZUGFeRD, Factur-X, FatturaPA, Peppol)",
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
    softwareApplicationSchema(),
  ];

  return JSON.stringify(schemas);
}
