import type { MetadataRoute } from "next";
import { ALL_PAGES } from "@/lib/aeo";

const BASE_URL = "https://vascobuild.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const answerPages: MetadataRoute.Sitemap = ALL_PAGES.map((page) => ({
    url: `${BASE_URL}/answers/${page.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: page.trade && page.country ? 0.8 : 0.9,
  }));

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
