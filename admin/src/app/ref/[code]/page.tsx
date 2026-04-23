// =============================================================================
// REFERRAL LANDING PAGE (R231)
// =============================================================================
// Served at https://admin.vasco.app/ref/{code}. Two roles:
//   1. Universal-link / App-link target — on a device where Vasco is
//      installed and AASA/assetlinks verified, the OS opens the app
//      directly and this page never renders.
//   2. Web fallback — on desktop or on a device without the app
//      installed, show a minimal page with store badges + the code
//      prefilled so the install-then-attribution chain works.
//
// The page is intentionally static + Server Component — no client JS
// required. The store-redirect buttons embed the code in the store
// deep-link so Apple Search Ads / Play Referrer can forward it.
// =============================================================================

import Link from "next/link";

interface PageProps {
  params: Promise<{ code: string }>;
}

// App Store + Play Store IDs — placeholders until live listings exist.
// When shipping, replace APPSTORE_ID with the numeric Apple ID and verify
// the Play package name matches app.json's android.package.
const APPSTORE_ID = "0000000000"; // e.g. from App Store Connect → App Info
const PLAY_PACKAGE = "com.vasco.app";

function normalizeCode(raw: string): string | null {
  const clean = raw.trim().toUpperCase();
  if (!/^[A-Z2-9]{4,8}$/.test(clean)) return null;
  return clean;
}

export default async function ReferralLandingPage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const code = normalizeCode(rawCode);

  // Store links with the code encoded — Apple passes it via
  // `?ct=ref_{CODE}` (campaign token) and Play Store via `referrer=ref_{CODE}`.
  const iosUrl = code
    ? `https://apps.apple.com/app/id${APPSTORE_ID}?ct=ref_${code}`
    : `https://apps.apple.com/app/id${APPSTORE_ID}`;
  const androidUrl = code
    ? `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=ref_${code}`
    : `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0B0E11",
        color: "#FFFFFF",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            background: "linear-gradient(135deg, #9A3412, #C2410C, #F97316)",
            margin: "0 auto 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
          }}
          aria-hidden
        >
          ⚡
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 900, margin: "0 0 8px", letterSpacing: -0.5 }}>
          {code ? "You've been invited to Vasco" : "Vasco"}
        </h1>

        {code ? (
          <p style={{ color: "#9CA3AF", fontSize: 16, lineHeight: 1.5, margin: "0 0 32px" }}>
            A contractor sent you this link. Install Vasco and sign up — both of you get a
            month free once you send your first invoice.
          </p>
        ) : (
          <p style={{ color: "#9CA3AF", fontSize: 16, lineHeight: 1.5, margin: "0 0 32px" }}>
            The construction-trade app that turns quotes, jobs, and invoices into one flow.
          </p>
        )}

        {code && (
          <div
            style={{
              background: "#14181F",
              border: "1px solid #2A3038",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 32,
            }}
          >
            <div style={{ fontSize: 11, color: "#9CA3AF", letterSpacing: 1.2, marginBottom: 4 }}>
              YOUR CODE
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#F97316", letterSpacing: 4 }}>
              {code}
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link
            href={iosUrl}
            style={{
              background: "#FFFFFF",
              color: "#0B0E11",
              padding: "14px 20px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Download for iPhone
          </Link>
          <Link
            href={androidUrl}
            style={{
              background: "#FFFFFF",
              color: "#0B0E11",
              padding: "14px 20px",
              borderRadius: 12,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Download for Android
          </Link>
        </div>

        {!code && (
          <p style={{ color: "#EF4444", fontSize: 13, marginTop: 24 }}>
            This referral code isn&apos;t valid. You can still install Vasco — your referrer may
            share a fresh code.
          </p>
        )}

        <p style={{ color: "#6B7280", fontSize: 12, marginTop: 48 }}>
          Already have Vasco installed? This link should have opened the app. Tap once more
          from the original message if it didn&apos;t.
        </p>
      </div>
    </main>
  );
}

// Server-rendered — no dynamic data beyond the URL param. Cache aggressively.
export const revalidate = 3600; // 1h