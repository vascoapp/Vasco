import type { Metadata } from "next";
import DeleteAccountClient from "./DeleteAccountClient";

// Server wrapper so the route can export metadata: a "use client" module cannot,
// and this URL goes into the Play Data safety form — a reviewer opens it, and a
// page with no <title> reads as unfinished.
export const metadata: Metadata = {
  // The root layout applies template "%s — Vasco"; including the suffix here
  // renders it twice.
  title: "Delete your account",
  description:
    "Permanently delete your Vasco account and all associated data, as required by GDPR Article 17.",
  // Not indexed (2026-10-08): Play needs this URL to be REACHABLE (it is
  // entered in the Data safety form), not to rank
  // in search. A deletion form in search results invites strangers to it.
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DeleteAccountClient />;
}
