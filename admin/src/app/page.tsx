import type { Metadata } from "next";
import MarketingHome from "@/components/MarketingHome";
import { content } from "@/lib/marketing-content";

export const metadata: Metadata = {
  title: content.en.meta.title,
  description: content.en.meta.description,
  openGraph: {
    title: content.en.meta.title,
    description: content.en.meta.ogDescription,
    type: "website",
    url: "https://vascobuild.com",
    locale: "en_GB",
    alternateLocale: ["nl_NL"],
  },
  alternates: {
    canonical: "https://vascobuild.com",
    languages: {
      en: "https://vascobuild.com",
      nl: "https://vascobuild.com/nl",
    },
  },
};

export default function HomePage() {
  return <MarketingHome locale="en" />;
}
