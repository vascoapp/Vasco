import type { Metadata } from "next";
import { BillingHeader, BillingFooter, BRAND } from "../../../components/BillingChrome";

export const metadata: Metadata = {
  title: "Checkout cancelled — Vasco",
  robots: { index: false, follow: false },
};

export default function BillingCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF7F2] via-[#F9FAFB] to-[#F9FAFB]">
      <BillingHeader />
      <main className="mx-auto max-w-md px-6 py-16">
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white text-center shadow-sm">
          <div className="px-8 pt-10">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-3xl text-zinc-400">
              ×
            </div>
            <h1 className="font-[family-name:var(--font-archivo)] text-2xl font-black text-zinc-900">
              Checkout cancelled
            </h1>
          </div>
          <div className="px-8 pb-8 pt-4">
            <p className="mb-7 text-sm text-zinc-600">
              No charge was made. You can pick a plan whenever you&apos;re ready — your free trial is
              still waiting.
            </p>
            <a
              href="/billing/upgrade"
              className="inline-block w-full rounded-2xl px-6 py-3.5 font-bold text-white shadow-sm transition hover:brightness-105"
              style={{ background: BRAND, boxShadow: `0 8px 24px -10px ${BRAND}99` }}
            >
              Back to plans
            </a>
            <a
              href="vasco://billing/cancel"
              className="mt-3 inline-block w-full rounded-2xl border border-zinc-200 px-6 py-3 text-center font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Open the Vasco app
            </a>
          </div>
        </div>
      </main>
      <BillingFooter />
    </div>
  );
}
