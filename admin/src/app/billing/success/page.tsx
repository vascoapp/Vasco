import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscription activated — Vasco",
  robots: { index: false, follow: false },
};

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#F97316]/10 text-3xl">
          ✓
        </div>
        <h1 className="mb-3 text-2xl font-bold text-zinc-900">
          Subscription activated
        </h1>
        <p className="mb-8 text-zinc-600">
          Your Vasco subscription is now active. Open the Vasco app to start
          using your new features — your contractor account has been upgraded.
        </p>
        <a
          href="vasco://billing/success"
          className="inline-block rounded-xl bg-[#F97316] px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
        >
          Open Vasco app
        </a>
        <p className="mt-6 text-xs text-zinc-500">
          If the button doesn&apos;t open the app, switch to Vasco manually —
          your subscription is already active.
        </p>
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        Questions? Email{" "}
        <a href="mailto:support@vascobuild.com" className="underline">
          support@vascobuild.com
        </a>
      </p>
    </main>
  );
}
