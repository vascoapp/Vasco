"use client";

// =============================================================================
// /billing/upgrade — web subscription checkout (iOS External Purchase Link target)
// =============================================================================
// Flow: user lands here (from the iOS link-out `?country=` or the web) → signs
// in with their Vasco account → picks tier × cycle → we call the
// `create-subscription-checkout` edge function (which requires a real user
// session) → redirect to Stripe Checkout.
//
// The edge fn reads the JWT via supabase.functions.invoke (auto-attached), so
// the user MUST be authenticated before checkout can start.
// =============================================================================

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase, isSupabaseConfigured } from "../../../lib/supabase";
import { BillingHeader, BillingFooter, TrustRow, BRAND } from "../../../components/BillingChrome";
import { PRICING } from "../../../lib/pricing";

type Tier = "pro" | "contractor";
type Cycle = "monthly" | "yearly";

// Display prices come from lib/pricing.ts (excl. VAT) — the same list the
// homepage and the app's TIERS use; the charge itself is the Stripe Price IDs
// on the edge function. Features: only what ships (the same as the homepage) —
// this page once sold "autopilot", automated reminders, a purchasing agent and
// van stock, none of which exist.
const PLANS: Record<
  Tier,
  { name: string; tagline: string; monthly: number; yearly: number; popular?: boolean; features: string[] }
> = {
  pro: {
    name: "Pro",
    tagline: "Unlimited quotes and invoices, plus e-invoicing",
    monthly: PRICING.pro.monthly,
    yearly: PRICING.pro.yearlyPerMonth,
    popular: true,
    features: [
      "Unlimited jobs, quotes, invoices and customers",
      "E-invoicing: XRechnung, ZUGFeRD, Factur-X, Facturae, FatturaPA, Peppol",
      "Payment links via your own Mollie or Stripe",
      "Online quote acceptance for your customers",
      `${PRICING.pro.seatsIncluded} team members included`,
    ],
  },
  contractor: {
    name: "Contractor",
    tagline: "For teams",
    monthly: PRICING.contractor.monthly,
    yearly: PRICING.contractor.yearlyPerMonth,
    features: ["Everything in Pro", `Up to ${PRICING.contractor.seatsIncluded} team members`, "Dedicated support"],
  },
};

const YEARLY_SAVING = Math.round((1 - PRICING.pro.yearlyPerMonth / PRICING.pro.monthly) * 100);

function isTier(v: string | null): v is Tier {
  return v === "pro" || v === "contractor";
}
function isCycle(v: string | null): v is Cycle {
  return v === "monthly" || v === "yearly";
}

function UpgradeInner() {
  const params = useSearchParams();
  const country = (params.get("country") || "").toLowerCase();

  const [tier, setTier] = useState<Tier>(isTier(params.get("tier")) ? (params.get("tier") as Tier) : "pro");
  const [cycle, setCycle] = useState<Cycle>(isCycle(params.get("cycle")) ? (params.get("cycle") as Cycle) : "monthly");
  const [extraSeats, setExtraSeats] = useState(0);

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The trial THIS account gets at checkout (create-subscription-checkout's
  // preview → _shared/checkoutTrial.ts): a fresh account a month, a running
  // in-app trial to its own end, a used one none. The page promised "your first
  // month is free" to everyone while the checkout gave it only once (2026-10-14).
  type Trial = { days: number } | { endsAt: number } | null;
  const [trial, setTrial] = useState<Trial | "unknown">("unknown");

  const configured = isSupabaseConfigured();

  useEffect(() => {
    // Reset first: switching accounts must not show the previous one's trial.
    setTrial("unknown");
    if (!sessionEmail) return;
    let active = true;
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.functions
      .invoke("create-subscription-checkout", { body: { preview: true } })
      .then(({ data, error: fnErr }) => {
        if (!active) return;
        setTrial(!fnErr && data?.ok ? ((data.trial ?? null) as Trial) : "unknown");
      })
      .catch(() => { if (active) setTrial("unknown"); });
    return () => { active = false; };
  }, [sessionEmail]);

  const trialEnd = trial && trial !== "unknown" && "endsAt" in trial
    ? new Date(trial.endsAt * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    if (!supabase) {
      setCheckingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSessionEmail(data.session?.user.email ?? null);
      setCheckingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!active) return;
      setSessionEmail(session?.user.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return;
    setSigningIn(true);
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSigningIn(false);
    if (signInErr) {
      setError(
        signInErr.message?.toLowerCase().includes("invalid")
          ? "Wrong email or password. Use the same login as the Vasco app."
          : signInErr.message || "Could not sign in. Please try again.",
      );
    }
  }

  async function startCheckout() {
    setError(null);
    const supabase = getSupabase();
    if (!supabase) return;
    setRedirecting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-subscription-checkout", {
        body: { tier, billingCycle: cycle, extraSeats: tier === "pro" ? extraSeats : 0 },
      });
      if (fnErr) {
        setError("Could not start checkout. Please try again.");
        setRedirecting(false);
        return;
      }
      if (data?.ok && data.url) {
        window.location.href = data.url as string;
        return;
      }
      setError((data?.error as string) || "Could not start checkout. Please try again.");
      setRedirecting(false);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setRedirecting(false);
    }
  }

  const plan = PLANS[tier];
  const seats = tier === "pro" ? extraSeats : 0;
  const seatPrice = cycle === "yearly" ? PRICING.extraSeat.yearlyPerMonth : PRICING.extraSeat.monthly;
  const price = (cycle === "yearly" ? plan.yearly : plan.monthly) + seats * seatPrice;
  const annualTotal = useMemo(() => price * 12, [price]);

  if (!configured) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="mb-3 font-[family-name:var(--font-archivo)] text-2xl font-black text-zinc-900">
            Checkout unavailable
          </h1>
          <p className="text-sm text-zinc-600">
            Subscriptions aren&apos;t configured on this deployment yet. Please try again later or email{" "}
            <a href="mailto:support@vascobuild.com" className="underline" style={{ color: BRAND }}>
              support@vascobuild.com
            </a>
            .
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Hero */}
      <div className="mb-8 text-center">
        <span
          className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ background: `${BRAND}14`, color: BRAND }}
        >
          Upgrade
        </span>
        <h1 className="font-[family-name:var(--font-archivo)] text-[34px] font-black leading-tight text-zinc-900 sm:text-[40px]">
          Choose your plan
        </h1>
        <p className="mx-auto mt-2 max-w-md text-zinc-500">
          {trial === null
            ? "Your free month has been used, so billing starts today. Cancel anytime. Prices excl. VAT."
            : trialEnd
              ? `Your trial continues until ${trialEnd}. No charge today, cancel anytime. Prices excl. VAT.`
              : trial !== "unknown"
                ? "Your first month is free. No charge today, cancel anytime. Prices excl. VAT."
                : "New accounts get their first month free. Cancel anytime. Prices excl. VAT."}
        </p>
      </div>

      {/* Cycle toggle */}
      <div className="mb-7 flex justify-center">
        <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1 text-sm shadow-sm">
          {(["monthly", "yearly"] as Cycle[]).map((c) => {
            const active = cycle === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                className="relative rounded-full px-5 py-2 font-semibold transition"
                style={
                  active
                    ? { background: BRAND, color: "#fff" }
                    : { background: "transparent", color: "#52525b" }
                }
              >
                {c === "monthly" ? "Monthly" : "Yearly"}
                {c === "yearly" && (
                  <span
                    className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={
                      active
                        ? { background: "rgba(255,255,255,0.25)", color: "#fff" }
                        : { background: `${BRAND}14`, color: BRAND }
                    }
                  >
                    −{YEARLY_SAVING}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plan cards (selectable) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(Object.keys(PLANS) as Tier[]).map((t) => {
          const p = PLANS[t];
          const active = t === tier;
          const tierPrice = cycle === "yearly" ? p.yearly : p.monthly;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              aria-pressed={active}
              className="relative rounded-3xl border p-6 text-left transition focus:outline-none"
              style={{
                borderColor: active ? BRAND : "#e4e4e7",
                background: active
                  ? `linear-gradient(180deg, ${BRAND}0A, #ffffff 60%)`
                  : "#ffffff",
                boxShadow: active
                  ? `0 10px 30px -12px ${BRAND}55`
                  : "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              {p.popular && (
                <span
                  className="absolute -top-3 left-6 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ background: BRAND }}
                >
                  Most popular
                </span>
              )}
              {/* selected radio dot */}
              <span
                className="absolute right-6 top-6 flex h-5 w-5 items-center justify-center rounded-full border-2"
                style={{ borderColor: active ? BRAND : "#d4d4d8" }}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full" style={{ background: BRAND }} />}
              </span>

              <h3 className="font-[family-name:var(--font-archivo)] text-xl font-black text-zinc-900">
                {p.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">{p.tagline}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-archivo)] text-4xl font-black text-zinc-900">
                  €{tierPrice}
                </span>
                <span className="text-sm font-medium text-zinc-500">/mo excl. VAT</span>
              </div>
              {cycle === "yearly" && (
                <p className="mt-0.5 text-xs text-zinc-400">billed €{p.yearly * 12}/yr</p>
              )}

              <ul className="mt-5 space-y-2.5 border-t border-zinc-100 pt-5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
                    <span className="mt-0.5 shrink-0" style={{ color: BRAND }}>
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Extra team members — Pro only; past three, Contractor is cheaper. */}
      {tier === "pro" && (
        <div className="mt-4 flex items-center justify-between rounded-3xl border border-zinc-200 bg-white px-6 py-4 shadow-sm">
          <div>
            <p className="font-semibold text-zinc-900">Extra team members</p>
            <p className="text-sm text-zinc-500">
              {PRICING.pro.seatsIncluded} included · €{seatPrice}/mo each, up to {PRICING.extraSeat.maxExtra} more
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="One fewer" onClick={() => setExtraSeats((n) => Math.max(0, n - 1))}
              className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-bold text-zinc-700 disabled:opacity-40" disabled={extraSeats === 0}>−</button>
            <span className="w-6 text-center text-lg font-bold text-zinc-900" aria-live="polite">{extraSeats}</span>
            <button type="button" aria-label="One more" onClick={() => setExtraSeats((n) => Math.min(PRICING.extraSeat.maxExtra, n + 1))}
              className="h-9 w-9 rounded-full border border-zinc-300 text-lg font-bold text-zinc-700 disabled:opacity-40" disabled={extraSeats === PRICING.extraSeat.maxExtra}>+</button>
          </div>
        </div>
      )}

      {/* Checkout / auth panel */}
      <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">You selected</p>
            <p className="font-[family-name:var(--font-archivo)] text-lg font-black text-zinc-900">
              Vasco {plan.name}
            </p>
          </div>
          <div className="text-right">
            <p className="font-[family-name:var(--font-archivo)] text-2xl font-black text-zinc-900">
              €{price}
              <span className="text-sm font-medium text-zinc-500">/mo excl. VAT</span>
            </p>
            {cycle === "yearly" && <p className="text-xs text-zinc-400">€{annualTotal} billed yearly</p>}
          </div>
        </div>

        {checkingSession ? (
          <p className="py-2 text-center text-sm text-zinc-500">Loading…</p>
        ) : sessionEmail ? (
          <>
            <p className="mb-4 text-sm text-zinc-600">
              Signed in as <span className="font-semibold text-zinc-900">{sessionEmail}</span>
            </p>
            <button
              type="button"
              onClick={startCheckout}
              disabled={redirecting}
              className="w-full rounded-2xl px-6 py-3.5 font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-60"
              style={{ background: BRAND, boxShadow: `0 8px 24px -10px ${BRAND}99` }}
            >
              {redirecting ? "Redirecting to secure checkout…" : trial && trial !== "unknown" ? "Start free trial →" : "Continue to checkout →"}
            </button>
            <p className="mt-3 text-center text-xs text-zinc-400">
              {trial === null
                ? `€${price}/mo excl. VAT, billed from today. Cancel anytime.`
                : trialEnd
                  ? `Free until ${trialEnd}, then €${price}/mo excl. VAT. Cancel before then and pay nothing.`
                  : trial !== "unknown"
                    ? `Free for the first month, then €${price}/mo excl. VAT. Cancel before then and pay nothing.`
                    : `€${price}/mo excl. VAT. Checkout shows any free time your account still has.`}
            </p>
            {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <form onSubmit={handleSignIn}>
            <p className="mb-4 text-sm text-zinc-600">Sign in with your Vasco account to continue.</p>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none transition focus:ring-2"
                style={{ ["--tw-ring-color" as string]: BRAND }}
                placeholder="you@example.com"
              />
            </label>
            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-medium text-zinc-500">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-zinc-900 outline-none transition focus:ring-2"
                style={{ ["--tw-ring-color" as string]: BRAND }}
                placeholder="••••••••"
              />
            </label>
            <button
              type="submit"
              disabled={signingIn}
              className="w-full rounded-2xl px-6 py-3.5 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
              style={{ background: "#18181b" }}
            >
              {signingIn ? "Signing in…" : "Sign in & continue"}
            </button>
            {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
            <p className="mt-4 text-center text-xs text-zinc-500">
              <a href="/billing" className="underline underline-offset-2">
                Manage an existing subscription
              </a>
            </p>
          </form>
        )}
      </div>

      <TrustRow />

      <p className="mt-6 text-center text-xs text-zinc-400">
        Prices excl. {country === "us" ? "sales tax" : "VAT"}; it is added at checkout based on your billing address.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF7F2] via-[#F9FAFB] to-[#F9FAFB]">
      <BillingHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">{children}</main>
      <BillingFooter />
    </div>
  );
}

export default function BillingUpgradePage() {
  return (
    <Suspense fallback={<p className="px-6 py-16 text-center text-sm text-zinc-500">Loading…</p>}>
      <UpgradeInner />
    </Suspense>
  );
}
