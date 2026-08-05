import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // llms.txt is explicitly allowed: it is the file that tells an AI
        // crawler what this site is authoritative about and, as importantly,
        // what it is not.
        allow: ["/", "/legal/", "/answers/", "/support", "/privacy", "/terms", "/eula", "/llms.txt", "/tools/"],
        disallow: ["/admin", "/admin/", "/billing/", "/api/"],
      },
    ],
    sitemap: "https://vascobuild.com/sitemap.xml",
  };
}
