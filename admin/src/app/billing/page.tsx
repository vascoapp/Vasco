"use client";

// =============================================================================
// /billing — billing landing + Customer Portal entry (STRIPE_PORTAL_RETURN_URL)
// =============================================================================
// Two jobs:
//  1. Manage an existing subscription → opens the Stripe Customer Portal via the
//     `create-billing-portal-session` edge fn (update card, cancel, switch plan).
//  2. Default return URL after the portal — so it must render cleanly even with
//     no action, and let the user hop back into the app.
// =============================================================================

import { useEffect, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "../../lib/supabase";
import { BillingHeader, BillingFooter, BRAND } from "../../components/BillingChrome";

export default function BillingLandingPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    if (!supabase) {
      setChecking(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionEmail(data.session?.user.email ?? null);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function openPortal() {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return;
    setOpening(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-billing-portal-session", {});
      if (fnErr) {
        setError("Could not open the billing portal. Please try again.");
        setOpening(false);
        return;
      }
      if (data?.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setError((data?.error as string) || "Could not open the billing portal. Please try again.");
      setOpening(false);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setOpening(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF7F2] via-[#F9FAFB] to-[#F9FAFB]">
      <BillingHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div
            className="px-8 pb-6 pt-8 text-center"
            style={{ background: `linear-gradient(180deg, ${BRAND}10, #ffffff)` }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{ background: `${BRAND}1A`, color: BRAND }}
            >
              ⚙
            </div>
            <h1 className="font-[family-name:var(--font-archivo)] text-2xl font-black text-zinc-900">
              Billing &amp; subscription
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">
              Update your payment method, switch plans, view invoices or cancel — anytime.
            </p>
          </div>

          <div className="px-8 pb-8">
            {!configured ? (
              <p className="text-center text-sm text-zinc-500">
                Billing isn&apos;t configured on this deployment yet.
              </p>
            ) : checking ? (
              <p className="text-center text-sm text-zinc-500">Loading…</p>
            ) : sessionEmail ? (
              <div className="space-y-3">
                <p className="mb-1 text-center text-sm text-zinc-600">
                  Signed in as <span className="font-semibold text-zinc-900">{sessionEmail}</span>
                </p>
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={opening}
                  className="w-full rounded-2xl px-6 py-3.5 font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
                  style={{ background: BRAND, boxShadow: `0 8px 24px -10px ${BRAND}99` }}
                >
                  {opening ? "Opening…" : "Manage subscription"}
                </button>
                <a
                  href="/billing/upgrade"
                  className="block w-full rounded-2xl border px-6 py-3 text-center font-semibold transition hover:bg-zinc-50"
                  style={{ borderColor: BRAND, color: BRAND }}
                >
                  Change plan
                </a>
                {error && <p className="text-center text-sm text-red-600">{error}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <a
                  href="/billing/upgrade"
                  className="block w-full rounded-2xl px-6 py-3.5 text-center font-bold text-white shadow-sm transition hover:brightness-105"
                  style={{ background: BRAND, boxShadow: `0 8px 24px -10px ${BRAND}99` }}
                >
                  Choose a plan
                </a>
                <p className="text-center text-xs text-zinc-500">
                  Already subscribed? Sign in on the upgrade page to manage it.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <BillingFooter />
    </div>
  );
}
