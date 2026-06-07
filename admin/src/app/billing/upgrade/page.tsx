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

type Tier = "pro" | "contractor";
type Cycle = "monthly" | "yearly";

// Indicative display prices (EUR). The actual charge comes from the Stripe
// Price IDs configured on the edge function — these are for the picker only.
const PLANS: Record<
  Tier,
  {
    name: string;
    tagline: string;
    monthly: number;
    yearly: number;
    popular?: boolean;
    features: string[];
  }
> = {
  pro: {
    name: "Pro",
    tagline: "For solo contractors running on autopilot",
    monthly: 39,
    yearly: 29,
    popular: true,
    features: [
      "Unlimited jobs, quotes & invoices",
      "Full EVE AI — Agent, Auditor & Analyst",
      "Purchasing agent & ML predictions",
      "Cross-contractor price benchmarking",
    ],
  },
  contractor: {
    name: "Contractor",
    tagline: "For teams that need seats & integrations",
    monthly: 69,
    yearly: 49,
    features: [
      "Everything in Pro",
      "Up to 15 team seats",
      "API access & white-label portal",
      "Subcontractor portal + priority support",
    ],
  },
};

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

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

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
        body: { tier, billingCycle: cycle },
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
  const price = cycle === "yearly" ? plan.yearly : plan.monthly;
  const annualTotal = useMemo(() => plan.yearly * 12, [plan.yearly]);

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
          Start with a 14-day free trial. No charge today, cancel anytime.
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
                    −25%
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
                <span className="text-sm font-medium text-zinc-500">/mo</span>
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
              <span className="text-sm font-medium text-zinc-500">/mo</span>
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
              {redirecting ? "Redirecting to secure checkout…" : "Start free trial →"}
            </button>
            <p className="mt-3 text-center text-xs text-zinc-400">
              Free for 14 days, then €{price}/mo. Cancel anytime before then and pay nothing.
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
        {country === "us" ? "Sales tax" : "VAT"} is calculated at checkout based on your billing address.
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
