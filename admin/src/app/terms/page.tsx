import { redirect } from "next/navigation";
import { asLegalLang } from "@/lib/legalContent";

// The app links here with ?lang=<its language>; keep it on the way through.
export default async function TermsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = asLegalLang((await searchParams).lang);
  redirect(lang ? `/legal/terms-of-service?lang=${lang}` : "/legal/terms-of-service");
}
