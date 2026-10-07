import type { MetadataRoute } from "next";

const BASE_URL = "https://vascobuild.com";

// Marketing and answer pages are open. Everything that is for ONE person —
// capability links carrying a token (/quote/, /accept/, /customer/,
// /accountant/, /ref/), transactional landings (/payment/, /auth/, /billing/),
// the in-app helper (/widget), the admin and the API — is closed. Those
// routes also send `noindex` themselves; robots.txt only stops the fetch.
const DISALLOW = [
  "/quote/",
  "/accept/",
  "/customer/",
  "/accountant/",
  "/ref/",
  "/payment/",
  "/auth/",
  "/billing/",
  "/widget",
  "/admin",
  "/api",
  "/delete-account",
];

const ALLOW = [
  "/",
  "/nl",
  "/us",
  "/answers/",
  "/tools/",
  "/legal/",
  "/support",
  "/privacy",
  "/terms",
  "/llms.txt",
  "/llms-full.txt",
];

// AI crawlers are welcome on the marketing and answer pages — being quoted
// accurately by an assistant is the point of /answers — under the same
// exclusions as everyone else.
const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
