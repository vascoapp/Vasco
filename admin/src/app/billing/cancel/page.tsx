import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout cancelled — Vasco",
  robots: { index: false, follow: false },
};

export default function BillingCancelPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-3xl text-zinc-400">
          ×
        </div>
        <h1 className="mb-3 text-2xl font-bold text-zinc-900">
          Checkout cancelled
        </h1>
        <p className="mb-8 text-zinc-600">
          No charge was made. You can re-open Vasco and try again whenever
          you&apos;re ready.
        </p>
        <a
          href="vasco://billing/cancel"
          className="inline-block rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-zinc-800"
        >
          Open Vasco app
        </a>
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        Need help choosing a plan? Email{" "}
        <a href="mailto:support@vascobuild.com" className="underline">
          support@vascobuild.com
        </a>
      </p>
    </main>
  );
}
