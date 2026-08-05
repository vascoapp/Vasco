// ═══════════════════════════════════════════════════════════════════════════
// E-INVOICING DEADLINES — one page, every country, days remaining
// ═══════════════════════════════════════════════════════════════════════════
// "How long have I got?" is the question behind every mandate search, and it is
// the one a table answers better than prose. It is also the most linkable thing
// on the site: a countdown is what an accountant's newsletter, a trade forum
// post or an assistant reaches for when someone asks about timing.
//
// The countdown is computed at render rather than hardcoded, so it cannot go
// stale in the way a written "18 months away" does. Deadlines that have already
// passed are shown as LIVE rather than hidden — Germany's receive obligation
// passed in January 2025 and is the one small firms are most often unaware of,
// so removing it would drop the most useful row on the page.
// ═══════════════════════════════════════════════════════════════════════════

import type { Metadata } from "next";
import Link from "next/link";
import { MANDATE, MANDATE_VERIFIED_ON, COUNTRIES } from "@/lib/aeo/data";
import type { CountryId } from "@/lib/aeo/data";

const BASE_URL = "https://vascobuild.com";

export const metadata: Metadata = {
  title: "E-invoicing deadlines in Europe: how long until the mandate applies to you",
  description: `Countdown to every EU e-invoicing deadline for self-employed trades and small contractors — Germany, France, Italy, Spain, the Netherlands. What you must receive, what you must issue, and from when. Verified ${MANDATE_VERIFIED_ON}.`,
  alternates: { canonical: `${BASE_URL}/answers/deadlines` },
  openGraph: {
    title: "E-invoicing deadlines in Europe — countdown by country",
    description: "How long until the e-invoicing mandate applies to your trade business, country by country.",
    url: `${BASE_URL}/answers/deadlines`,
    type: "article",
  },
};

/**
 * The dated obligations, separate from the prose in MANDATE.
 *
 * Only dates that are actually FIXED in law appear here. France's issuing
 * obligation is phased by company size and Spain's B2B rule awaits its
 * implementing regulation — inventing a row for those would be the one thing
 * this page must not do, so they are listed without a countdown and marked as
 * needing confirmation.
 */
interface Deadline {
  country: CountryId;
  label: string;
  /** ISO date, or null when the obligation has no fixed date yet. */
  date: string | null;
  note?: string;
}

const DEADLINES: Deadline[] = [
  { country: "de", label: "Must be able to RECEIVE structured e-invoices", date: "2025-01-01", note: "No turnover exemption. This one is already in force." },
  { country: "de", label: "Must ISSUE — businesses over €800,000 turnover", date: "2027-01-01" },
  { country: "de", label: "Must ISSUE — all remaining businesses", date: "2028-01-01" },
  { country: "it", label: "Fatturazione elettronica via SDI", date: "2019-01-01", note: "Long since mandatory for essentially all invoices." },
  { country: "fr", label: "Must be able to RECEIVE", date: "2026-09-01", note: "Reform rolls out from 2026." },
  { country: "fr", label: "Must ISSUE — phased by company size", date: null, note: "Between 2026 and 2028, smallest businesses last. Confirm your wave with your expert-comptable or the DGFiP." },
  { country: "es", label: "Facturae to public bodies (FACe)", date: "2015-01-15", note: "Already required for public-sector invoicing." },
  { country: "es", label: "General B2B obligation (Crea y Crece)", date: null, note: "Awaits the implementing regulation; the timetable has moved more than once." },
  { country: "nl", label: "E-invoicing to government (B2G)", date: "2017-01-01", note: "Already required." },
  { country: "nl", label: "Domestic B2B obligation", date: null, note: "No mandate yet. Draft law expected; direction currently points to around 2030." },
];

function daysUntil(iso: string): number {
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.ceil((then - now) / 86_400_000);
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export default function DeadlinesPage() {
  const rows = DEADLINES.map((d) => ({
    ...d,
    days: d.date ? daysUntil(d.date) : null,
  }));

  // Soonest future deadline first; live obligations after; undated last. A
  // contractor scanning this wants "what is coming at me" before "what already
  // applies", and the undated rows are the ones they cannot act on yet.
  const sorted = [...rows].sort((a, b) => {
    const rank = (r: typeof a) => (r.days === null ? 2 : r.days >= 0 ? 0 : 1);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return (a.days ?? 0) - (b.days ?? 0);
  });

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    name: "E-invoicing deadlines in Europe",
    url: `${BASE_URL}/answers/deadlines`,
    dateModified: new Date(MANDATE_VERIFIED_ON).toISOString().split("T")[0],
    mainEntity: sorted.map((r) => ({
      "@type": "Question",
      name: `When does "${r.label}" apply in ${COUNTRIES[r.country].name}?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: r.date
          ? `${formatDate(r.date)}.${r.days !== null && r.days >= 0 ? ` That is ${r.days} days away.` : " This obligation is already in force."}${r.note ? ` ${r.note}` : ""}`
          : `No fixed date yet. ${r.note ?? ""}`.trim(),
      },
    })),
  };

  return (
    <article lang="en">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <nav style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>
        <Link href="/answers" style={{ color: "#888", textDecoration: "none" }}>Answers</Link>
        {" / "}<span>Deadlines</span>
      </nav>

      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 12 }}>
        E-invoicing deadlines in Europe: how long have you got?
      </h1>
      <p style={{ color: "#9CA3AF", fontSize: 15, lineHeight: 1.7, marginBottom: 28 }}>
        Every dated e-invoicing obligation for self-employed trades and small
        contractors, counted from today. Obligations already in force are shown
        too — in Germany the duty to <em>receive</em> structured invoices has
        applied since January 2025, and it is the one small firms most often miss.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
        {sorted.map((r, i) => {
          const live = r.days !== null && r.days < 0;
          const soon = r.days !== null && r.days >= 0 && r.days < 400;
          return (
            <div key={i} style={{
              border: "1px solid #2A3038", borderRadius: 10, padding: "14px 16px",
              display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap",
            }}>
              <span style={{ fontWeight: 700, color: "#FFFFFF", minWidth: 130 }}>
                {COUNTRIES[r.country].name}
              </span>
              <span style={{ flex: 1, minWidth: 240, color: "#E5E7EB" }}>{r.label}</span>
              <span style={{
                fontWeight: 800,
                color: live ? "#EF4444" : soon ? "#F97316" : r.days === null ? "#9CA3AF" : "#FFFFFF",
                whiteSpace: "nowrap",
              }}>
                {r.days === null
                  ? "No fixed date"
                  : live
                    ? "In force now"
                    : `${r.days} days`}
              </span>
              {r.date && (
                <span style={{ color: "#9CA3AF", fontSize: 13, whiteSpace: "nowrap" }}>
                  {formatDate(r.date)}
                </span>
              )}
              {r.note && (
                <span style={{ flexBasis: "100%", color: "#9CA3AF", fontSize: 13, lineHeight: 1.6 }}>
                  {r.note}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        border: "1px solid #2A3038", borderRadius: 10, padding: "12px 14px",
        fontSize: 13, color: "#9CA3AF", lineHeight: 1.6, marginBottom: 28,
      }}>
        <strong style={{ color: "#FFFFFF" }}>Verified {MANDATE_VERIFIED_ON}.</strong>{" "}
        Countdowns are calculated when this page is served, so they do not go
        stale — but the underlying dates can change. Where a rollout is phased by
        company size we say so rather than guess a threshold. Check the national
        authority before acting:{" "}
        {(["de", "fr", "it", "es", "nl"] as CountryId[]).map((c, i, arr) => (
          <span key={c}>
            <a href={MANDATE[c].source?.url} rel="noopener" style={{ color: "#F97316" }}>
              {COUNTRIES[c].name}
            </a>
            {i < arr.length - 1 ? ", " : "."}
          </span>
        ))}
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>What each country requires</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(["de", "fr", "it", "es", "nl"] as CountryId[]).map((c) => (
          <Link
            key={c}
            href={`/answers/plumbing-${c}-einvoicing-mandate`}
            style={{ color: "#F97316", textDecoration: "none", fontSize: 15 }}
          >
            {COUNTRIES[c].name}: {MANDATE[c].status} →
          </Link>
        ))}
      </div>
    </article>
  );
}
