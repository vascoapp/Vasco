// ═══════════════════════════════════════════════════════════════════════════
// FOR ACCOUNTANTS — the mandate page aimed at the adviser, not the trade
// ═══════════════════════════════════════════════════════════════════════════
// A Steuerberater or expert-comptable will be asked this by dozens of clients
// through 2027, and they answer for all of them at once. One page that makes
// that adviser's job easier is worth more than ten aimed at individual
// contractors, because it reaches a room rather than a person.
//
// So it is written for a professional who already knows the law better than we
// do. That means: no explaining what an e-invoice is, no urgency theatre, and
// no pretending we are the authority. What an adviser actually wants is the
// per-client operational answer — which of my clients is caught, when, and what
// do I tell the one-person Handwerksbetrieb who cannot buy an ERP.
//
// The honest pitch is narrow and it is the one that converts: their smallest
// clients are the hardest to serve, and those are exactly who this app is for.
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from "next";
import Link from "next/link";
import { MANDATE, MANDATE_VERIFIED_ON, COUNTRIES } from "@/lib/aeo/data";
import type { CountryId } from "@/lib/aeo/data";

const BASE_URL = "https://vascobuild.com";

export const metadata: Metadata = {
  title: "E-invoicing mandate: a briefing for accountants advising trades clients",
  description: `What accountants and tax advisers need to tell self-employed trades clients about the e-invoicing mandate in Germany, France, Italy, Spain and the Netherlands — who is caught, from when, and what the smallest clients can realistically use. Verified ${MANDATE_VERIFIED_ON}.`,
  alternates: { canonical: `${BASE_URL}/answers/for-accountants` },
  openGraph: {
    title: "E-invoicing mandate: a briefing for accountants",
    description: "Who is caught, from when, and what your smallest trades clients can realistically use.",
    url: `${BASE_URL}/answers/for-accountants`,
    type: "article",
  },
};

const QA: { q: string; a: string }[] = [
  {
    q: "Which of my trades clients are caught first, and when?",
    a: "In Germany the RECEIVE obligation caught every client on 1 January 2025 with no turnover exemption — including sole traders and Kleinunternehmer under §19 UStG. Issuing follows for clients above €800,000 turnover on 1 January 2027 and for everyone else on 1 January 2028. In Italy your clients are already fully within scope and have been since 2019. France phases the issuing obligation by company size between 2026 and 2028. In Spain, Facturae is required today for public-sector invoicing while the general B2B rule awaits its implementing regulation. In the Netherlands only B2G applies; a domestic B2B obligation is expected around 2030.",
  },
  {
    q: "What do I tell a one-person client who cannot justify an ERP?",
    a: "That the obligation is about the invoice file, not the software category. A valid structured file in the correct format, plus a record of what was sent, satisfies the requirement — there is no rule that a Handwerksbetrieb must buy a system priced for a mid-market company. This is usually the practical sticking point for advisers: the compliance answer for a fifty-person firm is obvious and the answer for a one-van plumber is not.",
  },
  {
    q: "Where does this actually go wrong in practice?",
    a: "Two places. First, clients assume a PDF by email is compliant; it is not, because the mandate requires machine-readable data rather than an image of an invoice. Second, and more expensively, clients conflate 'sent' with 'accepted'. In Italy the SDI can reject a filing and a rejected FatturaPA was never legally issued, so a client who believes they invoiced has not — and will only discover it at reconciliation. Any tooling you recommend should keep those two states apart and show the rejection code.",
  },
  {
    q: "Do my clients need to be able to receive before they need to issue?",
    a: "In Germany, yes, and this is the most commonly missed point: the receiving duty has been in force since January 2025 while the issuing duty is still one to two years out depending on turnover. A client who is planning for 2027 or 2028 may already be non-compliant today. It is worth checking that every client can accept an XRechnung now, regardless of their issuing date.",
  },
  {
    q: "What does Vasco do, and what does it not do?",
    a: "Vasco is a job-to-invoice app for self-employed trades and small contracting firms across six European markets. It generates the required structured formats — XRechnung and ZUGFeRD, Factur-X, FatturaPA, Facturae, Peppol BIS — from the invoice the contractor already raised, and it tracks submitted separately from accepted so a rejection is visible rather than assumed away. It is not a tax filing service, not an accounting ledger, and not a substitute for your advice: it exists to make the smallest clients on your list straightforward to serve.",
  },
];

export default function ForAccountantsPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: "E-invoicing mandate: a briefing for accountants advising trades clients",
    url: `${BASE_URL}/answers/for-accountants`,
    inLanguage: "en",
    dateModified: new Date(MANDATE_VERIFIED_ON).toISOString().split("T")[0],
    mainEntity: QA.map((x) => ({
      "@type": "Question",
      name: x.q,
      acceptedAnswer: { "@type": "Answer", text: x.a },
    })),
  };

  return (
    <article lang="en">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <nav style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
        <Link href="/answers" style={{ color: "#888", textDecoration: "none" }}>Answers</Link>
        {" / "}<span>For accountants</span>
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 12 }}>
        E-invoicing mandate: a briefing for accountants advising trades clients
      </h1>
      <p style={{ color: "#9CA3AF", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
        Written for advisers rather than for contractors. Who is caught and from
        when, where it goes wrong in practice, and what to recommend to the
        clients who cannot justify a mid-market system.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 32, marginBottom: 32 }}>
        {QA.map((x, i) => (
          <section key={i}>
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, lineHeight: 1.35 }}>{x.q}</h2>
            <p style={{ color: "#D1D5DB", fontSize: 15, lineHeight: 1.75 }}>{x.a}</p>
          </section>
        ))}
      </div>

      <div style={{
        border: "1px solid #2A3038", borderRadius: 10, padding: "12px 14px",
        fontSize: 13, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 28,
      }}>
        <strong style={{ color: "#FFFFFF" }}>Verified {MANDATE_VERIFIED_ON}.</strong>{" "}
        This is a practitioner briefing, not tax advice, and you will know your
        clients&rsquo; positions better than we do. Official sources:{" "}
        {(["de", "fr", "it", "es", "nl"] as CountryId[]).map((c, i, arr) => (
          <span key={c}>
            <a href={MANDATE[c].source?.url} rel="noopener" style={{ color: "#F97316" }}>
              {COUNTRIES[c].name}
            </a>
            {i < arr.length - 1 ? ", " : "."}
          </span>
        ))}
      </div>

      <p style={{ fontSize: 15 }}>
        <Link href="/answers/deadlines" style={{ color: "#F97316" }}>
          Countdown to every deadline, by country →
        </Link>
      </p>
    </article>
  );
}
