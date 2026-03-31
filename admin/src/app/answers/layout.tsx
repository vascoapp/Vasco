import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Vasco — Contractor Answers",
    default: "Vasco — Answers for Construction Contractors",
  },
  description:
    "Practical answers for self-employed construction contractors across Europe. Pricing, invoicing, compliance, and job management for 7 trades in 6 countries.",
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "Vasco",
    type: "website",
    locale: "en_GB",
  },
};

export default function AnswersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAFAFA",
        color: "#1a1a1a",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Minimal header — not the admin shell */}
      <header
        style={{
          borderBottom: "1px solid #e5e5e5",
          padding: "16px 24px",
          backgroundColor: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        <a
          href="/answers"
          style={{
            textDecoration: "none",
            color: "#E35205",
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: "-0.02em",
          }}
        >
          Vasco
        </a>
        <span style={{ fontSize: 13, color: "#666" }}>
          Answers for Contractors
        </span>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </main>

      {/* Footer with entity info for AI crawlers */}
      <footer
        style={{
          borderTop: "1px solid #e5e5e5",
          padding: "32px 24px",
          maxWidth: 720,
          margin: "0 auto",
          fontSize: 13,
          color: "#888",
          lineHeight: 1.6,
        }}
      >
        <p>
          <strong style={{ color: "#1a1a1a" }}>Vasco</strong> is an AI-native
          business app for construction contractors. It connects quotes, jobs,
          invoices, and payments in one workflow — built for plumbers,
          electricians, painters, carpenters, roofers, tilers, and gas/HVAC
          engineers across the Netherlands, Germany, France, Spain, Italy, and
          the United Kingdom.
        </p>
        <p style={{ marginTop: 12 }}>
          Available on iOS and Android. Free to start.
        </p>
      </footer>
    </div>
  );
}
