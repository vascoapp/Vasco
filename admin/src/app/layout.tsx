import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/CookieBanner";

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
        <CookieBanner />
      </body>
    </html>
  );
}
