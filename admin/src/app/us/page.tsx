import type { Metadata } from "next";
import MarketingHome from "@/components/MarketingHome";
import { content } from "@/lib/marketing-content";
import { HOME_LANGUAGES } from "@/lib/homeAlternates";

export const metadata: Metadata = {
  title: { absolute: content["en-US"].meta.title },
  description: content["en-US"].meta.description,
  openGraph: {
    title: content["en-US"].meta.title,
    description: content["en-US"].meta.ogDescription,
    type: "website",
    url: "https://vascobuild.com/us",
    locale: "en_US",
    alternateLocale: ["en_GB", "nl_NL", "de_DE"],
  },
  alternates: {
    canonical: "https://vascobuild.com/us",
    languages: HOME_LANGUAGES,
  },
};

export default function HomePageUS() {
  return <MarketingHome locale="en-US" />;
}
