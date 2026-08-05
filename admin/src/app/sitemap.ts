import type { MetadataRoute } from "next";
import { ALL_PAGES } from "@/lib/aeo";

const BASE_URL = "https://vascobuild.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const answerPages: MetadataRoute.Sitemap = ALL_PAGES.map((page) => {
    // Mandate pages outrank the rest deliberately. They answer a question with
    // a legal deadline attached, which is the highest-intent search a
    // contractor makes — and the one where being absent costs the most. They
    // also change more often than evergreen advice, because legislation does.
    const isMandate = page.topic === "einvoicing-mandate";
    return {
      url: `${BASE_URL}/answers/${page.slug}`,
      lastModified: new Date(),
      changeFrequency: isMandate ? ("weekly" as const) : ("monthly" as const),
      priority: isMandate ? 0.9 : page.trade && page.country ? 0.8 : 0.9,
    };
  });

  return [
    {
      // The countdown. Highest priority on the site: it is the most linkable
      // page and the one whose content genuinely changes every day.
      url: `${BASE_URL}/answers/deadlines`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      // Free tool. The link-bait: high-intent query, and the page people send
      // each other.
      url: `${BASE_URL}/tools/e-invoice-validator`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      // Aimed at advisers, who answer for many clients at once.
      url: `${BASE_URL}/answers/for-accountants`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/answers`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...answerPages,
  ];
}
