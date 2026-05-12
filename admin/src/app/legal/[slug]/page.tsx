import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { legalTitle, renderLegalPage, type LegalSlug } from "@/lib/legalContent";

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
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug as LegalSlug)) {
    return { title: "Vasco — Legal" };
  }
  const title = legalTitle(slug as LegalSlug);
  return {
    title: `${title} — Vasco`,
    robots: { index: true, follow: true },
  };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!VALID_SLUGS.includes(slug as LegalSlug)) notFound();

  const html = await renderLegalPage(slug as LegalSlug);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <nav className="mb-8 text-sm">
        <a href="/" className="text-zinc-500 hover:text-zinc-900">
          ← Vasco
        </a>
      </nav>
      <article
        className="prose prose-zinc max-w-none prose-headings:font-semibold prose-a:text-[#F97316]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <footer className="mt-16 border-t border-zinc-200 pt-6 text-xs text-zinc-500">
        © {new Date().getFullYear()} Vasco B.V. — Amsterdam, The Netherlands —{" "}
        <a href="mailto:privacy@vasco.dev" className="underline">
          privacy@vasco.dev
        </a>
      </footer>
    </main>
  );
}
