import { redirect } from "next/navigation";
import { asLegalLang } from "@/lib/legalContent";

// The app links here with ?lang=<its language>; keep it on the way through.
export default async function PrivacyRedirect({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = asLegalLang((await searchParams).lang);
  redirect(lang ? `/legal/privacy-policy?lang=${lang}` : "/legal/privacy-policy");
}
