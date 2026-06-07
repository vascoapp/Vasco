import type { Metadata } from "next";
import { BillingHeader, BillingFooter, BRAND } from "../../../components/BillingChrome";

export const metadata: Metadata = {
  title: "Subscription activated — Vasco",
  robots: { index: false, follow: false },
};

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF7F2] via-[#F9FAFB] to-[#F9FAFB]">
      <BillingHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white text-center shadow-sm">
          <div className="px-8 pt-10" style={{ background: `linear-gradient(180deg, ${BRAND}10, #ffffff)` }}>
            <div
              className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-3xl text-white"
              style={{ background: BRAND, boxShadow: `0 10px 30px -8px ${BRAND}99` }}
            >
              ✓
            </div>
            <h1 className="font-[family-name:var(--font-archivo)] text-2xl font-black text-zinc-900">
              You&apos;re all set
            </h1>
          </div>
          <div className="px-8 pb-8 pt-4">
            <p className="mb-7 text-sm text-zinc-600">
              Your Vasco subscription is active and your free trial has started. Open the app to
              start using your new features right away.
            </p>
            <a
              href="vasco://billing/success"
              className="inline-block w-full rounded-2xl px-6 py-3.5 font-bold text-white shadow-sm transition hover:brightness-105"
              style={{ background: BRAND, boxShadow: `0 8px 24px -10px ${BRAND}99` }}
            >
              Open the Vasco app
            </a>
            <p className="mt-5 text-xs text-zinc-400">
              If the button doesn&apos;t open the app, switch to Vasco manually — your subscription is
              already active.
            </p>
          </div>
        </div>
      </main>
      <BillingFooter />
    </div>
  );
}
