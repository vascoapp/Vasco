import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted, not next/font/google: that downloads the fonts from Google on
// EVERY build, and a network hiccup failed the CI admin build ("next/font/google
// queries have exactly one entry", 2026-09-24 and 09-30) — red runs that said
// nothing about the code. Same families and weights as before (OFL, licences
// beside the files), copied from the app's @expo-google-fonts packages.
const archivo = localFont({
  src: [
    { path: "./fonts/Archivo_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Archivo_700Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/Archivo_800ExtraBold.ttf", weight: "800", style: "normal" },
    { path: "./fonts/Archivo_900Black.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-archivo",
  display: "swap",
});

const inter = localFont({
  src: [
    { path: "./fonts/Inter_400Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Inter_500Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Inter_600SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Inter_700Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vasco — Quotes, invoices and e-invoicing for the trades",
    template: "%s — Vasco",
  },
  description:
    "Quotes, jobs, invoices and e-invoicing for tradespeople and aannemers across NL, DE, FR, ES, IT and the UK. Free plan; no commission on payments.",
  metadataBase: new URL("https://vascobuild.com"),
  openGraph: {
    siteName: "Vasco",
    type: "website",
  },
  // The image itself comes from app/opengraph-image.tsx (file convention).
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${inter.variable}`}>
      <body>
        {children}
        {/* No cookie banner, deliberately. Removed 2026-08-19 after finding
            that nothing read its consent key — Accept and Reject did the same
            thing — and that there is no analytics package in package.json and
            no third-party script here, so there are no non-essential cookies
            to gate. ePrivacy requires consent for non-essential storage, not a
            button that pretends to ask, and a dialog that ignores the answer is
            a liability rather than a protection. It also rendered over the
            customer capability pages, telling a Dutch homeowner about cookies
            used "to run the admin dashboard".

            🔴 IF YOU ADD ANALYTICS OR ANY THIRD-PARTY SCRIPT, THE BANNER COMES
            BACK — and it must actually gate the load, not just record a click.
            Git history has the old component if it helps as a starting point. */}
      </body>
    </html>
  );
}
