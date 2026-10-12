import type { Metadata } from "next";
import MarketingHome from "@/components/MarketingHome";
import { content } from "@/lib/marketing-content";
import { HOME_LANGUAGES } from "@/lib/homeAlternates";
import { organizationSchema, softwareApplicationSchema } from "@/lib/aeo/schema";

export const metadata: Metadata = {
  title: { absolute: content.de.meta.title },
  description: content.de.meta.description,
  openGraph: {
    title: content.de.meta.title,
    description: content.de.meta.ogDescription,
    type: "website",
    url: "https://vascobuild.com/de",
    locale: "de_DE",
    alternateLocale: ["en_GB", "nl_NL", "en_US"],
  },
  alternates: {
    canonical: "https://vascobuild.com/de",
    languages: HOME_LANGUAGES,
  },
};

// Same graph as the English home, with the German FAQ the page shows.
const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    organizationSchema(),
    softwareApplicationSchema(),
    {
      "@type": "FAQPage",
      url: "https://vascobuild.com/de",
      inLanguage: "de",
      mainEntity: content.de.faq.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      })),
    },
  ],
};

export default function HomePageDE() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <MarketingHome locale="de" />
    </>
  );
}
