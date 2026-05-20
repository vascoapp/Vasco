import type { Metadata } from "next";
import MarketingHome from "@/components/MarketingHome";
import { content } from "@/lib/marketing-content";

export const metadata: Metadata = {
  title: content["en-US"].meta.title,
  description: content["en-US"].meta.description,
  openGraph: {
    title: content["en-US"].meta.title,
    description: content["en-US"].meta.ogDescription,
    type: "website",
    url: "https://vascobuild.com/us",
    locale: "en_US",
    alternateLocale: ["en_GB", "nl_NL"],
  },
  alternates: {
    canonical: "https://vascobuild.com/us",
    languages: {
      en: "https://vascobuild.com",
      "en-US": "https://vascobuild.com/us",
      nl: "https://vascobuild.com/nl",
    },
  },
};

export default function HomePageUS() {
  return <MarketingHome locale="en-US" />;
}
