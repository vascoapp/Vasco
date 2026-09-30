import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  legalLanguages,
  legalTitle,
  pickLegalLang,
  renderLegalPage,
  type LegalSlug,
} from "@/lib/legalContent";

const LANG_NAMES = { en: "English", nl: "Nederlands", de: "Deutsch", fr: "Français", es: "Español", it: "Italiano" } as const;

const VALID_SLUGS: LegalSlug[] = [
  "privacy-policy",
  "terms-of-service",
  "cookie-policy",
  "acceptable-use-policy",
  "data-processing-agreement",
  "eula",
  "gdpr-data-subject-request-process",
];

export function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lang = pickLegalLang((await searchParams).lang, (await headers()).get("accept-language"));
  if (!VALID_SLUGS.includes(slug as LegalSlug)) {
    return { title: "Legal" };
  }
  const title = legalTitle(slug as LegalSlug, legalLanguages(slug as LegalSlug).includes(lang) ? lang : "en");
  return {
    // Root layout applies template "%s — Vasco" — do not repeat the suffix.
    title,
    robots: { index: true, follow: true },
  };
}

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug as LegalSlug)) notFound();

  // The reader is a contractor OR their customer, in any of six markets:
  // ?lang= (the app passes its language), else the browser's, else English.
  const wanted = pickLegalLang((await searchParams).lang, (await headers()).get("accept-language"));
  const { html, lang } = await renderLegalPage(slug as LegalSlug, wanted);
  const languages = legalLanguages(slug as LegalSlug);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8 text-sm">
        <a href="/" className="text-zinc-500 hover:text-zinc-900">
          ← Vasco
        </a>
        {languages.length > 1 && (
          <span className="float-right space-x-3">
            {languages.map((l) => (
              <a
                key={l}
                href={`/legal/${slug}?lang=${l}`}
                hrefLang={l}
                aria-current={l === lang ? "page" : undefined}
                className={l === lang ? "font-semibold text-zinc-900" : "text-zinc-500 hover:text-zinc-900"}
              >
                {LANG_NAMES[l]}
              </a>
            ))}
          </span>
        )}
      </nav>
      <article
        lang={lang}
        className="prose prose-zinc max-w-none prose-headings:font-semibold prose-a:text-[#F97316]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
        © {new Date().getFullYear()} Vasco B.V. — Amsterdam, The Netherlands —{" "}
        <a href="mailto:privacy@vascobuild.com" className="underline">
          privacy@vascobuild.com
        </a>
      </footer>
    </main>
  );
}
