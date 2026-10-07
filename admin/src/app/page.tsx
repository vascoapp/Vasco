import type { Metadata } from "next";
import MarketingHome from "@/components/MarketingHome";
import { content } from "@/lib/marketing-content";
import { organizationSchema, softwareApplicationSchema } from "@/lib/aeo/schema";

export const metadata: Metadata = {
  title: { absolute: content.en.meta.title },
  description: content.en.meta.description,
  openGraph: {
    title: content.en.meta.title,
    description: content.en.meta.ogDescription,
    type: "website",
    url: "https://vascobuild.com",
    locale: "en_GB",
    alternateLocale: ["nl_NL", "en_US"],
  },
  alternates: {
    canonical: "https://vascobuild.com",
    languages: {
      en: "https://vascobuild.com",
      "en-US": "https://vascobuild.com/us",
      nl: "https://vascobuild.com/nl",
    },
  },
};

// Organization + SoftwareApplication + the on-page FAQ, so the structured
// data states exactly what the visible page states (no ratings, real tiers).
const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    organizationSchema(),
    softwareApplicationSchema(),
    {
      "@type": "FAQPage",
      url: "https://vascobuild.com",
      inLanguage: "en",
      mainEntity: content.en.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <MarketingHome locale="en" />
    </>
  );
}
