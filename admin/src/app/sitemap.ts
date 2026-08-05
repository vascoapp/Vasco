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
      url: `${BASE_URL}/answers`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...answerPages,
  ];
}
