// ═══════════════════════════════════════════════════════════════════════════
// FREE E-INVOICE VALIDATOR — the link-bait, and a genuinely useful tool
// ═══════════════════════════════════════════════════════════════════════════
// "XRechnung validieren kostenlos" is a real, recurring query with high intent:
// someone with a file in hand and a deadline. A free tool that answers it earns
// the backlinks that actually move rankings, gets passed around by accountants,
// and puts us in front of exactly the person who is about to need the product.
//
// The tool has to be honest to be worth linking to. It is a first-pass check,
// not certified conformance, and the page says so above the fold and again in
// the FAQ. Claiming more would get us cited once and distrusted afterwards.
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from "next";
import Link from "next/link";
import { ValidatorClient } from "./validator-client";
import { MANDATE_VERIFIED_ON } from "@/lib/aeo/data";

const BASE_URL = "https://vascobuild.com";

export const metadata: Metadata = {
  title: "Free e-invoice checker — basic checks for XRechnung, Peppol BIS and UBL",
  description:
    "Paste or upload an e-invoice XML for basic structural checks: EN 16931 mandatory fields and the totals that silently fail. Not the official KoSIT validation. Free, no sign-up, and your invoice never leaves your browser.",
  alternates: { canonical: `${BASE_URL}/tools/e-invoice-validator` },
  openGraph: {
    title: "Free e-invoice checker (XRechnung, Peppol BIS, UBL)",
    description: "Basic structural checks: mandatory fields and totals against EN 16931. Not the official KoSIT validation. Runs in your browser.",
    url: `${BASE_URL}/tools/e-invoice-validator`,
    type: "website",
  },
};

const FAQ = [
  {
    q: "Is this an official XRechnung validation?",
    a: "No. This tool runs basic structural checks only: whether the XML parses, whether the EN 16931 mandatory fields are present, and whether the totals add up (BR-CO-10, BR-CO-15, BR-CO-16). It does not run the official KoSIT validation — the full XRechnung Schematron and CIUS rule set — so an invoice that passes here can still be rejected. For a formal result use the official validator: the KoSIT validator (github.com/itplr-kosit/validator) or the Baden-Württemberg online service (erechnungsvalidator.service-bw.de).",
  },
  {
    q: "Is my invoice uploaded anywhere?",
    a: "No. The file is parsed in your browser and never sent to a server. An e-invoice contains your customer's name, address and VAT number, and none of that is needed to tell you whether your totals add up.",
  },
  {
    q: "Why does my invoice fail on totals when it looks fine?",
    a: "Because the arithmetic rules are checked by machine and not by eye. The most common failure is BR-CO-10: the sum of the line net amounts does not equal the stated line total, usually after a line was edited without the totals being rebuilt, or from rounding each line separately. BR-CO-15 (net plus VAT must equal gross) and BR-CO-16 (amount due must equal gross less any prepayment) catch the rest. A deposit subtracted silently rather than recorded as a prepaid amount is a frequent cause.",
  },
  {
    q: "Can I check a ZUGFeRD or Factur-X PDF here?",
    a: "Not the PDF itself. ZUGFeRD and Factur-X embed the invoice XML inside a PDF/A-3 file — extract that XML and paste it here. A plain PDF with no embedded XML is not a structured e-invoice at all, which is itself the single most common misunderstanding about the mandate.",
  },
];

export default function ValidatorPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Vasco e-invoice validator",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any (browser)",
        url: `${BASE_URL}/tools/e-invoice-validator`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        description:
          "Free browser-based basic checker for EN 16931 e-invoices (XRechnung, Peppol BIS, UBL): mandatory fields and total calculations. Not the official KoSIT validation. No upload, no sign-up.",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <article lang="en">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <nav style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
        <Link href="/answers" style={{ color: "#888", textDecoration: "none" }}>Answers</Link>
        {" / "}<span>E-invoice validator</span>
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 12 }}>
        Free e-invoice checker
      </h1>
      <p style={{ color: "#9CA3AF", fontSize: 15, lineHeight: 1.7, marginBottom: 8 }}>
        Check an XRechnung, Peppol BIS or other UBL invoice against EN 16931:
        the mandatory fields, and the total calculations that fail silently
        because the file still looks right.
      </p>
      <p style={{ color: "#9CA3AF", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
        Free, no sign-up. These are basic structural checks, not the official
        KoSIT validation, and an invoice that passes here can still be
        rejected. For a formal result use the official validator:{" "}
        <a href="https://erechnungsvalidator.service-bw.de" rel="noopener" style={{ color: "#F97316" }}>
          erechnungsvalidator.service-bw.de
        </a>{" "}
        or the{" "}
        <a href="https://github.com/itplr-kosit/validator" rel="noopener" style={{ color: "#F97316" }}>
          KoSIT validator
        </a>
        .
      </p>

      <ValidatorClient />

      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "40px 0 16px" }}>Common questions</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {FAQ.map((f, i) => (
          <section key={i}>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, lineHeight: 1.35 }}>{f.q}</h3>
            <p style={{ color: "#D1D5DB", fontSize: 14.5, lineHeight: 1.75 }}>{f.a}</p>
          </section>
        ))}
      </div>

      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 8 }}>
        <Link href="/answers/deadlines" style={{ color: "#F97316", fontSize: 15 }}>
          When does the e-invoicing mandate apply to you? Countdown by country →
        </Link>
        <Link href="/answers/for-accountants" style={{ color: "#F97316", fontSize: 15 }}>
          Briefing for accountants advising trades clients →
        </Link>
      </div>

      <p style={{ color: "#6B7280", fontSize: 12.5, marginTop: 28, lineHeight: 1.6 }}>
        Rule references follow EN 16931. Mandate information on this site was
        verified {MANDATE_VERIFIED_ON}.
      </p>
    </article>
  );
}
