import type { Metadata } from "next";
import MarketingHome from "@/components/MarketingHome";
import { content } from "@/lib/marketing-content";

export const metadata: Metadata = {
  title: content.nl.meta.title,
  description: content.nl.meta.description,
  openGraph: {
    title: content.nl.meta.title,
    description: content.nl.meta.ogDescription,
    type: "website",
    url: "https://vascobuild.com/nl",
    locale: "nl_NL",
    alternateLocale: ["en_GB", "en_US"],
  },
  alternates: {
    canonical: "https://vascobuild.com/nl",
    languages: {
      en: "https://vascobuild.com",
      "en-US": "https://vascobuild.com/us",
      nl: "https://vascobuild.com/nl",
    },
  },
};

export default function HomePageNL() {
  return <MarketingHome locale="nl" />;
}
