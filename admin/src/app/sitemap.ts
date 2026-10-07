import type { MetadataRoute } from "next";
import { ALL_PAGES } from "@/lib/aeo";
import { CONTENT_UPDATED_ON, isScaledTemplatePage, mandateVerifiedIso } from "@/lib/aeo/schema";

const BASE_URL = "https://vascobuild.com";

// Fixed dates, never `new Date()`: a lastModified that is "today" on every
// build tells crawlers every page changed on every deploy, which they learn to
// ignore. Mandate pages carry the date their legal facts were verified.
const CONTENT_DATE = CONTENT_UPDATED_ON;
const MANDATE_DATE = mandateVerifiedIso();

// Legal pages that exist (src/app/legal/[slug]). /privacy and /terms are
// redirects to the first two and are deliberately NOT listed: a sitemap lists
// canonical URLs, and a redirect in it is reported as an error.
const LEGAL_SLUGS = [
  "privacy-policy",
  "terms-of-service",
  "cookie-policy",
  "acceptable-use-policy",
  "data-processing-agreement",
  "eula",
  "gdpr-data-subject-request-process",
];

export default function sitemap(): MetadataRoute.Sitemap {
  // The templated trade × country × topic pages are `noindex` and left out
  // here (see isScaledTemplatePage); listing a noindexed URL sends crawlers a
  // contradictory signal.
  const answerPages: MetadataRoute.Sitemap = ALL_PAGES.filter((p) => !isScaledTemplatePage(p)).map(
    (page) => {
      // Mandate pages outrank the rest deliberately: a legal deadline is the
      // highest-intent search a contractor makes.
      const isMandate = page.topic === "einvoicing-mandate";
      return {
        url: `${BASE_URL}/answers/${page.slug}`,
        lastModified: isMandate ? MANDATE_DATE : CONTENT_DATE,
        changeFrequency: isMandate ? ("weekly" as const) : ("monthly" as const),
        priority: isMandate ? 0.9 : 0.7,
      };
    },
  );

  const marketing: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE_URL}/nl`, lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE_URL}/us`, lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/support`, lastModified: CONTENT_DATE, changeFrequency: "monthly", priority: 0.5 },
    ...LEGAL_SLUGS.map((slug) => ({
      url: `${BASE_URL}/legal/${slug}`,
      lastModified: CONTENT_DATE,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  return [
    ...marketing,
    {
      // The countdown: built from the mandate facts.
      url: `${BASE_URL}/answers/deadlines`,
      lastModified: MANDATE_DATE,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/tools/e-invoice-validator`,
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/answers/for-accountants`,
      lastModified: MANDATE_DATE,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/answers`,
      lastModified: CONTENT_DATE,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...answerPages,
  ];
}
