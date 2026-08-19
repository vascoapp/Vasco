import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Vasco — Run your trade business from your phone",
    template: "%s — Vasco",
  },
  description:
    "AI-native platform for contractors, aannemers, and site leads across the EU. Quotes, invoices, and incasso — built for the trade.",
  metadataBase: new URL("https://vascobuild.com"),
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
