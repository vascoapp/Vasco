import type { Metadata } from "next";
import Link from "next/link";
import {
  ALL_PAGES,
  getPageBySlug,
  TRADES,
  COUNTRIES,
  type TradeId,
  type CountryId,
  type TopicId,
} from "@/lib/aeo";
import { pageSchemas } from "@/lib/aeo/schema";

// ─── STATIC GENERATION ────────────────────────────────────────────────────

export function generateStaticParams(): Array<{ slug: string }> {
  return ALL_PAGES.map((p) => ({ slug: p.slug }));
}

// ─── METADATA ──────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPageBySlug(slug);
  if (!page) {
    return { title: "Not Found" };
  }

  return {
    title: page.title,
    description: page.description,
    openGraph: {
      title: page.title,
      description: page.description,
      url: `https://vascobuild.com/answers/${page.slug}`,
      type: "article",
    },
  };
}

// ─── TOPIC + TRADE LABELS ──────────────────────────────────────────────────

const TOPIC_LABELS: Record<TopicId, string> = {
  pricing: "Pricing",
  invoicing: "Invoicing",
  compliance: "Compliance",
  "job-management": "Job Management",
  "getting-paid": "Getting Paid",
  quoting: "Quoting",
};

// ─── PAGE COMPONENT ────────────────────────────────────────────────────────

export default async function AnswerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getPageBySlug(slug);

  if (!page) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Page not found</h1>
        <p style={{ marginTop: 12 }}>
          <Link href="/answers" style={{ color: "#E35205" }}>
            Browse all answers
          </Link>
        </p>
      </div>
    );
  }

  const relatedPages = page.relatedSlugs
    .map((s) => getPageBySlug(s))
    .filter(Boolean)
    .slice(0, 6);

  return (
    <article>
      {/* Breadcrumbs */}
      <nav style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
        <Link
          href="/answers"
          style={{ color: "#888", textDecoration: "none" }}
        >
          Answers
        </Link>
        {page.trade && (
          <>
            {" / "}
            <span>{TRADES[page.trade as TradeId].plural}</span>
          </>
        )}
        {page.country && (
          <>
            {" / "}
            <span>{COUNTRIES[page.country as CountryId].name}</span>
          </>
        )}
        {" / "}
        <span>{TOPIC_LABELS[page.topic]}</span>
      </nav>

      {/* Title */}
      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {page.title}
      </h1>

      <p
        style={{
          fontSize: 16,
          color: "#555",
          lineHeight: 1.5,
          marginBottom: 40,
        }}
      >
        {page.description}
      </p>

      {/* Context badges */}
      {(page.trade || page.country) && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
          {page.trade && (
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 16,
                backgroundColor: "#FFF3ED",
                color: "#E35205",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {TRADES[page.trade as TradeId].label}
            </span>
          )}
          {page.country && (
            <span
              style={{
                display: "inline-block",
                padding: "4px 12px",
                borderRadius: 16,
                backgroundColor: "#F0F4FF",
                color: "#1E3A8A",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {COUNTRIES[page.country as CountryId].name}
            </span>
          )}
          <span
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 16,
              backgroundColor: "#F5F5F5",
              color: "#555",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {TOPIC_LABELS[page.topic]}
          </span>
        </div>
      )}

      {/* Q&A pairs — the core AEO content */}
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {page.questions.map((q, i) => (
          <section key={i}>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1.3,
                marginBottom: 12,
              }}
            >
              {q.question}
            </h2>
            <div
              style={{
                fontSize: 15,
                lineHeight: 1.7,
                color: "#333",
              }}
            >
              {q.answer}
            </div>
          </section>
        ))}
      </div>

      {/* Related pages — internal linking for AI graph */}
      {relatedPages.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 16,
              color: "#888",
            }}
          >
            Related answers
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {relatedPages.map(
              (rp) =>
                rp && (
                  <Link
                    key={rp.slug}
                    href={`/answers/${rp.slug}`}
                    style={{
                      textDecoration: "none",
                      color: "#1a1a1a",
                      padding: "10px 14px",
                      backgroundColor: "#fff",
                      borderRadius: 8,
                      border: "1px solid #e5e5e5",
                      fontSize: 14,
                      lineHeight: 1.4,
                    }}
                  >
                    {rp.title}
                  </Link>
                )
            )}
          </div>
        </section>
      )}

      {/* JSON-LD structured data — the actual AEO mechanism */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: pageSchemas(page) }}
      />
    </article>
  );
}
