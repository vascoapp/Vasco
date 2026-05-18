import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/", "/answers/", "/support", "/privacy", "/terms", "/eula"],
        disallow: ["/admin", "/admin/", "/billing/", "/api/"],
      },
    ],
    sitemap: "https://vascobuild.com/sitemap.xml",
  };
}
