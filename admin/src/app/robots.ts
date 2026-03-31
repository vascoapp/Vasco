import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/answers/",
        disallow: "/admin/",
      },
    ],
    sitemap: "https://vasco.app/sitemap.xml",
  };
}
