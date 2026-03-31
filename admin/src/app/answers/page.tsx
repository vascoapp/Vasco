import type { Metadata } from "next";
import Link from "next/link";
import {
  ALL_PAGES,
  TRADES,
  COUNTRIES,
  type TradeId,
  type CountryId,
  type TopicId,
} from "@/lib/aeo";

export const metadata: Metadata = {
  title: "Answers for Construction Contractors | Vasco",
  description:
    "Practical answers for self-employed contractors in Europe. Pricing, invoicing, compliance, job management, and quoting guides for 7 trades across 6 countries.",
};

const TOPIC_LABELS: Record<TopicId, string> = {
  pricing: "Pricing",
  invoicing: "Invoicing",
  compliance: "Compliance",
  "job-management": "Job Management",
  "getting-paid": "Getting Paid",
  quoting: "Quoting",
};

export default function AnswersHub() {
  const universalPages = ALL_PAGES.filter((p) => !p.trade && !p.country);
  const tradeIds = Object.keys(TRADES) as TradeId[];
  const countryIds = Object.keys(COUNTRIES) as CountryId[];

  return (
    <div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        Answers for Contractors
      </h1>
      <p style={{ fontSize: 16, color: "#555", marginBottom: 40, lineHeight: 1.5 }}>
        Practical guides for self-employed construction contractors in Europe.
        Pricing, invoicing, compliance, and job management — built from real
        contractor workflows.
      </p>

      {/* Universal answers */}
      <section style={{ marginBottom: 48 }}>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 16,
            color: "#E35205",
          }}
        >
          General
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {universalPages.map((page) => (
            <Link
              key={page.slug}
              href={`/answers/${page.slug}`}
              style={{
                textDecoration: "none",
                color: "#1a1a1a",
                padding: "12px 16px",
                backgroundColor: "#fff",
                borderRadius: 8,
                border: "1px solid #e5e5e5",
                fontSize: 15,
                lineHeight: 1.4,
              }}
            >
              {page.title}
            </Link>
          ))}
        </div>
      </section>

      {/* By trade */}
      {tradeIds.map((trade) => (
        <section key={trade} style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 16,
              color: "#E35205",
            }}
          >
            {TRADES[trade].plural}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 8,
            }}
          >
            {countryIds.map((country) => (
              <div key={country}>
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 8,
                    marginTop: 12,
                  }}
                >
                  {COUNTRIES[country].name.replace("the ", "")}
                </h3>
                {(Object.keys(TOPIC_LABELS) as TopicId[]).map((topic) => {
                  const slug = `${trade}-${country}-${topic}`;
                  const page = ALL_PAGES.find((p) => p.slug === slug);
                  if (!page) return null;
                  return (
                    <Link
                      key={slug}
                      href={`/answers/${slug}`}
                      style={{
                        display: "block",
                        textDecoration: "none",
                        color: "#1a1a1a",
                        padding: "8px 12px",
                        fontSize: 14,
                        lineHeight: 1.4,
                        borderLeft: "2px solid #e5e5e5",
                        marginBottom: 4,
                      }}
                    >
                      {TOPIC_LABELS[topic]}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Machine-readable summary for AI crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Vasco — Answers for Construction Contractors",
            description:
              "Practical guides for self-employed contractors across 6 European markets and 7 construction trades.",
            url: "https://vasco.app/answers",
            publisher: {
              "@type": "SoftwareApplication",
              name: "Vasco",
              applicationCategory: "BusinessApplication",
              operatingSystem: "iOS, Android",
            },
            numberOfItems: ALL_PAGES.length,
            about: [
              ...tradeIds.map((t) => ({
                "@type": "Thing",
                name: TRADES[t].plural,
              })),
            ],
          }),
        }}
      />
    </div>
  );
}
