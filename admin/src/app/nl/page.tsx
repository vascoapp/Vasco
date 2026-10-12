import type { Metadata } from "next";
import MarketingHome from "@/components/MarketingHome";
import { content } from "@/lib/marketing-content";
import { HOME_LANGUAGES } from "@/lib/homeAlternates";

export const metadata: Metadata = {
  title: { absolute: content.nl.meta.title },
  description: content.nl.meta.description,
  openGraph: {
    title: content.nl.meta.title,
    description: content.nl.meta.ogDescription,
    type: "website",
    url: "https://vascobuild.com/nl",
    locale: "nl_NL",
    alternateLocale: ["en_GB", "de_DE", "en_US"],
  },
  alternates: {
    canonical: "https://vascobuild.com/nl",
    languages: HOME_LANGUAGES,
  },
};

export default function HomePageNL() {
  return <MarketingHome locale="nl" />;
}
