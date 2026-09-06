import type { Metadata } from "next";
import DeleteAccountClient from "./DeleteAccountClient";

// Server wrapper so the route can export metadata: a "use client" module cannot,
// and this URL goes into the Play Data safety form — a reviewer opens it, and a
// page with no <title> reads as unfinished.
export const metadata: Metadata = {
  title: "Delete your account — Vasco",
  description:
    "Permanently delete your Vasco account and all associated data, as required by GDPR Article 17.",
  // Must stay indexable: Play requires the deletion route to be readily
  // discoverable outside the app.
  robots: { index: true, follow: true },
};

export default function Page() {
  return <DeleteAccountClient />;
}
